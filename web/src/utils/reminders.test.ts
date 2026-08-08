import { describe, expect, it } from 'vitest';
import type { CalculatedInventory } from './InventoryEngine';
import {
  buildDoseReminders,
  buildRestockReminders,
  countDoseDaysInRange,
  isDoseAtSlot,
  isDoseDayOnAnchor,
  isDoseDueToday,
  mapSlotsToLabels,
  nextDoseDateOnAnchor,
  resolveDoseChips,
  resolveDoseChipsAtSlot,
  resolveDoseChipsForToday,
  resolveDoseSlotCodes,
  slotOfHour,
  sortDoseSlots,
} from './reminders';

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

describe('sortDoseSlots', () => {
  it('dedupes and orders slots by time of day', () => {
    expect(sortDoseSlots(['evening', 'morning', 'evening', 'noon'])).toEqual(['morning', 'noon', 'evening']);
  });
});

describe('mapSlotsToLabels', () => {
  it('uses plain slot labels without meal timing', () => {
    expect(mapSlotsToLabels(['morning', 'night'])).toEqual(['早晨', '睡前']);
  });

  it('prefixes meals for meal-relative timing, night stays 睡前', () => {
    expect(mapSlotsToLabels(['morning', 'evening', 'night'], 'before'))
      .toEqual(['早餐前', '晚餐前', '睡前']);
  });
});

describe('resolveDoseChips', () => {
  it('prefers explicit fixed times over everything else', () => {
    expect(resolveDoseChips({ frequency: 'bid', doseTimes: ['07:30', '21:00'] }))
      .toEqual({ kind: 'fixed', times: ['07:30', '21:00'] });
    expect(resolveDoseChips({ frequency: 'qd', timingInstruction: 'before', doseTimes: ['07:30'], doseSlots: ['evening'] }))
      .toEqual({ kind: 'fixed', times: ['07:30'] });
  });

  it('treats an empty doseTimes array as unset', () => {
    expect(resolveDoseChips({ frequency: 'qd', doseTimes: [] }))
      .toEqual({ kind: 'slots', times: ['早晨'] });
  });

  it('derives default slots for daily frequencies', () => {
    expect(resolveDoseChips({ frequency: 'tid' })).toEqual({ kind: 'slots', times: ['早晨', '中午', '晚上'] });
    expect(resolveDoseChips({ frequency: 'qn' })).toEqual({ kind: 'slots', times: ['睡前'] });
    expect(resolveDoseChips({ frequency: 'bid' })).toEqual({ kind: 'slots', times: ['早晨', '晚上'] });
  });

  it('does not pin qd to a specific meal when timing is meal-relative', () => {
    expect(resolveDoseChips({ frequency: 'qd', timingInstruction: 'before' }))
      .toEqual({ kind: 'slots', times: ['餐前'] });
    expect(resolveDoseChips({ frequency: 'qd', timingInstruction: 'after' }))
      .toEqual({ kind: 'slots', times: ['餐后'] });
  });

  it('anchors multi-dose frequencies to standard meals', () => {
    expect(resolveDoseChips({ frequency: 'bid', timingInstruction: 'before' }))
      .toEqual({ kind: 'slots', times: ['早餐前', '晚餐前'] });
    expect(resolveDoseChips({ frequency: 'tid', timingInstruction: 'after' }))
      .toEqual({ kind: 'slots', times: ['早餐后', '午餐后', '晚餐后'] });
    expect(resolveDoseChips({ frequency: 'qid', timingInstruction: 'before' }))
      .toEqual({ kind: 'slots', times: ['早餐前', '午餐前', '晚餐前', '睡前'] });
  });

  it('keeps plain slot labels for non-meal timings like fasting', () => {
    expect(resolveDoseChips({ frequency: 'qd', timingInstruction: 'fasting' }))
      .toEqual({ kind: 'slots', times: ['早晨'] });
  });

  it('uses user-picked slots when present, in day order', () => {
    expect(resolveDoseChips({ frequency: 'qd', doseSlots: ['noon'] }))
      .toEqual({ kind: 'slots', times: ['中午'] });
    expect(resolveDoseChips({ frequency: 'bid', doseSlots: ['evening', 'morning'] }))
      .toEqual({ kind: 'slots', times: ['早晨', '晚上'] });
  });

  it('anchors user-picked slots to meals when timing is meal-relative', () => {
    expect(resolveDoseChips({ frequency: 'qd', timingInstruction: 'before', doseSlots: ['evening'] }))
      .toEqual({ kind: 'slots', times: ['晚餐前'] });
    expect(resolveDoseChips({ frequency: 'bid', timingInstruction: 'after', doseSlots: ['noon', 'evening'] }))
      .toEqual({ kind: 'slots', times: ['午餐后', '晚餐后'] });
    expect(resolveDoseChips({ frequency: 'qd', timingInstruction: 'before', doseSlots: ['night'] }))
      .toEqual({ kind: 'slots', times: ['睡前'] });
  });

  it('falls back to anchor times for strict interval frequencies', () => {
    expect(resolveDoseChips({ frequency: 'q8h' })).toEqual({ kind: 'interval', times: ['06:00', '14:00', '22:00'] });
    expect(resolveDoseChips({ frequency: 'q12h' })).toEqual({ kind: 'interval', times: ['08:00', '20:00'] });
  });

  it('returns none for prn and unknown frequencies', () => {
    expect(resolveDoseChips({ frequency: 'prn' })).toEqual({ kind: 'none', times: [] });
    expect(resolveDoseChips({ frequency: 'qod' })).toEqual({ kind: 'none', times: [] });
    expect(resolveDoseChips({})).toEqual({ kind: 'none', times: [] });
  });
});

