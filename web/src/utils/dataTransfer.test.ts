import { describe, expect, it } from 'vitest';
import type { DrugProfile, DrugSpec, DrugTracker } from './InventoryEngine';
import { buildBackup, parseBackup, serializeBackup } from './dataTransfer';

const ME = 'user-me';
const OTHER = 'user-other';

function drug(overrides: Partial<DrugSpec>): DrugSpec {
  return { id: 'd1', createdBy: ME, name: '某药', ...overrides };
}

function profile(overrides: Partial<DrugProfile>): DrugProfile {
  return { id: 'p1', drugId: 'd1', dailyDosage: 3, alertThresholdDays: 7, ...overrides };
}

describe('buildBackup', () => {
  it('导出我创建的规格 + 医嘱引用的规格，跳过与我无关的共享规格', () => {
    const drugs = [
      drug({ id: 'mine', name: '我创建的药' }),
      drug({ id: 'referenced', createdBy: OTHER, name: '别人创建但我在用' }),
      drug({ id: 'unrelated', createdBy: OTHER, name: '别人的药' }),
    ];
    const profiles = [profile({ drugId: 'referenced' })];

    const backup = buildBackup({ drugs, profiles, trackers: [], userId: ME });

    expect(backup.version).toBe(1);
    expect(backup.drugs.map(item => item.name)).toEqual(['我创建的药', '别人创建但我在用']);
    expect(backup.profiles[0].drugName).toBe('别人创建但我在用');
  });

  it('医嘱与追踪通过药品名关联，完整保留频次细节', () => {
    const drugs = [drug({ id: 'd1', name: '利福喷丁胶囊 150毫克' })];
    const profiles = [profile({
      id: 'p1',
      drugId: 'd1',
      frequency: 'biw',
      dosePerTime: 3,
      dailyDosage: 0.857,
      timingInstruction: 'before',
      doseSlots: ['evening'],
      doseWeekdays: [3, 7],
    })];
    const trackers: DrugTracker[] = [{ profileId: 'p1', baseInventory: 17, baseDate: '2026-08-04T16:00:00.000Z' }];

    const backup = buildBackup({ drugs, profiles, trackers, userId: ME });

    expect(backup.profiles[0]).toMatchObject({
      drugName: '利福喷丁胶囊 150毫克',
      frequency: 'biw',
      dosePerTime: 3,
      timingInstruction: 'before',
      doseSlots: ['evening'],
      doseWeekdays: [3, 7],
    });
    expect(backup.trackers[0]).toEqual({ drugName: '利福喷丁胶囊 150毫克', baseInventory: 17, baseDate: '2026-08-04T16:00:00.000Z' });
  });

  it('追踪挂在没有医嘱的 profile 上时被跳过（数据已损坏的兜底）', () => {
    const backup = buildBackup({
      drugs: [drug({})],
      profiles: [],
      trackers: [{ profileId: 'ghost', baseInventory: 5, baseDate: '2026-01-01T00:00:00.000Z' }],
      userId: ME,
    });
    expect(backup.trackers).toEqual([]);
  });
});

describe('parseBackup', () => {
  it('导出→解析 完整往返', () => {
    const drugs = [drug({ id: 'd1', name: '乙胺丁醇片 0.25克', packagingSize: 100, packagingUnit: '瓶', pillUnit: '片' })];
    const profiles = [profile({
      id: 'p1',
      drugId: 'd1',
      frequency: 'qod',
      dosePerTime: 3,
      dailyDosage: 1.5,
      doseSlots: ['evening'],
      doseAnchorDate: '2026-08-05',
    })];
    const trackers: DrugTracker[] = [{ profileId: 'p1', baseInventory: 97, baseDate: '2026-08-04T16:00:00.000Z' }];
    const backup = buildBackup({ drugs, profiles, trackers, userId: ME });

    const result = parseBackup(serializeBackup(backup));

    expect(result.errors).toEqual([]);
    expect(result.data?.drugs[0]).toEqual({ name: '乙胺丁醇片 0.25克', packagingSize: 100, packagingUnit: '瓶', pillUnit: '片' });
    expect(result.data?.profiles[0]).toMatchObject({ drugName: '乙胺丁醇片 0.25克', frequency: 'qod', doseAnchorDate: '2026-08-05' });
    expect(result.data?.trackers[0].baseInventory).toBe(97);
  });

  it('拒绝坏 JSON、非对象顶层、错误版本', () => {
    expect(parseBackup('{oops').errors[0]).toMatchObject({ section: 'global', index: -1 });
    expect(parseBackup('[]').errors[0].message).toContain('顶层必须是备份对象');
    expect(parseBackup('{"version": 99}').errors[0].message).toContain('不支持的备份版本');
  });

  it('逐条收集错误，合法条目不落进 data', () => {
    const text = JSON.stringify({
      version: 1,
      drugs: [{ name: '好药' }, { name: 123 }],
      profiles: [{ drugName: '好药', dailyDosage: 3, alertThresholdDays: 7 }, { frequency: 'q5d' }],
      trackers: [{ drugName: '好药', baseInventory: -1, baseDate: '2026-01-01T00:00:00.000Z' }],
    });

    const result = parseBackup(text);

    expect(result.data).toBeUndefined();
    expect(result.errors.map(error => `${error.section}[${error.index}]`)).toEqual(['drugs[1]', 'profiles[1]', 'trackers[0]']);
  });

  it('拒绝假日期与非法时刻', () => {
    const badDate = JSON.stringify({ version: 1, profiles: [{ drugName: 'x', dailyDosage: 1, alertThresholdDays: 7, doseAnchorDate: '2026-02-30' }] });
    expect(parseBackup(badDate).errors[0].message).toContain('真实存在的日期');

    const badTime = JSON.stringify({ version: 1, profiles: [{ drugName: 'x', dailyDosage: 1, alertThresholdDays: 7, doseTimes: ['25:00'] }] });
    expect(parseBackup(badTime).errors[0].message).toContain('HH:MM');
  });

  it('兼容缺省字段：frequency 默认 qd，dailyDosage 按频次补算，数组可缺省', () => {
    const result = parseBackup(JSON.stringify({ version: 1, profiles: [{ drugName: 'x', dosePerTime: 2, dailyDosage: undefined }] }));

    expect(result.errors).toEqual([]);
    expect(result.data?.profiles[0].frequency).toBe('qd');
    expect(result.data?.profiles[0].dailyDosage).toBe(2);
    expect(result.data?.drugs).toEqual([]);
    expect(result.data?.trackers).toEqual([]);
  });
});
