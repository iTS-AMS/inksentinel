# yolo_server.py
# FastAPI server that wraps two YOLO models:
#   1. Trained detection model (best.pt)  — detects cheating objects/behaviour
#   2. YOLOv8 pose model (yolov8n-pose.pt) — detects head direction (looking away)
#
# Dual-agreement rule:
#   Detections are only emitted when BOTH models agree the person is cheating.
#   - Detection model must flag at least one cheating-class object (phone,
#     cheatsheet, cheating, looking_away from its own classes).
#   - Pose model must independently confirm the head is looking away/up.
#   If only one model fires, the frame is treated as clean — no output.
#   This eliminates false positives from either model acting alone.
#
# Head direction logic (pose model):
#   Uses nose + ear keypoints from the pose model.
#   If nose is significantly to the left/right of centre (looking sideways),
#   or nose is ABOVE both ears (looking up), the pose model flags looking_away.
#
# Key design decisions (preserved from original):
#   - Both models loaded ONCE at startup (lifespan context)
#   - /infer accepts raw JPEG bytes (Content-Type: image/jpeg)
#   - Annotated image returned as base64 JSON
#   - /health endpoint returns classes from both models
#   - Confidence threshold configurable via env var

import os
import base64
import asyncio
import math
from contextlib import asynccontextmanager

import cv2
import numpy as np
import supervision as sv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from ultralytics import YOLO

# ── Config ──────────────────────────────────────────────────────────────────────
MODEL_PATH           = os.getenv("YOLO_MODEL_PATH",  "best.pt")
POSE_MODEL_PATH      = os.getenv("YOLO_POSE_PATH",   "yolov8n-pose.pt")
CONFIDENCE_THRESHOLD = float(os.getenv("YOLO_CONF_THRESHOLD", "0.30"))
HOST                 = os.getenv("HOST", "0.0.0.0")
PORT                 = int(os.getenv("YOLO_PORT", "9999"))

CHEATING_CLASSES = {"phone", "cheatsheet", "looking_away", "cheating"}

# ── Pose keypoint indices (COCO 17-point skeleton) ──────────────────────────────
# 0=nose  1=left_eye  2=right_eye  3=left_ear  4=right_ear
KP_NOSE      = 0
KP_LEFT_EAR  = 3
KP_RIGHT_EAR = 4

# Tuning — how far the nose must shift relative to the head width to trigger
SIDEWAYS_RATIO_THRESHOLD = float(os.getenv("POSE_SIDEWAYS_RATIO", "0.30"))
# How far nose y must be ABOVE the ear midpoint (as fraction of head height) to trigger
LOOKUP_RATIO_THRESHOLD   = float(os.getenv("POSE_LOOKUP_RATIO",   "0.15"))
# Minimum keypoint confidence to trust the keypoint
KP_CONF_MIN              = float(os.getenv("POSE_KP_CONF_MIN",    "0.40"))

# ── Global model state ──────────────────────────────────────────────────────────
_model:           YOLO | None = None   # trained detection model
_pose_model:      YOLO | None = None   # pose model
_box_annotator:   sv.BoxAnnotator   | None = None
_label_annotator: sv.LabelAnnotator | None = None

# ── Lifespan ────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load both models on startup; release on shutdown."""
    global _model, _pose_model, _box_annotator, _label_annotator

    loop = asyncio.get_event_loop()

    print(f"[YOLO] Loading detection model from '{MODEL_PATH}' …")
    _model = await loop.run_in_executor(None, YOLO, MODEL_PATH)
    print(f"[YOLO] Detection model ready. Classes: {list(_model.names.values())}")

    print(f"[YOLO] Loading pose model from '{POSE_MODEL_PATH}' …")
    # On Windows, ultralytics may fail with OSError if the weights file doesn't
    # exist locally yet. Explicitly trigger the download before calling YOLO().
    def _load_pose():
        import urllib.request, pathlib
        pt = pathlib.Path(POSE_MODEL_PATH)
        if not pt.exists() or pt.stat().st_size < 1_000_000:
            url = f"https://github.com/ultralytics/assets/releases/download/v8.3.0/{pt.name}"
            print(f"[YOLO] Downloading pose weights from {url} …")
            urllib.request.urlretrieve(url, str(pt))
            print(f"[YOLO] Download complete ({pt.stat().st_size // 1024} KB)")
        return YOLO(str(pt))
    _pose_model = await loop.run_in_executor(None, _load_pose)
    print(f"[YOLO] Pose model ready.")

    _box_annotator   = sv.BoxAnnotator()
    _label_annotator = sv.LabelAnnotator()

    yield

    print("[YOLO] Server shutting down.")

# ── App ─────────────────────────────────────────────────────────────────────────
app = FastAPI(title="InkSentinel YOLO API", lifespan=lifespan)


# ── Routes ──────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    # Return classes from both models so inferenceClient.js health-check works
    detection_classes = _model.names      if _model      else {}
    pose_classes      = _pose_model.names if _pose_model else {}
    return {
        "status":           "ok",
        "model":            MODEL_PATH,
        "pose_model":       POSE_MODEL_PATH,
        "classes":          detection_classes,
        "pose_classes":     pose_classes,
    }