describe('slotOfHour', () => {
  it('maps hours to day slots on the 5/11/14/20 boundaries', () => {
    expect(slotOfHour(5)).toBe('morning');
    expect(slotOfHour(10)).toBe('morning');
    expect(slotOfHour(11)).toBe('noon');
    expect(slotOfHour(13)).toBe('noon');
    expect(slotOfHour(14)).toBe('evening');
    expect(slotOfHour(19)).toBe('evening');
    expect(slotOfHour(20)).toBe('night');
    expect(slotOfHour(23)).toBe('night');
    expect(slotOfHour(0)).toBe('night');
    expect(slotOfHour(4)).toBe('night');
  });
});

describe('resolveDoseSlotCodes', () => {
  it('maps fixed clock times to their slots', () => {
    expect(resolveDoseSlotCodes({ frequency: 'bid', doseTimes: ['08:00', '20:00'] }))
      .toEqual(['morning', 'night']);
  });

  it('returns user-picked slots in day order', () => {
    expect(resolveDoseSlotCodes({ frequency: 'qd', doseSlots: ['evening'] })).toEqual(['evening']);
  });

  it('covers all three meals for a neutral meal-relative qd', () => {
    expect(resolveDoseSlotCodes({ frequency: 'qd', timingInstruction: 'before' }))
      .toEqual(['morning', 'noon', 'evening']);
  });

  it('maps interval anchors to slots and returns null when timeless', () => {
    expect(resolveDoseSlotCodes({ frequency: 'q8h' })).toEqual(['morning', 'evening', 'night']);
    expect(resolveDoseSlotCodes({ frequency: 'prn' })).toBeNull();
  });
});

