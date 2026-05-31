import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import express from 'express';
import { pool } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3000);

const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'med_tracker_session';
const sessionDays = Number(process.env.SESSION_DAYS || 14);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '100kb' }));

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(header = '') {
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf('=');
      if (separator === -1) return cookies;
      const name = decodeURIComponent(part.slice(0, separator));
      const value = decodeURIComponent(part.slice(separator + 1));
      cookies[name] = value;
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly'];
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.secure) parts.push('Secure');

  return parts.join('; ');
}

function setSessionCookie(res, token, expiresAt) {
  res.setHeader('Set-Cookie', serializeCookie(sessionCookieName, token, {
    maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    expires: expiresAt,
    secure: isProduction,
  }));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', serializeCookie(sessionCookieName, '', {
    maxAge: 0,
    expires: new Date(0),
    secure: isProduction,
  }));
}

function sendError(res, status, message) {
  return res.status(status).json({ error: { message } });
}

async function getUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[sessionCookieName];
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

async function requireUser(req, res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      clearSessionCookie(res);
      return sendError(res, 401, 'Authentication required');
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function readRequiredFiniteNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const error = new Error(`${fieldName} must be a number`);
    error.status = 400;
    throw error;
  }
  return number;
}

function readOptionalFiniteNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  return readRequiredFiniteNumber(value, fieldName);
}

function readProfilePayload(body) {
  const name = String(body.name || '').trim();
  if (!name) {
    const error = new Error('name is required');
    error.status = 400;
    throw error;
  }

  const dailyDosage = readRequiredFiniteNumber(body.dailyDosage, 'dailyDosage');
  const alertThresholdDays = readRequiredFiniteNumber(body.alertThresholdDays, 'alertThresholdDays');
  const dosePerTime = readOptionalFiniteNumber(body.dosePerTime, 'dosePerTime');
  const packagingSize = readOptionalFiniteNumber(body.packagingSize, 'packagingSize');

  if (
    dailyDosage < 0
    || alertThresholdDays < 0
    || (dosePerTime !== null && dosePerTime < 0)
    || (packagingSize !== null && packagingSize <= 0)
  ) {
    const error = new Error('profile numeric fields are out of range');
    error.status = 400;
    throw error;
  }

  return {
    name,
    frequency: body.frequency ? String(body.frequency) : null,
    dosePerTime,
    dailyDosage,
    packagingSize,
    packagingUnit: body.packagingUnit ? String(body.packagingUnit).trim() : null,
    pillUnit: body.pillUnit ? String(body.pillUnit).trim() : null,
    alertThresholdDays,
  };
}

function readTrackerPayload(body) {
  const baseInventory = readRequiredFiniteNumber(body.baseInventory, 'baseInventory');
  if (baseInventory < 0) {
    const error = new Error('baseInventory must not be negative');
    error.status = 400;
    throw error;
  }

  const baseDate = new Date(body.baseDate);
  if (Number.isNaN(baseDate.getTime())) {
    const error = new Error('baseDate must be a valid date');
    error.status = 400;
    throw error;
  }

  return {
    baseInventory,
    baseDate: baseDate.toISOString(),
  };
}

function mapProfile(row) {
  return {
    id: row.id,
    name: row.name,
    frequency: row.frequency || undefined,
    dosePerTime: row.dose_per_time === null ? undefined : Number(row.dose_per_time),
    dailyDosage: Number(row.daily_dosage),
    packagingSize: row.packaging_size === null ? undefined : Number(row.packaging_size),
    packagingUnit: row.packaging_unit || undefined,
    pillUnit: row.pill_unit || undefined,
    alertThresholdDays: Number(row.alert_threshold_days),
  };
}

function mapTracker(row) {
  return {
    drugId: row.drug_id,
    baseInventory: Number(row.base_inventory),
    baseDate: new Date(row.base_date).toISOString(),
  };
}

