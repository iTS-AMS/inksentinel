-- ============================================================
-- InkSentinel — Complete Database Setup
-- Run in pgAdmin Query Tool on 'surveillance' database
-- ============================================================

-- ── Drop existing tables (clean slate) ──────────────────────
-- Run this block ONLY if you want to reset everything
DROP TABLE IF EXISTS signals        CASCADE;
DROP TABLE IF EXISTS detections     CASCADE;
DROP TABLE IF EXISTS video_segments CASCADE;
DROP TABLE IF EXISTS feeds          CASCADE;

-- ── Create tables ───────────────────────────────────────────

CREATE TABLE feeds (
  id         SERIAL PRIMARY KEY,
  label      TEXT NOT NULL,
  client_id  TEXT UNIQUE NOT NULL,
  connected  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE detections (
  id              SERIAL PRIMARY KEY,
  feed_id         INT REFERENCES feeds(id) ON DELETE CASCADE,
  detected_at     TIMESTAMPTZ NOT NULL,
  class_label     TEXT NOT NULL,
  confidence      FLOAT,
  alert_clip_path TEXT   -- path to 30s annotated .mp4 clip, NULL until clip is saved
);

CREATE TABLE video_segments (
  id         SERIAL PRIMARY KEY,
  feed_id    INT REFERENCES feeds(id) ON DELETE CASCADE,
  file_path  TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ,
  size_bytes BIGINT
);

CREATE TABLE signals (
  id       SERIAL PRIMARY KEY,
  signal   TEXT NOT NULL,
  params   JSONB,
  sent_at  TIMESTAMPTZ DEFAULT NOW(),
  sent_by  TEXT NOT NULL
);

-- ── Indexes for query performance ───────────────────────────
CREATE INDEX idx_detections_feed_time  ON detections (feed_id, detected_at DESC);
CREATE INDEX idx_detections_class      ON detections (class_label);
CREATE INDEX idx_segments_feed         ON video_segments (feed_id, started_at DESC);

-- ── Seed: 5 fixed seats ─────────────────────────────────────
-- client_id format: IP_label
-- using ::1 (localhost IPv6) since you're testing locally
INSERT INTO feeds (label, client_id, connected) VALUES
  ('Seat 01', '::1_Seat 01', false),
  ('Seat 02', '::1_Seat 02', false),
  ('Seat 03', '::1_Seat 03', false),
  ('Seat 04', '::1_Seat 04', false),
  ('Seat 05', '::1_Seat 05', false);

-- ── Seed: demo detections ───────────────────────────────────
INSERT INTO detections (feed_id, detected_at, class_label, confidence) VALUES
  (1, NOW() - INTERVAL '10 minutes', 'phone',      0.92),
  (1, NOW() - INTERVAL '8 minutes',  'phone',      0.88),
  (1, NOW() - INTERVAL '2 minutes',  'phone',      0.94),
  (3, NOW() - INTERVAL '6 minutes',  'book',       0.76),
  (4, NOW() - INTERVAL '7 minutes',  'person',     0.95),
  (4, NOW() - INTERVAL '5 minutes',  'cell phone', 0.91),
  (4, NOW() - INTERVAL '3 minutes',  'person',     0.87);

-- ── Verify ──────────────────────────────────────────────────
SELECT 'feeds'          AS tbl, COUNT(*) FROM feeds
UNION ALL
SELECT 'detections'     AS tbl, COUNT(*) FROM detections
UNION ALL
SELECT 'video_segments' AS tbl, COUNT(*) FROM video_segments
UNION ALL
SELECT 'signals'        AS tbl, COUNT(*) FROM signals;