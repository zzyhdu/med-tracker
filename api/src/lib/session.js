import crypto from 'node:crypto';
import { pool } from '../db.js';
import { config } from '../config.js';
import { parseCookies, serializeCookie } from './cookies.js';

/**
 * 会话管理：cookie 里是随机 token 本体，库里只存其 SHA-256。
 */

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sessionTokenFrom(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[config.sessionCookieName];
}

export async function getUserFromRequest(req) {
  const token = sessionTokenFrom(req);
  if (!token) return null;

  const { rows } = await pool.query(
    `
      select users.id, users.email
      from sessions
      join users on users.id = sessions.user_id
      where sessions.token_hash = $1
        and sessions.expires_at > now()
    `,
    [hashToken(token)],
  );

  return rows[0] || null;
}

export function setSessionCookie(res, token, expiresAt) {
  res.setHeader('Set-Cookie', serializeCookie(config.sessionCookieName, token, {
    maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    expires: expiresAt,
    secure: config.isProduction,
  }));
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', serializeCookie(config.sessionCookieName, '', {
    maxAge: 0,
    expires: new Date(0),
    secure: config.isProduction,
  }));
}
