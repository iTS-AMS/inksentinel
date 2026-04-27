-- ============================================================
--  InkSentinel — Seed Data v2  (expanded)
--
--  Run AFTER schema_v5_merged.sql OR schema_v5_existing_db_migration.sql
--  Safe to re-run — ON CONFLICT DO NOTHING on all inserts.
--
--  Row targets (none exceed 50):
--    courses          7     sections        12
--    students        20     student_sections 23
--    exam_sessions    5     feeds            5
--    session_feeds   24     detections      30
--    video_segments  20     signals         44
-- ============================================================


-- ════════════════════════════════════════════════════════════
--  COURSES
-- ════════════════════════════════════════════════════════════
INSERT INTO courses (course_code, course_name, credits) VALUES
  ('CSE215', 'Data Structures',                 3),
  ('CSE225', 'Algorithms',                      3),
  ('CSE299', 'Junior Design Project',           3),
  ('CSE300', 'Senior Design Project',           3),
  ('CSE311', 'Database Systems',                3),
  ('CSE331', 'Computer Networks',               3),
  ('MAT361', 'Engineering Mathematics III',     3)
ON CONFLICT (course_code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  SECTIONS  (12 sections across Spring + Summer 2026)
-- ════════════════════════════════════════════════════════════
INSERT INTO sections
  (course_code, section_name, initials, year, year_session)
VALUES
  ('CSE299', '06',  'SvA', 2026, 'Spring'),
  ('CSE299', '07',  'RaH', 2026, 'Spring'),
  ('CSE299', '08',  'MsR', 2026, 'Spring'),
  ('CSE300', '04',  'JDP', 2026, 'Spring'),
  ('CSE300', '05',  'KhM', 2026, 'Spring'),
  ('CSE311', '01',  'TaA', 2026, 'Spring'),
  ('CSE311', '02',  'FaB', 2026, 'Spring'),
  ('CSE331', '03',  'NkS', 2026, 'Spring'),
  ('CSE215', '01',  'SvA', 2026, 'Summer'),
  ('CSE215', '02',  'RaH', 2026, 'Summer'),
  ('CSE225', '01',  'MsR', 2026, 'Summer'),
  ('MAT361', '05',  'FaB', 2026, 'Spring')
ON CONFLICT (course_code, section_name, year, year_session) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  STUDENTS  (20 students, seats 1-20, pen units 1-20)
-- ════════════════════════════════════════════════════════════
INSERT INTO students
  (name, student_id, email, seat_number, pen_unit_id)
VALUES
  ('Ahmed Rahman',      '2212345678', 'ahmed.rahman@northsouth.edu',      1,  1),
  ('Tasnim Hossain',    '2212345679', 'tasnim.hossain@northsouth.edu',     2,  2),
  ('Rafi Islam',        '2212345680', 'rafi.islam@northsouth.edu',         3,  3),
  ('Nadia Akter',       '2212345681', 'nadia.akter@northsouth.edu',        4,  4),
  ('Shibli Sadik',      '2212345682', 'shibli.sadik@northsouth.edu',       5,  5),
  ('Lamia Chowdhury',   '2212345683', 'lamia.chowdhury@northsouth.edu',    6,  6),
  ('Tanvir Hasan',      '2212345684', 'tanvir.hasan@northsouth.edu',       7,  7),
  ('Sadia Islam',       '2212345685', 'sadia.islam@northsouth.edu',        8,  8),
  ('Mehrab Hossain',    '2212345686', 'mehrab.hossain@northsouth.edu',     9,  9),
  ('Fariha Noor',       '2212345687', 'fariha.noor@northsouth.edu',        10, 10),
  ('Ishrak Ahmed',      '2212345688', 'ishrak.ahmed@northsouth.edu',       11, 11),
  ('Sabrina Kabir',     '2212345689', 'sabrina.kabir@northsouth.edu',      12, 12),
  ('Raquibul Hasan',    '2212345690', 'raquibul.hasan@northsouth.edu',     13, 13),
  ('Samia Rahman',      '2212345691', 'samia.rahman@northsouth.edu',       14, 14),
  ('Nafis Ul Haque',    '2212345692', 'nafis.haque@northsouth.edu',        15, 15),
  ('Zarif Chowdhury',   '2212345693', 'zarif.chowdhury@northsouth.edu',    16, 16),
  ('Momo Akter',        '2212345694', 'momo.akter@northsouth.edu',         17, 17),
  ('Tahmid Islam',      '2212345695', 'tahmid.islam@northsouth.edu',       18, 18),
  ('Nusrat Jahan',      '2212345696', 'nusrat.jahan@northsouth.edu',       19, 19),
  ('Rezwan Ul Karim',   '2212345697', 'rezwan.karim@northsouth.edu',       20, 20)
ON CONFLICT (student_id) DO NOTHING;

-- Primary section assignments
UPDATE students SET section_id = (
  SELECT section_id FROM sections WHERE course_code='CSE299'
  AND section_name='06' AND year=2026 AND year_session='Spring' LIMIT 1)
WHERE student_id IN ('2212345678','2212345679','2212345680','2212345681','2212345682');

UPDATE students SET section_id = (
  SELECT section_id FROM sections WHERE course_code='CSE300'
  AND section_name='04' AND year=2026 AND year_session='Spring' LIMIT 1)
WHERE student_id IN ('2212345683','2212345684','2212345685','2212345686','2212345687');

UPDATE students SET section_id = (
  SELECT section_id FROM sections WHERE course_code='CSE311'
  AND section_name='01' AND year=2026 AND year_session='Spring' LIMIT 1)
WHERE student_id IN ('2212345688','2212345689','2212345690','2212345691','2212345692');

UPDATE students SET section_id = (
  SELECT section_id FROM sections WHERE course_code='CSE331'
  AND section_name='03' AND year=2026 AND year_session='Spring' LIMIT 1)
WHERE student_id IN ('2212345693','2212345694','2212345695','2212345696','2212345697');


-- ════════════════════════════════════════════════════════════
--  STUDENT_SECTIONS  (23 enrollments = 20 primary + 3 cross)
-- ════════════════════════════════════════════════════════════
INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id FROM students s, sections sec
WHERE s.student_id IN ('2212345678','2212345679','2212345680','2212345681','2212345682')
  AND sec.course_code='CSE299' AND sec.section_name='06'
  AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;

INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id FROM students s, sections sec
WHERE s.student_id IN ('2212345683','2212345684','2212345685','2212345686','2212345687')
  AND sec.course_code='CSE300' AND sec.section_name='04'
  AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;

INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id FROM students s, sections sec
WHERE s.student_id IN ('2212345688','2212345689','2212345690','2212345691','2212345692')
  AND sec.course_code='CSE311' AND sec.section_name='01'
  AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;

INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id FROM students s, sections sec
WHERE s.student_id IN ('2212345693','2212345694','2212345695','2212345696','2212345697')
  AND sec.course_code='CSE331' AND sec.section_name='03'
  AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;

-- 3 cross-enrolled in MAT361
INSERT INTO student_sections (std_id, section_id)
SELECT s.student_id, sec.section_id FROM students s, sections sec
WHERE s.student_id IN ('2212345678','2212345683','2212345688')
  AND sec.course_code='MAT361' AND sec.section_name='05'
  AND sec.year=2026 AND sec.year_session='Spring'
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  EXAM_SESSIONS  (5 sessions: varied status + exam types)
-- ════════════════════════════════════════════════════════════
INSERT INTO exam_sessions
  (name, course_name, instructor_name, time_block,
   duration_ms, status, exam_type, section_id, created_at, ended_at)
VALUES
  -- 1: CSE299 midterm — ended, multiple incidents, 3 days ago
  ('CSE299_Midterm_Spring2026', 'Junior Design Project', 'SvA',
   '09:00 – 11:00', 7200000, 'ended', 'midterm',
   (SELECT section_id FROM sections WHERE course_code='CSE299'
    AND section_name='06' AND year=2026 AND year_session='Spring' LIMIT 1),
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 hours'),

  -- 2: CSE300 quiz — active right now
  ('CSE300_Quiz1_Spring2026', 'Senior Design Project', 'JDP',
   '14:00 – 15:00', 3600000, 'active', 'quiz',
   (SELECT section_id FROM sections WHERE course_code='CSE300'
    AND section_name='04' AND year=2026 AND year_session='Spring' LIMIT 1),
   NOW() - INTERVAL '30 minutes', NULL),

  -- 3: CSE311 final — ended 10 days ago, clean (no incidents)
  ('CSE311_Final_Spring2026', 'Database Systems', 'TaA',
   '10:00 – 13:00', 10800000, 'ended', 'final',
   (SELECT section_id FROM sections WHERE course_code='CSE311'
    AND section_name='01' AND year=2026 AND year_session='Spring' LIMIT 1),
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '3 hours'),

  -- 4: CSE331 quiz — ended yesterday, moderate incidents
  ('CSE331_Quiz2_Spring2026', 'Computer Networks', 'NkS',
   '11:00 – 12:00', 3600000, 'ended', 'quiz',
   (SELECT section_id FROM sections WHERE course_code='CSE331'
    AND section_name='03' AND year=2026 AND year_session='Spring' LIMIT 1),
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '1 hour'),

  -- 5: CSE299 mock exam — ended 5 days ago, used for practice
  ('CSE299_Mock_Spring2026', 'Junior Design Project', 'SvA',
   '14:00 – 15:30', 5400000, 'ended', 'mock',
   (SELECT section_id FROM sections WHERE course_code='CSE299'
    AND section_name='06' AND year=2026 AND year_session='Spring' LIMIT 1),
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '90 minutes')
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  FEEDS  (5 seats — the same physical seats used each session)
-- ════════════════════════════════════════════════════════════
INSERT INTO feeds (label, client_id, connected, camera_id, deleted_at)
VALUES
  ('Seat 01', '192.168.43.101_Seat 01', false, 'CAM-A1B2', NULL),
  ('Seat 02', '192.168.43.102_Seat 02', false, 'CAM-C3D4', NULL),
  ('Seat 03', '192.168.43.103_Seat 03', false, 'CAM-E5F6', NULL),
  ('Seat 04', '192.168.43.104_Seat 04', false, 'CAM-G7H8', NULL),
  ('Seat 05', '192.168.43.105_Seat 05', false, 'CAM-I9J0', NULL)
ON CONFLICT (client_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  SESSION_FEEDS  (24 rows — attendance across all 5 sessions)
-- ════════════════════════════════════════════════════════════

-- Session 1: CSE299 midterm — 5 seats, 4 submitted, 1 flagged
INSERT INTO session_feeds
  (session_id, feed_id, feed_label, candidate_name, student_id,
   time_remaining_ms, student_status, connected_at)
VALUES
  (1,1,'Seat 01','Ahmed Rahman',
   (SELECT id FROM students WHERE student_id='2212345678'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '2 min'),
  (1,2,'Seat 02','Tasnim Hossain',
   (SELECT id FROM students WHERE student_id='2212345679'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '3 min'),
  (1,3,'Seat 03','Rafi Islam',
   (SELECT id FROM students WHERE student_id='2212345680'),
   0,'flagged',(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '1 min'),
  (1,4,'Seat 04','Nadia Akter',
   (SELECT id FROM students WHERE student_id='2212345681'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '4 min'),
  (1,5,'Seat 05','Shibli Sadik',
   (SELECT id FROM students WHERE student_id='2212345682'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '2 min')
ON CONFLICT DO NOTHING;

-- Session 2: CSE300 quiz — 4 present, 1 absent (active)
INSERT INTO session_feeds
  (session_id, feed_id, feed_label, candidate_name, student_id,
   time_remaining_ms, student_status, connected_at)
VALUES
  (2,1,'Seat 01','Lamia Chowdhury',
   (SELECT id FROM students WHERE student_id='2212345683'),
   1800000,'present',(SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '1 min'),
  (2,2,'Seat 02','Tanvir Hasan',
   (SELECT id FROM students WHERE student_id='2212345684'),
   1800000,'present',(SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '2 min'),
  (2,3,'Seat 03','Sadia Islam',
   (SELECT id FROM students WHERE student_id='2212345685'),
   1800000,'paused',(SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '1 min'),
  (2,4,'Seat 04','Mehrab Hossain',
   (SELECT id FROM students WHERE student_id='2212345686'),
   1800000,'present',(SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '3 min'),
  (2,5,'Seat 05',NULL,NULL,0,'absent',
   (SELECT created_at FROM exam_sessions WHERE id=2))
ON CONFLICT DO NOTHING;

-- Session 3: CSE311 final — 4 seats, clean session
INSERT INTO session_feeds
  (session_id, feed_id, feed_label, candidate_name, student_id,
   time_remaining_ms, student_status, connected_at)
VALUES
  (3,1,'Seat 01','Ishrak Ahmed',
   (SELECT id FROM students WHERE student_id='2212345688'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=3)+INTERVAL '2 min'),
  (3,2,'Seat 02','Sabrina Kabir',
   (SELECT id FROM students WHERE student_id='2212345689'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=3)+INTERVAL '1 min'),
  (3,3,'Seat 03','Raquibul Hasan',
   (SELECT id FROM students WHERE student_id='2212345690'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=3)+INTERVAL '5 min'),
  (3,4,'Seat 04','Samia Rahman',
   (SELECT id FROM students WHERE student_id='2212345691'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=3)+INTERVAL '2 min')
ON CONFLICT DO NOTHING;

-- Session 4: CSE331 quiz — 5 seats, 2 flagged
INSERT INTO session_feeds
  (session_id, feed_id, feed_label, candidate_name, student_id,
   time_remaining_ms, student_status, connected_at)
VALUES
  (4,1,'Seat 01','Zarif Chowdhury',
   (SELECT id FROM students WHERE student_id='2212345693'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '1 min'),
  (4,2,'Seat 02','Momo Akter',
   (SELECT id FROM students WHERE student_id='2212345694'),
   0,'flagged',(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '2 min'),
  (4,3,'Seat 03','Tahmid Islam',
   (SELECT id FROM students WHERE student_id='2212345695'),
   0,'flagged',(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '1 min'),
  (4,4,'Seat 04','Nusrat Jahan',
   (SELECT id FROM students WHERE student_id='2212345696'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '3 min'),
  (4,5,'Seat 05','Rezwan Ul Karim',
   (SELECT id FROM students WHERE student_id='2212345697'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '2 min')
ON CONFLICT DO NOTHING;

-- Session 5: CSE299 mock — 5 seats, relaxed (no incidents expected but one slipped)
INSERT INTO session_feeds
  (session_id, feed_id, feed_label, candidate_name, student_id,
   time_remaining_ms, student_status, connected_at)
VALUES
  (5,1,'Seat 01','Ahmed Rahman',
   (SELECT id FROM students WHERE student_id='2212345678'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '1 min'),
  (5,2,'Seat 02','Tasnim Hossain',
   (SELECT id FROM students WHERE student_id='2212345679'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '2 min'),
  (5,3,'Seat 03','Rafi Islam',
   (SELECT id FROM students WHERE student_id='2212345680'),
   0,'flagged',(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '1 min'),
  (5,4,'Seat 04','Nadia Akter',
   (SELECT id FROM students WHERE student_id='2212345681'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '3 min'),
  (5,5,'Seat 05','Shibli Sadik',
   (SELECT id FROM students WHERE student_id='2212345682'),
   0,'submitted',(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '2 min')
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  DETECTIONS  (30 rows across sessions 1, 4, 5)
--  Session 2/3 are clean to show contrast.
-- ════════════════════════════════════════════════════════════

-- Session 1: CSE299 midterm (most incidents — 14 detections)
INSERT INTO detections
  (session_id, feed_id, detected_at, class_label, confidence, notes)
VALUES
  (1,1,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '18 min','phone',      0.92, NULL),
  (1,1,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '34 min','phone',      0.88, 'Student warned verbally'),
  (1,1,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '67 min','phone',      0.94, 'Second warning issued'),
  (1,1,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '95 min','phone',      0.91, 'Repeated offence — reported'),
  (1,3,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '22 min','cheatsheet', 0.76, NULL),
  (1,3,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '55 min','looking_away',0.71,NULL),
  (1,3,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '78 min','cheatsheet', 0.83, 'Proctor moved closer'),
  (1,4,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '41 min','cheating',   0.95, 'Appeared to copy from neighbour'),
  (1,4,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '89 min','cheating',   0.87, 'Same behaviour repeated'),
  (1,4,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '101min','phone',      0.79, NULL),
  (1,2,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '44 min','looking_away',0.68,NULL),
  (1,5,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '73 min','phone',      0.82, NULL),
  (1,5,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '88 min','looking_away',0.71,NULL),
  (1,2,(SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '112min','cheatsheet', 0.77, NULL)
ON CONFLICT DO NOTHING;

-- Session 4: CSE331 quiz (8 detections — 2 flagged students)
INSERT INTO detections
  (session_id, feed_id, detected_at, class_label, confidence, notes)
VALUES
  (4,2,(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '12 min','phone',      0.89, NULL),
  (4,2,(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '28 min','phone',      0.93, 'Warned'),
  (4,2,(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '41 min','cheatsheet', 0.78, NULL),
  (4,2,(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '53 min','cheating',   0.91, 'Confirmed cheating — disabled pen'),
  (4,3,(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '19 min','looking_away',0.74,NULL),
  (4,3,(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '35 min','phone',      0.86, 'Second phone detection'),
  (4,3,(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '47 min','cheatsheet', 0.81, NULL),
  (4,3,(SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '58 min','cheating',   0.88, 'Flagged for review')
ON CONFLICT DO NOTHING;

-- Session 5: CSE299 mock — 1 student slipped up (8 detections)
INSERT INTO detections
  (session_id, feed_id, detected_at, class_label, confidence, notes)
VALUES
  (5,3,(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '10 min','phone',      0.84, NULL),
  (5,3,(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '25 min','phone',      0.91, 'Mock — no action taken'),
  (5,3,(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '40 min','looking_away',0.69,NULL),
  (5,3,(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '55 min','cheatsheet', 0.75, NULL),
  (5,3,(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '62 min','cheating',   0.83, 'Noted for training purposes'),
  (5,1,(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '35 min','looking_away',0.66,NULL),
  (5,4,(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '48 min','phone',      0.72, NULL),
  (5,4,(SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '70 min','looking_away',0.68,NULL)
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  VIDEO_SEGMENTS  (20 rows — 4 feeds × 2 segments × sessions 1+4)
-- ════════════════════════════════════════════════════════════
INSERT INTO video_segments
  (session_id, feed_id, file_path, started_at, ended_at, size_bytes)
VALUES
  -- Session 1 — seats 1-4, 2 segments each (8 rows)
  (1,1,'recordings/CSE299_Midterm_Spring2026/Seat_01/Seat_01_seg_0000_2026-04-13_09-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1),
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '10 min', 158000000),
  (1,1,'recordings/CSE299_Midterm_Spring2026/Seat_01/Seat_01_seg_0001_2026-04-13_09-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '20 min', 161000000),
  (1,2,'recordings/CSE299_Midterm_Spring2026/Seat_02/Seat_02_seg_0000_2026-04-13_09-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1),
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '10 min', 155000000),
  (1,2,'recordings/CSE299_Midterm_Spring2026/Seat_02/Seat_02_seg_0001_2026-04-13_09-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '20 min', 157000000),
  (1,3,'recordings/CSE299_Midterm_Spring2026/Seat_03/Seat_03_seg_0000_2026-04-13_09-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1),
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '10 min', 162000000),
  (1,3,'recordings/CSE299_Midterm_Spring2026/Seat_03/Seat_03_seg_0001_2026-04-13_09-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '20 min', 159000000),
  (1,4,'recordings/CSE299_Midterm_Spring2026/Seat_04/Seat_04_seg_0000_2026-04-13_09-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1),
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '10 min', 160000000),
  (1,4,'recordings/CSE299_Midterm_Spring2026/Seat_04/Seat_04_seg_0001_2026-04-13_09-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '20 min', 163000000),

  -- Session 4 — seats 1-4, 2 segments each (8 rows)
  (4,1,'recordings/CSE331_Quiz2_Spring2026/Seat_01/Seat_01_seg_0000_2026-04-19_11-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=4),
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '10 min', 98000000),
  (4,1,'recordings/CSE331_Quiz2_Spring2026/Seat_01/Seat_01_seg_0001_2026-04-19_11-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '20 min', 99000000),
  (4,2,'recordings/CSE331_Quiz2_Spring2026/Seat_02/Seat_02_seg_0000_2026-04-19_11-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=4),
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '10 min', 101000000),
  (4,2,'recordings/CSE331_Quiz2_Spring2026/Seat_02/Seat_02_seg_0001_2026-04-19_11-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '20 min', 103000000),
  (4,3,'recordings/CSE331_Quiz2_Spring2026/Seat_03/Seat_03_seg_0000_2026-04-19_11-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=4),
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '10 min', 97000000),
  (4,3,'recordings/CSE331_Quiz2_Spring2026/Seat_03/Seat_03_seg_0001_2026-04-19_11-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '20 min', 100000000),
  (4,4,'recordings/CSE331_Quiz2_Spring2026/Seat_04/Seat_04_seg_0000_2026-04-19_11-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=4),
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '10 min', 96000000),
  (4,4,'recordings/CSE331_Quiz2_Spring2026/Seat_04/Seat_04_seg_0001_2026-04-19_11-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '20 min', 98000000),

  -- Session 5 — seats 1-2 only (mock, partial recording) (4 rows)
  (5,1,'recordings/CSE299_Mock_Spring2026/Seat_01/Seat_01_seg_0000_2026-04-15_14-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=5),
   (SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '10 min', 87000000),
  (5,1,'recordings/CSE299_Mock_Spring2026/Seat_01/Seat_01_seg_0001_2026-04-15_14-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '20 min', 89000000),
  (5,2,'recordings/CSE299_Mock_Spring2026/Seat_02/Seat_02_seg_0000_2026-04-15_14-00.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=5),
   (SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '10 min', 85000000),
  (5,2,'recordings/CSE299_Mock_Spring2026/Seat_02/Seat_02_seg_0001_2026-04-15_14-10.mp4',
   (SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '10 min',
   (SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '20 min', 88000000)
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  SIGNALS  (44 rows across all 5 sessions)
--  action_type and invigilator_id set on every row.
-- ════════════════════════════════════════════════════════════

-- ── Session 1: CSE299 Midterm (14 signals) ──────────────────
INSERT INTO signals (session_id,feed_id,signal,params,sent_at,sent_by,action_type,invigilator_id)
VALUES
  (1,NULL,'timer','{"cmd":"timer","duration_ms":7200000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)-INTERVAL '2 min','admin','exam_control','admin'),
  (1,NULL,'start','{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1),'admin','exam_control','admin'),
  (1,1,'warn','{"cmd":"warn","device_id":1}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '19 min','admin','unit_control','admin'),
  (1,3,'warn','{"cmd":"warn","device_id":3}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '23 min','admin','unit_control','admin'),
  (1,NULL,'pause','{"cmd":"pause"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '60 min','admin','exam_control','admin'),
  (1,NULL,'start','{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '65 min','admin','exam_control','admin'),
  (1,4,'disable','{"cmd":"disable","device_id":4,"punish_ms":300000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '42 min','admin','unit_control','admin'),
  (1,1,'warn','{"cmd":"warn","device_id":1}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '68 min','admin','unit_control','admin'),
  (1,1,'deduct','{"cmd":"deduct","device_id":1,"time_ms":300000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '70 min','admin','unit_control','admin'),
  (1,NULL,'reset','{"cmd":"reset","transport":"ble"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '64 min','pen_app','exam_control','pen_app'),
  (1,3,'disable','{"cmd":"disable","device_id":3,"punish_ms":120000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '79 min','admin','unit_control','admin'),
  (1,3,'enable','{"cmd":"enable","device_id":3}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '81 min','admin','unit_control','admin'),
  (1,4,'enable','{"cmd":"enable","device_id":4}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=1)+INTERVAL '95 min','admin','unit_control','admin'),
  (1,NULL,'end','{"cmd":"end"}'::jsonb,
   (SELECT ended_at FROM exam_sessions WHERE id=1),'admin','exam_control','admin')
ON CONFLICT DO NOTHING;

-- ── Session 2: CSE300 Quiz (8 signals — active session) ─────
INSERT INTO signals (session_id,feed_id,signal,params,sent_at,sent_by,action_type,invigilator_id)
VALUES
  (2,NULL,'timer','{"cmd":"timer","duration_ms":3600000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2)-INTERVAL '1 min','admin','exam_control','admin'),
  (2,NULL,'start','{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2),'admin','exam_control','admin'),
  (2,3,'disable','{"cmd":"disable","device_id":3}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '15 min','admin','unit_control','admin'),
  (2,3,'enable','{"cmd":"enable","device_id":3}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '22 min','admin','unit_control','admin'),
  (2,NULL,'reset','{"cmd":"reset","transport":"ble"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '5 min','pen_app','exam_control','pen_app'),
  (2,1,'warn','{"cmd":"warn","device_id":1}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '18 min','pen_app','unit_control','pen_app'),
  (2,NULL,'pause','{"cmd":"pause"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '28 min','admin','exam_control','admin'),
  (2,NULL,'start','{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=2)+INTERVAL '30 min','admin','exam_control','admin')
ON CONFLICT DO NOTHING;

-- ── Session 3: CSE311 Final (6 signals — clean exam) ────────
INSERT INTO signals (session_id,feed_id,signal,params,sent_at,sent_by,action_type,invigilator_id)
VALUES
  (3,NULL,'timer','{"cmd":"timer","duration_ms":10800000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=3)-INTERVAL '3 min','admin','exam_control','admin'),
  (3,NULL,'start','{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=3),'admin','exam_control','admin'),
  (3,NULL,'pause','{"cmd":"pause"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=3)+INTERVAL '90 min','admin','exam_control','admin'),
  (3,NULL,'start','{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=3)+INTERVAL '95 min','admin','exam_control','admin'),
  (3,NULL,'end','{"cmd":"end"}'::jsonb,
   (SELECT ended_at FROM exam_sessions WHERE id=3),'admin','exam_control','admin'),
  (3,NULL,'reset','{"cmd":"reset","transport":"usb"}'::jsonb,
   (SELECT ended_at FROM exam_sessions WHERE id=3)+INTERVAL '2 min','admin','exam_control','admin')
ON CONFLICT DO NOTHING;

-- ── Session 4: CSE331 Quiz (10 signals — incident-heavy) ────
INSERT INTO signals (session_id,feed_id,signal,params,sent_at,sent_by,action_type,invigilator_id)
VALUES
  (4,NULL,'timer','{"cmd":"timer","duration_ms":3600000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=4)-INTERVAL '2 min','admin','exam_control','admin'),
  (4,NULL,'start','{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=4),'admin','exam_control','admin'),
  (4,2,'warn','{"cmd":"warn","device_id":2}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '13 min','admin','unit_control','admin'),
  (4,3,'warn','{"cmd":"warn","device_id":3}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '20 min','admin','unit_control','admin'),
  (4,2,'disable','{"cmd":"disable","device_id":2,"punish_ms":180000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '54 min','admin','unit_control','admin'),
  (4,3,'disable','{"cmd":"disable","device_id":3,"punish_ms":180000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '59 min','admin','unit_control','admin'),
  (4,2,'deduct','{"cmd":"deduct","device_id":2,"time_ms":600000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '55 min','admin','unit_control','admin'),
  (4,3,'deduct','{"cmd":"deduct","device_id":3,"time_ms":600000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '60 min','admin','unit_control','admin'),
  (4,NULL,'pause','{"cmd":"pause"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=4)+INTERVAL '30 min','admin','exam_control','admin'),
  (4,NULL,'end','{"cmd":"end"}'::jsonb,
   (SELECT ended_at FROM exam_sessions WHERE id=4),'admin','exam_control','admin')
ON CONFLICT DO NOTHING;

-- ── Session 5: CSE299 Mock (6 signals — relaxed, pen_app heavy) ──
INSERT INTO signals (session_id,feed_id,signal,params,sent_at,sent_by,action_type,invigilator_id)
VALUES
  (5,NULL,'timer','{"cmd":"timer","duration_ms":5400000}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=5)-INTERVAL '1 min','pen_app','exam_control','pen_app'),
  (5,NULL,'start','{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=5),'pen_app','exam_control','pen_app'),
  (5,3,'warn','{"cmd":"warn","device_id":3}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '26 min','admin','unit_control','admin'),
  (5,NULL,'pause','{"cmd":"pause"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '45 min','pen_app','exam_control','pen_app'),
  (5,NULL,'start','{"cmd":"start"}'::jsonb,
   (SELECT created_at FROM exam_sessions WHERE id=5)+INTERVAL '47 min','pen_app','exam_control','pen_app'),
  (5,NULL,'end','{"cmd":"end"}'::jsonb,
   (SELECT ended_at FROM exam_sessions WHERE id=5),'pen_app','exam_control','pen_app')
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════
--  VERIFICATION
-- ════════════════════════════════════════════════════════════
SELECT tbl, cnt FROM (
  SELECT 'courses'           AS tbl, COUNT(*) AS cnt FROM courses          UNION ALL
  SELECT 'sections',                 COUNT(*)          FROM sections        UNION ALL
  SELECT 'students',                 COUNT(*)          FROM students        UNION ALL
  SELECT 'student_sections',         COUNT(*)          FROM student_sections UNION ALL
  SELECT 'exam_sessions',            COUNT(*)          FROM exam_sessions   UNION ALL
  SELECT 'feeds',                    COUNT(*)          FROM feeds           UNION ALL
  SELECT 'session_feeds',            COUNT(*)          FROM session_feeds   UNION ALL
  SELECT 'detections',               COUNT(*)          FROM detections      UNION ALL
  SELECT 'video_segments',           COUNT(*)          FROM video_segments  UNION ALL
  SELECT 'signals',                  COUNT(*)          FROM signals
) t ORDER BY tbl;

-- Expected:
--   courses            7
--   detections        30
--   exam_sessions      5
--   feeds              5
--   sections          12
--   session_feeds     24
--   signals           44
--   student_sections  23
--   students          20
--   video_segments    20
