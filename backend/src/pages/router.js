import 'dotenv/config';
import { Router } from 'express';
import path       from 'path';
import { fileURLToPath } from 'url';
import jwt        from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';

const router    = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC    = path.join(__dirname, '..', '..', 'public');

const page = (name) => path.join(PUBLIC, `${name}.html`);

// redirect root to dashboard
router.get('/', requireAuth, (req, res) => {
  res.redirect('/dashboard');
});

// login page — redirect to dashboard if already logged in
router.get('/login', (req, res) => {
  try {
    jwt.verify(req.cookies?.token, process.env.JWT_SECRET);
    res.redirect('/dashboard');
  } catch {
    res.sendFile(page('login'));
  }
});

// protected pages
router.get('/dashboard',     requireAuth, (req, res) => res.sendFile(page('dashboard')));
router.get('/session',       requireAuth, (req, res) => res.sendFile(page('session')));
router.get('/incidents',     requireAuth, (req, res) => res.sendFile(page('incidents')));
router.get('/candidate/:id', requireAuth, (req, res) => res.sendFile(page('candidate')));

export default router;