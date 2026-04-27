-- ============================================================
--  InkSentinel — user_settings table
--  Run once against the surveillance DB.
--  Stores per-user UI and proctoring preferences.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  username              TEXT        PRIMARY KEY,  -- matches the login username
  theme                 TEXT        NOT NULL DEFAULT 'system'
                                    CHECK (theme IN ('light','dark','system')),
  language              TEXT        NOT NULL DEFAULT 'english'
                                    CHECK (language IN ('english','bangla')),
  font_scale            INT         NOT NULL DEFAULT 100
                                    CHECK (font_scale BETWEEN 70 AND 150),
  movement_threshold    INT         NOT NULL DEFAULT 45
                                    CHECK (movement_threshold BETWEEN 0 AND 100),
  audio_sensitivity     INT         NOT NULL DEFAULT 72
                                    CHECK (audio_sensitivity BETWEEN 0 AND 100),
  backend_url           TEXT        NOT NULL DEFAULT 'http://localhost:3000',
  ai_url                TEXT        NOT NULL DEFAULT 'http://localhost:9999',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verify
SELECT column_name, data_type, column_default
FROM   information_schema.columns
WHERE  table_name = 'user_settings'
ORDER  BY ordinal_position;




-- ============================================================
--  surveillance DB — feeds table extension + camera_links view
--
--  Adds an `available` computed column approach via a view
--  so the feeds table dropdown in index.html can show which
--  cameras are: Live (connected), Available (registered, offline),
--  or Unregistered (no camera_id yet).
--
--  Run once:
--    psql -U <user> -d <db> -f feeds_available_migration.sql
-- ============================================================

-- ── 1. camera_links table ────────────────────────────────────
-- Persists room-level seat-to-camera assignments across sessions.
-- The modal "Link" button in index.html writes here so the
-- assignment survives a page refresh.

CREATE TABLE IF NOT EXISTS camera_links (
  id          SERIAL      PRIMARY KEY,
  seat_label  TEXT        NOT NULL UNIQUE,   -- e.g. "Seat 01"
  feed_id     INT         REFERENCES feeds(id) ON DELETE SET NULL,
  camera_id   TEXT,                          -- CAM-XXXX snapshot for display
  feed_label  TEXT,                          -- feed.label snapshot
  status      TEXT        NOT NULL DEFAULT 'free'
              CHECK (status IN ('linked', 'free', 'disconnected')),
  linked_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camera_links_feed   ON camera_links (feed_id);
CREATE INDEX IF NOT EXISTS idx_camera_links_status ON camera_links (status);

-- ── 2. feeds_available view ──────────────────────────────────
-- Derives availability from live feeds state.
-- Used by GET /api/feeds so the dropdown shows correct status
-- without an extra DB column that can go stale.
--
--   status = 'live'        → connected = true
--   status = 'available'   → connected = false, camera_id IS NOT NULL
--   status = 'unregistered'→ camera_id IS NULL

CREATE OR REPLACE VIEW feeds_available AS
SELECT
  f.id,
  f.label,
  f.client_id,
  f.connected,
  f.camera_id,
  f.created_at,
  f.deleted_at,
  CASE
    WHEN f.connected              THEN 'live'
    WHEN f.camera_id IS NOT NULL  THEN 'available'
    ELSE                               'unregistered'
  END AS availability,
  cl.seat_label AS linked_seat     -- NULL if not linked to any seat
FROM  feeds f
LEFT  JOIN camera_links cl ON cl.feed_id = f.id
WHERE f.deleted_at IS NULL;

-- ── 3. Verify ────────────────────────────────────────────────
SELECT 'camera_links' AS object, COUNT(*) FROM camera_links
UNION ALL
SELECT 'feeds_available (view)', COUNT(*) FROM feeds_available;



DROP TABLE IF EXISTS user_settings;

CREATE TABLE user_settings (
  username              TEXT        PRIMARY KEY,
  theme                 TEXT        NOT NULL DEFAULT 'system'
                                    CHECK (theme IN ('light','dark','system')),
  language              TEXT        NOT NULL DEFAULT 'english'
                                    CHECK (language IN ('english','bangla')),
  font_scale            INT         NOT NULL DEFAULT 100
                                    CHECK (font_scale BETWEEN 70 AND 150),
  movement_threshold    INT         NOT NULL DEFAULT 45
                                    CHECK (movement_threshold BETWEEN 0 AND 100),
  audio_sensitivity     INT         NOT NULL DEFAULT 72
                                    CHECK (audio_sensitivity BETWEEN 0 AND 100),
  backend_url           TEXT        NOT NULL DEFAULT 'http://localhost:3000',
  ai_url                TEXT        NOT NULL DEFAULT 'http://localhost:9999',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);