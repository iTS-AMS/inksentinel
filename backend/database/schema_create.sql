-- ============================================================
--  InkSentinel — Full Schema  (v5, clean install)
--
--  No seed data in this file. Run seed_data.sql separately.
--
--  DROP ORDER follows FK dependencies.
-- ============================================================

DROP TABLE IF EXISTS student_sections   CASCADE;
DROP TABLE IF EXISTS session_feeds      CASCADE;
DROP TABLE IF EXISTS signals            CASCADE;
DROP TABLE IF EXISTS detections         CASCADE;
DROP TABLE IF EXISTS video_segments     CASCADE;
DROP TABLE IF EXISTS feeds              CASCADE;
DROP TABLE IF EXISTS exam_sessions      CASCADE;
DROP TABLE IF EXISTS students           CASCADE;
DROP TABLE IF EXISTS sections           CASCADE;
DROP TABLE IF EXISTS courses            CASCADE;

DROP VIEW IF EXISTS exams                  CASCADE;
DROP VIEW IF EXISTS exam_student_sessions  CASCADE;
DROP VIEW IF EXISTS logs                   CASCADE;
DROP VIEW IF EXISTS ai_alerts              CASCADE;


-- ════════════════════════════════════════════════════════════
--  REFERENCE / ROSTER TABLES
-- ════════════════════════════════════════════════════════════

