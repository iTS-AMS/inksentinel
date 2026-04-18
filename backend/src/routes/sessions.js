// src/routes/sessions.js v4
// GET /api/sessions/:id/attendance — returns session_feeds rows
// Added: candidate_name PATCH endpoint for updating names

import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        s.id, s.name, s.course_name, s.instructor_name,
        s.time_block, s.created_at, s.ended_at,
        COUNT(DISTINCT d.id)       AS detection_count,
        COUNT(DISTINCT sf.feed_id) AS seat_count
      FROM exam_sessions s
      LEFT JOIN detections   d  ON d.session_id  = s.id
      LEFT JOIN session_feeds sf ON sf.session_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error('[Sessions] List error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/sessions/active
router.get('/active', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM exam_sessions WHERE ended_at IS NULL ORDER BY created_at DESC LIMIT 1`
    );
    res.json({ session: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/sessions/:id/attendance
// Returns all seats that connected during this session
router.get('/:id/attendance', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid session ID' });

  try {
    const result = await query(`
      SELECT
        sf.id,
        sf.feed_id,
        sf.feed_label,
        sf.candidate_name,
        sf.connected_at,
        COUNT(d.id) AS alert_count
      FROM   session_feeds sf
      LEFT   JOIN detections d
             ON  d.feed_id    = sf.feed_id
             AND d.session_id = sf.session_id
      WHERE  sf.session_id = $1
      GROUP  BY sf.id, sf.feed_id, sf.feed_label, sf.candidate_name, sf.connected_at
      ORDER  BY sf.feed_label
    `, [id]);

    res.json({ attendance: result.rows });
  } catch (err) {
    console.error('[Sessions] Attendance error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /api/sessions/:id/attendance/:sfId
// Update candidate_name for a specific attendance row
router.patch('/:id/attendance/:sfId', async (req, res) => {
  const sfId  = parseInt(req.params.sfId);
  const { candidate_name } = req.body;
  if (isNaN(sfId)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    await query(
      'UPDATE session_feeds SET candidate_name = $1 WHERE id = $2',
      [candidate_name || null, sfId]
    );
    res.json({ updated: true });
  } catch (err) {
    console.error('[Sessions] Name update error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/sessions
router.post('/', async (req, res) => {
  const { name, course_name, instructor_name, time_block } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Session name is required' });

  const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    await query(`UPDATE exam_sessions SET ended_at = NOW() WHERE ended_at IS NULL`);
    await query(`UPDATE feeds SET deleted_at = NOW(), connected = false WHERE deleted_at IS NULL`);

    const result = await query(
      `INSERT INTO exam_sessions (name, course_name, instructor_name, time_block)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [safeName, course_name || null, instructor_name || null, time_block || null]
    );

    console.log(`[Sessions] New session: "${result.rows[0].name}" (id=${result.rows[0].id})`);
    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error('[Sessions] Create error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/sessions/:id/end
router.put('/:id/end', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid session ID' });

  try {
    const result = await query(
      `UPDATE exam_sessions SET ended_at = NOW()
       WHERE id = $1 AND ended_at IS NULL RETURNING *`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Session not found or already ended' });
    res.json({ session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;