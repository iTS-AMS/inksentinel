// ============================================================
//  src/routes/stats.js  (v6)
//
//  Changes from v5:
//  - byFeed fallback overhauled. Previous fallback used
//    `feeds WHERE deleted_at IS NULL` (current active feeds).
//    This was wrong for historical sessions: the feeds that had
//    detections in session 1 may now be soft-deleted (when
//    session 2 started), so they don't appear in the current
//    feeds table. Result was 0 alerts shown for all seats.
//
//    New fallback derives seats from the detections table itself:
//    SELECT DISTINCT feed_id FROM detections WHERE session_id=$1
//    This always gives the correct seat list for any session,
//    regardless of whether session_feeds was populated or the
//    feed is now soft-deleted.
//
//  - Added comment explaining why two fallback paths exist.
// ============================================================

import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

router.get('/', async (req, res) => {
  try {
    // ── Resolve session ───────────────────────────────────────
    // ?session_id=N → specific historical session
    // no param      → currently active session
    // no active     → return zeros (fresh install / all ended)
    let sessionId   = req.query.session_id ? parseInt(req.query.session_id) : null;
    let sessionInfo = null;

    if (!sessionId) {
      const active = await query(
        `SELECT * FROM exam_sessions
         WHERE  ended_at IS NULL
         ORDER  BY created_at DESC
         LIMIT  1`
      );
      if (active.rows.length > 0) {
        sessionId   = active.rows[0].id;
        sessionInfo = active.rows[0];
      }
    } else {
      const si = await query('SELECT * FROM exam_sessions WHERE id = $1', [sessionId]);
      sessionInfo = si.rows[0] || null;
    }

    // ── No session — return zeros ─────────────────────────────
    // Avoids leaking global counts onto a blank dashboard
    if (!sessionId) {
      const liveResult = await query(
        `SELECT COUNT(*) AS cnt
         FROM feeds WHERE connected = true AND deleted_at IS NULL`
      );
      return res.json({
        sessionId:    null,
        sessionInfo:  null,
        totalAlerts:  0,
        flaggedFeeds: 0,
        liveFeeds:    Number(liveResult.rows[0].cnt),
        clearFeeds:   0,
        byClass:      {},
        byFeed:       [],
      });
    }

    // ── Summary counts ────────────────────────────────────────
    const summary = await query(`
      SELECT
        (SELECT COUNT(*)
         FROM   detections
         WHERE  session_id = $1)                              AS total_alerts,

        (SELECT COUNT(DISTINCT feed_id)
         FROM   detections
         WHERE  session_id = $1
         AND    feed_id IS NOT NULL)                          AS flagged_feeds,

        (SELECT COUNT(*)
         FROM   feeds
         WHERE  connected = true AND deleted_at IS NULL)      AS live_feeds
    `, [sessionId]);

    // ── Detection class breakdown ─────────────────────────────
    const byClass = await query(`
      SELECT class_label, COUNT(*) AS count
      FROM   detections
      WHERE  session_id = $1
      GROUP  BY class_label
      ORDER  BY count DESC
    `, [sessionId]);

    // ── Per-seat breakdown — three-tier source priority ───────
    //
    // Tier 1: session_feeds (attendance table)
    //   Best source — populated in real-time as cameras connect.
    //   Available for sessions that ran with wsHandler_v4+.
    //   Gives correct seat labels even for soft-deleted feeds.
    //
    // Tier 2: detections table (derive seats from who was caught)
    //   Fallback when session_feeds has no rows (historical sessions
    //   before attendance tracking was added, or Demo_Session seed).
    //   This is the KEY FIX: detections always have feed_id from when
    //   the detection was recorded, so even if the feed is now
    //   soft-deleted we get the right label via the feed JOIN.
    //
    // Tier 3: current active feeds (last resort)
    //   Used only when the session has NO detections yet AND no
    //   attendance records — e.g. session just started, no cameras
    //   connected yet. Shows the available seats as a preview.

    // Check session_feeds first
    const sfCheck = await query(
      `SELECT COUNT(*) AS cnt FROM session_feeds WHERE session_id = $1`,
      [sessionId]
    );
    const hasAttendance = Number(sfCheck.rows[0].cnt) > 0;

    // Check detections for this session
    const detCheck = await query(
      `SELECT COUNT(DISTINCT feed_id) AS cnt
       FROM detections WHERE session_id = $1 AND feed_id IS NOT NULL`,
      [sessionId]
    );
    const hasDetections = Number(detCheck.rows[0].cnt) > 0;

    let byFeed;

    if (hasAttendance) {
      // ── Tier 1: session_feeds ─────────────────────────────
      byFeed = await query(`
        SELECT
          sf.feed_id                       AS id,
          sf.feed_label                    AS label,
          COALESCE(f.connected, false)     AS connected,
          COUNT(d.id)                      AS alerts
        FROM   session_feeds sf
        LEFT   JOIN feeds f
               ON  f.id = sf.feed_id
        LEFT   JOIN detections d
               ON  d.feed_id    = sf.feed_id
               AND d.session_id = $1
        WHERE  sf.session_id = $1
        GROUP  BY sf.feed_id, sf.feed_label, f.connected
        ORDER  BY sf.feed_label
      `, [sessionId]);

    } else if (hasDetections) {
      // ── Tier 2: derive seats from detections ──────────────
      // Correct for historical sessions without session_feeds rows.
      // JOIN to feeds for the label — the feed row still exists
      // even after soft-delete (deleted_at just hides it from
      // the dashboard, the row is not removed).
      byFeed = await query(`
        SELECT
          d.feed_id                        AS id,
          COALESCE(f.label, 'Seat (removed)') AS label,
          COALESCE(f.connected, false)     AS connected,
          COUNT(d.id)                      AS alerts
        FROM   detections d
        LEFT   JOIN feeds f ON f.id = d.feed_id
        WHERE  d.session_id = $1
        AND    d.feed_id IS NOT NULL
        GROUP  BY d.feed_id, f.label, f.connected
        ORDER  BY label
      `, [sessionId]);

    } else {
      // ── Tier 3: current active feeds (preview only) ───────
      byFeed = await query(`
        SELECT
          f.id,
          f.label,
          f.connected,
          0 AS alerts
        FROM   feeds f
        WHERE  f.deleted_at IS NULL
        ORDER  BY f.id
      `);
    }

    const s         = summary.rows[0];
    const liveFeeds = Number(s.live_feeds);
    const flagged   = Number(s.flagged_feeds);

    res.json({
      sessionId,
      sessionInfo,
      totalAlerts:  Number(s.total_alerts),
      flaggedFeeds: flagged,
      liveFeeds,
      clearFeeds:   Math.max(0, liveFeeds - flagged),
      byClass: Object.fromEntries(
        byClass.rows.map(r => [r.class_label, Number(r.count)])
      ),
      byFeed: byFeed.rows.map(r => ({
        id:        r.id,
        label:     r.label,
        connected: r.connected,
        alerts:    Number(r.alerts),
      })),
    });

  } catch (err) {
    console.error('[Stats]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;