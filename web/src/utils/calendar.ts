import { formatDosage, frequencyShortLabel } from './InventoryEngine';
import type { CalculatedInventory } from './InventoryEngine';
import { isDoseDueToday, resolveDoseChipsForToday } from './reminders';

/**
 * 服药日程热力图（GitHub 贡献图式）的纯推算层：
 * 数据完全来自医嘱 + 提醒引擎（isDoseDueToday / resolveDoseChipsForToday），不落库。
 * 格子 = 一天，颜色深浅 = 当天剂数；未来的格子是「计划」，不代表已服。
 */

export interface CalendarDayDose {
  name: string;
  /** 当天的时刻 chips，如 ['晚餐前'] / ['20:00']；无固定时刻时退化为频次短名 */
  times: string[];
  /** 如 '每次 3 粒' */
  doseText: string;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** 一周从周一开始（国内习惯） */
export function startOfWeekMonday(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = monday.getDay(); // 0=周日
  monday.setDate(monday.getDate() - ((day + 6) % 7));
  return monday;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** 热力图窗口：anchor 所在周往前 weeksBack 周、往后 weeksForward 周，周一对齐，共 (weeksBack+1+weeksForward)*7 天 */
export function buildCalendarWindow(anchor: Date = new Date(), weeksBack = 3, weeksForward = 2): Date[] {
  const start = addDays(startOfWeekMonday(anchor), -weeksBack * 7);
  const totalDays = (weeksBack + 1 + weeksForward) * 7;
  return Array.from({ length: totalDays }, (_, i) => addDays(start, i));
}

/** 周频次 chips 带「周日 」前缀，日历格子里日期已不言自明，剥掉 */
function stripWeekdayPrefix(time: string): string {
  return time.replace(/^周[一二三四五六日]\s*/, '');
}

/** 本地零点的毫秒数，用于「日期是否早于起始日」的比较 */
function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * 某天该吃的药：周几/锚定日由引擎判定；prn 与无频次药不算日程。
 * 早于追踪起始日（= 开始服用日期）的日子不算——那时药还没开始吃。
 */
export function dosesOnDate(meds: CalculatedInventory[], date: Date): CalendarDayDose[] {
  const dayStart = startOfLocalDay(date);
  return meds
    .filter(med => med.frequency && med.frequency !== 'prn'
      && dayStart >= startOfLocalDay(new Date(med.baseDate))
      && isDoseDueToday(med, date))
    .map(med => {
      const chips = resolveDoseChipsForToday(med, date);
      const times = chips.times.length > 0
        ? chips.times.map(stripWeekdayPrefix)
        : [med.frequency ? frequencyShortLabel(med.frequency) : '按医嘱'];
      const pillUnit = med.pillUnit || '粒';
      return {
        name: med.name,
        times,
        doseText: `每次 ${formatDosage(med.dosePerTime || med.dailyDosage)}${pillUnit}`,
      };
    });
}

/** 一天的总剂数 → 热力档位 0-4（0=无服药） */
export function intensityOf(doseCount: number): 0 | 1 | 2 | 3 | 4 {
  if (doseCount <= 0) return 0;
  if (doseCount <= 2) return 1;
  if (doseCount <= 4) return 2;
  if (doseCount <= 7) return 3;
  return 4;
}
