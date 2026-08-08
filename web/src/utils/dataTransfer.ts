import { FREQUENCY_MULTIPLIERS } from './InventoryEngine';
import type { DoseSlot, DrugProfile, DrugSpec, DrugTracker, TimingInstruction } from './InventoryEngine';
import {
  DOSE_SLOT_LABELS,
  TIMING_INSTRUCTION_LABELS,
  WEEKDAY_LABELS,
  sortDoseSlots,
  sortDoseWeekdays,
} from './reminders';

/**
 * 账号数据的跨实例搬运格式（备份/迁移）。
 * 与批量导入（profileImport）的区别：那是手写 JSON 的快捷录入，这里是自己导出的完整快照，
 * 多了库存追踪，且全部用「药品名」做关联键 —— 两台实例的 UUID 各自为政，只有名字可移植。
 */

export const BACKUP_VERSION = 1;

export interface BackupDrug {
  name: string;
  packagingSize?: number;
  packagingUnit?: string;
  pillUnit?: string;
}

export interface BackupProfile {
  drugName: string;
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

export interface BackupTracker {
  drugName: string;
  baseInventory: number;
  baseDate: string;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  drugs: BackupDrug[];
  profiles: BackupProfile[];
  trackers: BackupTracker[];
}

export type BackupSection = 'drugs' | 'profiles' | 'trackers';

export interface BackupError {
  section: BackupSection | 'global';
  index: number; // section 内的序号；-1 表示整体错误（如 JSON 解析失败）
  message: string;
}

export interface BackupParseResult {
  data?: BackupData;
  errors: BackupError[];
}

interface BackupSource {
  drugs: DrugSpec[];
  profiles: DrugProfile[];
  trackers: DrugTracker[];
  userId: string;
}

/**
 * 导出当前账号的数据快照。规格只带走「我创建的」和「我的医嘱引用的」，
 * 别人创建且与我无关的共享规格不属于我的数据，不搬。
 */
export function buildBackup({ drugs, profiles, trackers, userId }: BackupSource): BackupData {
  const referencedDrugIds = new Set(profiles.map(profile => profile.drugId));
  const exportedDrugs = drugs.filter(drug => drug.createdBy === userId || referencedDrugIds.has(drug.id));
  const nameById = new Map(exportedDrugs.map(drug => [drug.id, drug.name]));

  const exportedProfiles = profiles.flatMap(profile => {
    const drugName = nameById.get(profile.drugId);
    if (!drugName) return [];
    return [{
      drugName,
      frequency: profile.frequency ?? 'qd',
      dosePerTime: profile.dosePerTime ?? profile.dailyDosage,
      dailyDosage: profile.dailyDosage,
      alertThresholdDays: profile.alertThresholdDays,
      timingInstruction: profile.timingInstruction,
      doseTimes: profile.doseTimes,
      doseSlots: profile.doseSlots,
      doseWeekdays: profile.doseWeekdays,
      doseAnchorDate: profile.doseAnchorDate,
    }];
  });

  const drugNameByProfileId = new Map(
    profiles.map(profile => [profile.id, nameById.get(profile.drugId)] as const),
  );
  const exportedTrackers = trackers.flatMap(tracker => {
    const drugName = drugNameByProfileId.get(tracker.profileId);
    if (!drugName) return [];
    return [{ drugName, baseInventory: tracker.baseInventory, baseDate: tracker.baseDate }];
  });

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    drugs: exportedDrugs.map(drug => ({
      name: drug.name,
      packagingSize: drug.packagingSize,
      packagingUnit: drug.packagingUnit,
      pillUnit: drug.pillUnit,
    })),
    profiles: exportedProfiles,
    trackers: exportedTrackers,
  };
}

export function serializeBackup(data: BackupData): string {
  return JSON.stringify(data, null, 2);
}

// ---------- 解析与校验 ----------

