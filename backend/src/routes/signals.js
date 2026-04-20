// ============================================================
//  src/routes/signals.js  (v7)
//
//  Changes from v6:
//  - Imports broadcastJSON from wsHandler.js so it can push
//    real-time ack messages to all dashboard clients (including
//    the candidate page) after a confirmed serial write.
//
//  - After HTTP 200 path (serial write succeeded): broadcasts
//    { type: 'signal_ack', cmd, device_id, status: 'delivered' }
//    This lets candidate.html show a per-unit "Delivered ✓"
//    confirmation without polling.
//
//  - After HTTP 202 path (ESP32 unreachable): broadcasts
//    { type: 'signal_ack', cmd, device_id, status: 'undelivered' }
//    So the candidate page still gets a real-time update (amber).
//
//  - Serial port 'data' event listener parses JSON echo lines
//    from ESP32 firmware. When firmware is updated to send acks
//    (e.g. {"ack":"ok","cmd":"start","unit":1}), this handler
//    will forward them as { type: 'serial_ack' } WS messages.
//    Currently a no-op until firmware supports it.
//
//  - portOpening flag and async getPort() from v6 unchanged.
// ============================================================

import 'dotenv/config';
import { Router }                   from 'express';
import { query, getActiveSession }  from '../db.js';
import { requireAuthApi }           from '../middleware/auth.js';
import { SerialPort }               from 'serialport';
import { broadcastJSON }            from '../wsHandler.js';

const router = Router();
router.use(requireAuthApi);

console.log('[Signal] Route loaded — getActiveSession import:',
  typeof getActiveSession === 'function' ? 'OK' : 'MISSING ⚠');
console.log('[Signal] Route loaded — broadcastJSON import:',
  typeof broadcastJSON === 'function' ? 'OK' : 'MISSING ⚠');

const VALID_COMMANDS = ['timer','start','pause','end','reset','warn','disable','enable','deduct'];
const UNIT_COMMANDS  = ['warn','disable','enable','deduct'];
const NEEDS_DURATION = ['timer'];
const NEEDS_TIME_MS  = ['deduct'];

// ── Serial port state ────────────────────────────────────────
let port         = null;
let portOpening  = false;
let lastOpenAttempt = 0;
const REOPEN_COOLDOWN_MS = 5000;

// Buffer for partial lines coming in from serial
let serialLineBuf = '';

// ── Serial data handler ───────────────────────────────────────
// Parses newline-delimited JSON from ESP32.
// Currently logs all incoming lines for debugging.
// When ESP32 firmware is updated to send ack JSON like:
//   {"ack":"ok","cmd":"start","unit":1}
//   {"ack":"ok","cmd":"start","unit":"all"}
// this function will forward them as WS messages to dashboard
// clients so candidate.html can show per-unit confirmation.
function handleSerialData(chunk) {
  serialLineBuf += chunk.toString();
  const lines = serialLineBuf.split('\n');

  // Keep the last partial line in the buffer
  serialLineBuf = lines.pop();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    console.log(`[Signal] Serial RX: ${trimmed}`);

    // Try to parse as JSON ack from ESP32 firmware
    try {
      const msg = JSON.parse(trimmed);

      if (msg.ack) {
        // Forward to all dashboard clients (including candidate page)
        // candidate.html listens for type:'serial_ack' to show
        // per-unit hardware confirmation (future feature once firmware updated)
        broadcastJSON({
          type:      'serial_ack',
          ack:       msg.ack,         // 'ok' | 'err'
          cmd:       msg.cmd,
          unit:      msg.unit,        // unit id or 'all'
          raw:       trimmed,
        });
        console.log(`[Signal] Serial ack forwarded: cmd=${msg.cmd} unit=${msg.unit}`);
      }
    } catch (_) {
      // Not JSON — plain ESP32 debug output, already logged above
    }
  }
}

