// ============================================================
//  src/routes/signals.js  (v6)
//
//  Changes from v5:
//  - Serial port opening state tracked with `portOpening` flag.
//    Previously, SerialPort() with autoOpen:true returned the
//    object immediately, then fired 'error' asynchronously.
//    getPort() returned the object before error fired, so
//    p.write() was called on a port in error state. Now we
//    wait for 'open' event before returning the port, using
//    a Promise-based initializer. This prevents the "open
//    attempt on every click" loop.
//  - Cooldown now resets ONLY after an open attempt resolves
//    (success or failure), not on every call to getPort().
//    This ensures the 5s gap is respected regardless of
//    async error timing.
// ============================================================

import 'dotenv/config';
import { Router }                   from 'express';
import { query, getActiveSession }  from '../db.js';
import { requireAuthApi }           from '../middleware/auth.js';
import { SerialPort }               from 'serialport';

const router = Router();
router.use(requireAuthApi);

console.log('[Signal] Route loaded — getActiveSession import:',
  typeof getActiveSession === 'function' ? 'OK' : 'MISSING ⚠');

const VALID_COMMANDS = ['timer','start','pause','end','reset','warn','disable','enable','deduct'];
const UNIT_COMMANDS  = ['warn','disable','enable','deduct'];
const NEEDS_DURATION = ['timer'];
const NEEDS_TIME_MS  = ['deduct'];

// ── Serial port state ────────────────────────────────────────
let port            = null;   // open SerialPort instance, or null
let portOpening     = false;  // true while open attempt is in flight
let lastOpenAttempt = 0;      // timestamp of last attempt start
const REOPEN_COOLDOWN_MS = 5000;

// Returns a ready-to-write SerialPort, or null if unavailable.
// Uses portOpening flag to prevent concurrent open attempts — the
// async 'error' event in v5 caused getPort() to return a port
// object before it had confirmed open, leading to write() on a
// broken port and bypassing the cooldown.
async function getPort() {
  // Already open and healthy — return immediately
  if (port?.isOpen) return port;

  // Another open attempt is already in flight — don't stack
  if (portOpening) return null;

  // Cooldown — don't retry within 5s of last attempt
  const now = Date.now();
  if (now - lastOpenAttempt < REOPEN_COOLDOWN_MS) return null;

  const portPath = process.env.ESP32_SERIAL_PORT;
  if (!portPath) {
    console.warn('[Signal] ESP32_SERIAL_PORT not set — serial disabled');
    return null;
  }

  // ── Attempt to open port — await the result ───────────────
  // We wrap in a Promise that resolves on 'open' or rejects on
  // 'error'. This means getPort() waits for confirmation before
  // returning, eliminating the async race condition.
  portOpening     = true;
  lastOpenAttempt = now;

  return new Promise(resolve => {
    let p;
    try {
      p = new SerialPort({ path: portPath, baudRate: 115200, autoOpen: true });
    } catch (err) {
      // Synchronous throw (rare — usually async via 'error' event)
      console.error('[Signal] Failed to create SerialPort:', err.message);
      portOpening = false;
      resolve(null);
      return;
    }

    // Resolves with the port instance on successful open
    p.once('open', () => {
      console.log(`[Signal] Serial port ${portPath} opened`);
      port = p;

      // Flush OS buffer to prevent replay of pre-restart commands
      p.flush(err => {
        if (err) console.error('[Signal] Flush error:', err.message);
        else     console.log('[Signal] Serial port flushed — buffer cleared');
      });

      // Wire persistent handlers for errors after open
      p.on('error', err => {
        console.error('[Signal] Serial error (post-open):', err.message);
        port = null;
      });
      p.on('close', () => {
        console.log('[Signal] Serial port closed');
        port = null;
      });

      portOpening = false;
      resolve(p);
    });

    // Resolves with null on open failure
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

  if (!sessionId) {
    console.warn('[Signal] No active session — signal stored as legacy');
  }

  try {
    await query(
      `INSERT INTO signals (session_id, signal, params, sent_by)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, cmd, JSON.stringify(esp32Payload), req.user.username]
    );
    console.log(`[Signal] ${req.user.username} sent (session=${sessionId}):`, esp32Payload);

    await sendToESP32(esp32Payload);
    res.json({ success: true, sent: esp32Payload });

  } catch (err) {
    if (err.message === 'ESP32_UNREACHABLE') {
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