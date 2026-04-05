import { Router } from 'express';
import { query }  from '../db.js';

import { requireAuthApi } from '../middleware/auth.js';

const router = Router();

router.use(requireAuthApi);

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
      GROUP BY f.id
      ORDER BY f.id
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid feed ID' });
  }

  try {
    const feedResult = await query(
      'SELECT * FROM feeds WHERE id = $1',
      [id]
    );

    if (feedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const detResult = await query(
      `SELECT * FROM detections
       WHERE feed_id = $1
       ORDER BY detected_at DESC`,
      [id]
    );

    res.json({
      ...feedResult.rows[0],
      detections: detResult.rows
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;