CREATE TABLE courses (
  course_code  TEXT PRIMARY KEY,
  course_name  TEXT NOT NULL,
  credits      INT  DEFAULT 3,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sections (
  section_id    SERIAL PRIMARY KEY,
  course_code   TEXT NOT NULL
                REFERENCES courses(course_code) ON DELETE CASCADE,
  section_name  TEXT NOT NULL,
  initials      TEXT,
  year          INT  NOT NULL DEFAULT 2026,
  year_session  TEXT NOT NULL
                CHECK (year_session IN ('Spring','Summer','Fall')),
  UNIQUE (course_code, section_name, year, year_session)
);
CREATE INDEX idx_sections_course ON sections (course_code);

CREATE TABLE students (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  student_id   TEXT UNIQUE NOT NULL,
  email        TEXT,
  section_id   INT  REFERENCES sections(section_id) ON DELETE SET NULL,
  seat_number  INT,
  pen_unit_id  INT,
  client_id    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_students_student_id ON students (student_id);
CREATE INDEX idx_students_section    ON students (section_id);

CREATE TABLE student_sections (
  id         SERIAL PRIMARY KEY,
  std_id     TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  section_id INT  NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
  UNIQUE (std_id, section_id)
);
CREATE INDEX idx_student_sections_std ON student_sections (std_id);
CREATE INDEX idx_student_sections_sec ON student_sections (section_id);


-- ════════════════════════════════════════════════════════════
--  EXAM SESSIONS
-- ════════════════════════════════════════════════════════════

CREATE TABLE exam_sessions (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  course_name      TEXT,
  instructor_name  TEXT,
  time_block       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  -- Extended fields
  duration_ms      BIGINT,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','ended')),
  exam_type        TEXT DEFAULT 'midterm'
                   CHECK (exam_type IN ('quiz','midterm','final','mock')),
  section_id       INT REFERENCES sections(section_id) ON DELETE SET NULL
);
CREATE INDEX idx_sessions_active  ON exam_sessions (ended_at) WHERE ended_at IS NULL;
CREATE INDEX idx_sessions_section ON exam_sessions (section_id);


-- ════════════════════════════════════════════════════════════
--  FEEDS
-- ════════════════════════════════════════════════════════════

CREATE TABLE feeds (
  id          SERIAL PRIMARY KEY,
  label       TEXT NOT NULL,
  client_id   TEXT UNIQUE NOT NULL,
  connected   BOOLEAN DEFAULT false,
  camera_id   TEXT UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);
CREATE INDEX idx_feeds_active    ON feeds (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_feeds_camera_id ON feeds (camera_id)  WHERE camera_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════
--  SESSION_FEEDS  (attendance)
-- ════════════════════════════════════════════════════════════

CREATE TABLE session_feeds (
  id                SERIAL PRIMARY KEY,
  session_id        INT REFERENCES exam_sessions(id) ON DELETE CASCADE,
  feed_id           INT REFERENCES feeds(id)         ON DELETE SET NULL,
  feed_label        TEXT NOT NULL,
  candidate_name    TEXT,
  connected_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Extended fields
  student_id        INT REFERENCES students(id)      ON DELETE SET NULL,
  time_remaining_ms BIGINT,
  student_status    TEXT NOT NULL DEFAULT 'present'
                    CHECK (student_status IN
                      ('present','absent','submitted','flagged','paused')),
  UNIQUE (session_id, feed_id)
);
CREATE INDEX idx_session_feeds_session ON session_feeds (session_id);
CREATE INDEX idx_session_feeds_feed    ON session_feeds (feed_id);
CREATE INDEX idx_session_feeds_student ON session_feeds (student_id);
CREATE INDEX idx_session_feeds_status  ON session_feeds (student_status);


-- ════════════════════════════════════════════════════════════
--  DETECTIONS
-- ════════════════════════════════════════════════════════════

CREATE TABLE detections (
  id               SERIAL PRIMARY KEY,
  session_id       INT REFERENCES exam_sessions(id) ON DELETE SET NULL,
  feed_id          INT REFERENCES feeds(id)         ON DELETE SET NULL,
  detected_at      TIMESTAMPTZ NOT NULL,
  class_label      TEXT NOT NULL,
  confidence       FLOAT CHECK (confidence BETWEEN 0 AND 1),
  alert_clip_path  TEXT,
  image_reference  TEXT,
  notes            TEXT
);
CREATE INDEX idx_detections_session ON detections (session_id, detected_at DESC);
CREATE INDEX idx_detections_feed    ON detections (feed_id, detected_at DESC);
CREATE INDEX idx_detections_class   ON detections (class_label);


-- ════════════════════════════════════════════════════════════
--  VIDEO_SEGMENTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE video_segments (
  id          SERIAL PRIMARY KEY,
  session_id  INT REFERENCES exam_sessions(id) ON DELETE SET NULL,
  feed_id     INT REFERENCES feeds(id)         ON DELETE SET NULL,
  file_path   TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  size_bytes  BIGINT
);
CREATE INDEX idx_segments_session ON video_segments (session_id);
CREATE INDEX idx_segments_feed    ON video_segments (feed_id, started_at DESC);


-- ════════════════════════════════════════════════════════════
--  SIGNALS
-- ════════════════════════════════════════════════════════════

CREATE TABLE signals (
  id             SERIAL PRIMARY KEY,
  session_id     INT REFERENCES exam_sessions(id) ON DELETE SET NULL,
  feed_id        INT REFERENCES feeds(id)         ON DELETE SET NULL,
  signal         TEXT NOT NULL,
  params         JSONB,
  sent_at        TIMESTAMPTZ DEFAULT NOW(),
  sent_by        TEXT NOT NULL,
  action_type    TEXT DEFAULT 'exam_control'
                 CHECK (action_type IN ('exam_control','unit_control','system')),
  invigilator_id TEXT
);
CREATE INDEX idx_signals_session    ON signals (session_id, sent_at DESC);
CREATE INDEX idx_signals_feed       ON signals (feed_id);
CREATE INDEX idx_signals_sent_by    ON signals (sent_by);
CREATE INDEX idx_signals_type       ON signals (action_type);
CREATE INDEX idx_signals_invigilator ON signals (invigilator_id);


-- ════════════════════════════════════════════════════════════
--  COMPATIBILITY VIEWS
-- ════════════════════════════════════════════════════════════

CREATE VIEW exams AS
SELECT id, name, duration_ms AS duration,
  created_at AS start_time, ended_at AS end_time,
  status, exam_type, section_id
FROM exam_sessions;

CREATE VIEW exam_student_sessions AS
SELECT sf.id, sf.session_id AS exam_id, sf.student_id,
  sf.time_remaining_ms AS time_remaining,
  sf.student_status AS status,
  sf.feed_id, sf.feed_label, sf.candidate_name, sf.connected_at
FROM session_feeds sf;

CREATE VIEW logs AS
SELECT id, sent_at AS timestamp, action_type, invigilator_id,
  session_id, feed_id, signal AS command, params AS details, sent_by
FROM signals;

CREATE VIEW ai_alerts AS
SELECT d.id, d.feed_id AS student_feed_id, sf.student_id,
  d.detected_at AS timestamp, d.class_label AS label_detected,
  d.confidence, d.image_reference, d.alert_clip_path,
  d.session_id, d.notes
FROM detections d
LEFT JOIN session_feeds sf
  ON sf.feed_id = d.feed_id AND sf.session_id = d.session_id;


-- ════════════════════════════════════════════════════════════
--  VERIFY (run after creation to check all tables exist)
-- ════════════════════════════════════════════════════════════
SELECT table_name
FROM   information_schema.tables
WHERE  table_schema = 'public'
ORDER  BY table_name;
-- Expected tables: courses, detections, exam_sessions, feeds,
-- section_feeds, sections, signals, student_sections, students,
-- video_segments
-- Expected views: ai_alerts, exam_student_sessions, exams, logs
