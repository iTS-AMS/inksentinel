// src/routes/feeds.js  (v2)
// Adds camera_id generation on upsert.
// camera_id is a short 8-char code shown on the camera page.
// Format: CAM-XXXX where XXXX is uppercase alphanumeric.
import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// ── Generate a short unique camera ID ────────────────────────
function genCamId() {
  const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code     = 'CAM-';
  for (let i = 0; i < 4; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── GET /api/feeds ────────────────────────────────────────────
// Returns all active feeds with live-computed availability status.
// availability: 'live' | 'available' | 'unregistered'
//   live        — camera is actively connected and streaming
//   available   — registered (has camera_id) but currently offline
//   unregistered— feed row exists but camera_id never assigned
// Sorted: live first, then available, then unregistered.
// No dependency on feeds_available view — works with base schema.
router.get('/', async (req, res) => {
  // Returns all non-deleted feeds with status:
  //   available    - connected=true,  not linked to any seat in camera_links
  //   linked       - connected=true,  already linked to a seat (different modal)
  //   disconnected - connected=false  (registered but offline)
  // Optional ?seat=<label> tells us which seat is opening the modal so we can
  // mark a feed as 'available' even if it's linked to THIS seat.
  const currentSeat = req.query.seat || null;
  try {
    const result = await query(`
      SELECT
        f.id,
        f.label,
        f.client_id,
        f.connected,
        f.camera_id,
        f.created_at,
        cl.seat_label   AS linked_seat,
        COUNT(d.id)     AS alert_count,
        CASE
          WHEN NOT f.connected                            THEN 'disconnected'
          WHEN cl.seat_label IS NULL                      THEN 'available'
          WHEN cl.seat_label = $1                         THEN 'available'
          ELSE                                                 'linked'
        END AS availability
      FROM   feeds f
      LEFT   JOIN camera_links cl ON cl.feed_id = f.id
      LEFT   JOIN detections   d  ON d.feed_id  = f.id
      WHERE  f.deleted_at IS NULL
      GROUP  BY f.id, f.label, f.client_id, f.connected,
                f.camera_id, f.created_at, cl.seat_label
      ORDER  BY
        CASE
          WHEN NOT f.connected THEN 3
          WHEN cl.seat_label IS NULL OR cl.seat_label = $1 THEN 1
          ELSE 2
        END,
        f.label
    `, [currentSeat]);
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (err) {
    console.error('[Feeds] List error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/feeds/:id ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid feed ID' });

  try {
    const feedResult = await query(`
      SELECT f.*, COUNT(d.id) AS alert_count
      FROM   feeds f
      LEFT   JOIN detections d ON d.feed_id = f.id
      WHERE  f.id = $1
      GROUP  BY f.id
    `, [id]);

    if (!feedResult.rows.length)
      return res.status(404).json({ error: 'Feed not found' });

    const detResult = await query(`
      SELECT id, class_label, confidence, detected_at, alert_clip_path
      FROM   detections
      WHERE  feed_id = $1
      ORDER  BY detected_at DESC
      LIMIT  20
    `, [id]);

    res.json({ ...feedResult.rows[0], detections: detResult.rows });
  } catch (err) {
    console.error('[Feeds] Get error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── DELETE /api/feeds/:id  (soft delete) ─────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid feed ID' });

  try {
    const check = await query(
      'SELECT connected FROM feeds WHERE id = $1 AND deleted_at IS NULL', [id]);

    if (!check.rows.length)
      return res.status(404).json({ error: 'Feed not found' });

    if (check.rows[0].connected)
      return res.status(400).json({
        error: 'Cannot remove a connected feed — disconnect the camera first'
      });

    await query(
      'UPDATE feeds SET deleted_at = NOW() WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('[Feeds] Delete error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
export { genCamId };