describe('isDoseAtSlot / resolveDoseChipsAtSlot', () => {
  it('treats timeless meds as relevant at any slot', () => {
    expect(isDoseAtSlot({ frequency: 'prn' }, 'night')).toBe(true);
    expect(resolveDoseChipsAtSlot({ frequency: 'prn' }, 'night')).toEqual({ kind: 'none', times: [] });
  });

  it('matches tid only at its three day slots', () => {
    const med = { frequency: 'tid', timingInstruction: 'after' as const };
    expect(isDoseAtSlot(med, 'noon')).toBe(true);
    expect(isDoseAtSlot(med, 'night')).toBe(false);
    expect(resolveDoseChipsAtSlot(med, 'noon')).toEqual({ kind: 'slots', times: ['午餐后'] });
    expect(resolveDoseChipsAtSlot(med, 'night').times).toEqual([]);
  });

  it('filters fixed times down to the current slot', () => {
    const med = { frequency: 'bid', doseTimes: ['08:00', '20:00'] };
    expect(resolveDoseChipsAtSlot(med, 'night')).toEqual({ kind: 'fixed', times: ['20:00'] });
    expect(isDoseAtSlot(med, 'noon')).toBe(false);
  });

  it('shows the neutral qd chip at any meal slot but not at night', () => {
    const med = { frequency: 'qd', timingInstruction: 'before' as const };
    expect(resolveDoseChipsAtSlot(med, 'noon')).toEqual({ kind: 'slots', times: ['餐前'] });
    expect(resolveDoseChipsAtSlot(med, 'night').times).toEqual([]);
  });

  it('resolves user-picked slots with meal anchoring', () => {
    const med = { frequency: 'qd', timingInstruction: 'before' as const, doseSlots: ['evening' as const] };
    expect(resolveDoseChipsAtSlot(med, 'evening')).toEqual({ kind: 'slots', times: ['晚餐前'] });
    expect(resolveDoseChipsAtSlot(med, 'morning').times).toEqual([]);
  });
});

describe('weekly schedules (qw/biw/tiw)', () => {
  // 2026-08-06 是周四，2026-08-07 是周五
  const thursday = new Date('2026-08-06T12:00:00');
  const friday = new Date('2026-08-07T12:00:00');

  it('renders weekday chips with meal or slot suffix', () => {
    expect(resolveDoseChips({ frequency: 'biw', timingInstruction: 'before', doseWeekdays: [4, 1] }))
      .toEqual({ kind: 'weekly', times: ['周一 餐前', '周四 餐前'] });
    expect(resolveDoseChips({ frequency: 'biw', timingInstruction: 'before', doseWeekdays: [1, 4], doseSlots: ['evening'] }))
      .toEqual({ kind: 'weekly', times: ['周一 晚餐前', '周四 晚餐前'] });
    expect(resolveDoseChips({ frequency: 'qw', doseWeekdays: [6] }))
      .toEqual({ kind: 'weekly', times: ['周六'] });
  });

  it('keeps fixed times and slots ahead of the weekly branch', () => {
    expect(resolveDoseChips({ frequency: 'biw', doseTimes: ['08:00'], doseWeekdays: [1, 4] }))
      .toEqual({ kind: 'fixed', times: ['08:00'] });
    expect(resolveDoseChips({ frequency: 'biw', doseSlots: ['evening'] }))
      .toEqual({ kind: 'slots', times: ['晚上'] });
  });

  it('isDoseDueToday gates on the specified weekdays only', () => {
    const med = { frequency: 'biw', doseWeekdays: [1, 4] };
    expect(isDoseDueToday(med, thursday)).toBe(true);
    expect(isDoseDueToday(med, friday)).toBe(false);
    // 未指定周几、或非周频次：每天都算
    expect(isDoseDueToday({ frequency: 'biw' }, friday)).toBe(true);
    expect(isDoseDueToday({ frequency: 'qd' }, friday)).toBe(true);
  });

  it('利福喷丁真实日程：周三/周日服药，周六(2026-08-08)不出现', () => {
    const med = { frequency: 'biw', doseWeekdays: [3, 7], doseSlots: ['evening' as const] };
    const saturday = new Date('2026-08-08T20:00:00');
    const sunday = new Date('2026-08-09T20:00:00');
    expect(isDoseDueToday(med, saturday)).toBe(false);
    expect(isDoseDueToday(med, sunday)).toBe(true);
    expect(isDoseAtSlot(med, 'evening')).toBe(true);
  });

  it('resolveDoseChipsAtSlot shows only today’s dose on a dose day', () => {
    const med = { frequency: 'biw', timingInstruction: 'before' as const, doseWeekdays: [1, 4] };
    expect(resolveDoseChipsAtSlot(med, 'morning', thursday))
      .toEqual({ kind: 'weekly', times: ['周四 餐前'] });
    expect(resolveDoseChipsAtSlot(med, 'morning', friday).times).toEqual([]);
  });

  it('resolveDoseChipsAtSlot also respects the slot on weekly meds', () => {
    const med = { frequency: 'biw', doseWeekdays: [1, 4], doseSlots: ['evening' as const] };
    expect(resolveDoseChipsAtSlot(med, 'evening', thursday).times).toEqual(['周四 晚上']);
    expect(resolveDoseChipsAtSlot(med, 'morning', thursday).times).toEqual([]);
  });

  it('resolveDoseChipsForToday 只显示今天那一剂，非服药日返回空', () => {
    // 利福喷丁日程：周三/周日 晚餐前
    const med = { frequency: 'biw', timingInstruction: 'before' as const, doseWeekdays: [3, 7], doseSlots: ['evening' as const] };
    const saturday = new Date('2026-08-08T20:00:00');
    const sunday = new Date('2026-08-09T20:00:00');
    expect(resolveDoseChipsForToday(med, sunday).times).toEqual(['周日 晚餐前']);
    expect(resolveDoseChipsForToday(med, saturday).times).toEqual([]);
  });

  it('resolveDoseChipsForToday 对非周频次原样透传', () => {
    const med = { frequency: 'tid' };
    expect(resolveDoseChipsForToday(med, friday)).toEqual(resolveDoseChips(med));
  });
});

