-- ── Drop existing to apply new structure ────────────────────
DROP TABLE IF EXISTS signals        CASCADE;
DROP TABLE IF EXISTS detections     CASCADE;
DROP TABLE IF EXISTS video_segments CASCADE;
DROP TABLE IF EXISTS feeds          CASCADE;

-- ── 1. Feeds (With Soft-Delete Support) ─────────────────────
CREATE TABLE feeds (
  id           SERIAL PRIMARY KEY,
  label        TEXT NOT NULL,
  client_id    TEXT UNIQUE NOT NULL,
  connected    BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ DEFAULT NULL  -- Use this instead of hard DELETE
);

-- ── 2. Detections (Evidence Protection) ─────────────────────
CREATE TABLE detections (
  id              SERIAL PRIMARY KEY,
  -- We use SET NULL so if a seat is removed, the 'Phone' alert stays in the DB
  feed_id         INT REFERENCES feeds(id) ON DELETE SET NULL, 
  detected_at     TIMESTAMPTZ NOT NULL,
  class_label     TEXT NOT NULL,
  confidence      FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  alert_clip_path TEXT
);

-- ── 3. Video Segments (Metadata Retention) ──────────────────
CREATE TABLE video_segments (
  id         SERIAL PRIMARY KEY,
  feed_id    INT REFERENCES feeds(id) ON DELETE SET NULL,
  file_path  TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at   TIMESTAMPTZ,
  size_bytes BIGINT
);

-- ── 4. Signals (Full Audit Trail) ───────────────────────────
CREATE TABLE signals (
  id       SERIAL PRIMARY KEY,
  -- Explicitly link signal to the feed it targeted
  feed_id  INT REFERENCES feeds(id) ON DELETE SET NULL, 
  signal   TEXT NOT NULL,       -- e.g., 'warn', 'disable_pen'
  params   JSONB,               
  sent_at  TIMESTAMPTZ DEFAULT NOW(),
  sent_by  TEXT NOT NULL        -- 'admin' or 'pen_app'
);

-- ── Enhanced Indexes ────────────────────────────────────────
CREATE INDEX idx_feeds_active        ON feeds (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_detections_feed     ON detections (feed_id);
CREATE INDEX idx_signals_feed        ON signals (feed_id);
CREATE INDEX idx_signals_time_type   ON signals (sent_at DESC, signal);