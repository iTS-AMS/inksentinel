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

router.get('/', requireAuth, (req, res) => res.redirect('/dashboard'));

router.get('/login', (req, res) => {
  try {
    jwt.verify(req.cookies?.token, process.env.JWT_SECRET);
    res.redirect('/dashboard');
  } catch {
    res.sendFile(page('login'));
  }
});

router.get('/dashboard',     requireAuth, (req, res) => res.sendFile(page('dashboard')));
router.get('/session',       requireAuth, (req, res) => res.sendFile(page('session')));
router.get('/incidents',     requireAuth, (req, res) => res.sendFile(page('incidents')));
router.get('/candidate/:id', requireAuth, (req, res) => res.sendFile(page('candidate')));
router.get('/camera',        requireAuth, (req, res) => res.sendFile(page('camera')));
router.get('/history',       requireAuth, (req, res) => res.sendFile(page('history')));
router.get('/sessions',      requireAuth, (req, res) => res.redirect('/allsessions'));
router.get('/allsessions',   requireAuth, (req, res) => res.sendFile(page('allsessions')));
router.get('/pen',           requireAuth, (req, res) =>
  res.sendFile(path.join(PUBLIC, 'penapp', 'index.html'))
);
router.get('/students-list', requireAuth, (req, res) => res.sendFile(page('students-list')));

export default router;
