import { Router } from 'express';
import { query }  from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const summary = await query(`
      SELECT
        (SELECT COUNT(*) FROM detections)                    AS total_alerts,
        (SELECT COUNT(DISTINCT feed_id) FROM detections)     AS flagged_feeds,
        (SELECT COUNT(*) FROM feeds WHERE connected = true)  AS live_feeds
    `);

    const byClass = await query(`
      SELECT class_label, COUNT(*) AS count
      FROM detections
      GROUP BY class_label
      ORDER BY count DESC
    `);

    const byFeed = await query(`
      SELECT f.label, f.connected, COUNT(d.id) AS alerts
      FROM feeds f
      LEFT JOIN detections d ON d.feed_id = f.id
      GROUP BY f.id, f.label, f.connected
      ORDER BY f.id
    `);

    const s = summary.rows[0];

    res.json({
      totalAlerts:  Number(s.total_alerts),
      flaggedFeeds: Number(s.flagged_feeds),
      liveFeeds:    Number(s.live_feeds),
      byClass:      Object.fromEntries(
                      byClass.rows.map(r => [r.class_label, Number(r.count)])
                    ),
      byFeed:       byFeed.rows.map(r => ({
                      label:  r.label,
                      connected: r.connected,
                      alerts: Number(r.alerts)
                    })),
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;