// ── Serial port open — async, waits for 'open' event ─────────
// Returns a ready port or null. portOpening flag prevents stacking
// concurrent open attempts (the v5 fix for the freeze bug).
async function getPort() {
  if (port?.isOpen) return port;
  if (portOpening) return null;

  const now = Date.now();
  if (now - lastOpenAttempt < REOPEN_COOLDOWN_MS) return null;

  const portPath = process.env.ESP32_SERIAL_PORT;
  if (!portPath) {
    console.warn('[Signal] ESP32_SERIAL_PORT not set — serial disabled');
    return null;
  }

  portOpening     = true;
  lastOpenAttempt = now;

  return new Promise(resolve => {
    let p;
    try {
      p = new SerialPort({ path: portPath, baudRate: 115200, autoOpen: true });
    } catch (err) {
      console.error('[Signal] Failed to create SerialPort:', err.message);
      portOpening = false;
      resolve(null);
      return;
    }

    p.once('open', () => {
      console.log(`[Signal] Serial port ${portPath} opened`);
      port = p;

      // Flush OS buffer — prevents replay of pre-restart commands
      p.flush(err => {
        if (err) console.error('[Signal] Flush error:', err.message);
        else     console.log('[Signal] Serial port flushed — buffer cleared');
      });

      // ── Listen for incoming data from ESP32 ───────────────
      // Handles both debug prints and future ack JSON from firmware
      p.on('data', handleSerialData);

      p.on('error', err => {
        console.error('[Signal] Serial error (post-open):', err.message);
        port = null;
      });
      p.on('close', () => {
        console.log('[Signal] Serial port closed');
        port          = null;
        serialLineBuf = ''; // clear partial buffer on disconnect
      });

      portOpening = false;
      resolve(p);
    });

    p.once('error', err => {
      console.error('[Signal] Serial open error:', err.message);
      portOpening = false;
      port        = null;
      resolve(null);
    });
  });
}

// Write one newline-terminated JSON command to the ESP32.
async function sendToESP32(payload) {
  const p = await getPort();
  if (!p) throw new Error('ESP32_UNREACHABLE');

  return new Promise((resolve, reject) => {
    p.write(JSON.stringify(payload) + '\n', err => {
      if (err) {
        console.error('[Signal] Write error:', err.message);
        port = null;
        return reject(new Error('ESP32_UNREACHABLE'));
      }
      resolve();
    });
  });
}

// ── POST /api/signal ─────────────────────────────────────────
router.post('/', async (req, res) => {
  const { cmd, device_id, duration_ms, punish_ms, time_ms } = req.body;

  if (!cmd || !VALID_COMMANDS.includes(cmd))
    return res.status(400).json({
      error: `Invalid command. Must be one of: ${VALID_COMMANDS.join(', ')}`
    });

  if (UNIT_COMMANDS.includes(cmd) && !device_id)
    return res.status(400).json({ error: `${cmd} requires device_id` });
  if (NEEDS_DURATION.includes(cmd) && !duration_ms)
    return res.status(400).json({ error: 'timer requires duration_ms' });
  if (NEEDS_TIME_MS.includes(cmd) && !time_ms)
    return res.status(400).json({ error: 'deduct requires time_ms' });

  const esp32Payload = { cmd };
  if (device_id)   esp32Payload.device_id   = device_id;
  if (duration_ms) esp32Payload.duration_ms = duration_ms;
  if (punish_ms)   esp32Payload.punish_ms   = punish_ms;
  if (time_ms)     esp32Payload.time_ms     = time_ms;

  const session   = await getActiveSession();
  const sessionId = session?.id || null;
  if (!sessionId)
    console.warn('[Signal] No active session — signal stored as legacy');

  try {
    // Always log to DB first, regardless of ESP32 state
    await query(
      `INSERT INTO signals (session_id, signal, params, sent_by)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, cmd, JSON.stringify(esp32Payload), req.user.username]
    );
    console.log(`[Signal] ${req.user.username} sent (session=${sessionId}):`, esp32Payload);

    // ── Try to deliver to ESP32 ───────────────────────────
    await sendToESP32(esp32Payload);

    // ── HTTP 200: serial write confirmed ──────────────────
    // Broadcast signal_ack so candidate.html can show
    // "Delivered ✓" in real-time without a page refresh.
    // unit: device_id for unit commands, 'all' for global ones.
    broadcastJSON({
      type:      'signal_ack',
      status:    'delivered',
      cmd,
      unit:      device_id || 'all',
      duration_ms: duration_ms || null,
      time_ms:     time_ms     || null,
    });

    res.json({ success: true, sent: esp32Payload });

  } catch (err) {
    if (err.message === 'ESP32_UNREACHABLE') {
      // ── HTTP 202: logged but not delivered ───────────────
      // Still broadcast so candidate page updates immediately
      broadcastJSON({
        type:   'signal_ack',
        status: 'undelivered',
        cmd,
        unit:   device_id || 'all',
      });

      return res.status(202).json({
        warning: 'ESP32 not connected — command logged but not delivered',
        sent:    esp32Payload,
        logged:  true,
      });
    }
    console.error('[Signal] Unexpected error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;