function readOptionalNumber(record: Record<string, unknown>, field: string): number | undefined {
  const value = record[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} 必须是数字`);
  }
  return value;
}

function readRequiredNumber(record: Record<string, unknown>, field: string): number {
  const value = readOptionalNumber(record, field);
  if (value === undefined) throw new Error(`${field} 必填`);
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

function asRecord(entry: unknown): Record<string, unknown> {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error('条目必须是对象');
  }
  return entry as Record<string, unknown>;
}

const DOSE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function readDoseAnchorDate(record: Record<string, unknown>): string | undefined {
  const value = readOptionalString(record, 'doseAnchorDate');
  if (value === undefined || value === '') return undefined;
  if (!DATE_ONLY_PATTERN.test(value)) {
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

function parseDrug(entry: unknown): BackupDrug {
  const record = asRecord(entry);
  const name = readOptionalString(record, 'name')?.trim();
  if (!name) throw new Error('name 必填且不能为空');
  const packagingSize = readOptionalNumber(record, 'packagingSize');
  if (packagingSize !== undefined && packagingSize <= 0) throw new Error('packagingSize 必须大于 0');
  return {
    name,
    packagingSize,
    packagingUnit: readOptionalString(record, 'packagingUnit'),
    pillUnit: readOptionalString(record, 'pillUnit'),
  };
}

function parseProfile(entry: unknown): BackupProfile {
  const record = asRecord(entry);
  const drugName = readOptionalString(record, 'drugName')?.trim();
  if (!drugName) throw new Error('drugName 必填且不能为空');

  const frequency = readOptionalString(record, 'frequency') ?? 'qd';
  if (!(frequency in FREQUENCY_MULTIPLIERS)) throw new Error(`frequency 无效：${frequency}`);

  const dosePerTime = readOptionalNumber(record, 'dosePerTime') ?? 1;
  if (dosePerTime < 0) throw new Error('dosePerTime 不能小于 0');

  // 缺省时按「单次剂量 × 频次系数」补算，与医嘱表单一致
  const dailyDosage = readOptionalNumber(record, 'dailyDosage') ?? dosePerTime * FREQUENCY_MULTIPLIERS[frequency];
  if (dailyDosage < 0) throw new Error('dailyDosage 不能小于 0');

  const alertThresholdDays = readOptionalNumber(record, 'alertThresholdDays') ?? 14;
  if (alertThresholdDays < 0) throw new Error('alertThresholdDays 不能小于 0');

  return {
    drugName,
    frequency,
    dosePerTime,
    dailyDosage,
    alertThresholdDays,
    timingInstruction: readTimingInstruction(record),
    doseTimes: readDoseTimes(record),
    doseSlots: readDoseSlots(record),
    doseWeekdays: readDoseWeekdays(record),
    doseAnchorDate: readDoseAnchorDate(record),
  };
}

function parseTracker(entry: unknown): BackupTracker {
  const record = asRecord(entry);
  const drugName = readOptionalString(record, 'drugName')?.trim();
  if (!drugName) throw new Error('drugName 必填且不能为空');
  const baseInventory = readRequiredNumber(record, 'baseInventory');
  if (baseInventory < 0) throw new Error('baseInventory 不能小于 0');
  const baseDate = readOptionalString(record, 'baseDate');
  if (!baseDate || Number.isNaN(new Date(baseDate).getTime())) {
    throw new Error('baseDate 必须是合法的日期时间');
  }
  return { drugName, baseInventory, baseDate };
}

function parseSection<T>(
  value: unknown,
  section: BackupSection,
  parseEntry: (entry: unknown) => T,
  errors: BackupError[],
): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.push({ section, index: -1, message: `${section} 必须是数组` });
    return [];
  }
  const items: T[] = [];
  value.forEach((entry, index) => {
    try {
      items.push(parseEntry(entry));
    } catch (error) {
      errors.push({ section, index, message: error instanceof Error ? error.message : '条目无效' });
    }
  });
  return items;
}

/** 解析备份文件。有任何错误都不返回 data，由调用方展示错误并阻止导入。 */
export function parseBackup(jsonText: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { errors: [{ section: 'global', index: -1, message: 'JSON 解析失败，请检查格式' }] };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { errors: [{ section: 'global', index: -1, message: '顶层必须是备份对象（含 version/drugs/profiles/trackers）' }] };
  }

  const record = parsed as Record<string, unknown>;
  if (record['version'] !== BACKUP_VERSION) {
    return { errors: [{ section: 'global', index: -1, message: `不支持的备份版本：${String(record['version'])}（当前支持 ${BACKUP_VERSION}）` }] };
  }

  const errors: BackupError[] = [];
  const data: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: typeof record['exportedAt'] === 'string' ? record['exportedAt'] : '',
    drugs: parseSection(record['drugs'], 'drugs', parseDrug, errors),
    profiles: parseSection(record['profiles'], 'profiles', parseProfile, errors),
    trackers: parseSection(record['trackers'], 'trackers', parseTracker, errors),
  };

  return errors.length > 0 ? { errors } : { data, errors: [] };
}
