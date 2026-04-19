# yolo_server.py
# FastAPI server that wraps the YOLO model.
# Designed to run on the same machine as Node.js (or via ngrok on Google Colab).
#
# Key design decisions:
#   - Model loaded ONCE at startup (lifespan context) — not per-request
#   - /infer accepts raw JPEG bytes (Content-Type: image/jpeg) — no base64 overhead on input
#   - Annotated image returned as base64 JSON — avoids multipart complexity for Node.js
#   - /health endpoint lets Node.js verify connectivity on startup
#   - Confidence threshold configurable via env var

import os
import base64
import asyncio
from contextlib import asynccontextmanager
from typing import List

import cv2
import numpy as np
import supervision as sv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from ultralytics import YOLO
from pydantic import BaseModel

# ── Config ─────────────────────────────────────────────────────────────────────
MODEL_PATH          = os.getenv("YOLO_MODEL_PATH", "best.pt")
CONFIDENCE_THRESHOLD = float(os.getenv("YOLO_CONF_THRESHOLD", "0.30"))
HOST                = os.getenv("HOST", "0.0.0.0")
PORT                = int(os.getenv("PORT", "8000"))

CHEATING_CLASSES = {"phone", "cheatsheet", "looking_away", "cheating"}

# ── Global model state ─────────────────────────────────────────────────────────
# Stored at module level so it survives across requests.
_model: YOLO | None             = None
_box_annotator: sv.BoxAnnotator | None   = None
_label_annotator: sv.LabelAnnotator | None = None

# ── Lifespan (replaces deprecated @app.on_event("startup")) ───────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup; release on shutdown."""
    global _model, _box_annotator, _label_annotator
    print(f"[YOLO] Loading model from '{MODEL_PATH}' …")
    # Run in executor so we don't block the event loop during startup
    loop = asyncio.get_event_loop()
    _model = await loop.run_in_executor(None, YOLO, MODEL_PATH)
    _box_annotator   = sv.BoxAnnotator()
    _label_annotator = sv.LabelAnnotator()
    print(f"[YOLO] Model ready. Classes: {list(_model.names.values())}")
    yield
    # Cleanup (nothing needed for YOLO)
    print("[YOLO] Server shutting down.")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="InkSentinel YOLO API", lifespan=lifespan)


# ── Response schema ────────────────────────────────────────────────────────────
class DetectionItem(BaseModel):
    class_: str
    confidence: float

    class Config:
        # Rename `class_` → `class` in JSON output (class is a reserved word in Python)
        fields = {"class_": "class"}


class InferResponse(BaseModel):
    detections: list
    detection_count: int
    annotated_image: str | None   # base64-encoded JPEG, or null if no detections


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_PATH}


@app.post("/infer")
async def infer(request: Request):
    """
    Accepts raw JPEG bytes (Content-Type: image/jpeg).
    Returns JSON with detections and optional base64 annotated image.
    """
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Empty request body")

    # ── Decode JPEG ──────────────────────────────────────────────────────────
    nparr = np.frombuffer(body, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Could not decode JPEG")

    # ── Run inference (in executor to avoid blocking async loop) ─────────────
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, _run_yolo, frame)

    detections_sv = sv.Detections.from_ultralytics(results)
    detections_sv = detections_sv[detections_sv.confidence >= CONFIDENCE_THRESHOLD]

    # ── Build detection list ─────────────────────────────────────────────────
    detection_count = len(detections_sv)
    detections_out  = []

    if detection_count > 0:
        for class_id, conf in zip(detections_sv.class_id, detections_sv.confidence):
            detections_out.append({
                "class":      _model.names[class_id],
                "confidence": round(float(conf), 4),
            })

    # ── Annotate frame only when detections exist ────────────────────────────
    annotated_b64 = None
    if detection_count > 0:
        labels = [
            f"{_model.names[cid]} {conf:.2f}"
            for cid, conf in zip(detections_sv.class_id, detections_sv.confidence)
        ]

        annotated = _box_annotator.annotate(scene=frame.copy(), detections=detections_sv)
        annotated = _label_annotator.annotate(scene=annotated, detections=detections_sv, labels=labels)

        # Draw alert overlay banner if cheating class detected
        _draw_overlay(annotated, detections_out)

        # Encode back to JPEG then base64
        success, jpeg_bytes = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if success:
            annotated_b64 = base64.b64encode(jpeg_bytes.tobytes()).decode("utf-8")

    return JSONResponse({
        "detections":      detections_out,
        "detection_count": detection_count,
        "annotated_image": annotated_b64,   # null when no detections (save bandwidth)
    })


# ── Helpers ────────────────────────────────────────────────────────────────────

def _run_yolo(frame: np.ndarray):
    """Synchronous YOLO inference — called from executor."""
    return _model(frame, verbose=False)[0]


def _draw_overlay(frame: np.ndarray, detections: list) -> None:
    """Draw a status banner matching the standalone script's behaviour."""
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


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("yolo_server:app", host=HOST, port=PORT, reload=False, workers=1)
