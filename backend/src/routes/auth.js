import dotenv from 'dotenv';
dotenv.config({quiet: true});

import { Router } from 'express';
import jwt        from 'jsonwebtoken';
import bcrypt     from 'bcryptjs';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // check username
  if (!username || username !== process.env.ADMIN_USERNAME) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // check password against stored hash
  const valid = bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // sign a JWT token
  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  // store token in HTTP-only cookie
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000
  });

  res.json({ success: true, redirect: '/dashboard' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, redirect: '/login' });
});

export default router;