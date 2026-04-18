-- ============================================================
--  InkSentinel — Final Database Schema  (v3)
--  Adds exam_sessions table + session_id to detections,
--  video_segments, signals.
--
--  Run in pgAdmin Query Tool on 'surveillance' database.
-- ============================================================

DROP TABLE IF EXISTS signals        CASCADE;
DROP TABLE IF EXISTS detections     CASCADE;
DROP TABLE IF EXISTS video_segments CASCADE;
DROP TABLE IF EXISTS feeds          CASCADE;
DROP TABLE IF EXISTS exam_sessions  CASCADE;

-- ── exam_sessions ─────────────────────────────────────────────
-- One row per exam sitting. Name becomes the recordings folder.
CREATE TABLE exam_sessions (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,         -- e.g. "CSE299_Midterm_April2026"
  course_name     TEXT,                  -- e.g. "Junior Design Project"
  instructor_name TEXT,
  time_block      TEXT,                  -- e.g. "09:00 – 11:00"
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ            -- NULL = session still active
);

-- ── feeds ─────────────────────────────────────────────────────
CREATE TABLE feeds (
  id         SERIAL PRIMARY KEY,
  label      TEXT NOT NULL,
  client_id  TEXT UNIQUE NOT NULL,
  connected  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL   -- soft-delete
);

-- ── detections ───────────────────────────────────────────────
CREATE TABLE detections (
  id              SERIAL PRIMARY KEY,
  session_id      INT REFERENCES exam_sessions(id) ON DELETE SET NULL,
  feed_id         INT REFERENCES feeds(id)         ON DELETE SET NULL,
  detected_at     TIMESTAMPTZ NOT NULL,
  class_label     TEXT NOT NULL,
  confidence      FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  alert_clip_path TEXT
);

-- ── video_segments ────────────────────────────────────────────
CREATE TABLE video_segments (
  id         SERIAL PRIMARY KEY,
  session_id INT REFERENCES exam_sessions(id) ON DELETE SET NULL,
  feed_id    INT REFERENCES feeds(id)         ON DELETE SET NULL,
  file_path  TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ,
  size_bytes BIGINT
);

-- ── signals ───────────────────────────────────────────────────
CREATE TABLE signals (
  id         SERIAL PRIMARY KEY,
  session_id INT REFERENCES exam_sessions(id) ON DELETE SET NULL,
  feed_id    INT REFERENCES feeds(id)         ON DELETE SET NULL,
  signal     TEXT NOT NULL,
  params     JSONB,
  sent_at    TIMESTAMPTZ DEFAULT NOW(),
  sent_by    TEXT NOT NULL   -- 'admin' | 'pen_app'
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_feeds_active         ON feeds          (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_detections_session   ON detections     (session_id, detected_at DESC);
CREATE INDEX idx_detections_feed      ON detections     (feed_id, detected_at DESC);
CREATE INDEX idx_detections_class     ON detections     (class_label);
CREATE INDEX idx_segments_session     ON video_segments (session_id);
CREATE INDEX idx_segments_feed        ON video_segments (feed_id, started_at DESC);
CREATE INDEX idx_signals_session      ON signals        (session_id, sent_at DESC);
CREATE INDEX idx_signals_feed         ON signals        (feed_id);
CREATE INDEX idx_signals_sent_by      ON signals        (sent_by);
CREATE INDEX idx_sessions_active      ON exam_sessions  (ended_at) WHERE ended_at IS NULL;

-- ── Seed: 5 exam seats ───────────────────────────────────────
INSERT INTO feeds (label, client_id, connected) VALUES
  ('Seat 01', '::1_Seat 01', false),
  ('Seat 02', '::1_Seat 02', false),
  ('Seat 03', '::1_Seat 03', false),
  ('Seat 04', '::1_Seat 04', false),
  ('Seat 05', '::1_Seat 05', false);

-- ── Seed: one demo session ───────────────────────────────────
INSERT INTO exam_sessions (name, course_name, instructor_name, time_block) VALUES
  ('Demo_Session', 'Junior Design Project', 'Dr. Demo', '09:00 – 11:00');

-- ── Seed: demo detections tied to session 1 ──────────────────
INSERT INTO detections (session_id, feed_id, detected_at, class_label, confidence) VALUES
  (1, 1, NOW() - INTERVAL '10 minutes', 'phone',      0.92),
  (1, 1, NOW() - INTERVAL '8 minutes',  'phone',      0.88),
  (1, 1, NOW() - INTERVAL '2 minutes',  'phone',      0.94),
  (1, 3, NOW() - INTERVAL '6 minutes',  'cheatsheet', 0.76),
  (1, 4, NOW() - INTERVAL '7 minutes',  'cheating',   0.95),
  (1, 4, NOW() - INTERVAL '5 minutes',  'phone',      0.91),
  (1, 4, NOW() - INTERVAL '3 minutes',  'cheating',   0.87);

-- ── Verify ───────────────────────────────────────────────────
SELECT 'exam_sessions'  AS tbl, COUNT(*) FROM exam_sessions
UNION ALL
SELECT 'feeds'          AS tbl, COUNT(*) FROM feeds
UNION ALL
SELECT 'detections'     AS tbl, COUNT(*) FROM detections
UNION ALL
SELECT 'video_segments' AS tbl, COUNT(*) FROM video_segments
UNION ALL
SELECT 'signals'        AS tbl, COUNT(*) FROM signals;
-- Expected: 1 / 5 / 7 / 0 / 0