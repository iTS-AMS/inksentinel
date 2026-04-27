// ============================================================
//  src/routes/settings.js
//
//  GET  /api/settings        — load current user's settings
//                              (creates a row with defaults if none exists)
//  PATCH /api/settings       — save settings for current user
//
//  Username is taken from the JWT payload (req.user.username)
//  which requireAuthApi sets after verifying the cookie.
//
//  Mount in app.js / server.js:
//    import settingsRouter from './routes/settings.js';
//    app.use('/api/settings', settingsRouter);
// ============================================================

import { Router } from 'express';
import { query }  from '../db.js';
import { requireAuthApi } from '../middleware/auth.js';

const router = Router();
router.use(requireAuthApi);

// ── Defaults (mirrors CHECK constraints in SQL) ───────────────
const DEFAULTS = {
  theme:               'system',
  language:            'english',
  font_scale:          100,
  movement_threshold:  45,
  audio_sensitivity:   72,
  backend_url:         'http://localhost:3000',
  ai_url:              'http://localhost:9999',
};

// ── GET /api/settings ─────────────────────────────────────────
// Returns the row for the logged-in user.
// If no row exists yet, inserts defaults and returns them.
router.get('/', async (req, res) => {
  const username = req.user?.username;
  if (!username) return res.status(401).json({ error: 'Not authenticated' });

  try {
    // Upsert — INSERT defaults if first time, do nothing otherwise
    await query(`
      INSERT INTO user_settings (username)
      VALUES ($1)
      ON CONFLICT (username) DO NOTHING
    `, [username]);

    const result = await query(
      'SELECT * FROM user_settings WHERE username = $1',
      [username]
    );

    res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error('[Settings] GET error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── PATCH /api/settings ───────────────────────────────────────
// Accepts any subset of the settings fields.
// Unknown keys are silently ignored — only whitelisted columns
// are ever written to prevent SQL injection via column names.
router.patch('/', async (req, res) => {
  const username = req.user?.username;
  if (!username) return res.status(401).json({ error: 'Not authenticated' });

  const ALLOWED = [
    'theme', 'language', 'font_scale',
    'movement_threshold', 'audio_sensitivity',
    'backend_url', 'ai_url',
  ];

  const VALIDATORS = {
    theme:              v => ['light','dark','system'].includes(v),
    language:           v => ['english','bangla'].includes(v),
    font_scale:         v => Number.isInteger(Number(v)) && v >= 70 && v <= 150,
    movement_threshold: v => Number.isInteger(Number(v)) && v >= 0  && v <= 100,
    audio_sensitivity:  v => Number.isInteger(Number(v)) && v >= 0  && v <= 100,
    backend_url:        v => typeof v === 'string' && v.startsWith('http'),
    ai_url:             v => typeof v === 'string' && v.startsWith('http'),
  };

  const updates = [];
  const params  = [];

  for (const key of ALLOWED) {
    if (req.body[key] === undefined) continue;
    const val = req.body[key];
    if (!VALIDATORS[key](val)) {
      return res.status(400).json({ error: `Invalid value for ${key}: ${val}` });
    }
    params.push(val);
    updates.push(`${key} = $${params.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No valid settings fields provided' });
  }

  // Always update the timestamp
  updates.push(`updated_at = NOW()`);

  // Upsert — create row if it doesn't exist, then update
  try {
    await query(`
      INSERT INTO user_settings (username)
      VALUES ($1)
      ON CONFLICT (username) DO NOTHING
    `, [username]);

    params.push(username);
    const result = await query(`
      UPDATE user_settings
         SET ${updates.join(', ')}
       WHERE username = $${params.length}
      RETURNING *
    `, params);

    res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error('[Settings] PATCH error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;