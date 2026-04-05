import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import jwt from 'jsonwebtoken';
// this file is for JWT cookie checking 
// for page routes — redirects to /login if not authenticated
export function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.redirect('/login');
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('token');
    res.redirect('/login');
  }
}

// for API routes — returns JSON instead of redirecting
export function requireAuthApi(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('token');
    res.status(401).json({ error: 'Session expired' });
  }
}