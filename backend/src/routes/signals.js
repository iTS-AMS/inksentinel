import 'dotenv/config';
import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';
import { WebSocket } from 'ws';

const router = Router();
router.use(requireAuthApi);

const VALID_COMMANDS = ['timer', 'start', 'pause', 'end', 'reset', 'warn', 'disable', 'enable', 'deduct'];

// commands that target a specific pen unit
const UNIT_COMMANDS  = ['warn', 'disable', 'enable', 'deduct'];

// commands that require extra fields
const NEEDS_DURATION = ['timer'];
const NEEDS_TIME_MS  = ['deduct'];

router.post('/', async (req, res) => {
  const { cmd, device_id, duration_ms, punish_ms, time_ms } = req.body;

  // validate command
  if (!cmd || !VALID_COMMANDS.includes(cmd)) {
    return res.status(400).json({
      error: `Invalid command. Must be one of: ${VALID_COMMANDS.join(', ')}`
    });
  }

  // unit commands require a device_id
  if (UNIT_COMMANDS.includes(cmd) && !device_id) {
    return res.status(400).json({ error: `${cmd} requires device_id` });
  }

  // timer requires duration_ms
  if (NEEDS_DURATION.includes(cmd) && !duration_ms) {
    return res.status(400).json({ error: 'timer requires duration_ms' });
  }

  // deduct requires time_ms
  if (NEEDS_TIME_MS.includes(cmd) && !time_ms) {
    return res.status(400).json({ error: 'deduct requires time_ms' });
  }

  // build the exact JSON the ESP32 expects
  const esp32Payload = { cmd };
  if (device_id)   esp32Payload.device_id   = device_id;
  if (duration_ms) esp32Payload.duration_ms = duration_ms;
  if (punish_ms)   esp32Payload.punish_ms   = punish_ms;
  if (time_ms)     esp32Payload.time_ms     = time_ms;

  try {
    // log to DB first regardless of ESP32 result
    await query(
      'INSERT INTO signals (signal, params, sent_by) VALUES ($1, $2, $3)',
      [cmd, JSON.stringify(esp32Payload), req.user.username]
    );

    console.log(`[Signal] ${req.user.username} sent:`, esp32Payload);

    // connect to ESP32 via WebSocket, send command, close
    await sendToESP32(esp32Payload);

    res.json({ success: true, sent: esp32Payload });

  } catch (err) {
    if (err.message === 'ESP32_UNREACHABLE') {
      return res.status(202).json({
        warning: 'ESP32 unreachable — command logged but not delivered',
        sent:    esp32Payload,
        logged:  true
      });
    }
    console.error('[Signal] Unexpected error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// opens a WebSocket to the ESP32, sends one command, then closes
function sendToESP32(payload) {
  return new Promise((resolve, reject) => {
    const esp32 = new WebSocket(process.env.ESP32_URL);

    const timeout = setTimeout(() => {
      esp32.terminate();
      reject(new Error('ESP32_UNREACHABLE'));
    }, 5000);

    esp32.on('open', () => {
      esp32.send(JSON.stringify(payload));
      clearTimeout(timeout);
      esp32.close();
      resolve();
    });

    esp32.on('error', () => {
      clearTimeout(timeout);
      reject(new Error('ESP32_UNREACHABLE'));
    });
  });
}

export default router;