describe('every-N-days schedules (qod)', () => {
  // 锚定 2026-08-05（周三）：服药日为 8/5、8/7、8/9…，之前 8/3、8/1…
  it('isDoseDayOnAnchor walks forward and backward in whole cycles', () => {
    const on = (iso: string) => isDoseDayOnAnchor('2026-08-05', 2, new Date(`${iso}T12:00:00`));
    expect(on('2026-08-05')).toBe(true);
    expect(on('2026-08-06')).toBe(false);
    expect(on('2026-08-07')).toBe(true);
    expect(on('2026-08-04')).toBe(false);
    expect(on('2026-08-03')).toBe(true);
  });

  it('isDoseDueToday applies the anchor only when set', () => {
    const med = { frequency: 'qod', doseAnchorDate: '2026-08-05' };
    expect(isDoseDueToday(med, new Date('2026-08-07T12:00:00'))).toBe(true);
    expect(isDoseDueToday(med, new Date('2026-08-08T12:00:00'))).toBe(false);
    expect(isDoseDueToday({ frequency: 'qod' }, new Date('2026-08-08T12:00:00'))).toBe(true);
  });

  it('nextDoseDateOnAnchor returns today on a dose day, tomorrow otherwise', () => {
    expect(nextDoseDateOnAnchor('2026-08-05', 2, new Date('2026-08-07T18:00:00')).getDate()).toBe(7);
    const next = nextDoseDateOnAnchor('2026-08-05', 2, new Date('2026-08-08T06:00:00'));
    expect(next.getMonth()).toBe(7);
    expect(next.getDate()).toBe(9);
  });
});

describe('plain qd neutrality (unspecified time of day)', () => {
  it('counts a plain qd as possible at any slot', () => {
    expect(resolveDoseSlotCodes({ frequency: 'qd' })).toEqual(['morning', 'noon', 'evening', 'night']);
    expect(resolveDoseSlotCodes({ frequency: 'qd', timingInstruction: 'fasting' }))
      .toEqual(['morning', 'noon', 'evening', 'night']);
    expect(isDoseAtSlot({ frequency: 'qd' }, 'noon')).toBe(true);
    expect(isDoseAtSlot({ frequency: 'qd' }, 'night')).toBe(true);
  });

  it('pins qd with morning/bedtime timing to that slot', () => {
    expect(resolveDoseSlotCodes({ frequency: 'qd', timingInstruction: 'bedtime' })).toEqual(['night']);
    expect(resolveDoseSlotCodes({ frequency: 'qd', timingInstruction: 'morning' })).toEqual(['morning']);
    expect(resolveDoseChips({ frequency: 'qd', timingInstruction: 'bedtime' }))
      .toEqual({ kind: 'slots', times: ['睡前'] });
    expect(isDoseAtSlot({ frequency: 'qd', timingInstruction: 'bedtime' }, 'morning')).toBe(false);
  });

  it('keeps the suggestion chip unchanged at any slot instead of relabeling', () => {
    expect(resolveDoseChipsAtSlot({ frequency: 'qd' }, 'noon')).toEqual({ kind: 'slots', times: ['早晨'] });
    expect(resolveDoseChipsAtSlot({ frequency: 'qd' }, 'night')).toEqual({ kind: 'slots', times: ['早晨'] });
  });
});

