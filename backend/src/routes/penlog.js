// src/routes/penlog.js
import 'dotenv/config';
import { Router }                   from 'express';
import { requireAuthApi }           from '../middleware/auth.js';
import { query, getActiveSession }  from '../db.js';

const router = Router();
router.use(requireAuthApi);

router.post('/', async (req, res) => {
  const { cmd, device_id, duration_ms, punish_ms, time_ms, transport } = req.body;
  if (!cmd) return res.status(400).json({ error: 'cmd is required' });

  const params = {};
  if (device_id)   params.device_id   = device_id;
  if (duration_ms) params.duration_ms = duration_ms;
  if (punish_ms)   params.punish_ms   = punish_ms;
  if (time_ms)     params.time_ms     = time_ms;
  if (transport)   params.transport   = transport;

  const session   = await getActiveSession();
  const sessionId = session?.id || null;

  try {
    await query(
      `INSERT INTO signals (session_id, signal, params, sent_by)
       VALUES ($1, $2, $3, 'pen_app')`,
      [sessionId, cmd, JSON.stringify(params)]
    );
    res.json({ logged: true });
  } catch (err) {
    console.error('[PenLog] DB error:', err.message);
    res.status(500).json({ error: 'Log failed' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT sg.signal AS cmd, sg.params, sg.sent_at AS ts, s.name AS session_name
      FROM   signals sg
      LEFT   JOIN exam_sessions s ON s.id = sg.session_id
      WHERE  sg.sent_by = 'pen_app'
      ORDER  BY sg.sent_at DESC
      LIMIT  100
    `);
    const entries = result.rows.map(r => ({
      ts:           r.ts,
      cmd:          r.cmd,
      session_name: r.session_name,
      ...(typeof r.params === 'string' ? JSON.parse(r.params || '{}') : (r.params || {}))
    }));
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Read failed' });
  }
});

router.delete('/', async (req, res) => {
  try {
    await query("DELETE FROM signals WHERE sent_by = 'pen_app'");
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: 'Clear failed' });
  }
});

export default router;