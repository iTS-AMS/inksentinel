// src/routes/feeds.js
import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// ── GET /api/feeds ───────────────────────────────────────────
// Only returns soft-active feeds (deleted_at IS NULL)
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        f.id,
        f.label,
        f.connected,
        COUNT(d.id) AS alert_count
      FROM feeds f
      LEFT JOIN detections d ON d.feed_id = f.id
      WHERE f.deleted_at IS NULL
      GROUP BY f.id
      ORDER BY f.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/feeds/:id ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid feed ID' });

  try {
    const feedResult = await query(
      'SELECT * FROM feeds WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (feedResult.rows.length === 0)
      return res.status(404).json({ error: 'Feed not found' });

    const detResult = await query(
      `SELECT * FROM detections WHERE feed_id = $1 ORDER BY detected_at DESC`,
      [id]
    );

    res.json({ ...feedResult.rows[0], detections: detResult.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── DELETE /api/feeds/:id ────────────────────────────────────
// Soft-delete — sets deleted_at timestamp instead of removing the row.
// Detections, video_segments, signals keep their feed_id (SET NULL only
// fires on hard DELETE, which we no longer do).
// Blocks if the feed is currently connected.
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid feed ID' });

  try {
    const check = await query(
      'SELECT connected, deleted_at FROM feeds WHERE id = $1',
      [id]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ error: 'Feed not found' });
    if (check.rows[0].connected)
      return res.status(409).json({ error: 'Cannot remove a connected feed' });
    if (check.rows[0].deleted_at)
      return res.status(409).json({ error: 'Feed already removed' });

    await query(
      'UPDATE feeds SET deleted_at = NOW() WHERE id = $1',
      [id]
    );

    console.log(`[Feeds] Feed ${id} soft-deleted`);
    res.json({ success: true, deleted: id });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;