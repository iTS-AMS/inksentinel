import dotenv from 'dotenv';
dotenv.config({quiet: true});

import { Router } from 'express';
import jwt        from 'jsonwebtoken';
import bcrypt     from 'bcryptjs';

const router = Router();

import { requireAuthApi } from '../middleware/auth.js';

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || username !== process.env.ADMIN_USERNAME) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',                                      // required — Chrome 80+ drops cookies without this on LAN/IP access
    secure:   process.env.USE_HTTPS === 'true',           // only set Secure flag when actually running HTTPS
    maxAge:   8 * 60 * 60 * 1000
  });

  // Redirect to exam-setup (the post-login landing page)
  res.json({ success: true, redirect: '/exam-setup' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.USE_HTTPS === 'true',
  });
  res.json({ success: true, redirect: '/login' });
});

// GET /api/auth/me — returns current user from JWT cookie
// Used by sidebar.html to display username + role
router.get('/me', requireAuthApi, (req, res) => {
  res.json({
    user: {
      username: req.user.username,
      role:     req.user.role || 'admin',
    }
  });
});

export default router;