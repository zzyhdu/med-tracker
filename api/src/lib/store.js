import { pool } from '../db.js';
import { httpError } from './errors.js';
import { mapDrug, mapProfile, mapTracker } from './mappers.js';

/**
 * 数据访问层：承载非平凡的写路径 SQL（upsert、级联删除判断）。
 * 约定：
 * - 归属校验内嵌在 SQL 里（where 或 insert-select），跨用户访问表现为「查无此行」，
 *   路由层据此返回 404，绝不泄露他人数据的存在性。
 * - 返回 null 表示未命中；返回 undefined 表示写操作完成但无需回读。
 */

const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_UNIQUE_VIOLATION = '23505';

export async function saveDrug(userId, drugId, payload) {
  const { rows } = await pool.query(
    `
      insert into drugs (id, created_by, name, packaging_size, packaging_unit, pill_unit)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (id) do update set
        name = excluded.name,
        packaging_size = excluded.packaging_size,
        packaging_unit = excluded.packaging_unit,
        pill_unit = excluded.pill_unit,
        updated_at = now()
      where drugs.created_by = excluded.created_by
      returning *
    `,
    [drugId, userId, payload.name, payload.packagingSize, payload.packagingUnit, payload.pillUnit],
  );

  return rows[0] ? mapDrug(rows[0]) : null;
}

/**
 * 删除共享规格。三种结局：
 * - not-found：规格不存在或不是当前用户创建的
 * - referenced：规格被其他用户的医嘱引用，禁止删除（409）
 * - deleted：删除成功；当前用户自己的医嘱/追踪由外键级联连带删除
 */
export async function deleteDrug(userId, drugId) {
  const { rows: owned } = await pool.query(
    'select id from drugs where id = $1 and created_by = $2',
    [drugId, userId],
  );
  if (owned.length === 0) return 'not-found';

  const { rows: foreignRefs } = await pool.query(
    'select 1 from profiles where drug_id = $1 and user_id <> $2 limit 1',
    [drugId, userId],
  );
  if (foreignRefs.length > 0) return 'referenced';

  await pool.query('delete from drugs where id = $1', [drugId]);
  return 'deleted';
}

export async function saveProfile(userId, profileId, payload) {
  try {
    const { rows } = await pool.query(
      `
        insert into profiles (id, user_id, drug_id, frequency, dose_per_time, daily_dosage, alert_threshold_days,
                              timing_instruction, dose_times, dose_slots, dose_weekdays, dose_anchor_date)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        on conflict (id) do update set
          drug_id = excluded.drug_id,
          frequency = excluded.frequency,
          dose_per_time = excluded.dose_per_time,
          daily_dosage = excluded.daily_dosage,
          alert_threshold_days = excluded.alert_threshold_days,
          timing_instruction = excluded.timing_instruction,
          dose_times = excluded.dose_times,
          dose_slots = excluded.dose_slots,
          dose_weekdays = excluded.dose_weekdays,
          dose_anchor_date = excluded.dose_anchor_date,
          updated_at = now()
        where profiles.user_id = excluded.user_id
        returning *
      `,
      [
        profileId,
        userId,
        payload.drugId,
        payload.frequency,
        payload.dosePerTime,
        payload.dailyDosage,
        payload.alertThresholdDays,
        payload.timingInstruction,
        payload.doseTimes,
        payload.doseSlots,
        payload.doseWeekdays,
        payload.doseAnchorDate,
      ],
    );

    return rows[0] ? mapProfile(rows[0]) : null;
  } catch (error) {
    if (error?.code === PG_FOREIGN_KEY_VIOLATION) {
      throw httpError(400, 'drugId does not exist');
    }
    if (error?.code === PG_UNIQUE_VIOLATION) {
      throw httpError(409, 'An instruction already exists for this drug');
    }
    throw error;
  }
}

export async function saveTracker(userId, profileId, payload) {
  const { rows } = await pool.query(
    `
      insert into trackers (user_id, profile_id, base_inventory, base_date)
      select $1, profiles.id, $3, $4
      from profiles
      where profiles.id = $2
        and profiles.user_id = $1
      on conflict (user_id, profile_id) do update set
        base_inventory = excluded.base_inventory,
        base_date = excluded.base_date,
        updated_at = now()
      returning *
    `,
    [userId, profileId, payload.baseInventory, payload.baseDate],
  );

  return rows[0] ? mapTracker(rows[0]) : null;
}