describe('countDoseDaysInRange', () => {
  const from = new Date('2026-08-05T12:00:00'); // 周三

  it('counts weekly dose days in (from, to]', () => {
    const med = { frequency: 'biw', doseWeekdays: [1, 4] };
    // (8/5, 8/10] 内 8/6(周四)、8/10(周一) 两天
    expect(countDoseDaysInRange(med, from, new Date('2026-08-10T12:00:00'))).toBe(2);
    expect(countDoseDaysInRange(med, from, new Date('2026-08-05T12:00:00'))).toBe(0);
  });

  it('counts anchor-parity dose days', () => {
    const med = { frequency: 'qod', doseAnchorDate: '2026-08-05' };
    // (8/5, 8/9] 内 8/7、8/9 两天
    expect(countDoseDaysInRange(med, from, new Date('2026-08-09T12:00:00'))).toBe(2);
  });

  it('returns null when no schedule is specified', () => {
    expect(countDoseDaysInRange({ frequency: 'biw' }, from, new Date('2026-08-10T12:00:00'))).toBeNull();
    expect(countDoseDaysInRange({ frequency: 'qd' }, from, new Date('2026-08-10T12:00:00'))).toBeNull();
  });
});

describe('buildDoseReminders', () => {
  it('drops meds with no dosage and no frequency', () => {
    const meds = [makeMed({ profileId: 'a', dailyDosage: 0, frequency: undefined })];

    expect(buildDoseReminders(meds)).toEqual([]);
  });

  it('sorts scheduled meds by doses per day, prn and irregular last', () => {
    const meds = [
      makeMed({ profileId: 'prn', name: '按需药', frequency: 'prn', dailyDosage: 0 }),
      makeMed({ profileId: 'qd', name: '每日一次', frequency: 'qd', dailyDosage: 1 }),
      makeMed({ profileId: 'tid', name: '每日三次', frequency: 'tid', dailyDosage: 3 }),
      makeMed({ profileId: 'qod', name: '隔日一次', frequency: 'qod', dailyDosage: 0.5 }),
    ];

    expect(buildDoseReminders(meds).map(med => med.profileId)).toEqual(['tid', 'qd', 'qod', 'prn']);
  });

  it('breaks ties by name', () => {
    const meds = [
      makeMed({ profileId: 'b', name: '布洛芬', frequency: 'bid', dailyDosage: 2 }),
      makeMed({ profileId: 'a', name: '阿莫西林', frequency: 'bid', dailyDosage: 2 }),
    ];

    expect(buildDoseReminders(meds).map(med => med.name)).toEqual(['阿莫西林', '布洛芬']);
  });
});

describe('buildRestockReminders', () => {
  it('keeps only low-stock meds, soonest to run out first', () => {
    const meds = [
      makeMed({ profileId: 'ok', name: '库存健康', isLowStock: false, daysRemaining: 30 }),
      makeMed({ profileId: 'low2', name: '还能撑五天', isLowStock: true, daysRemaining: 5 }),
      makeMed({ profileId: 'low1', name: '已经吃完', isLowStock: true, daysRemaining: 0 }),
      makeMed({ profileId: 'prn', name: '按需药', isLowStock: true, daysRemaining: Number.POSITIVE_INFINITY }),
    ];

    expect(buildRestockReminders(meds).map(med => med.profileId)).toEqual(['low1', 'low2', 'prn']);
  });
});
