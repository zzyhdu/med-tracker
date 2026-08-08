import type { CalculatedInventory, DoseSlot, TimingInstruction } from './InventoryEngine';

/** 服药时机展示文案（附专业定义：餐前=饭前15~60分钟，空腹=餐前1小时或餐后2小时） */
export const TIMING_INSTRUCTION_LABELS: Record<TimingInstruction, string> = {
  fasting: '空腹（餐前1小时或餐后2小时）',
  before: '餐前（饭前15~60分钟）',
  with: '餐中（随餐服用）',
  after: '餐后（饭后15~30分钟）',
  morning: '晨服（清晨，早餐前后）',
  bedtime: '睡前（睡前15~30分钟）',
};

/** 一天内可选时段的展示文案 */
export const DOSE_SLOT_LABELS: Record<DoseSlot, string> = {
  morning: '早晨',
  noon: '中午',
  evening: '晚上',
  night: '睡前',
};

/** 时段在一天中的先后顺序（排序与展示统一用它） */
export const DOSE_SLOT_ORDER: DoseSlot[] = ['morning', 'noon', 'evening', 'night'];

/** 日间时段型频次的默认服药时段 */
export const DEFAULT_DOSE_SLOTS: Record<string, DoseSlot[]> = {
  'qd': ['morning'],
  'bid': ['morning', 'evening'],
  'tid': ['morning', 'noon', 'evening'],
  'qid': ['morning', 'noon', 'evening', 'night'],
  'qn': ['night'],
};

/** 严格间隔型频次的标准锚点时刻（按小时等间隔、含夜间，维持血药浓度） */
export const INTERVAL_ANCHOR_TIMES: Record<string, string[]> = {
  'q12h': ['08:00', '20:00'],
  'q8h': ['06:00', '14:00', '22:00'],
  'q6h': ['06:00', '12:00', '18:00', '00:00'],
};

/** 周频次（按周几服药）对应的每周次数 */
export const WEEKLY_DOSE_COUNTS: Record<string, number> = {
  'qw': 1,
  'biw': 2,
  'tiw': 3,
};

/** 隔 N 天型频次的间隔天数（qod = 隔天一次） */
export const EVERY_N_DAYS: Record<string, number> = {
  'qod': 2,
};

/** 服药日展示文案，键为 ISO 周日（1=周一 … 7=周日） */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
};

/** 周一到周日的排列顺序（排序与展示统一用它） */
export const WEEKDAY_ORDER: number[] = [1, 2, 3, 4, 5, 6, 7];

/** 餐食相对时机（餐前/餐后/餐中）的短标签，用于拼接餐次锚定的 chips */
const TIMING_SHORT_LABELS: Partial<Record<TimingInstruction, string>> = {
  before: '餐前',
  after: '餐后',
  with: '餐时',
};

/** 时段对应的餐次前缀（睡前不属于任何一餐，无前缀） */
const SLOT_MEAL_PREFIX: Record<DoseSlot, string> = {
  morning: '早',
  noon: '午',
  evening: '晚',
  night: '',
};

/** 去重并按一天内的先后顺序排列 */
export function sortDoseSlots(slots: DoseSlot[]): DoseSlot[] {
  return DOSE_SLOT_ORDER.filter(slot => slots.includes(slot));
}

/** 去重并按周一到周日排列 */
export function sortDoseWeekdays(days: number[]): number[] {
  return WEEKDAY_ORDER.filter(day => days.includes(day));
}

/** 时段划分：5-10 点早晨，11-13 点中午，14-19 点晚上，20 点-次日 4 点睡前 */
export function slotOfHour(hour: number): DoseSlot {
  if (hour >= 5 && hour <= 10) return 'morning';
  if (hour >= 11 && hour <= 13) return 'noon';
  if (hour >= 14 && hour <= 19) return 'evening';
  return 'night';
}

/** 当前时刻所属的服药时段 */
export function currentDoseSlot(now: Date = new Date()): DoseSlot {
  return slotOfHour(now.getHours());
}

/** HH:MM 时刻所属的时段 */
function slotOfTime(time: string): DoseSlot {
  return slotOfHour(Number(time.slice(0, 2)));
}

/** Date → ISO 周日（1=周一 … 7=周日） */
function isoWeekdayOf(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay();
}

