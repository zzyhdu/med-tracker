import { Router } from 'express';
import { pool } from '../db.js';
import { sendError } from '../lib/errors.js';
import { mapTracker } from '../lib/mappers.js';
import { readTrackerPayload } from '../lib/payloads.js';
import { saveTracker } from '../lib/store.js';
import { requireUser } from '../middleware/requireUser.js';

/**
 * 库存追踪：挂靠在用户自己的医嘱上。
 */
export const trackersRouter = Router();

trackersRouter.use(requireUser);

trackersRouter.get('/', async (req, res, next) => {
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

trackersRouter.post('/', async (req, res, next) => {
  try {
    const profileId = req.body.profileId;
    if (!profileId) return sendError(res, 400, 'profileId is required');

    const tracker = await saveTracker(req.user.id, profileId, readTrackerPayload(req.body));
    if (!tracker) return sendError(res, 404, 'Profile not found');
    return res.status(201).json({ tracker });
  } catch (error) {
    return next(error);
  }
});

trackersRouter.put('/:profileId', async (req, res, next) => {
  try {
    const tracker = await saveTracker(req.user.id, req.params.profileId, readTrackerPayload(req.body));
    if (!tracker) return sendError(res, 404, 'Profile not found');
    return res.json({ tracker });
  } catch (error) {
    return next(error);
  }
});

trackersRouter.delete('/:profileId', async (req, res, next) => {
  try {
    await pool.query('delete from trackers where user_id = $1 and profile_id = $2', [req.user.id, req.params.profileId]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
