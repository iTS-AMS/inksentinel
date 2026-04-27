import 'dotenv/config';
import { Router }       from 'express';
import path             from 'path';
import { fileURLToPath} from 'url';
import jwt              from 'jsonwebtoken';
import { requireAuth }  from '../middleware/auth.js';

const router    = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC    = path.join(__dirname, '..', '..', 'public');

// Helper — resolves a filename in public/pages/
const page = (name) => path.join(PUBLIC, 'pages', `${name}.html`);

// ── Root ────────────────────────────────────────────────────
// Logged-in users go straight to exam setup.
router.get('/', requireAuth, (req, res) => res.redirect('/exam-setup'));

// ── Auth ─────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  try {
    jwt.verify(req.cookies?.token, process.env.JWT_SECRET);
    res.redirect('/exam-setup'); // already logged in
  } catch {
    res.sendFile(page('login'));
  }
});

// ── Dashboard (Proctopen pen-control app) ────────────────────
router.get('/dashboard', requireAuth, (req, res) =>
  res.sendFile(page('index'))
);

// ── Exam Setup ───────────────────────────────────────────────
router.get('/exam-setup', requireAuth, (req, res) =>
  res.sendFile(page('exam-setup-page'))
);

// ── Camera Setup ───────────────────────────────────────────────
router.get('/camera', requireAuth, (req, res) =>
  res.sendFile(page('camera'))
);

// ── All Sessions ─────────────────────────────────────────────
router.get('/allsession', requireAuth, (req, res) =>
  res.sendFile(page('allsessions'))
);

// ── Session Detail ───────────────────────────────────────────
// No sidebar entry — only reachable by clicking a row in /allsession.
// Session ID passed as query param: /session?id=5
router.get('/session', requireAuth, (req, res) =>
  res.sendFile(page('session'))
);

// ── Student List ─────────────────────────────────────────────
router.get('/student-list', requireAuth, (req, res) =>
  res.sendFile(page('student-list-page'))
);

// ── Settings ─────────────────────────────────────────────────
router.get('/settings', requireAuth, (req, res) =>
  res.sendFile(page('settings-page'))
);

export default router;