/** 一天内服药时刻推导的输入（医嘱的时刻相关字段） */
export interface DoseScheduleInput {
  frequency?: string;
  doseTimes?: string[];
  doseSlots?: DoseSlot[];
  doseWeekdays?: number[];
  doseAnchorDate?: string;
  timingInstruction?: TimingInstruction;
}

/**
 * 时段码 → 展示文案：
 * 有餐食相对时机（餐前/餐后/餐中）时拼餐次（morning+before → 早餐前），
 * 睡前时段不属于餐次，固定显示「睡前」；无餐食时机时用时段本身文案（早晨/中午/晚上）。
 */
export function mapSlotsToLabels(slots: DoseSlot[], timing?: TimingInstruction): string[] {
  const short = timing ? TIMING_SHORT_LABELS[timing] : undefined;
  return sortDoseSlots(slots).map(slot => {
    if (!short || slot === 'night') return DOSE_SLOT_LABELS[slot];
    return `${SLOT_MEAL_PREFIX[slot]}${short}`;
  });
}

/**
 * 周频次 chips 的文案：「周一」「周四」，可带时段或餐食时机后缀
 * （选了晚上+餐前 → 「周一 晚餐前」；只有餐前时机 → 「周一 餐前」）。
 */
function formatWeeklyChips(med: DoseScheduleInput, days: number[]): string[] {
  let suffix = '';
  if (med.doseSlots && med.doseSlots.length > 0) {
    suffix = mapSlotsToLabels(med.doseSlots, med.timingInstruction).join(' / ');
  } else {
    const short = med.timingInstruction ? TIMING_SHORT_LABELS[med.timingInstruction] : undefined;
    if (short) suffix = short;
  }
  return sortDoseWeekdays(days).map(day => (suffix ? `${WEEKDAY_LABELS[day]} ${suffix}` : WEEKDAY_LABELS[day]));
}

export type DoseTimeKind = 'fixed' | 'weekly' | 'slots' | 'interval' | 'none';

export interface DoseTimes {
  kind: DoseTimeKind;
  times: string[];
}

/**
 * 一天内服药时刻推导，优先级：
 * 医嘱显式固定时间点 > 周频次的服药日（qw/biw/tiw 且指定了周几）> 用户自选时段
 * > 频次默认时段 > 间隔型频次的标准锚点 > 无（prn 等）。
 * 餐食相对时机（餐前/餐后/餐中）在时段层做餐次锚定（早餐前/午餐后…），
 * 但 qd 默认不指派具体哪一餐，保持中性「餐前」，由用户用自选时段明确。
 */
export function resolveDoseChips(med: DoseScheduleInput): DoseTimes {
  if (med.doseTimes && med.doseTimes.length > 0) {
    return { kind: 'fixed', times: med.doseTimes };
  }
  if (med.frequency && med.frequency in WEEKLY_DOSE_COUNTS && med.doseWeekdays && med.doseWeekdays.length > 0) {
    return { kind: 'weekly', times: formatWeeklyChips(med, med.doseWeekdays) };
  }
  if (med.doseSlots && med.doseSlots.length > 0) {
    return { kind: 'slots', times: mapSlotsToLabels(med.doseSlots, med.timingInstruction) };
  }
  const defaults = med.frequency ? DEFAULT_DOSE_SLOTS[med.frequency] : undefined;
  if (defaults) {
    const short = med.timingInstruction ? TIMING_SHORT_LABELS[med.timingInstruction] : undefined;
    if (short && med.frequency === 'qd') {
      return { kind: 'slots', times: [short] };
    }
    // qd + 睡前时机：时段本身就是指定，chip 用睡前而非默认早晨
    const slots = med.frequency === 'qd' && med.timingInstruction === 'bedtime' ? ['night' as DoseSlot] : defaults;
    return { kind: 'slots', times: mapSlotsToLabels(slots, med.timingInstruction) };
  }
  const anchors = med.frequency ? INTERVAL_ANCHOR_TIMES[med.frequency] : undefined;
  if (anchors) {
    return { kind: 'interval', times: anchors };
  }
  return { kind: 'none', times: [] };
}

/**
 * 与 resolveDoseChips 同一优先链，但返回时段码而不是展示文案，用于「当前时段」筛选。
 * 固定时间点/间隔锚点按小时归并到时段；null 表示无时刻信息（prn 等），任何时段都展示。
 * qd + 餐食相对时机且未自选时段时是中性「餐前」，覆盖三餐（不含睡前）。
 */