async function saveProfile(userId, profileId, payload) {
  const { rows } = await pool.query(
    `
      insert into profiles (
        id,
        user_id,
        name,
        frequency,
        dose_per_time,
        daily_dosage,
        packaging_size,
        packaging_unit,
        pill_unit,
        alert_threshold_days
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (id) do update set
        name = excluded.name,
        frequency = excluded.frequency,
        dose_per_time = excluded.dose_per_time,
        daily_dosage = excluded.daily_dosage,
        packaging_size = excluded.packaging_size,
        packaging_unit = excluded.packaging_unit,
        pill_unit = excluded.pill_unit,
        alert_threshold_days = excluded.alert_threshold_days,
        updated_at = now()
      where profiles.user_id = excluded.user_id
      returning *
    `,
    [
      profileId,
      userId,
      payload.name,
      payload.frequency,
      payload.dosePerTime,
      payload.dailyDosage,
      payload.packagingSize,
      payload.packagingUnit,
      payload.pillUnit,
      payload.alertThresholdDays,
    ],
  );

  return rows[0] ? mapProfile(rows[0]) : null;
}

async function saveTracker(userId, drugId, payload) {
  const { rows } = await pool.query(
    `
      insert into trackers (user_id, drug_id, base_inventory, base_date)
      select $1, profiles.id, $3, $4
      from profiles
      where profiles.id = $2
        and profiles.user_id = $1
      on conflict (user_id, drug_id) do update set
        base_inventory = excluded.base_inventory,
        base_date = excluded.base_date,
        updated_at = now()
      returning *
    `,
    [userId, drugId, payload.baseInventory, payload.baseDate],
  );

  return rows[0] ? mapTracker(rows[0]) : null;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/session', async (req, res, next) => {
  try {
    const user = await getUserFromRequest(req);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
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
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

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

app.post('/api/logout', async (req, res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[sessionCookieName];
    if (token) {
      await pool.query('delete from sessions where token_hash = $1', [hashToken(token)]);
    }

    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/profiles', requireUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select * from profiles where user_id = $1 order by name asc',
      [req.user.id],
    );
    res.json({ profiles: rows.map(mapProfile) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/profiles', requireUser, async (req, res, next) => {
  try {
    const profileId = req.body.id || crypto.randomUUID();
    const profile = await saveProfile(req.user.id, profileId, readProfilePayload(req.body));
    if (!profile) return sendError(res, 404, 'Profile not found');
    return res.status(201).json({ profile });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/profiles/:id', requireUser, async (req, res, next) => {
  try {
    const profile = await saveProfile(req.user.id, req.params.id, readProfilePayload(req.body));
    if (!profile) return sendError(res, 404, 'Profile not found');
    return res.json({ profile });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/profiles/:id', requireUser, async (req, res, next) => {
  try {
    await pool.query('delete from profiles where user_id = $1 and id = $2', [req.user.id, req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/trackers', requireUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select * from trackers where user_id = $1 order by base_date desc',
      [req.user.id],
    );
    res.json({ trackers: rows.map(mapTracker) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/trackers', requireUser, async (req, res, next) => {
  try {
    const drugId = req.body.drugId;
    if (!drugId) return sendError(res, 400, 'drugId is required');

    const tracker = await saveTracker(req.user.id, drugId, readTrackerPayload(req.body));
    if (!tracker) return sendError(res, 404, 'Profile not found');
    return res.status(201).json({ tracker });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/trackers/:drugId', requireUser, async (req, res, next) => {
  try {
    const tracker = await saveTracker(req.user.id, req.params.drugId, readTrackerPayload(req.body));
    if (!tracker) return sendError(res, 404, 'Profile not found');
    return res.json({ tracker });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/trackers/:drugId', requireUser, async (req, res, next) => {
  try {
    await pool.query('delete from trackers where user_id = $1 and drug_id = $2', [req.user.id, req.params.drugId]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (res.headersSent) return;
  sendError(res, error.status || 500, error.status ? error.message : 'Internal server error');
});

try {
  await pool.query('select 1');
  app.listen(port, '0.0.0.0', () => {
    console.log(`med-tracker API listening on port ${port}`);
  });
} catch (error) {
  console.error('Unable to connect to PostgreSQL', error);
  process.exit(1);
}
