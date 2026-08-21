import { describe, expect, it } from 'vitest';
import type { CalculatedInventory } from './InventoryEngine';
import {
  buildCalendarWindow,
  dosesOnDate,
  intensityOf,
  startOfWeekMonday,
} from './calendar';

function makeMed(overrides: Partial<CalculatedInventory>): CalculatedInventory {
  return {
    profileId: 'x',
    drugId: 'd',
    name: '某药',
    dailyDosage: 1,
    alertThresholdDays: 7,
    baseInventory: 100,
    baseDate: '2026-01-01T00:00:00.000Z',
    currentInventory: 100,
    daysRemaining: 100,
    isLowStock: false,
    ...overrides,
  };
}

// 用户的真实四药方案（2026-08-05 就诊后开始服用，基线 8/5 零点本地 = 8/4 16:00Z）
const REGIMEN_START = '2026-08-04T16:00:00.000Z';
const REGIMEN: CalculatedInventory[] = [
  makeMed({ name: '异烟肼片', frequency: 'qd', dosePerTime: 3, timingInstruction: 'before', doseSlots: ['evening'], baseDate: REGIMEN_START }),
  makeMed({ name: '利福喷丁胶囊', frequency: 'biw', dosePerTime: 3, timingInstruction: 'before', doseWeekdays: [3, 7], doseSlots: ['evening'], baseDate: REGIMEN_START }),
  makeMed({ name: '莫西沙星片', frequency: 'qd', dosePerTime: 1, doseSlots: ['evening'], baseDate: REGIMEN_START }),
  makeMed({ name: '乙胺丁醇片', frequency: 'qod', dosePerTime: 3, doseAnchorDate: '2026-08-05', doseSlots: ['evening'], baseDate: REGIMEN_START }),
];

describe('buildCalendarWindow', () => {
  // 2026-08-08 是周六，所在周周一为 8/3
  const saturday = new Date('2026-08-08T12:00:00');

  it('周一对齐，长度为整周', () => {
    const days = buildCalendarWindow(saturday, 3, 2);
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(days[0]).toEqual(new Date('2026-07-13T00:00:00'));
    expect(days[41]).toEqual(new Date('2026-08-23T00:00:00'));
  });

  it('窗口包含 anchor 当天', () => {
    const days = buildCalendarWindow(saturday);
    expect(days.some(day => day.getTime() === new Date('2026-08-08T00:00:00').getTime())).toBe(true);
  });
});

describe('startOfWeekMonday', () => {
  it('周日归到上一个周一', () => {
    expect(startOfWeekMonday(new Date('2026-08-09T15:00:00'))).toEqual(new Date('2026-08-03T00:00:00'));
  });

  it('周一当天不变', () => {
    expect(startOfWeekMonday(new Date('2026-08-03T15:00:00'))).toEqual(new Date('2026-08-03T00:00:00'));
  });
});

describe('dosesOnDate', () => {
  it('周六（2026-08-08）：只有两种每日药，周频/隔日药不出现', () => {
    const doses = dosesOnDate(REGIMEN, new Date('2026-08-08T12:00:00'));
    expect(doses.map(dose => dose.name)).toEqual(['异烟肼片', '莫西沙星片']);
  });

  it('周日（2026-08-09）：四种药全到，周频次 chip 剥掉星期前缀', () => {
    const doses = dosesOnDate(REGIMEN, new Date('2026-08-09T12:00:00'));
    expect(doses.map(dose => dose.name)).toEqual(['异烟肼片', '利福喷丁胶囊', '莫西沙星片', '乙胺丁醇片']);
    const rifapentine = doses.find(dose => dose.name === '利福喷丁胶囊');
    expect(rifapentine?.times).toEqual(['晚餐前']);
    expect(rifapentine?.doseText).toBe('每次 3粒');
  });

  it('隔日药锚定 8/5：8/7 吃、8/8 不吃、8/9 吃', () => {
    const on = (day: string) => dosesOnDate(REGIMEN, new Date(`${day}T12:00:00`)).some(dose => dose.name === '乙胺丁醇片');
    expect(on('2026-08-07')).toBe(true);
    expect(on('2026-08-08')).toBe(false);
    expect(on('2026-08-09')).toBe(true);
  });

  it('prn 与无频次药不算日程', () => {
    const meds = [makeMed({ name: '止痛药', frequency: 'prn' }), makeMed({ name: '无频次药', frequency: undefined })];
    expect(dosesOnDate(meds, new Date('2026-08-09T12:00:00'))).toEqual([]);
  });

  it('开始服用日（追踪基线）之前不显示服药安排', () => {
    // 8/3 周一、8/4 周二：按频次规则本应服药，但方案 8/5 才开始
    expect(dosesOnDate(REGIMEN, new Date('2026-08-03T12:00:00'))).toEqual([]);
    expect(dosesOnDate(REGIMEN, new Date('2026-08-04T12:00:00'))).toEqual([]);
    // 8/2 周日是利福喷丁的服药日，但同样在起始日之前
    expect(dosesOnDate(REGIMEN, new Date('2026-08-02T12:00:00'))).toEqual([]);
  });

  it('起始日当天（8/5 周三）四种药全到', () => {
    const doses = dosesOnDate(REGIMEN, new Date('2026-08-05T12:00:00'));
    expect(doses.map(dose => dose.name)).toEqual(['异烟肼片', '利福喷丁胶囊', '莫西沙星片', '乙胺丁醇片']);
  });
});

describe('intensityOf', () => {
  it('按剂数分档', () => {
    expect(intensityOf(0)).toBe(0);
    expect(intensityOf(1)).toBe(1);
    expect(intensityOf(2)).toBe(1);
    expect(intensityOf(3)).toBe(2);
    expect(intensityOf(4)).toBe(2);
    expect(intensityOf(5)).toBe(3);
    expect(intensityOf(7)).toBe(3);
    expect(intensityOf(8)).toBe(4);
  });
});
