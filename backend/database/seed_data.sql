-- ============================================================
--  InkSentinel — Seed Data
--
--  Run AFTER schema_v5_merged.sql (fresh install)
--  OR AFTER schema_v5_existing_db_migration.sql (existing DB)
--
--  Contains realistic dummy values for every table:
--    courses, sections, students, student_sections,
--    exam_sessions, feeds, session_feeds,
--    detections, video_segments, signals
--
--  Safe to re-run — all inserts use ON CONFLICT DO NOTHING.
--  To reset: TRUNCATE all tables in reverse FK order first.
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  COURSES  (7 courses across CSE and MAT departments)
-- ════════════════════════════════════════════════════════════
INSERT INTO courses (course_code, course_name, credits) VALUES
  ('CSE215', 'Data Structures',                 3),
  ('CSE225', 'Algorithms',                       3),
  ('CSE299', 'Junior Design Project',            3),
  ('CSE300', 'Senior Design Project',            3),
  ('CSE311', 'Database Systems',                 3),
  ('CSE331', 'Computer Networks',                3),
  ('MAT361', 'Engineering Mathematics III',      3)
ON CONFLICT (course_code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  SECTIONS  (2026 Spring and Summer, multiple per course)
-- ════════════════════════════════════════════════════════════
INSERT INTO sections
  (course_code, section_name, initials, year, year_session)
VALUES
  -- CSE299 Spring 2026
  ('CSE299', '06',  'SvA', 2026, 'Spring'),
  ('CSE299', '07',  'RaH', 2026, 'Spring'),
  ('CSE299', '08',  'MsR', 2026, 'Spring'),
  -- CSE300 Spring 2026
  ('CSE300', '04',  'JDP', 2026, 'Spring'),
  ('CSE300', '05',  'KhM', 2026, 'Spring'),
  -- CSE311 Spring 2026
  ('CSE311', '01',  'TaA', 2026, 'Spring'),
  ('CSE311', '02',  'FaB', 2026, 'Spring'),
  -- CSE331 Spring 2026
  ('CSE331', '03',  'NkS', 2026, 'Spring'),
  -- CSE215 Summer 2026
  ('CSE215', '01',  'SvA', 2026, 'Summer'),
  ('CSE215', '02',  'RaH', 2026, 'Summer'),
  -- CSE225 Summer 2026
  ('CSE225', '01',  'MsR', 2026, 'Summer'),
  -- MAT361 Spring 2026
  ('MAT361', '05',  'FaB', 2026, 'Spring')
ON CONFLICT (course_code, section_name, year, year_session) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  STUDENTS  (20 students with realistic NSU-style IDs)
--  section_id linked to their primary exam section.
--  pen_unit_id maps to their Wemos device (1-indexed).
-- ════════════════════════════════════════════════════════════
INSERT INTO students
  (name, student_id, email, seat_number, pen_unit_id)
VALUES
  -- CSE299/06 group (seats 1-5)
  ('Ahmed Rahman',       '2212345678', 'ahmed.rahman@northsouth.edu',       1,  1),
  ('Tasnim Hossain',     '2212345679', 'tasnim.hossain@northsouth.edu',      2,  2),
  ('Rafi Islam',         '2212345680', 'rafi.islam@northsouth.edu',          3,  3),
  ('Nadia Akter',        '2212345681', 'nadia.akter@northsouth.edu',         4,  4),
  ('Shibli Sadik',       '2212345682', 'shibli.sadik@northsouth.edu',        5,  5),
  -- CSE300/04 group (seats 6-10)
  ('Lamia Chowdhury',    '2212345683', 'lamia.chowdhury@northsouth.edu',     6,  6),
  ('Tanvir Hasan',       '2212345684', 'tanvir.hasan@northsouth.edu',        7,  7),
  ('Sadia Islam',        '2212345685', 'sadia.islam@northsouth.edu',         8,  8),
  ('Mehrab Hossain',     '2212345686', 'mehrab.hossain@northsouth.edu',      9,  9),
  ('Fariha Noor',        '2212345687', 'fariha.noor@northsouth.edu',         10, 10),
  -- CSE311/01 group (seats 11-15)
  ('Ishrak Ahmed',       '2212345688', 'ishrak.ahmed@northsouth.edu',        11, 11),
  ('Sabrina Kabir',      '2212345689', 'sabrina.kabir@northsouth.edu',       12, 12),
  ('Raquibul Hasan',     '2212345690', 'raquibul.hasan@northsouth.edu',      13, 13),
  ('Samia Rahman',       '2212345691', 'samia.rahman@northsouth.edu',        14, 14),
  ('Nafis Ul Haque',     '2212345692', 'nafis.haque@northsouth.edu',         15, 15),
  -- CSE331/03 group (seats 16-20)
  ('Zarif Chowdhury',    '2212345693', 'zarif.chowdhury@northsouth.edu',     16, 16),
  ('Momo Akter',         '2212345694', 'momo.akter@northsouth.edu',          17, 17),
  ('Tahmid Islam',       '2212345695', 'tahmid.islam@northsouth.edu',        18, 18),
  ('Nusrat Jahan',       '2212345696', 'nusrat.jahan@northsouth.edu',        19, 19),
  ('Rezwan Ul Karim',    '2212345697', 'rezwan.karim@northsouth.edu',        20, 20)
ON CONFLICT (student_id) DO NOTHING;

-- Link students to their primary section
UPDATE students SET section_id = (
  SELECT section_id FROM sections
  WHERE course_code='CSE299' AND section_name='06'
  AND year=2026 AND year_session='Spring' LIMIT 1
) WHERE student_id IN (
  '2212345678','2212345679','2212345680','2212345681','2212345682'
);

UPDATE students SET section_id = (
  SELECT section_id FROM sections
  WHERE course_code='CSE300' AND section_name='04'
  AND year=2026 AND year_session='Spring' LIMIT 1
) WHERE student_id IN (
  '2212345683','2212345684','2212345685','2212345686','2212345687'
);

UPDATE students SET section_id = (
  SELECT section_id FROM sections
  WHERE course_code='CSE311' AND section_name='01'
  AND year=2026 AND year_session='Spring' LIMIT 1
) WHERE student_id IN (
  '2212345688','2212345689','2212345690','2212345691','2212345692'
);

UPDATE students SET section_id = (
  SELECT section_id FROM sections
  WHERE course_code='CSE331' AND section_name='03'
  AND year=2026 AND year_session='Spring' LIMIT 1
) WHERE student_id IN (
  '2212345693','2212345694','2212345695','2212345696','2212345697'
);


-- ════════════════════════════════════════════════════════════
--  STUDENT_SECTIONS  (enrollment records)
--  Each student enrolled in their primary section.
--  A few students enrolled in a second elective section
--  to show the many-to-many relationship works.
-- ════════════════════════════════════════════════════════════

-- CSE299/06 enrollment
INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id
FROM students s, sections sec
WHERE s.student_id IN (
  '2212345678','2212345679','2212345680','2212345681','2212345682'
)
AND sec.course_code='CSE299' AND sec.section_name='06'
AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;

-- CSE300/04 enrollment
INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id
FROM students s, sections sec
WHERE s.student_id IN (
  '2212345683','2212345684','2212345685','2212345686','2212345687'
)
AND sec.course_code='CSE300' AND sec.section_name='04'
AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;

-- CSE311/01 enrollment
INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id
FROM students s, sections sec
WHERE s.student_id IN (
  '2212345688','2212345689','2212345690','2212345691','2212345692'
)
AND sec.course_code='CSE311' AND sec.section_name='01'
AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;

-- CSE331/03 enrollment
INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id
FROM students s, sections sec
WHERE s.student_id IN (
  '2212345693','2212345694','2212345695','2212345696','2212345697'
)
AND sec.course_code='CSE331' AND sec.section_name='03'
AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;

-- Cross-enrollment: 3 students also taking MAT361/05 as an elective
INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id
FROM students s, sections sec
WHERE s.student_id IN ('2212345678','2212345683','2212345688')
AND sec.course_code='MAT361' AND sec.section_name='05'
AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  EXAM_SESSIONS  (3 sessions: 1 ended, 1 active, 1 ended)
-- ════════════════════════════════════════════════════════════
INSERT INTO exam_sessions
  (name, course_name, instructor_name, time_block,
   duration_ms, status, exam_type, section_id, created_at, ended_at)
VALUES
  -- Session 1: CSE299 midterm — ended, has detections
  (
    'CSE299_Midterm_Spring2026',
    'Junior Design Project',
    'SvA',
    '09:00 – 11:00',
    7200000,          -- 2 hours
    'ended',
    'midterm',
    (SELECT section_id FROM sections
     WHERE course_code='CSE299' AND section_name='06'
     AND year=2026 AND year_session='Spring' LIMIT 1),
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days' + INTERVAL '2 hours'
  ),
  -- Session 2: CSE300 quiz — active right now
  (
    'CSE300_Quiz1_Spring2026',
    'Senior Design Project',
    'JDP',
    '14:00 – 15:00',
    3600000,          -- 1 hour
    'active',
    'quiz',
    (SELECT section_id FROM sections
     WHERE course_code='CSE300' AND section_name='04'
     AND year=2026 AND year_session='Spring' LIMIT 1),
    NOW() - INTERVAL '30 minutes',
    NULL              -- still active
  ),
  -- Session 3: CSE311 final — ended, clean session (no incidents)
  (
    'CSE311_Final_Spring2026',
    'Database Systems',
    'TaA',
    '10:00 – 13:00',
    10800000,         -- 3 hours
    'ended',
    'final',
    (SELECT section_id FROM sections
     WHERE course_code='CSE311' AND section_name='01'
     AND year=2026 AND year_session='Spring' LIMIT 1),
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days' + INTERVAL '3 hours'
  )
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  FEEDS  (5 webcam seats — soft-deleted after session 1,
--          then recreated for session 2 on new connect)
-- ════════════════════════════════════════════════════════════
INSERT INTO feeds (label, client_id, connected, deleted_at) VALUES
  -- Active seats (session 2 — CSE300 quiz, currently running)
  ('Seat 01', '192.168.43.101_Seat 01', false, NULL),
  ('Seat 02', '192.168.43.102_Seat 02', false, NULL),
  ('Seat 03', '192.168.43.103_Seat 03', false, NULL),
  ('Seat 04', '192.168.43.104_Seat 04', false, NULL),
  ('Seat 05', '192.168.43.105_Seat 05', false, NULL)
ON CONFLICT (client_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  SESSION_FEEDS  (attendance records)
--  Session 1: 5 seats, all students assigned, all present
--  Session 2: 5 seats, 4 assigned, 1 absent
--  Session 3: 4 seats (one student was absent)
-- ════════════════════════════════════════════════════════════

-- Session 1 attendance (CSE299 midterm)
INSERT INTO session_feeds
  (session_id, feed_id, feed_label, candidate_name, student_id,
   time_remaining_ms, student_status, connected_at)
VALUES
  (1, 1, 'Seat 01', 'Ahmed Rahman',
   (SELECT id FROM students WHERE student_id='2212345678'),
   0, 'submitted',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '2 minutes'),
  (1, 2, 'Seat 02', 'Tasnim Hossain',
   (SELECT id FROM students WHERE student_id='2212345679'),
   0, 'submitted',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '3 minutes'),
  (1, 3, 'Seat 03', 'Rafi Islam',
   (SELECT id FROM students WHERE student_id='2212345680'),
   0, 'flagged',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '1 minute'),
  (1, 4, 'Seat 04', 'Nadia Akter',
   (SELECT id FROM students WHERE student_id='2212345681'),
   0, 'submitted',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '4 minutes'),
  (1, 5, 'Seat 05', 'Shibli Sadik',
   (SELECT id FROM students WHERE student_id='2212345682'),
   0, 'submitted',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '2 minutes')
ON CONFLICT DO NOTHING;

-- Session 2 attendance (CSE300 quiz — active)
INSERT INTO session_feeds
  (session_id, feed_id, feed_label, candidate_name, student_id,
   time_remaining_ms, student_status, connected_at)
VALUES
  (2, 1, 'Seat 01', 'Lamia Chowdhury',
   (SELECT id FROM students WHERE student_id='2212345683'),
   1800000, 'present',
   (SELECT created_at FROM exam_sessions WHERE id=2) + INTERVAL '1 minute'),
  (2, 2, 'Seat 02', 'Tanvir Hasan',
   (SELECT id FROM students WHERE student_id='2212345684'),
   1800000, 'present',
   (SELECT created_at FROM exam_sessions WHERE id=2) + INTERVAL '2 minutes'),
  (2, 3, 'Seat 03', 'Sadia Islam',
   (SELECT id FROM students WHERE student_id='2212345685'),
   1800000, 'paused',   -- individually paused (stepped out)
   (SELECT created_at FROM exam_sessions WHERE id=2) + INTERVAL '1 minute'),
  (2, 4, 'Seat 04', 'Mehrab Hossain',
   (SELECT id FROM students WHERE student_id='2212345686'),
   1800000, 'present',
   (SELECT created_at FROM exam_sessions WHERE id=2) + INTERVAL '3 minutes'),
  (2, 5, 'Seat 05', NULL,
   NULL,
   0, 'absent',         -- seat registered but no student showed up
   (SELECT created_at FROM exam_sessions WHERE id=2))
ON CONFLICT DO NOTHING;

-- Session 3 attendance (CSE311 final — ended, clean)
INSERT INTO session_feeds
  (session_id, feed_id, feed_label, candidate_name, student_id,
   time_remaining_ms, student_status, connected_at)
VALUES
  (3, 1, 'Seat 01', 'Ishrak Ahmed',
   (SELECT id FROM students WHERE student_id='2212345688'),
   0, 'submitted',
   (SELECT created_at FROM exam_sessions WHERE id=3) + INTERVAL '2 minutes'),
  (3, 2, 'Seat 02', 'Sabrina Kabir',
   (SELECT id FROM students WHERE student_id='2212345689'),
   0, 'submitted',
   (SELECT created_at FROM exam_sessions WHERE id=3) + INTERVAL '1 minute'),
  (3, 3, 'Seat 03', 'Raquibul Hasan',
   (SELECT id FROM students WHERE student_id='2212345690'),
   0, 'submitted',
   (SELECT created_at FROM exam_sessions WHERE id=3) + INTERVAL '5 minutes'),
  (3, 4, 'Seat 04', 'Samia Rahman',
   (SELECT id FROM students WHERE student_id='2212345691'),
   0, 'submitted',
   (SELECT created_at FROM exam_sessions WHERE id=3) + INTERVAL '2 minutes')
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  DETECTIONS  (session 1 only — CSE299 midterm had incidents)
--  7 detections across 3 feeds, realistic timestamps
-- ════════════════════════════════════════════════════════════
INSERT INTO detections
  (session_id, feed_id, detected_at, class_label, confidence, notes)
VALUES
  -- Seat 01 (Ahmed Rahman) — 3 phone detections
  (1, 1,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '18 minutes',
   'phone', 0.92, NULL),
  (1, 1,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '34 minutes',
   'phone', 0.88, 'Student warned verbally'),
  (1, 1,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '67 minutes',
   'phone', 0.94, 'Second warning issued'),

  -- Seat 03 (Rafi Islam) — cheatsheet + phone
  (1, 3,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '22 minutes',
   'cheatsheet', 0.76, NULL),
  (1, 3,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '55 minutes',
   'looking_away', 0.71, NULL),

  -- Seat 04 (Nadia Akter) — 2 cheating detections
  (1, 4,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '41 minutes',
   'cheating', 0.95, 'Appeared to copy from neighbour'),
  (1, 4,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '89 minutes',
   'cheating', 0.87, 'Same behaviour repeated')
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  VIDEO_SEGMENTS  (session 1, feeds 1–4, two 10-min segments each)
--  Paths use the session name as folder, matching recorder.js
-- ════════════════════════════════════════════════════════════
INSERT INTO video_segments
  (session_id, feed_id, file_path, started_at, ended_at, size_bytes)
VALUES
  -- Seat 01 (two segments)
  (1, 1,
   'recordings/CSE299_Midterm_Spring2026/Seat_01/Seat_01_seg_0000_2026-04-13_09-00-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1),
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '10 minutes',
   158000000),
  (1, 1,
   'recordings/CSE299_Midterm_Spring2026/Seat_01/Seat_01_seg_0001_2026-04-13_09-10-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '10 minutes',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '20 minutes',
   161000000),

  -- Seat 02 (two segments)
  (1, 2,
   'recordings/CSE299_Midterm_Spring2026/Seat_02/Seat_02_seg_0000_2026-04-13_09-00-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1),
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '10 minutes',
   155000000),
  (1, 2,
   'recordings/CSE299_Midterm_Spring2026/Seat_02/Seat_02_seg_0001_2026-04-13_09-10-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '10 minutes',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '20 minutes',
   157000000),

  -- Seat 03 (two segments)
  (1, 3,
   'recordings/CSE299_Midterm_Spring2026/Seat_03/Seat_03_seg_0000_2026-04-13_09-00-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1),
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '10 minutes',
   162000000),
  (1, 3,
   'recordings/CSE299_Midterm_Spring2026/Seat_03/Seat_03_seg_0001_2026-04-13_09-10-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '10 minutes',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '20 minutes',
   159000000),

  -- Seat 04 (two segments)
  (1, 4,
   'recordings/CSE299_Midterm_Spring2026/Seat_04/Seat_04_seg_0000_2026-04-13_09-00-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1),
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '10 minutes',
   160000000),
  (1, 4,
   'recordings/CSE299_Midterm_Spring2026/Seat_04/Seat_04_seg_0001_2026-04-13_09-10-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '10 minutes',
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '20 minutes',
   163000000)
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  SIGNALS  (realistic command history across both sessions)
--  action_type and invigilator_id populated for all rows.
-- ════════════════════════════════════════════════════════════
INSERT INTO signals
  (session_id, feed_id, signal, params, sent_at, sent_by,
   action_type, invigilator_id)
VALUES

  -- ── Session 1 (CSE299 midterm) ──────────────────────────

  -- Set 2h timer then start
  (1, NULL,
   'timer',
   '{"cmd":"timer","duration_ms":7200000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1) - INTERVAL '2 minutes',
   'admin', 'exam_control', 'admin'),

  (1, NULL,
   'start',
   '{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1),
   'admin', 'exam_control', 'admin'),

  -- Warn Seat 01 (Ahmed) after first phone detection
  (1, 1,
   'warn',
   '{"cmd":"warn","device_id":1}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '19 minutes',
   'admin', 'unit_control', 'admin'),

  -- Warn Seat 03 (Rafi) after cheatsheet
  (1, 3,
   'warn',
   '{"cmd":"warn","device_id":3}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '23 minutes',
   'admin', 'unit_control', 'admin'),

  -- Halfway pause then resume
  (1, NULL,
   'pause',
   '{"cmd":"pause"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '60 minutes',
   'admin', 'exam_control', 'admin'),

  (1, NULL,
   'start',
   '{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '65 minutes',
   'admin', 'exam_control', 'admin'),

  -- Disable Seat 04 (Nadia) after confirmed cheating
  (1, 4,
   'disable',
   '{"cmd":"disable","device_id":4,"punish_ms":300000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '42 minutes',
   'admin', 'unit_control', 'admin'),

  -- Deduct 5 min from Seat 01 (second offence)
  (1, 1,
   'deduct',
   '{"cmd":"deduct","device_id":1,"time_ms":300000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1) + INTERVAL '68 minutes',
   'admin', 'unit_control', 'admin'),

  -- End signal
  (1, NULL,
   'end',
   '{"cmd":"end"}'::jsonb,
   (SELECT ended_at FROM exam_sessions WHERE id=1),
   'admin', 'exam_control', 'admin'),

  -- ── Session 2 (CSE300 quiz — active) ────────────────────

  -- Set 1h timer then start
  (2, NULL,
   'timer',
   '{"cmd":"timer","duration_ms":3600000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2) - INTERVAL '1 minute',
   'admin', 'exam_control', 'admin'),

  (2, NULL,
   'start',
   '{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2),
   'admin', 'exam_control', 'admin'),

  -- Pause Seat 03 (Sadia stepped out)
  (2, 3,
   'disable',
   '{"cmd":"disable","device_id":3}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2) + INTERVAL '15 minutes',
   'admin', 'unit_control', 'admin'),

  -- Pen app: student reset from pen device
  (2, NULL,
   'reset',
   '{"cmd":"reset","transport":"ble"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2) + INTERVAL '5 minutes',
   'pen_app', 'exam_control', 'pen_app')

ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  VERIFICATION QUERY
--  Run this after seeding to confirm all counts.
-- ════════════════════════════════════════════════════════════
SELECT tbl, cnt FROM (
  SELECT 'courses'          AS tbl, COUNT(*) AS cnt FROM courses
  UNION ALL
  SELECT 'sections',               COUNT(*)          FROM sections
  UNION ALL
  SELECT 'students',               COUNT(*)          FROM students
  UNION ALL
  SELECT 'student_sections',       COUNT(*)          FROM student_sections
  UNION ALL
  SELECT 'exam_sessions',          COUNT(*)          FROM exam_sessions
  UNION ALL
  SELECT 'feeds',                  COUNT(*)          FROM feeds
  UNION ALL
  SELECT 'session_feeds',          COUNT(*)          FROM session_feeds
  UNION ALL
  SELECT 'detections',             COUNT(*)          FROM detections
  UNION ALL
  SELECT 'video_segments',         COUNT(*)          FROM video_segments
  UNION ALL
  SELECT 'signals',                COUNT(*)          FROM signals
) t ORDER BY tbl;

-- Expected row counts:
--   courses           7
--   detections        7
--   exam_sessions     3
--   feeds             5
--   sections         12
--   session_feeds    14
--   signals          13
--   student_sections 23   (20 primary + 3 cross-enrolled in MAT361)
--   students         20
--   video_segments    8
