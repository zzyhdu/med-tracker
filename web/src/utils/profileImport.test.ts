import { describe, expect, it } from 'vitest';
import { parseProfileImport } from './profileImport';

describe('parseProfileImport', () => {
  it('parses a full entry and keeps explicit dailyDosage', () => {
    const result = parseProfileImport(JSON.stringify([
      {
        id: 'ignored-id',
        name: '阿莫西林',
        frequency: 'bid',
        dosePerTime: 2,
        dailyDosage: 5,
        packagingSize: 24,
        packagingUnit: '盒',
        pillUnit: '粒',
        alertThresholdDays: 7,
        unknownField: 'ignored',
      },
    ]));

    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      {
        name: '阿莫西林',
        frequency: 'bid',
        dosePerTime: 2,
        dailyDosage: 5,
        packagingSize: 24,
        packagingUnit: '盒',
        pillUnit: '粒',
        alertThresholdDays: 7,
      },
    ]);
  });

  it('applies defaults and computes dailyDosage like the instruction form', () => {
    const result = parseProfileImport(JSON.stringify([{ name: '维生素D', frequency: 'tid', dosePerTime: 2 }]));

    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.dailyDosage).toBe(6);
    expect(item.alertThresholdDays).toBe(14);
    expect(item.packagingSize).toBeUndefined();
    expect(item.packagingUnit).toBeUndefined();
    expect(item.pillUnit).toBeUndefined();
  });

  it('defaults frequency to qd when omitted', () => {
    const result = parseProfileImport(JSON.stringify([{ name: '二甲双胍' }]));

    expect(result.items[0].frequency).toBe('qd');
    expect(result.items[0].dailyDosage).toBe(1);
  });

  it('rejects broken JSON and non-array payloads as whole-file errors', () => {
    expect(parseProfileImport('{oops').errors).toEqual([{ index: -1, message: 'JSON 解析失败，请检查格式' }]);
    expect(parseProfileImport('{"name":"x"}').errors).toEqual([{ index: -1, message: '顶层必须是药品规格数组' }]);
  });

  it('accepts timingInstruction and doseTimes with normalization', () => {
    const result = parseProfileImport(JSON.stringify([
      { name: '异烟肼', timingInstruction: 'before', doseTimes: ['20:00', '08:00', '08:00'] },
    ]));

    expect(result.errors).toEqual([]);
    expect(result.items[0].timingInstruction).toBe('before');
    expect(result.items[0].doseTimes).toEqual(['08:00', '20:00']);
  });

  it('rejects invalid timingInstruction and doseTimes', () => {
    const result = parseProfileImport(JSON.stringify([
      { name: '坏时机', timingInstruction: 'brunch' },
      { name: '坏时间', doseTimes: ['25:00'] },
      { name: '空数组时间', doseTimes: [] },
    ]));

    expect(result.items).toEqual([]);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].message).toContain('timingInstruction');
    expect(result.errors[1].message).toContain('doseTimes');
  });

  it('accepts doseSlots with normalization and rejects invalid ones', () => {
    const result = parseProfileImport(JSON.stringify([
      { name: '利福平', doseSlots: ['evening', 'morning'] },
      { name: '坏时段', doseSlots: ['dawn'] },
      { name: '空时段', doseSlots: [] },
    ]));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].doseSlots).toEqual(['morning', 'evening']);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toContain('doseSlots');
  });

  it('accepts doseWeekdays with normalization and rejects invalid ones', () => {
    const result = parseProfileImport(JSON.stringify([
      { name: '利福喷丁', frequency: 'biw', doseWeekdays: [4, 1] },
      { name: '坏服药日', doseWeekdays: [8] },
      { name: '空服药日', doseWeekdays: [] },
    ]));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].doseWeekdays).toEqual([1, 4]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toContain('doseWeekdays');
  });

  it('accepts doseAnchorDate and rejects impossible dates', () => {
    const result = parseProfileImport(JSON.stringify([
      { name: '乙胺丁醇', frequency: 'qod', doseAnchorDate: '2026-08-05' },
      { name: '假日期', doseAnchorDate: '2026-02-30' },
      { name: '坏格式', doseAnchorDate: '08/05' },
    ]));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].doseAnchorDate).toBe('2026-08-05');
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toContain('doseAnchorDate');
  });

  it('collects per-entry errors without blocking valid entries', () => {
    const result = parseProfileImport(JSON.stringify([
      { name: '好药' },
      { name: '   ' },
      { name: '频次错', frequency: 'q5d' },
      { name: '剂量负', dosePerTime: -1 },
      { name: '包装零', packagingSize: 0 },
      { name: '阈值负', alertThresholdDays: -1 },
      { name: '类型错', dosePerTime: '2' },
      'not-an-object',
    ]));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('好药');
    expect(result.errors.map(error => error.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.errors[0].message).toContain('name');
  });
});
