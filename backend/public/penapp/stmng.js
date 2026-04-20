// ============================================================
//  public/penapp/stmng.js  — Storage Manager
//
//  Connects the Proctopen grid app to the InkSentinel backend.
//  All DB reads/writes go through here — the rest of app.js
//  should never call fetch() directly.
//
//  Usage: import * as DB from './stmng.js'
//
//  Functions:
//    DB.searchStudents(query, page)   → paginated student list
//    DB.getStudent(studentId)         → single student detail
//    DB.getActiveSession()            → current exam session
//    DB.assignStudentToSeat(...)      → PATCH session_feeds
//    DB.removeStudentFromSeat(sfId)   → PATCH session_feeds
//    DB.getFeedByCameraId(camId)      → feed row for cam_id
//    DB.pollAlerts(sessionId)         → recent detections for grid
//    DB.logSignal(cmd, params)        → write to signals via API
//
//  The backend runs at BASE_URL (same origin by default).
//  If the penapp is served from a different port, set BASE_URL.
// ============================================================

const BASE_URL = window.location.origin; // e.g. http://192.168.43.1:3000

// ── Internal fetch wrapper ────────────────────────────────────
// Attaches cookies automatically (same-origin credential).
// Returns parsed JSON or throws on HTTP error.
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    credentials: 'include', // send JWT cookie
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (res.status === 401) {
    // JWT expired — redirect to login
    window.location.href = '/login';
    throw new Error('Unauthenticated');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ────────────────────────────────────────────────────────────
//  STUDENTS
// ────────────────────────────────────────────────────────────

/**
 * Search students by name or student_id.
 * @param {string}  q     — search query (empty = all)
 * @param {number}  page  — 1-indexed page number
 * @param {number}  limit — rows per page (default 20)
 * @returns {{ students: [], pagination: {} }}
 */
export async function searchStudents(q = '', page = 1, limit = 20) {
  const params = new URLSearchParams({ q, page, limit });
  return apiFetch(`/api/students?${params}`);
}

/**
 * Get full detail for one student including all enrollments.
 * @param {string} studentId — institutional ID e.g. '2212345678'
 */
export async function getStudent(studentId) {
  return apiFetch(`/api/students/${encodeURIComponent(studentId)}`);
}

// ────────────────────────────────────────────────────────────
//  SESSIONS
// ────────────────────────────────────────────────────────────

/**
 * Get the currently active exam session.
 * Returns { session: {...} } or { session: null }
 */
export async function getActiveSession() {
  return apiFetch('/api/sessions/active');
}

/**
 * Get attendance list for a session.
 * Returns { attendance: [{id, feed_id, feed_label, candidate_name,
 *            student_id, connected_at, alert_count}] }
 */
export async function getAttendance(sessionId) {
  return apiFetch(`/api/sessions/${sessionId}/attendance`);
}

// ────────────────────────────────────────────────────────────
//  SEAT ASSIGNMENTS
// ────────────────────────────────────────────────────────────

/**
 * Assign a student to a seat in the active session.
 * Calls PATCH /api/sessions/:id/attendance/:sfId
 * @param {number} sessionId     — exam_sessions.id
 * @param {number} sfId          — session_feeds.id
 * @param {string} candidateName — display name
 * @param {string} studentDbId   — students.student_id
 */
export async function assignStudentToSeat(sessionId, sfId, candidateName, studentDbId) {
  // Look up the students.id (PK integer) from student_id string
  let studentPkId = null;
  if (studentDbId) {
    try {
      const data = await getStudent(studentDbId);
      studentPkId = data.student?.id || null;
    } catch (_) {}
  }

  return apiFetch(`/api/sessions/${sessionId}/attendance/${sfId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      candidate_name: candidateName || null,
      student_id:     studentPkId,
    }),
  });
}

/**
 * Remove a student from a seat (clears name + student_id link).
 */
export async function removeStudentFromSeat(sessionId, sfId) {
  return apiFetch(`/api/sessions/${sessionId}/attendance/${sfId}`, {
    method: 'PATCH',
    body: JSON.stringify({ candidate_name: null, student_id: null }),
  });
}

// ────────────────────────────────────────────────────────────
//  CAMERA / FEEDS
// ────────────────────────────────────────────────────────────

/**
 * Find a feed row by camera_id (the short code shown on camera page).
 * Returns { feed: {...} } or { feed: null }
 */
export async function getFeedByCameraId(camId) {
  if (!camId) return { feed: null };
  try {
    const feeds = await apiFetch('/api/feeds');
    const feed  = feeds.find(f => f.camera_id === camId.trim().toUpperCase()) || null;
    return { feed };
  } catch (err) {
    console.error('[stmng] getFeedByCameraId error:', err.message);
    return { feed: null };
  }
}

/**
 * Get all current feeds (for dashboard status).
 */
export async function getFeeds() {
  return apiFetch('/api/feeds');
}

// ────────────────────────────────────────────────────────────
//  ALERT POLLING
// ────────────────────────────────────────────────────────────

/**
 * Fetch recent detections for a session.
 * Call this every few seconds to colour grid card borders.
 *
 * @param {number} sessionId
 * @param {number} sinceMs — only return detections newer than Date.now()-sinceMs
 * @returns {{ alerts: [{feed_id, class_label, confidence, detected_at}] }}
 *
 * Returns a Map<feed_id, maxConfidence> for easy lookup in renderGrid().
 */
export async function pollAlerts(sessionId, sinceMs = 30000) {
  const data      = await apiFetch(`/api/incidents?sessionId=${sessionId}`);
  const cutoff    = Date.now() - sinceMs;
  const alertMap  = new Map(); // feed_id → highest recent confidence

  (data.incidents || []).forEach(inc => {
    const ts = new Date(inc.detected_at).getTime();
    if (ts < cutoff) return;
    const feedId = inc.feed_id;
    const prev   = alertMap.get(feedId) || 0;
    if (inc.confidence > prev) alertMap.set(feedId, inc.confidence);
  });

  return alertMap; // Map<feed_id, confidence 0..1>
}

// ────────────────────────────────────────────────────────────
//  SIGNALS
// ────────────────────────────────────────────────────────────

/**
 * Log a signal to the InkSentinel signals table.
 * The penapp already sends via USB/BLE/WiFi — this logs it to the DB.
 * Mirrors what signals.js does for the proctor candidate page.
 *
 * @param {string} cmd     — e.g. 'start', 'warn', 'disable'
 * @param {object} params  — e.g. { device_id: 1, punish_ms: 60000 }
 */
export async function logSignal(cmd, params = {}) {
  return apiFetch('/api/signal', {
    method: 'POST',
    body:   JSON.stringify({ cmd, ...params }),
  }).catch(err => {
    // Non-fatal — pen command already sent via hardware transport
    console.warn('[stmng] logSignal failed (non-fatal):', err.message);
    return null;
  });
}

// ────────────────────────────────────────────────────────────
//  WEBSOCKET — live camera frames
// ────────────────────────────────────────────────────────────

/**
 * Open a dashboard-role WebSocket to the InkSentinel backend.
 * Returns the WebSocket object — caller attaches onmessage handler.
 *
 * The WS streams binary JPEG frames: [4-byte feedId][jpeg bytes]
 * and JSON events: {type:'feed_connected'|'feed_disconnected'|'detection'|'signal_ack'}
 */
export function openDashboardWS() {
  const url = `${BASE_URL.replace('http','ws').replace('https','wss')}/ws?role=dashboard`;
  const ws  = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  return ws;
}