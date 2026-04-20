// src/db.js  (v4)
// Adds camera_id generation to getOrCreateFeed.
// A short CAM-XXXX id is assigned once and never changes.
import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';

const pool = new pg.Pool({
  host:     process.env.PG_HOST,
  port:     Number(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

pool.on('error', err => console.error('DB pool error:', err.message));

export async function testConnection() {
  const r = await pool.query('SELECT NOW() AS time');
  console.log('DB connected at:', r.rows[0].time);
}

export async function query(sql, params = []) {
  return pool.query(sql, params);
}

export default pool;

// ── Camera ID generator (same charset as feeds_v2.js) ────────
function genCamId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CAM-';
  for (let i = 0; i < 4; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── getOrCreateFeed ──────────────────────────────────────────
// Upserts feed by client_id, assigning a camera_id if none exists.
export async function getOrCreateFeed(clientId, label) {
  // First try to get existing feed
  const existing = await query(
    `SELECT * FROM feeds WHERE client_id = $1`, [clientId]
  );

  if (existing.rows.length > 0) {
    const feed = existing.rows[0];
    // Assign camera_id if it was never set
    if (!feed.camera_id) {
      let camId;
      // Retry until we get a unique one (collision is astronomically rare)
      for (let attempts = 0; attempts < 5; attempts++) {
        camId = genCamId();
        const conflict = await query(
          `SELECT id FROM feeds WHERE camera_id = $1`, [camId]);
        if (!conflict.rows.length) break;
      }
      await query(
        `UPDATE feeds SET camera_id=$1, label=$2, connected=true, deleted_at=NULL
         WHERE client_id=$3`,
        [camId, label, clientId]
      );
      return (await query(`SELECT * FROM feeds WHERE client_id=$1`, [clientId])).rows[0];
    }
    // Already has camera_id — just mark connected
    await query(
      `UPDATE feeds SET label=$1, connected=true, deleted_at=NULL WHERE client_id=$2`,
      [label, clientId]
    );
    return (await query(`SELECT * FROM feeds WHERE client_id=$1`, [clientId])).rows[0];
  }

  // New feed — generate camera_id
  let camId;
  for (let attempts = 0; attempts < 5; attempts++) {
    camId = genCamId();
    const conflict = await query(`SELECT id FROM feeds WHERE camera_id=$1`, [camId]);
    if (!conflict.rows.length) break;
  }

  const result = await query(
    `INSERT INTO feeds (label, client_id, connected, camera_id)
     VALUES ($1, $2, true, $3) RETURNING *`,
    [label, clientId, camId]
  );
  console.log(`[DB] New feed "${label}" assigned camera_id: ${camId}`);
  return result.rows[0];
}

export async function getActiveSession() {
  const r = await query(
    `SELECT * FROM exam_sessions
     WHERE ended_at IS NULL ORDER BY created_at DESC LIMIT 1`
  );
  return r.rows[0] || null;
}

export async function resetAllConnected() {
  await query('UPDATE feeds SET connected = false');
  console.log('[DB] Reset all feeds to connected=false');
}