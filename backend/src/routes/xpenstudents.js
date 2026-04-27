// ============================================================
//  src/routes/students.js  (v2)
//
//  Fix from v1: removed s.camera_id from SELECT.
//  camera_id lives on the feeds table, not students.
//  All other logic unchanged.
//
//  GET /api/students        — paginated + searchable roster
//  GET /api/students/:id    — single student + enrollments
//  GET /api/students/by-section/:section_id
// ============================================================
 
import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// ── GET /api/students ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const q         = req.query.q          || '';
  const sectionId = req.query.section_id ? parseInt(req.query.section_id) : null;
  const page      = Math.max(1, parseInt(req.query.page)  || 1);
  const limit     = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset    = (page - 1) * limit;

  const params = [];
  let sql = `
    SELECT
      s.id,
      s.name,
      s.student_id,
      s.email,
      s.seat_number,
      s.pen_unit_id,
      s.client_id,
      sec.section_name,
      sec.course_code,
      sec.initials     AS instructor_initials,
      c.course_name
    FROM   students s
    LEFT   JOIN sections sec ON sec.section_id = s.section_id
    LEFT   JOIN courses  c   ON c.course_code  = sec.course_code
    WHERE  1=1
  `;

  if (q.trim()) {
    params.push(`%${q.trim()}%`);
    sql += ` AND (s.name ILIKE $${params.length}
                  OR s.student_id ILIKE $${params.length})`;
  }

  if (sectionId) {
    params.push(sectionId);
    sql += ` AND s.section_id = $${params.length}`;
  }

  // Get total count for pagination
  const countSql = `SELECT COUNT(*) AS total FROM (${sql}) sub`;
  const countRes = await query(countSql, params).catch(() => null);
  const total    = countRes ? Number(countRes.rows[0].total) : 0;

  // Add pagination
  sql    += ' ORDER BY s.name ASC';
  params.push(limit);  sql += ` LIMIT  $${params.length}`;
  params.push(offset); sql += ` OFFSET $${params.length}`;

  try {
    const result = await query(sql, params);
    res.json({
      students: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Students] List error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/students/by-section/:section_id ─────────────────
// Must come BEFORE /:student_id to avoid route collision
router.get('/by-section/:section_id', async (req, res) => {
  const sectionId = parseInt(req.params.section_id);
  if (isNaN(sectionId)) return res.status(400).json({ error: 'Invalid section ID' });

  try {
    const result = await query(`
      SELECT
        s.id, s.name, s.student_id, s.email,
        s.seat_number, s.pen_unit_id
      FROM   students s
      WHERE  s.section_id = $1
      ORDER  BY s.name
    `, [sectionId]);
    res.json({ students: result.rows });
  } catch (err) {
    console.error('[Students] By-section error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/students/:student_id ────────────────────────────
router.get('/:student_id', async (req, res) => {
  const studentId = req.params.student_id;

  try {
    const studentRes = await query(`
      SELECT
        s.id, s.name, s.student_id, s.email,
        s.seat_number, s.pen_unit_id, s.client_id,
        sec.section_name,
        sec.course_code,
        sec.initials  AS instructor_initials,
        c.course_name
      FROM   students s
      LEFT   JOIN sections sec ON sec.section_id = s.section_id
      LEFT   JOIN courses  c   ON c.course_code  = sec.course_code
      WHERE  s.student_id = $1
    `, [studentId]);

    if (!studentRes.rows.length)
      return res.status(404).json({ error: 'Student not found' });

    const enrollRes = await query(`
      SELECT
        sec.section_id,
        sec.section_name,
        sec.course_code,
        sec.initials,
        sec.year,
        sec.year_session,
        c.course_name
      FROM   student_sections ss
      JOIN   sections sec ON sec.section_id = ss.section_id
      JOIN   courses  c   ON c.course_code  = sec.course_code
      WHERE  ss.std_id = $1
      ORDER  BY sec.course_code, sec.section_name
    `, [studentId]);

    res.json({
      student:     studentRes.rows[0],
      enrollments: enrollRes.rows,
    });
  } catch (err) {
    console.error('[Students] Detail error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;