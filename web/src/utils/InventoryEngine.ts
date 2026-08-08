import { countDoseDaysInRange } from './reminders';

export const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  'qd': 1,
  'bid': 2,
  'tid': 3,
  'qid': 4,
  'qn': 1,
  'q12h': 2,
  'q8h': 3,
  'q6h': 4,
  'qod': 0.5,
  'qw': 1 / 7,
  'biw': 2 / 7,
  'tiw': 3 / 7,
  'prn': 0,
};

export const FREQUENCY_LABELS: Record<string, string> = {
  'qd': 'qd (每日1次)',
  'bid': 'bid (每日2次)',
  'tid': 'tid (每日3次)',
  'qid': 'qid (每日4次)',
  'qn': 'qn (每晚1次)',
  'q12h': 'q12h (每12小时1次)',
  'q8h': 'q8h (每8小时1次)',
  'q6h': 'q6h (每6小时1次)',
  'qod': 'qod (隔日1次)',
  'qw': 'qw (每周1次)',
  'biw': 'biw (每周2次)',
  'tiw': 'tiw (每周3次)',
  'prn': 'prn (按需服用)',
};

/** 频次的中文短名（去掉拉丁处方缩写），用于卡片展示；表单下拉仍用带缩写的 FREQUENCY_LABELS */
export function frequencyShortLabel(frequency: string): string {
  const label = FREQUENCY_LABELS[frequency];
  if (!label) return frequency;
  const match = label.match(/^[a-z0-9]+ \((.+)\)$/);
  return match ? match[1] : label;
}

/** 剂量数字展示：最多两位小数并去尾零（3 → "3"，0.857… → "0.86"） */
export function formatDosage(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * 领域模型（与后端 DTO 一一对应）：
 * - DrugSpec 共享药物规格：跨用户可读共用，仅创建者可改
 * - DrugProfile 个人医嘱：每用户对某款药自己的服用方法
 * - DrugTracker 库存基线：挂靠在用户自己的医嘱上
 */
export interface DrugSpec {
  id: string;
  createdBy: string;
  name: string;
  packagingSize?: number;
  packagingUnit?: string;
  pillUnit?: string;
}

/** 服药时机：与餐食/作息的关系（对应医院药学的 6 类服药时机） */
export type TimingInstruction = 'fasting' | 'before' | 'with' | 'after' | 'morning' | 'bedtime';

/** 一天内的可选时段（医嘱自选时段从这里挑） */
export type DoseSlot = 'morning' | 'noon' | 'evening' | 'night';

export interface DrugProfile {
  id: string;
  drugId: string; // FK → DrugSpec.id
  frequency?: string; // e.g., 'bid'
  dosePerTime?: number; // e.g., 2 pills each time
  dailyDosage: number; // Stays active for exactly calculating deductions
  alertThresholdDays: number;
  timingInstruction?: TimingInstruction; // 空腹/餐前/餐中/餐后/晨服/睡前
  doseTimes?: string[]; // 固定时间点（'HH:MM'），优先级最高
  doseSlots?: DoseSlot[]; // 自选时段，数量=每日次数；doseTimes 为空时生效
  doseWeekdays?: number[]; // 周频次服药日（1=周一…7=周日），数量=每周次数；仅 qw/biw/tiw 用
  doseAnchorDate?: string; // 隔 N 天频次的锚定服药日（'YYYY-MM-DD'）；仅 qod 等用
}

export interface DrugTracker {
  profileId: string; // FK → DrugProfile.id
  baseInventory: number;
  baseDate: string;
}

/**
 * 展示层合并视图：医嘱 + 规格 + 库存推算结果，
 * 看板卡片与行动页卡片都只消费这一个类型。
 */
export interface CalculatedInventory {
  profileId: string;
  drugId: string;
  name: string;
  frequency?: string;
  dosePerTime?: number;
  dailyDosage: number;
  alertThresholdDays: number;
  timingInstruction?: TimingInstruction;
  doseTimes?: string[];
  doseSlots?: DoseSlot[];
  doseWeekdays?: number[];
  doseAnchorDate?: string;
  packagingSize?: number;
  packagingUnit?: string;
  pillUnit?: string;
  baseInventory: number;
  baseDate: string;
  currentInventory: number;
  daysRemaining: number;
  isLowStock: boolean;
}

export class InventoryEngine {
  static calculate(profile: DrugProfile, spec: DrugSpec, tracker: DrugTracker, currentDate: Date = new Date()): CalculatedInventory {
    const base = new Date(tracker.baseDate);
    const baseMidnight = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const currentMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

    const diffTime = currentMidnight.getTime() - baseMidnight.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    // 有具体服药日程的（周频次的周几 / 隔日的锚定日）按实际服药事件扣减，
    // 即只在服药日扣单次剂量；没有日程信息的退回按日均剂量平均扣。
    const doseDays = countDoseDaysInRange(profile, baseMidnight, currentMidnight);
    const deduction = doseDays !== null && profile.dosePerTime !== undefined
      ? doseDays * profile.dosePerTime
      : diffDays * profile.dailyDosage;
    const currentInventory = Math.max(0, tracker.baseInventory - deduction);

    const daysRemaining = profile.dailyDosage > 0
      ? Number((currentInventory / profile.dailyDosage).toFixed(1))
      : Number.POSITIVE_INFINITY;

    const isLowStock = daysRemaining <= profile.alertThresholdDays || currentInventory === 0;

    return {
      profileId: profile.id,
      drugId: spec.id,
      name: spec.name,
      frequency: profile.frequency,
      dosePerTime: profile.dosePerTime,
      dailyDosage: profile.dailyDosage,
      alertThresholdDays: profile.alertThresholdDays,
      timingInstruction: profile.timingInstruction,
      doseTimes: profile.doseTimes,
      doseSlots: profile.doseSlots,
      doseWeekdays: profile.doseWeekdays,
      doseAnchorDate: profile.doseAnchorDate,
      packagingSize: spec.packagingSize,
      packagingUnit: spec.packagingUnit,
      pillUnit: spec.pillUnit,
      baseInventory: tracker.baseInventory,
      baseDate: tracker.baseDate,
      currentInventory,
      daysRemaining,
      isLowStock
    };
  }

  static recalibrate(tracker: DrugTracker, newCurrentInventory: number, currentDate: Date = new Date()): DrugTracker {
    return {
      ...tracker,
      baseInventory: Math.max(0, newCurrentInventory),
      baseDate: currentDate.toISOString()
    };
  }
}

/**
 * 三表 join：trackers → profiles → drugs，产出卡片用的合并视图。
 * 孤儿的追踪/医嘱（关联行不存在）静默跳过。
 */
export function joinInventory(
  profiles: DrugProfile[],
  drugs: DrugSpec[],
  trackers: DrugTracker[],
): CalculatedInventory[] {
  const specById = new Map(drugs.map(drug => [drug.id, drug]));
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));

  const results: CalculatedInventory[] = [];
  for (const tracker of trackers) {
    const profile = profileById.get(tracker.profileId);
    const spec = profile ? specById.get(profile.drugId) : undefined;
    if (profile && spec) {
      results.push(InventoryEngine.calculate(profile, spec, tracker));
    }
  }
  return results;
}