export function resolveDoseSlotCodes(med: DoseScheduleInput): DoseSlot[] | null {
  if (med.doseTimes && med.doseTimes.length > 0) {
    return sortDoseSlots(med.doseTimes.map(slotOfTime));
  }
  if (med.doseSlots && med.doseSlots.length > 0) {
    return sortDoseSlots(med.doseSlots);
  }
  const defaults = med.frequency ? DEFAULT_DOSE_SLOTS[med.frequency] : undefined;
  if (defaults) {
    if (med.frequency === 'qd') {
      const short = med.timingInstruction ? TIMING_SHORT_LABELS[med.timingInstruction] : undefined;
      // 餐食相对 qd：任一餐都可能（睡前无餐次）
      if (short) return ['morning', 'noon', 'evening'];
      // 晨服/睡前时机本身就是时段指定
      if (med.timingInstruction === 'morning') return ['morning'];
      if (med.timingInstruction === 'bedtime') return ['night'];
      // 纯 qd 未指定时刻：全天任何时段都可能，不钉死在默认早晨
      return ['morning', 'noon', 'evening', 'night'];
    }
    return defaults;
  }
  const anchors = med.frequency ? INTERVAL_ANCHOR_TIMES[med.frequency] : undefined;
  if (anchors) {
    return sortDoseSlots(anchors.map(slotOfTime));
  }
  return null;
}

/** 该药在指定时段是否有服药安排；无时刻信息的（prn 等）任何时段都算有 */
export function isDoseAtSlot(med: DoseScheduleInput, slot: DoseSlot): boolean {
  const codes = resolveDoseSlotCodes(med);
  return codes === null || codes.includes(slot);
}

/**
 * 锚定日推算：锚定日本身是服药日，之后每隔 N-1 天一次；
 * 锚定日之前的日期也能回推（相差整数个周期即为服药日）。
 */
export function isDoseDayOnAnchor(anchorDate: string, everyNDays: number, date: Date): boolean {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((day.getTime() - anchor.getTime()) / 86400000);
  return ((diffDays % everyNDays) + everyNDays) % everyNDays === 0;
}

/** 从 from 起最近的一个服药日（from 本身就是则返回 from） */
export function nextDoseDateOnAnchor(anchorDate: string, everyNDays: number, from: Date = new Date()): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (!isDoseDayOnAnchor(anchorDate, everyNDays, candidate)) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

/** 今日是否为服药日：隔 N 天型按锚定日推算；周频次按周几；未指定或其他频次每天都算 */
export function isDoseDueToday(med: DoseScheduleInput, date: Date = new Date()): boolean {
  if (med.frequency && med.frequency in EVERY_N_DAYS && med.doseAnchorDate) {
    return isDoseDayOnAnchor(med.doseAnchorDate, EVERY_N_DAYS[med.frequency], date);
  }
  if (!med.frequency || !(med.frequency in WEEKLY_DOSE_COUNTS)) return true;
  if (!med.doseWeekdays || med.doseWeekdays.length === 0) return true;
  return med.doseWeekdays.includes(isoWeekdayOf(date));
}

/**
 * 数 (fromExclusive, toInclusive] 内的服药天数（库存按服药事件扣减用）：
 * - 周频次且指定了周几：范围内匹配的服药日数
 * - 隔 N 天且锚定了日期：范围内的服药日数
 * 返回 null 表示没有具体日程，调用方退回按日均剂量扣减。
 */
export function countDoseDaysInRange(med: DoseScheduleInput, fromExclusive: Date, toInclusive: Date): number | null {
  let predicate: ((day: Date) => boolean) | null = null;
  if (med.frequency && med.frequency in WEEKLY_DOSE_COUNTS && med.doseWeekdays && med.doseWeekdays.length > 0) {
    const weekdays = med.doseWeekdays;
    predicate = day => weekdays.includes(isoWeekdayOf(day));
  } else if (med.frequency && med.frequency in EVERY_N_DAYS && med.doseAnchorDate) {
    const anchorDate = med.doseAnchorDate;
    const everyN = EVERY_N_DAYS[med.frequency];
    predicate = day => isDoseDayOnAnchor(anchorDate, everyN, day);
  }
  if (!predicate) return null;

  let count = 0;
  const day = new Date(fromExclusive.getFullYear(), fromExclusive.getMonth(), fromExclusive.getDate() + 1);
  const end = new Date(toInclusive.getFullYear(), toInclusive.getMonth(), toInclusive.getDate());
  while (day.getTime() <= end.getTime()) {
    if (predicate(day)) count += 1;
    day.setDate(day.getDate() + 1);
  }
  return count;
}

