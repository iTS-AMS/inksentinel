
import dotenv from 'dotenv';
dotenv.config({quiet: true});
import pg     from 'pg';

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