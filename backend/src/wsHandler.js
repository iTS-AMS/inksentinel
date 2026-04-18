// wsHandler.js v4 — attendance tracking added
import 'dotenv/config';
import { WebSocketServer }                       from 'ws';
import path                                      from 'path';
import { mkdirSync }                             from 'fs';
import { spawn }                                 from 'child_process';
import { FeedRecorder }                          from './recorder.js';
import { getOrCreateFeed, query, getActiveSession } from './db.js';
import { runInference, checkYoloHealth }         from './inferenceClient.js';

const SAMPLE_INTERVAL_MS  = Number(process.env.YOLO_SAMPLE_MS)    || 300;
const CHEAT_THRESHOLD_MS  = Number(process.env.CHEAT_THRESHOLD_MS) || 3000;
const RING_BUFFER_SECONDS = Number(process.env.RING_BUFFER_SEC)    || 30;
const RING_FPS            = 10;
const RING_MAX_FRAMES     = RING_BUFFER_SECONDS * RING_FPS;
const FORCE_RAW_STREAM    = process.env.FORCE_RAW_STREAM === 'true';
const CHEATING_CLASSES    = new Set(['phone', 'cheatsheet', 'looking_away', 'cheating']);

const connectedFeeds   = new Map();
const dashboardClients = new Set();
const feedSessions     = new Map();

class FeedSession {
  constructor(feedId, label, recorder) {
    this.feedId            = feedId;
    this.label             = label;
    this.recorder          = recorder;
    this.sessionId         = null;
    this.isProcessing      = false;
    this.lastProcessedTime = 0;
    this.ringBuffer        = [];
    this.cheatStartTime    = null;
    this.alertFired        = false;
    this.currentDetections = [];
    this.detectionCount    = 0;
    this.showAnnotated     = false;
    this.annotatedFrame    = null;
    this.cheatingActive    = false;
  }

  pushFrame(jpegBuffer, annotated = false) {
    this.ringBuffer.push({ jpegBuffer, annotated, ts: new Date() });
    if (this.ringBuffer.length > RING_MAX_FRAMES) this.ringBuffer.shift();
  }

  updateDetectionState(detections, detectionCount, annotatedFrame) {
    const now          = Date.now();
    const isSuspicious = this._isSuspicious(detections, detectionCount);
    this.currentDetections = detections;
    this.detectionCount    = detectionCount;
    this.annotatedFrame    = annotatedFrame || null;

    if (isSuspicious) {
      if (this.cheatStartTime === null) {
        this.cheatStartTime = now;
        this.alertFired     = false;
        console.log(`[State] Feed ${this.feedId}: suspicious activity started`);
      }
      const elapsed       = now - this.cheatStartTime;
      this.showAnnotated  = true;
      this.cheatingActive = elapsed >= CHEAT_THRESHOLD_MS;
      if (this.cheatingActive && !this.alertFired) {
        this.alertFired = true;
        return { alertTriggered: true };
      }
    } else {
      if (this.cheatStartTime !== null)
        console.log(`[State] Feed ${this.feedId}: suspicious activity ended`);
      this.cheatStartTime = null;
      this.alertFired     = false;
      this.cheatingActive = false;
      this.showAnnotated  = false;
    }
    return { alertTriggered: false };
  }

  _isSuspicious(detections, detectionCount) {
    if (detectionCount === 0) return false;
    if (detections.filter(d => d.class === 'person').length > 1) return true;
    return detections.some(d => CHEATING_CLASSES.has(d.class));
  }
}

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  checkYoloHealth();
  wss.on('connection', (ws, req) => {
    const url   = new URL(req.url, 'http://localhost');
    const role  = url.searchParams.get('role');
    const label = url.searchParams.get('label') || 'Camera';
    if (role === 'feed')      { handleFeedConnection(ws, req, label); return; }
    if (role === 'dashboard') { handleDashboardConnection(ws); return; }
    ws.close(4000, 'Unknown role');
  });
  console.log('[WS] WebSocket server ready on /ws');
  return wss;
}

