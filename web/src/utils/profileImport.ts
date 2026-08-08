import { FREQUENCY_MULTIPLIERS } from './InventoryEngine';
import type { DoseSlot, TimingInstruction } from './InventoryEngine';
import {
  DOSE_SLOT_LABELS,
  TIMING_INSTRUCTION_LABELS,
  WEEKDAY_LABELS,
  sortDoseSlots,
  sortDoseWeekdays,
} from './reminders';

/** 批量导入的条目：规格字段 + 医嘱字段的合体，不含 id（规格按名字复用或新建） */
export interface ImportedDrug {
  name: string;
  packagingSize?: number;
  packagingUnit?: string;
  pillUnit?: string;
  frequency: string;
  dosePerTime: number;
  dailyDosage: number;
  alertThresholdDays: number;
  timingInstruction?: TimingInstruction;
  doseTimes?: string[];
  doseSlots?: DoseSlot[];
  doseWeekdays?: number[];
  doseAnchorDate?: string;
}

export interface ImportError {
  index: number; // -1 表示整体错误（如 JSON 解析失败）
  message: string;
}

export interface ImportResult {
  items: ImportedDrug[];
  errors: ImportError[];
}

function readOptionalNumber(record: Record<string, unknown>, field: string): number | undefined {
  const value = record[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} 必须是数字`);
  }
  return value;
}

function readOptionalString(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${field} 必须是字符串`);
  }
  return value;
}

const DOSE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function readTimingInstruction(record: Record<string, unknown>): TimingInstruction | undefined {
  const value = readOptionalString(record, 'timingInstruction');
  if (value === undefined) return undefined;
  if (!(value in TIMING_INSTRUCTION_LABELS)) {
    throw new Error(`timingInstruction 无效：${value}`);
  }
  return value as TimingInstruction;
}

function readDoseTimes(record: Record<string, unknown>): string[] | undefined {
  const value = record['doseTimes'];
  if (value === undefined || value === null) return undefined;
  const isValid = Array.isArray(value)
    && value.length >= 1
    && value.length <= 6
    && value.every(time => typeof time === 'string' && DOSE_TIME_PATTERN.test(time));
  if (!isValid) {
    throw new Error('doseTimes 必须是 1-6 个 HH:MM 格式的时间');
  }
  return [...new Set(value as string[])].sort();
}

function readDoseSlots(record: Record<string, unknown>): DoseSlot[] | undefined {
  const value = record['doseSlots'];
  if (value === undefined || value === null) return undefined;
  const isValid = Array.isArray(value)
    && value.length >= 1
    && value.length <= 6
    && value.every(slot => typeof slot === 'string' && slot in DOSE_SLOT_LABELS);
  if (!isValid) {
    throw new Error(`doseSlots 必须是 1-6 个时段代码：${Object.keys(DOSE_SLOT_LABELS).join(', ')}`);
  }
  return sortDoseSlots(value as DoseSlot[]);
}

function readDoseWeekdays(record: Record<string, unknown>): number[] | undefined {
  const value = record['doseWeekdays'];
  if (value === undefined || value === null) return undefined;
  const isValid = Array.isArray(value)
    && value.length >= 1
    && value.length <= 7
    && value.every(day => typeof day === 'number' && Number.isInteger(day) && day in WEEKDAY_LABELS);
  if (!isValid) {
    throw new Error('doseWeekdays 必须是 1-7 的整数（1=周一 … 7=周日）');
  }
  return sortDoseWeekdays(value as number[]);
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readDoseAnchorDate(record: Record<string, unknown>): string | undefined {
  const value = record['doseAnchorDate'];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    throw new Error('doseAnchorDate 必须是 YYYY-MM-DD 格式的日期');
  }
  // 拒绝 2026-02-30 这类会被顺延的假日期
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isReal = parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
  if (!isReal) {
    throw new Error('doseAnchorDate 不是真实存在的日期');
  }
  return value;
}

function parseEntry(entry: unknown): ImportedDrug {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error('条目必须是对象');
  }
  const record = entry as Record<string, unknown>;

  const name = readOptionalString(record, 'name')?.trim();
  if (!name) {
    throw new Error('name 必填且不能为空');
  }

  const frequency = readOptionalString(record, 'frequency') ?? 'qd';
  if (!(frequency in FREQUENCY_MULTIPLIERS)) {
    throw new Error(`frequency 无效：${frequency}`);
  }

  const dosePerTime = readOptionalNumber(record, 'dosePerTime') ?? 1;
  if (dosePerTime < 0) {
    throw new Error('dosePerTime 不能小于 0');
  }

  // 与医嘱表单保持一致：dailyDosage = 单次剂量 × 频次系数，显式给出时优先
  const explicitDailyDosage = readOptionalNumber(record, 'dailyDosage');
  const dailyDosage = explicitDailyDosage ?? dosePerTime * FREQUENCY_MULTIPLIERS[frequency];
  if (dailyDosage < 0) {
    throw new Error('dailyDosage 不能小于 0');
  }

  const packagingSize = readOptionalNumber(record, 'packagingSize');
  if (packagingSize !== undefined && packagingSize <= 0) {
    throw new Error('packagingSize 必须大于 0');
  }

  const alertThresholdDays = readOptionalNumber(record, 'alertThresholdDays') ?? 14;
  if (alertThresholdDays < 0) {
    throw new Error('alertThresholdDays 不能小于 0');
  }

  return {
    name,
    frequency,
    dosePerTime,
    dailyDosage,
    packagingSize,
    packagingUnit: readOptionalString(record, 'packagingUnit'),
    pillUnit: readOptionalString(record, 'pillUnit'),
    alertThresholdDays,
    timingInstruction: readTimingInstruction(record),
    doseTimes: readDoseTimes(record),
    doseSlots: readDoseSlots(record),
    doseWeekdays: readDoseWeekdays(record),
    doseAnchorDate: readDoseAnchorDate(record),
  };
}

export function parseProfileImport(jsonText: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { items: [], errors: [{ index: -1, message: 'JSON 解析失败，请检查格式' }] };
  }

  if (!Array.isArray(parsed)) {
    return { items: [], errors: [{ index: -1, message: '顶层必须是药品规格数组' }] };
  }

  const items: ImportedDrug[] = [];
  const errors: ImportError[] = [];

  parsed.forEach((entry, index) => {
    try {
      items.push(parseEntry(entry));
    } catch (error) {
      errors.push({ index, message: error instanceof Error ? error.message : '条目无效' });
    }
  });

  return { items, errors };
}
