import { describe, expect, it } from 'vitest';
import { InventoryEngine, formatDosage, frequencyShortLabel } from './InventoryEngine';
import type { DrugProfile, DrugSpec, DrugTracker } from './InventoryEngine';

const spec: DrugSpec = {
  id: 'd',
  createdBy: 'u',
  name: '某药',
  packagingSize: 20,
  packagingUnit: '盒',
  pillUnit: '粒',
};

function makeProfile(overrides: Partial<DrugProfile>): DrugProfile {
  return { id: 'p', drugId: 'd', dailyDosage: 1, alertThresholdDays: 7, ...overrides };
}

function makeTracker(baseInventory: number, baseDate: string): DrugTracker {
  return { profileId: 'p', baseInventory, baseDate };
}

describe('InventoryEngine.calculate deduction model', () => {
  it('deducts per-day average for daily frequencies (unchanged)', () => {
    const profile = makeProfile({ frequency: 'bid', dosePerTime: 2, dailyDosage: 4 });
    const result = InventoryEngine.calculate(
      profile, spec, makeTracker(100, '2026-08-05T00:00:00'), new Date('2026-08-08T12:00:00'),
    );
    expect(result.currentInventory).toBe(100 - 3 * 4);
  });

  it('deducts only on dose days for weekly frequencies with weekdays', () => {
    // biw 周一/周四各服 3 粒；8/5(周三) 基线 → (8/5, 8/10] 内 8/6(四)、8/10(一) 两次服药
    const profile = makeProfile({ frequency: 'biw', dosePerTime: 3, dailyDosage: (3 * 2) / 7, doseWeekdays: [1, 4] });
    const result = InventoryEngine.calculate(
      profile, spec, makeTracker(100, '2026-08-05T00:00:00'), new Date('2026-08-10T12:00:00'),
    );
    expect(result.currentInventory).toBe(100 - 2 * 3);
  });

  it('does not deduct doses on the base date itself', () => {
    const profile = makeProfile({ frequency: 'biw', dosePerTime: 3, dailyDosage: (3 * 2) / 7, doseWeekdays: [1, 4] });
    const result = InventoryEngine.calculate(
      profile, spec, makeTracker(100, '2026-08-10T00:00:00'), new Date('2026-08-10T18:00:00'),
    );
    expect(result.currentInventory).toBe(100);
  });

  it('deducts on anchor-parity days for qod', () => {
    // qod 锚定 8/5，每次 3 粒；8/5 基线 → (8/5, 8/9] 内 8/7、8/9 两次服药
    const profile = makeProfile({ frequency: 'qod', dosePerTime: 3, dailyDosage: 1.5, doseAnchorDate: '2026-08-05' });
    const result = InventoryEngine.calculate(
      profile, spec, makeTracker(100, '2026-08-05T00:00:00'), new Date('2026-08-09T12:00:00'),
    );
    expect(result.currentInventory).toBe(100 - 2 * 3);
  });

  it('falls back to per-day average when no schedule is specified', () => {
    const profile = makeProfile({ frequency: 'biw', dosePerTime: 3, dailyDosage: (3 * 2) / 7 });
    const result = InventoryEngine.calculate(
      profile, spec, makeTracker(100, '2026-08-05T00:00:00'), new Date('2026-08-12T12:00:00'),
    );
    expect(result.currentInventory).toBeCloseTo(100 - 7 * ((3 * 2) / 7), 10);
  });
});

describe('formatDosage', () => {
  it('去尾零：整数不带小数点', () => {
    expect(formatDosage(3)).toBe('3');
    expect(formatDosage(2.5)).toBe('2.5');
  });

  it('最多两位小数：长浮点收敛', () => {
    expect(formatDosage(0.8571428571428571)).toBe('0.86');
    expect(formatDosage(1 / 7)).toBe('0.14');
  });
});

describe('frequencyShortLabel', () => {
  it('去掉拉丁缩写，只留中文', () => {
    expect(frequencyShortLabel('qd')).toBe('每日1次');
    expect(frequencyShortLabel('biw')).toBe('每周2次');
    expect(frequencyShortLabel('prn')).toBe('按需服用');
  });

  it('未知频次原样返回', () => {
    expect(frequencyShortLabel('q5d')).toBe('q5d');
  });
});