async function handleFeedConnection(ws, req, label) {
  const clientId = `${req.socket.remoteAddress}_${label}`;
  console.log(`[WS] Feed connecting: "${label}"`);

  let feed;
  try {
    feed = await getOrCreateFeed(clientId, label);
  } catch (err) {
    console.error('[WS] Failed to get/create feed:', err.message);
    ws.close(); return;
  }

  await query('UPDATE feeds SET connected = true WHERE id = $1', [feed.id]);

  // ── Active session + attendance ───────────────────────────
  const activeSession = await getActiveSession();
  const sessionName   = activeSession?.name || null;
  const sessionId     = activeSession?.id   || null;

  if (sessionId) {
    // UPSERT attendance — reconnects don't duplicate
    await query(
      `INSERT INTO session_feeds (session_id, feed_id, feed_label, connected_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, feed_id) DO NOTHING`,
      [sessionId, feed.id, feed.label]
    ).catch(err => console.error('[WS] Attendance insert error:', err.message));
    console.log(`[WS] Attendance: feed "${label}" in session "${sessionName}"`);
  } else {
    console.warn(`[WS] Feed "${label}" — no active session, attendance not recorded`);
  }

  const recorder    = new FeedRecorder(feed.id, feed.label, sessionName, sessionId);
  recorder.start();

  const session     = new FeedSession(feed.id, feed.label, recorder);
  session.sessionId = sessionId;
  feedSessions.set(ws, session);
  connectedFeeds.set(feed.id, ws);

  broadcastJSON({ type: 'feed_connected', feed_id: feed.id, label: feed.label });
  console.log(`[WS] Feed "${label}" ready (id=${feed.id})`);

  ws.on('message', (data, isBinary) => {
    if (!isBinary) return;
    const session = feedSessions.get(ws);
    if (!session) return;
    const jpegBuffer = Buffer.from(data);

    session.recorder.writeFrame(jpegBuffer);
    session.pushFrame(jpegBuffer, false);

    const frameToSend = (!FORCE_RAW_STREAM && session.showAnnotated && session.annotatedFrame)
      ? session.annotatedFrame : jpegBuffer;
    const feedIdBuf = Buffer.alloc(4);
    feedIdBuf.writeUInt32BE(session.feedId, 0);
    broadcastBinary(Buffer.concat([feedIdBuf, frameToSend]));

    broadcastJSON({
      type: 'detection', feed_id: session.feedId,
      detections: session.currentDetections,
      detection_count: session.detectionCount,
      annotated: session.showAnnotated,
      cheating_active: session.cheatingActive,
    });

    if (ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({
          type: 'detection', feed_id: session.feedId,
          detections: session.currentDetections,
          detection_count: session.detectionCount,
        }));
      } catch (_) {}
    }

    _maybeRunInference(session, jpegBuffer);
  });

  ws.on('close', () => {
    const session = feedSessions.get(ws);
    if (session) {
      session.recorder.stop();
      connectedFeeds.delete(session.feedId);
      feedSessions.delete(ws);
      query('UPDATE feeds SET connected = false WHERE id = $1', [session.feedId])
        .catch(err => console.error('[WS] DB disconnect error:', err.message));
      broadcastJSON({ type: 'feed_disconnected', feed_id: session.feedId });
    }
    console.log(`[WS] Feed "${label}" disconnected`);
  });

  ws.on('error', err => console.error(`[WS] Feed "${label}" error:`, err.message));
}

