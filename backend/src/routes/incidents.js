// src/routes/incidents.js
import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

router.get('/', async (req, res) => {
  const { feedId, classLabel, sessionId } = req.query;

  // Build parameterized query — no string interpolation
  let sql    = `
    SELECT
      d.*,
      f.label         AS feed_label,
      s.name          AS session_name
    FROM detections d
    LEFT JOIN feeds         f ON f.id = d.feed_id
    LEFT JOIN exam_sessions s ON s.id = d.session_id
    WHERE 1=1
  `;
  const params = [];

  if (sessionId) {
    params.push(parseInt(sessionId));
    sql += ` AND d.session_id = $${params.length}`;
  }

  if (feedId && feedId !== 'all') {
    params.push(parseInt(feedId));
    sql += ` AND d.feed_id = $${params.length}`;
  }

  if (classLabel && classLabel !== 'all') {
    params.push(classLabel);
    sql += ` AND d.class_label = $${params.length}`;
  }

  sql += ' ORDER BY d.detected_at DESC';

  try {
    const result = await query(sql, params);
    res.json({ incidents: result.rows });
  } catch (err) {
    console.error('[Incidents]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;