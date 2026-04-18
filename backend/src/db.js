// src/db.js
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

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err.message);
});

export async function testConnection() {
  const result = await pool.query('SELECT NOW() AS time');
  console.log('DB connected at:', result.rows[0].time);
}

export async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

export default pool;

// Atomic upsert — prevents race condition on simultaneous camera connects
export async function getOrCreateFeed(clientId, label) {
  const result = await query(
    `INSERT INTO feeds (label, client_id, connected)
     VALUES ($1, $2, true)
     ON CONFLICT (client_id)
     DO UPDATE SET label = EXCLUDED.label, connected = true, deleted_at = NULL
     RETURNING *`,
    [label, clientId]
  );
  return result.rows[0];
}

// Returns the currently active exam session, or null if none started.
// Used by wsHandler, signals.js, penlog.js to write session_id.
export async function getActiveSession() {
  const result = await query(
    `SELECT * FROM exam_sessions WHERE ended_at IS NULL ORDER BY created_at DESC LIMIT 1`
  );
  return result.rows[0] || null;
}

export async function resetAllConnected() {
  await query('UPDATE feeds SET connected = false');
  console.log('[DB] Reset all feeds to connected=false');
}