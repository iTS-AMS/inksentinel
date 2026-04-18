// inferenceClient.js
// Sends JPEG frames to the Python YOLO server and returns detections + annotated image.
//
// Contract (matches server_v2.py):
//   POST /infer
//     Body:    raw JPEG bytes (Content-Type: image/jpeg)
//     Returns: JSON {
//       "detection_count": int,
//       "detections": [{"class": str, "confidence": float}],
//       "annotated_image": "<base64 JPEG or null>"
//     }
//
//   GET /health → {"status": "ok", "classes": {...}}
//
// Design:
//   - Single endpoint — no separate /infer-annotated round trip
//   - 4s timeout — tight enough to drop stale frames on slow CPU
//   - Returns typed InferenceResult so wsHandler can pattern-match cleanly
//   - Throttle is handled in wsHandler via isProcessing + SAMPLE_INTERVAL_MS

import 'dotenv/config';

// YOLO_API_URL in .env — points to localhost:9999 or ngrok tunnel
// Note: port 9999 (matches server_v2.py), NOT 8000 from AI friend's env
const YOLO_BASE  = process.env.YOLO_API_URL || 'http://localhost:9999';
const INFER_URL  = `${YOLO_BASE}/infer`;
const TIMEOUT_MS = process.env.YOLO_TIMEOUT_MS
  ? Number(process.env.YOLO_TIMEOUT_MS)
  : 4000;

/**
 * @typedef {Object} Detection
 * @property {string} class
 * @property {number} confidence
 */

/**
 * @typedef {Object} InferenceResult
 * @property {boolean}     ok
 * @property {Detection[]} detections
 * @property {number}      detection_count
 * @property {Buffer|null} annotatedFrame  - decoded JPEG, null if no detections
 * @property {string|null} error
 */

/**
 * Send one JPEG frame to the YOLO API.
 * @param  {Buffer} jpegBuffer
 * @returns {Promise<InferenceResult>}
 */
export async function runInference(jpegBuffer) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(INFER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body:    jpegBuffer,
      signal:  controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`YOLO API returned ${response.status}: ${text}`);
    }

    const json = await response.json();

    // Decode base64 annotated image — null when no detections
    let annotatedFrame = null;
    if (json.annotated_image) {
      annotatedFrame = Buffer.from(json.annotated_image, 'base64');
    }

    return {
      ok:              true,
      detections:      json.detections      ?? [],
      detection_count: json.detection_count ?? 0,
      annotatedFrame,
      error:           null,
    };

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    const msg       = isTimeout
      ? `YOLO inference timed out after ${TIMEOUT_MS}ms`
      : `YOLO inference error: ${err.message}`;

    console.warn(`[Inference] ${msg}`);

    return {
      ok:              false,
      detections:      [],
      detection_count: 0,
      annotatedFrame:  null,
      error:           msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Health-check the YOLO API on startup.
 * @returns {Promise<boolean>}
 */
export async function checkYoloHealth() {
  try {
    const res = await fetch(`${YOLO_BASE}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[Inference] YOLO API reachable ✓ — classes: ${Object.values(data.classes).join(', ')}`);
      return true;
    }
  } catch (_) {}
  console.warn('[Inference] YOLO API NOT reachable — inference disabled until it comes up');
  return false;
}