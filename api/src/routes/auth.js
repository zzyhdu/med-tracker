import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { config } from '../config.js';
import { sendError } from '../lib/errors.js';
import {
  clearSessionCookie,
  getUserFromRequest,
  hashToken,
  sessionTokenFrom,
  setSessionCookie,
} from '../lib/session.js';

export const authRouter = Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

authRouter.get('/session', async (req, res, next) => {
  try {
    const user = await getUserFromRequest(req);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required');
    }

    const { rows } = await pool.query(
      'select id, email, password_hash from users where email = $1',
      [email],
    );
    const user = rows[0];
    const passwordMatches = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!passwordMatches) {
      return sendError(res, 401, 'Invalid email or password');
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);

    await pool.query('delete from sessions where expires_at <= now()');
    await pool.query(
      'insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)',
      [hashToken(token), user.id, expiresAt],
    );

    setSessionCookie(res, token, expiresAt);
    return res.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = sessionTokenFrom(req);
    if (token) {
      await pool.query('delete from sessions where token_hash = $1', [hashToken(token)]);
    }

    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