/**
 * resolveDoseChips 的「当前时段」版本：只保留此刻该吃的 chips。
 * 周频次在非服药日返回空 times（调用方据此隐藏卡片）；在服药日只显示今日那一剂。
 */
export function resolveDoseChipsAtSlot(med: DoseScheduleInput, slot: DoseSlot, date: Date = new Date()): DoseTimes {
  const base = resolveDoseChips(med);
  if (base.kind === 'none') return base;
  if (base.kind === 'weekly') {
    if (!isDoseDueToday(med, date)) return { ...base, times: [] };
    if (med.doseSlots && med.doseSlots.length > 0 && !med.doseSlots.includes(slot)) {
      return { ...base, times: [] };
    }
    return { ...base, times: formatWeeklyChips(med, [isoWeekdayOf(date)]) };
  }
  if (base.kind === 'fixed' || base.kind === 'interval') {
    return { ...base, times: base.times.filter(time => slotOfTime(time) === slot) };
  }
  const codes = resolveDoseSlotCodes(med);
  if (!codes || !codes.includes(slot)) {
    return { ...base, times: [] };
  }
  const short = med.timingInstruction ? TIMING_SHORT_LABELS[med.timingInstruction] : undefined;
  const hasCustomSlots = !!(med.doseSlots && med.doseSlots.length > 0);
  // 中性 qd（餐食相对未指派餐次 / 纯 qd 未指定时刻）：任何时段都展示原 chip，不按当前时段重命名
  const isNeutralQd = med.frequency === 'qd' && !hasCustomSlots
    && (short !== undefined || (med.timingInstruction !== 'morning' && med.timingInstruction !== 'bedtime'));
  if (isNeutralQd) {
    return base;
  }
  return { ...base, times: mapSlotsToLabels([slot], med.timingInstruction) };
}

/**
 * 「今天全部」视图的 chips：周频次只显示今天那一剂（非服药日返回空 times，由调用方过滤），
 * 其他类型与 resolveDoseChips 一致。
 */
export function resolveDoseChipsForToday(med: DoseScheduleInput, date: Date = new Date()): DoseTimes {
  const base = resolveDoseChips(med);
  if (base.kind !== 'weekly') return base;
  if (!isDoseDueToday(med, date)) return { ...base, times: [] };
  return { ...base, times: formatWeeklyChips(med, [isoWeekdayOf(date)]) };
}

export function buildDoseReminders(meds: CalculatedInventory[]): CalculatedInventory[] {
  return meds
    .filter(med => med.dailyDosage > 0 || med.frequency)
    .sort((a, b) => {
      const timesA = resolveDoseChips(a);
      const timesB = resolveDoseChips(b);

      // 有明确服药时刻的（时段/固定/周频次/间隔锚点）排前面，无时刻的（prn/隔日等）垫底
      if (timesA.kind !== 'none' && timesB.kind === 'none') return -1;
      if (timesA.kind === 'none' && timesB.kind !== 'none') return 1;

      // 同有明确时刻的，服药次数多的排前面
      if (timesA.kind !== 'none' && timesB.kind !== 'none' && timesA.times.length !== timesB.times.length) {
        return timesB.times.length - timesA.times.length;
      }

      // 同为无时刻的，日剂量大的（真在吃）排前面，prn(0) 垫底
      if (timesA.kind === 'none' && timesB.kind === 'none' && a.dailyDosage !== b.dailyDosage) {
        return b.dailyDosage - a.dailyDosage;
      }

      return a.name.localeCompare(b.name);
    });
}

export function buildRestockReminders(meds: CalculatedInventory[]): CalculatedInventory[] {
  return meds
    .filter(med => med.isLowStock)
    .sort((a, b) => {
      // 快吃完的排最前，按需服用（Infinity）沉底
      if (a.daysRemaining === Number.POSITIVE_INFINITY && b.daysRemaining === Number.POSITIVE_INFINITY) {
        return a.name.localeCompare(b.name);
      }
      if (a.daysRemaining === Number.POSITIVE_INFINITY) return 1;
      if (b.daysRemaining === Number.POSITIVE_INFINITY) return -1;
      return a.daysRemaining - b.daysRemaining;
    });
}