function _maybeRunInference(session, jpegBuffer) {
  const now = Date.now();
  if (now - session.lastProcessedTime < SAMPLE_INTERVAL_MS) return;
  if (session.isProcessing) return;
  session.isProcessing      = true;
  session.lastProcessedTime = now;

  runInference(jpegBuffer).then(async result => {
    if (!result.ok) return;
    const { detections, detection_count, annotatedFrame } = result;
    const { alertTriggered } = session.updateDetectionState(detections, detection_count, annotatedFrame);
    if (annotatedFrame) session.pushFrame(annotatedFrame, true);

    if (detection_count > 0)
      _saveDetections(session.sessionId, session.feedId, detections)
        .catch(err => console.error('[Inference] DB save error:', err.message));

    if (alertTriggered) {
      console.log(`[Alert] Feed ${session.feedId}: confirmed — saving clip`);
      _saveAlertClip(session).catch(err => console.error('[Alert] Clip error:', err.message));
    }

    broadcastJSON({
      type: 'detection', feed_id: session.feedId,
      detections, detection_count,
      annotated: session.showAnnotated,
      cheating_active: session.cheatingActive,
    });
  }).finally(() => { session.isProcessing = false; });
}

async function _saveDetections(sessionId, feedId, detections) {
  for (const det of detections) {
    await query(
      `INSERT INTO detections (session_id, feed_id, detected_at, class_label, confidence)
       VALUES ($1, $2, NOW(), $3, $4)`,
      [sessionId, feedId, det.class, det.confidence]
    );
  }
}

async function _saveAlertClip(session) {
  const frames = [...session.ringBuffer];
  if (!frames.length) return;
  const clipPath = path.join(
    session.recorder.dir,
    `alert_${new Date().toISOString().replace(/[:.]/g,'-')}.mp4`
  );
  await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-f','mjpeg','-framerate',String(RING_FPS),'-i','pipe:0',
      '-c:v','libx264','-preset','fast','-crf','26','-pix_fmt','yuv420p','-y', clipPath
    ], { stdio: ['pipe','ignore','pipe'] });
    ff.stderr.on('data', c => { if (/error/i.test(c.toString())) console.error(`[Alert] ffmpeg: ${c.toString().trim()}`); });
    ff.on('error', reject);
    ff.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg code ${code}`)));
    for (const { jpegBuffer } of frames) ff.stdin.write(jpegBuffer);
    ff.stdin.end();
  });
  console.log(`[Alert] Clip saved: ${clipPath} (${frames.length} frames)`);
  await query(
    `UPDATE detections SET alert_clip_path = $1
     WHERE id = (SELECT id FROM detections WHERE feed_id = $2 ORDER BY detected_at DESC LIMIT 1)`,
    [clipPath, session.feedId]
  ).catch(err => console.error('[Alert] alert_clip_path update:', err.message));
}

function handleDashboardConnection(ws) {
  dashboardClients.add(ws);
  for (const [feedId] of connectedFeeds) {
    const s = [...feedSessions.values()].find(s => s.feedId === feedId);
    if (s) {
      try { ws.send(JSON.stringify({ type: 'feed_connected', feed_id: feedId, label: s.label })); }
      catch (_) {}
    }
  }
  ws.on('message', data => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'signal') {
        const feedWs = connectedFeeds.get(Number(msg.feedId));
        if (feedWs?.readyState === 1)
          feedWs.send(JSON.stringify({ type: 'signal', signal: msg.signal }));
      }
    } catch (_) {}
  });
  ws.on('close', () => dashboardClients.delete(ws));
  ws.on('error', () => dashboardClients.delete(ws));
}

function broadcastJSON(data) {
  const msg = JSON.stringify(data);
  for (const client of [...dashboardClients]) {
    if (client.readyState === 1) {
      try { client.send(msg); } catch (_) { dashboardClients.delete(client); }
    }
  }
}

function broadcastBinary(buffer) {
  for (const client of [...dashboardClients]) {
    if (client.readyState === 1) {
      try { client.send(buffer); } catch (_) { dashboardClients.delete(client); }
    }
  }
}

export function getConnectedFeeds() { return connectedFeeds; }