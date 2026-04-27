// src/routes/camera-links.js
// Manages the camera_links table — persists seat-to-feed assignments
// across page refreshes.
//
// PUT    /api/camera-links          — upsert a seat-camera link
// DELETE /api/camera-links/:seat    — unlink a seat
// GET    /api/camera-links          — list all current links

import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// ── PUT /api/camera-links ────────────────────────────────────
// Upserts a link: { seat_label, feed_id, camera_id, feed_label }
router.put('/', async (req, res) => {
  const { seat_label, feed_id, camera_id, feed_label } = req.body;
  if (!seat_label || !feed_id)
    return res.status(400).json({ error: 'seat_label and feed_id required' });

  try {
    const result = await query(`
      INSERT INTO camera_links (seat_label, feed_id, camera_id, feed_label, status, linked_at, updated_at)
      VALUES ($1, $2, $3, $4, 'linked', NOW(), NOW())
      ON CONFLICT (seat_label) DO UPDATE SET
        feed_id    = EXCLUDED.feed_id,
        camera_id  = EXCLUDED.camera_id,
        feed_label = EXCLUDED.feed_label,
        status     = 'linked',
        linked_at  = NOW(),
        updated_at = NOW()
      RETURNING *
    `, [seat_label, feed_id, camera_id || null, feed_label || null]);

    res.set('Cache-Control', 'no-store');
    res.json({ link: result.rows[0] });
  } catch (err) {
    console.error('[CameraLinks] Upsert error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── DELETE /api/camera-links/:seat ──────────────────────────
router.delete('/:seat', async (req, res) => {
  const seatLabel = decodeURIComponent(req.params.seat);
  try {
    await query(
      `UPDATE camera_links SET status = 'free', feed_id = NULL,
        camera_id = NULL, feed_label = NULL, updated_at = NOW()
       WHERE seat_label = $1`,
      [seatLabel]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ unlinked: true });
  } catch (err) {
    console.error('[CameraLinks] Delete error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/camera-links ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT cl.*, f.connected, f.camera_id AS live_camera_id
      FROM   camera_links cl
      LEFT   JOIN feeds f ON f.id = cl.feed_id
      WHERE  cl.status = 'linked'
      ORDER  BY cl.seat_label
    `);
    res.set('Cache-Control', 'no-store');
    res.json({ links: result.rows });
  } catch (err) {
    console.error('[CameraLinks] List error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;