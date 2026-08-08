import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { sendError } from '../lib/errors.js';
import { mapProfile } from '../lib/mappers.js';
import { readProfilePayload } from '../lib/payloads.js';
import { saveProfile } from '../lib/store.js';
import { requireUser } from '../middleware/requireUser.js';

/**
 * 个人医嘱：每用户每药一条，仅本人可见、可写。
 */
export const profilesRouter = Router();

profilesRouter.use(requireUser);

profilesRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select * from profiles where user_id = $1 order by created_at asc',
      [req.user.id],
    );
    res.json({ profiles: rows.map(mapProfile) });
  } catch (error) {
    next(error);
  }
});

profilesRouter.post('/', async (req, res, next) => {
  try {
    const profileId = req.body.id || crypto.randomUUID();
    const profile = await saveProfile(req.user.id, profileId, readProfilePayload(req.body));
    if (!profile) return sendError(res, 404, 'Profile not found');
    return res.status(201).json({ profile });
  } catch (error) {
    return next(error);
  }
});

profilesRouter.put('/:id', async (req, res, next) => {
  try {
    const profile = await saveProfile(req.user.id, req.params.id, readProfilePayload(req.body));
    if (!profile) return sendError(res, 404, 'Profile not found');
    return res.json({ profile });
  } catch (error) {
    return next(error);
  }
});

profilesRouter.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('delete from profiles where user_id = $1 and id = $2', [req.user.id, req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
