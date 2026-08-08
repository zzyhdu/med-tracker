import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.js';
import { sendError } from '../lib/errors.js';
import { mapDrug } from '../lib/mappers.js';
import { readDrugPayload } from '../lib/payloads.js';
import { deleteDrug, saveDrug } from '../lib/store.js';
import { requireUser } from '../middleware/requireUser.js';

/**
 * 共享药物规格库：所有登录用户可读、可引用；
 * 仅创建者可修改/删除，被他人医嘱引用的规格禁止删除。
 */
export const drugsRouter = Router();

drugsRouter.use(requireUser);

drugsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('select * from drugs order by name asc');
    res.json({ drugs: rows.map(mapDrug) });
  } catch (error) {
    next(error);
  }
});

drugsRouter.post('/', async (req, res, next) => {
  try {
    const drugId = req.body.id || crypto.randomUUID();
    const drug = await saveDrug(req.user.id, drugId, readDrugPayload(req.body));
    if (!drug) return sendError(res, 404, 'Drug not found');
    return res.status(201).json({ drug });
  } catch (error) {
    return next(error);
  }
});

drugsRouter.put('/:id', async (req, res, next) => {
  try {
    const drug = await saveDrug(req.user.id, req.params.id, readDrugPayload(req.body));
    if (!drug) return sendError(res, 404, 'Drug not found');
    return res.json({ drug });
  } catch (error) {
    return next(error);
  }
});

drugsRouter.delete('/:id', async (req, res, next) => {
  try {
    const outcome = await deleteDrug(req.user.id, req.params.id);
    if (outcome === 'not-found') return sendError(res, 404, 'Drug not found');
    if (outcome === 'referenced') return sendError(res, 409, 'Drug is referenced by other users');
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