@app.post("/infer")
async def infer(request: Request):
    """
    Accepts raw JPEG bytes (Content-Type: image/jpeg).
    Returns JSON with detections and optional base64 annotated image.
    Output shape is identical to the original single-model version.
    """
    if _model is None or _pose_model is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty request body")

    # ── Decode JPEG ─────────────────────────────────────────────────────────────
    nparr = np.frombuffer(body, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode JPEG")

    loop = asyncio.get_event_loop()

    # ── Run both models concurrently in executor ─────────────────────────────────
    det_task  = loop.run_in_executor(None, _run_detection, frame)
    pose_task = loop.run_in_executor(None, _run_pose,      frame)
    det_results, pose_results = await asyncio.gather(det_task, pose_task)

    # ── Process detection model results ─────────────────────────────────────────
    detections_sv = sv.Detections.from_ultralytics(det_results)
    detections_sv = detections_sv[detections_sv.confidence >= CONFIDENCE_THRESHOLD]

    det_model_out = []
    for class_id, conf in zip(detections_sv.class_id, detections_sv.confidence):
        det_model_out.append({
            "class":      _model.names[class_id],
            "confidence": round(float(conf), 4),
        })

    # ── Process pose results — extract head direction per person ─────────────────
    pose_detections = _analyse_pose(pose_results, frame.shape)

    # ── Dual-agreement gate ──────────────────────────────────────────────────────
    # Both models must agree before we emit any detections.
    #
    # det_model_cheating → detection model found at least one cheating-class object
    # pose_looking_away  → pose model found at least one person looking away/up
    #
    # Only when BOTH are true do we pass detections downstream.
    # If only one fires, the frame is treated as clean — empty output.
    det_model_cheating = any(d["class"] in CHEATING_CLASSES for d in det_model_out)
    pose_looking_away  = len(pose_detections) > 0

    both_agree = det_model_cheating and pose_looking_away

    detections_out  = det_model_out   if both_agree else []
    pose_to_draw    = pose_detections if both_agree else []
    detection_count = len(detections_out)

    # ── Annotate frame ───────────────────────────────────────────────────────────
    # Always draw the pose skeleton so the operator can see head direction live
    # (green = clean, red = both models agree on cheating).
    # Detection boxes and the alert banner are only drawn when both_agree.
    annotated_b64 = None
    has_anything_to_show = len(detections_sv) > 0 or len(pose_detections) > 0
    if has_anything_to_show:
        annotated = frame.copy()

        # Draw detection boxes only when both agree
        if both_agree and len(detections_sv) > 0:
            labels = [
                f"{_model.names[cid]} {conf:.2f}"
                for cid, conf in zip(detections_sv.class_id, detections_sv.confidence)
            ]
            annotated = _box_annotator.annotate(scene=annotated, detections=detections_sv)
            annotated = _label_annotator.annotate(scene=annotated, detections=detections_sv, labels=labels)

        # Pose skeleton — red if both agree, green if only pose fired
        _draw_pose_annotations(annotated, pose_results, pose_to_draw)

        # Alert banner — only shown when both agree
        _draw_overlay(annotated, detections_out)

        success, jpeg_bytes = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if success:
            annotated_b64 = base64.b64encode(jpeg_bytes.tobytes()).decode("utf-8")

    # ── Return — identical shape to original, nothing downstream changes ─────────
    return JSONResponse({
        "detections":      detections_out,
        "detection_count": detection_count,
        "annotated_image": annotated_b64,   # null when no agreement (saves bandwidth)
    })


# ── Model runners (synchronous — called from executor) ──────────────────────────

def _run_detection(frame: np.ndarray):
    return _model(frame, verbose=False)[0]

def _run_pose(frame: np.ndarray):
    return _pose_model(frame, verbose=False)[0]


# ── Head direction analysis ──────────────────────────────────────────────────────

def _analyse_pose(pose_result, frame_shape: tuple) -> list:
    """
    For each person detected by the pose model, check head direction.
    Returns a list of detection dicts (same shape as detection model output)
    only for people who are looking away or up.

    Keypoints used:
      nose (0), left_ear (3), right_ear (4)

    Logic:
      Sideways: nose x deviates from ear-midpoint x by more than
                SIDEWAYS_RATIO_THRESHOLD × ear-to-ear distance.
      Looking up: nose y is above (smaller than) ear-midpoint y by more than
                  LOOKUP_RATIO_THRESHOLD × ear-to-ear distance.
    """
    results = []

    if pose_result.keypoints is None:
        return results

    # keypoints.data shape: (num_persons, 17, 3)  [x, y, conf]
    kp_data = pose_result.keypoints.data.cpu().numpy()

    for person_kps in kp_data:
        nose      = person_kps[KP_NOSE]
        left_ear  = person_kps[KP_LEFT_EAR]
        right_ear = person_kps[KP_RIGHT_EAR]

        nose_conf  = nose[2]
        l_ear_conf = left_ear[2]
        r_ear_conf = right_ear[2]

        # Need at least nose + one ear to reason about direction
        if nose_conf < KP_CONF_MIN:
            continue
        if l_ear_conf < KP_CONF_MIN and r_ear_conf < KP_CONF_MIN:
            continue

        # Build ear midpoint from whichever ears are visible
        valid_ears = [e for e, c in [(left_ear, l_ear_conf), (right_ear, r_ear_conf)]
                      if c >= KP_CONF_MIN]
        ear_mid_x = float(np.mean([e[0] for e in valid_ears]))
        ear_mid_y = float(np.mean([e[1] for e in valid_ears]))

        # Head width proxy: ear-to-ear distance; fall back to frame width fraction
        if l_ear_conf >= KP_CONF_MIN and r_ear_conf >= KP_CONF_MIN:
            head_scale = float(np.linalg.norm(
                np.array([left_ear[0], left_ear[1]]) - np.array([right_ear[0], right_ear[1]])
            ))
        else:
            head_scale = frame_shape[1] * 0.12   # ~12% of frame width

        if head_scale < 5:   # too small to trust
            continue

        nose_x = float(nose[0])
        nose_y = float(nose[1])

        dx = nose_x - ear_mid_x          # positive = nose right of ears → looking right
        dy = ear_mid_y - nose_y          # positive = nose above ears → looking up

        sideways_ratio = dx / head_scale
        lookup_ratio   = dy / head_scale

        is_sideways   = abs(sideways_ratio) > SIDEWAYS_RATIO_THRESHOLD
        is_looking_up = lookup_ratio       > LOOKUP_RATIO_THRESHOLD

        if is_sideways or is_looking_up:
            # Synthetic confidence: how far past the threshold we are (capped at 0.99)
            if is_looking_up and is_sideways:
                ratio_excess = max(abs(sideways_ratio) - SIDEWAYS_RATIO_THRESHOLD,
                                   lookup_ratio        - LOOKUP_RATIO_THRESHOLD)
            elif is_looking_up:
                ratio_excess = lookup_ratio   - LOOKUP_RATIO_THRESHOLD
            else:
                ratio_excess = abs(sideways_ratio) - SIDEWAYS_RATIO_THRESHOLD

            synthetic_conf = round(min(0.99, 0.50 + ratio_excess * 1.5), 4)

            results.append({
                "class":      "looking_away",
                "confidence": synthetic_conf,
            })

    return results


# ── Pose annotation ──────────────────────────────────────────────────────────────

# Skeleton edges (COCO pairs) — subset: just head + shoulders for clarity
_POSE_EDGES = [
    (KP_NOSE, KP_LEFT_EAR),
    (KP_NOSE, KP_RIGHT_EAR),
]

def _draw_pose_annotations(frame: np.ndarray, pose_result, pose_detections: list) -> None:
    """
    Draw nose + ear keypoints and connecting lines.
    Colours the head markers red if looking_away was flagged for that person,
    green otherwise.
    """
    if pose_result.keypoints is None:
        return

    kp_data    = pose_result.keypoints.data.cpu().numpy()
    flagged    = len(pose_detections) > 0   # simplified: colour all if any flagged
    dot_colour = (0, 0, 220) if flagged else (0, 220, 0)

    for person_kps in kp_data:
        # Draw lines
        for a, b in _POSE_EDGES:
            pa, pb = person_kps[a], person_kps[b]
            if pa[2] >= KP_CONF_MIN and pb[2] >= KP_CONF_MIN:
                cv2.line(frame,
                         (int(pa[0]), int(pa[1])),
                         (int(pb[0]), int(pb[1])),
                         dot_colour, 2)

        # Draw keypoints
        for idx in [KP_NOSE, KP_LEFT_EAR, KP_RIGHT_EAR]:
            kp = person_kps[idx]
            if kp[2] >= KP_CONF_MIN:
                cv2.circle(frame, (int(kp[0]), int(kp[1])), 5, dot_colour, -1)

        # Label nose
        nose = person_kps[KP_NOSE]
        if nose[2] >= KP_CONF_MIN and flagged:
            cv2.putText(frame, "looking away",
                        (int(nose[0]) + 8, int(nose[1]) - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 220), 2)


# ── Alert overlay banner ─────────────────────────────────────────────────────────

def _draw_overlay(frame: np.ndarray, detections: list) -> None:
    """Draw a status banner at the top of the frame."""
    has_cheat = any(d["class"] in CHEATING_CLASSES for d in detections)
    if has_cheat:
        cv2.rectangle(frame, (0, 0), (frame.shape[1], 60), (0, 0, 220), -1)
        cv2.putText(
            frame, "!! CHEATING DETECTED !!",
            (10, 44), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 3
        )
    elif detections:
        cv2.putText(
            frame, "Suspicious Activity",
            (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 165, 255), 3
        )


# ── Entry point ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("yolo_server:app", host=HOST, port=PORT, reload=False, workers=1)
