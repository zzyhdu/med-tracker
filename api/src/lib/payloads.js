import { httpError } from './errors.js';
import {
  readOptionalFiniteNumber,
  readOptionalString,
  readRequiredFiniteNumber,
  readRequiredString,
} from './validation.js';

/**
 * 请求体解析层：把不受信任的 req.body 转成类型安全的领域 payload。
 * 解析失败抛 400 httpError，字段缺失/非法在信息中指明字段名。
 */

// 服药时机（与餐食/作息的关系），对应医院药学的 6 类服药时机
export const TIMING_INSTRUCTIONS = new Set(['fasting', 'before', 'with', 'after', 'morning', 'bedtime']);

// 一天内的可选时段（用户自选时段从这里挑），数组顺序即一天的先后
export const DOSE_SLOT_VALUES = ['morning', 'noon', 'evening', 'night'];

// 周频次的服药日：1=周一 … 7=周日（ISO weekday）
const MIN_WEEKDAY = 1;
const MAX_WEEKDAY = 7;

const DOSE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DOSE_TIMES = 6;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function readDrugPayload(body) {
  const packagingSize = readOptionalFiniteNumber(body.packagingSize, 'packagingSize');
  if (packagingSize !== null && packagingSize <= 0) {
    throw httpError(400, 'packagingSize must be positive');
  }

  return {
    name: readRequiredString(body.name, 'name'),
    packagingSize,
    packagingUnit: readOptionalString(body.packagingUnit),
    pillUnit: readOptionalString(body.pillUnit),
  };
}

function readTimingInstruction(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  if (!TIMING_INSTRUCTIONS.has(text)) {
    throw httpError(400, `timingInstruction must be one of: ${[...TIMING_INSTRUCTIONS].join(', ')}`);
  }
  return text;
}

function readDoseTimes(value) {
  if (value === undefined || value === null) return null;
  const isValid = Array.isArray(value)
    && value.length >= 1
    && value.length <= MAX_DOSE_TIMES
    && value.every(time => typeof time === 'string' && DOSE_TIME_PATTERN.test(time));
  if (!isValid) {
    throw httpError(400, `doseTimes must be an array of 1-${MAX_DOSE_TIMES} HH:MM times`);
  }
  // 去重并升序，保证一天内的时刻按时间顺序展示
  return [...new Set(value)].sort();
}

function readDoseSlots(value) {
  if (value === undefined || value === null) return null;
  const isValid = Array.isArray(value)
    && value.length >= 1
    && value.length <= MAX_DOSE_TIMES
    && value.every(slot => DOSE_SLOT_VALUES.includes(slot));
  if (!isValid) {
    throw httpError(400, `doseSlots must be an array of slot codes: ${DOSE_SLOT_VALUES.join(', ')}`);
  }
  // 去重并按一天内的先后顺序排列
  return DOSE_SLOT_VALUES.filter(slot => value.includes(slot));
}

function readDoseWeekdays(value) {
  if (value === undefined || value === null) return null;
  const isValid = Array.isArray(value)
    && value.length >= 1
    && value.length <= MAX_WEEKDAY
    && value.every(day => Number.isInteger(day) && day >= MIN_WEEKDAY && day <= MAX_WEEKDAY);
  if (!isValid) {
    throw httpError(400, 'doseWeekdays must be an array of ISO weekdays (1=Monday … 7=Sunday)');
  }
  // 去重并升序，保证按周一到周日展示
  return [...new Set(value)].sort((a, b) => a - b);
}

function readDoseAnchorDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  if (!DATE_ONLY_PATTERN.test(text)) {
    throw httpError(400, 'doseAnchorDate must be a YYYY-MM-DD date');
  }
  // 拒绝 2026-02-30 这类会被 JS 静默顺延的假日期
  const [year, month, day] = text.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isReal = parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
  if (!isReal) {
    throw httpError(400, 'doseAnchorDate must be a real calendar date');
  }
  return text;
}

export function readProfilePayload(body) {
  const dailyDosage = readRequiredFiniteNumber(body.dailyDosage, 'dailyDosage');
  const alertThresholdDays = readRequiredFiniteNumber(body.alertThresholdDays, 'alertThresholdDays');
  const dosePerTime = readOptionalFiniteNumber(body.dosePerTime, 'dosePerTime');

  if (dailyDosage < 0 || alertThresholdDays < 0 || (dosePerTime !== null && dosePerTime < 0)) {
    throw httpError(400, 'profile numeric fields are out of range');
  }

  return {
    drugId: readRequiredString(body.drugId, 'drugId'),
    frequency: readOptionalString(body.frequency),
    dosePerTime,
    dailyDosage,
    alertThresholdDays,
    timingInstruction: readTimingInstruction(body.timingInstruction),
    doseTimes: readDoseTimes(body.doseTimes),
    doseSlots: readDoseSlots(body.doseSlots),
    doseWeekdays: readDoseWeekdays(body.doseWeekdays),
    doseAnchorDate: readDoseAnchorDate(body.doseAnchorDate),
  };
}

export function readTrackerPayload(body) {
  const baseInventory = readRequiredFiniteNumber(body.baseInventory, 'baseInventory');
  if (baseInventory < 0) {
    throw httpError(400, 'baseInventory must not be negative');
  }

  const baseDate = new Date(body.baseDate);
  if (Number.isNaN(baseDate.getTime())) {
    throw httpError(400, 'baseDate must be a valid date');
  }

  return {
    baseInventory,
    baseDate: baseDate.toISOString(),
  };
}
