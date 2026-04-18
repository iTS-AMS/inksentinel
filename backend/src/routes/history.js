// ============================================================
//  src/routes/history.js
//
//  GET    /api/history  — signal rows joined to exam_sessions
//                         so session_name is returned
//  DELETE /api/history  — clear signals by source or all
//
//  Supported query params:
//    ?sessionId=N      — filter by session
//    ?source=admin|pen_app
//    ?cmd=start|pause|...
//    ?date=YYYY-MM-DD
//
//  WHY session_name was null:
//    The original history route selected only from signals sg
//    with no JOIN to exam_sessions. Even though session_id was
//    correctly written by signals_v5.js, the route never fetched
//    the name. Adding LEFT JOIN exam_sessions s ON s.id = sg.session_id
//    and selecting s.name AS session_name fixes it.
// ============================================================

import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// ── GET /api/history ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const { source, cmd, date, sessionId } = req.query;

  // ── Base query — JOIN to exam_sessions for session name ───
  // The LEFT JOIN ensures signals with session_id=NULL (legacy)
  // still appear — s.name will be null for those rows, which
  // the frontend renders as "legacy" in amber.
  let sql = `
    SELECT
      sg.id,
      sg.signal          AS cmd,
      sg.params,
      sg.sent_at         AS ts,
      sg.sent_by,
      s.name             AS session_name
    FROM   signals sg
    LEFT   JOIN exam_sessions s
           ON  s.id = sg.session_id
    WHERE  1=1
  `;
  const vals = [];

  // ── Build WHERE clauses from query params ─────────────────
  // All params use $N placeholders — never string-interpolated

  if (sessionId) {
    vals.push(parseInt(sessionId));
    sql += ` AND sg.session_id = $${vals.length}`;
  }

  if (source && source !== 'all') {
    vals.push(source);
    sql += ` AND sg.sent_by = $${vals.length}`;
  }

  if (cmd && cmd !== 'all') {
    vals.push(cmd);
    sql += ` AND sg.signal = $${vals.length}`;
  }

  if (date) {
    // Cast timestamptz to date for calendar-day comparison
    vals.push(date);
    sql += ` AND sg.sent_at::date = $${vals.length}`;
  }

  sql += ' ORDER BY sg.sent_at DESC';

  try {
    const result = await query(sql, vals);

    // Parse params JSONB — pg driver returns it as object if column
    // type is jsonb, as string if text. Handle both.
    const entries = result.rows.map(r => ({
      id:           r.id,
      cmd:          r.cmd,
      ts:           r.ts,
      sent_by:      r.sent_by,
      session_name: r.session_name,   // null for legacy signals
      params: typeof r.params === 'string'
        ? JSON.parse(r.params || '{}')
        : (r.params || {}),
    }));

    res.json({ entries });

  } catch (err) {
    console.error('[History] Query error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── DELETE /api/history ───────────────────────────────────────
// ?source=pen_app  → delete only pen app signals
// no param         → delete all signals
// Note: "Clear All" in the UI uses client-side hide (localStorage),
// not this endpoint. This endpoint is only for actual DB deletion.
router.delete('/', async (req, res) => {
  const { source } = req.query;
  try {
    if (source && source !== 'all') {
      await query('DELETE FROM signals WHERE sent_by = $1', [source]);
    } else {
      await query('DELETE FROM signals');
    }
    console.log('[History] Signals cleared', source ? `(source: ${source})` : '(all)');
    res.json({ cleared: true });
  } catch (err) {
    console.error('[History] Clear error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;