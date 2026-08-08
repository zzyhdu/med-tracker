import { useState } from 'react';
import type { FormEvent } from 'react';
import { FREQUENCY_LABELS, FREQUENCY_MULTIPLIERS } from '../utils/InventoryEngine';
import type { DoseSlot, DrugProfile, DrugSpec, TimingInstruction } from '../utils/InventoryEngine';
import {
  DOSE_SLOT_LABELS,
  DOSE_SLOT_ORDER,
  EVERY_N_DAYS,
  INTERVAL_ANCHOR_TIMES,
  TIMING_INSTRUCTION_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  WEEKLY_DOSE_COUNTS,
  sortDoseSlots,
  sortDoseWeekdays,
} from '../utils/reminders';

interface Props {
  drugs: DrugSpec[];
  initialData?: DrugProfile;
  onSave: (profile: DrugProfile) => void;
  onCancel: () => void;
}

/** 一天内服药时刻的三种记法：默认时段 / 自选时段 / 固定时间点 */
type TimeMode = 'default' | 'custom' | 'fixed';

/** 频次对应的每日服药次数；prn(0) 表示无固定时刻 */
function dosesPerDay(frequency: string): number {
  const multiplier = FREQUENCY_MULTIPLIERS[frequency] ?? 1;
  if (multiplier === 0) return 0;
  return Math.max(1, Math.round(multiplier));
}

/** 进入「固定时间点」模式时的预填时刻 */
function defaultFixedTimes(frequency: string): string[] {
  const intervalAnchors = INTERVAL_ANCHOR_TIMES[frequency];
  if (intervalAnchors) return intervalAnchors;
  const defaults: Record<number, string[]> = {
    1: ['08:00'],
    2: ['08:00', '20:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['08:00', '12:00', '18:00', '22:00'],
  };
  return defaults[dosesPerDay(frequency)] ?? [];
}

/** 把已填时刻数组对齐到目标数量：保留已有值，空缺用默认值补 */
function alignTimes(current: string[], frequency: string): string[] {
  const defaults = defaultFixedTimes(frequency);
  return Array.from({ length: dosesPerDay(frequency) }, (_, i) => current[i] ?? defaults[i] ?? '08:00');
}

function initialTimeMode(data?: DrugProfile): TimeMode {
  if (data?.doseTimes?.length) return 'fixed';
  if (data?.doseSlots?.length) return 'custom';
  return 'default';
}

/** 日期输入框需要的本地 yyyy-mm-dd 格式（不能用 toISOString，会偏到 UTC 前一天） */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 医嘱表单：选定一款共享规格后，记录您个人的服用方法。
 * 医嘱是私人的，其他用户看不到；同一款药每人只有一条医嘱。
 */
export function InstructionForm({ drugs, initialData, onSave, onCancel }: Props) {
  const [drugId, setDrugId] = useState<string>(initialData?.drugId ?? drugs[0]?.id ?? '');
  const [frequency, setFrequency] = useState<string>(initialData?.frequency ?? 'qd');
  const [dosePerTime, setDosePerTime] = useState<number>(initialData?.dosePerTime ?? 1);
  const [alertThreshold, setAlertThreshold] = useState<number>(initialData?.alertThresholdDays ?? 14);
  const [timingInstruction, setTimingInstruction] = useState<string>(initialData?.timingInstruction ?? '');
  const [timeMode, setTimeMode] = useState<TimeMode>(initialTimeMode(initialData));
  const [customSlots, setCustomSlots] = useState<DoseSlot[]>(initialData?.doseSlots ?? []);
  const [fixedTimes, setFixedTimes] = useState<string[]>(initialData?.doseTimes ?? []);
  const [doseWeekdays, setDoseWeekdays] = useState<number[]>(initialData?.doseWeekdays ?? []);
  const [doseAnchorDate, setDoseAnchorDate] = useState<string>(initialData?.doseAnchorDate ?? toDateInputValue(new Date()));

  const selectedDrug = drugs.find(drug => drug.id === drugId);
  const pillUnit = selectedDrug?.pillUnit || '粒';
  const timesPerDay = dosesPerDay(frequency);
  // 周频次（qw/biw/tiw）需要指定每周的哪几天服药
  const weeklyCount = WEEKLY_DOSE_COUNTS[frequency] ?? 0;
  // 隔 N 天频次（qod）需要一个锚定服药日来推算哪天吃、哪天不吃
  const intervalDays = EVERY_N_DAYS[frequency] ?? 0;
  // 自选时段/服药日的数量必须与每日/每周次数一致，否则不允许提交
  const customIncomplete = timeMode === 'custom' && customSlots.length !== timesPerDay;
  const weeklyIncomplete = weeklyCount > 0 && doseWeekdays.length !== weeklyCount;
  const anchorIncomplete = intervalDays > 0 && !doseAnchorDate;

  const handleFrequencyChange = (next: string) => {
    setFrequency(next);
    if (timeMode === 'fixed') {
      setFixedTimes(current => alignTimes(current, next));
    }
    if (timeMode === 'custom') {
      setCustomSlots(current => current.slice(0, dosesPerDay(next)));
    }
    setDoseWeekdays(current => current.slice(0, WEEKLY_DOSE_COUNTS[next] ?? 0));
  };

  const handleTimeModeChange = (next: TimeMode) => {
    setTimeMode(next);
    if (next === 'fixed') {
      setFixedTimes(current => alignTimes(current, frequency));
    }
  };

  const toggleSlot = (slot: DoseSlot) => {
    setCustomSlots(current => {
      if (current.includes(slot)) return current.filter(item => item !== slot);
      if (current.length >= timesPerDay) return current;
      return [...current, slot];
    });
  };

  const toggleWeekday = (day: number) => {
    setDoseWeekdays(current => {
      if (current.includes(day)) return current.filter(item => item !== day);
      if (current.length >= weeklyCount) return current;
      return [...current, day];
    });
  };

  const handleFixedTimeChange = (index: number, value: string) => {
    setFixedTimes(current => current.map((time, i) => (i === index ? value : time)));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDrug || dosePerTime < 0 || customIncomplete || weeklyIncomplete || anchorIncomplete) return;

    // Resolve clinical math into engine metric
    const rawMultiplier = FREQUENCY_MULTIPLIERS[frequency] ?? 1;
    const computedDailyDosage = dosePerTime * rawMultiplier;

    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      drugId: selectedDrug.id,
      frequency,
      dosePerTime: Number(dosePerTime),
      dailyDosage: Number(computedDailyDosage),
      alertThresholdDays: Number(alertThreshold),
      timingInstruction: (timingInstruction || undefined) as TimingInstruction | undefined,
      doseTimes: timeMode === 'fixed' && timesPerDay > 0 ? fixedTimes.slice(0, timesPerDay) : undefined,
      doseSlots: timeMode === 'custom' && timesPerDay > 0 ? sortDoseSlots(customSlots) : undefined,
      doseWeekdays: weeklyCount > 0 ? sortDoseWeekdays(doseWeekdays) : undefined,
      doseAnchorDate: intervalDays > 0 ? doseAnchorDate : undefined,
    });
  };

  if (drugs.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>规格库是空的，请先在上方创建一款药物规格。</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>{initialData ? '编辑我的医嘱' : '新增我的医嘱'}</h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)', marginBottom: '16px' }}>
        医嘱只对您本人生效，库存看板会按它自动推算每日消耗。
      </p>
      <form onSubmit={handleSubmit}>
        <div className="input-block">
          <label>关联药物规格</label>
          <select
            value={drugId}
            onChange={e => setDrugId(e.target.value)}
            disabled={!!initialData}
            required
            style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: '1rem' }}
          >
            {drugs.map(drug => (
              <option key={drug.id} value={drug.id}>
                {drug.name} (1{drug.packagingUnit || '盒'}={drug.packagingSize || 60}{drug.pillUnit || '粒'})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="input-block" style={{ flex: 1, minWidth: '200px' }}>
            <label>服药频次</label>
            <select value={frequency} onChange={e => handleFrequencyChange(e.target.value)} required style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: '1rem' }}>
              {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="input-block" style={{ flex: 1, minWidth: '150px' }}>
            <label>每次剂量（{pillUnit}）</label>
            <input type="number" step="0.1" value={dosePerTime} onChange={e => setDosePerTime(Number(e.target.value))} required />
          </div>
        </div>

        {weeklyCount > 0 && (
          <div className="input-block">
            <label>一周内的服药日（周几吃）</label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {WEEKDAY_ORDER.map(day => {
                const checked = doseWeekdays.includes(day);
                const maxed = !checked && doseWeekdays.length >= weeklyCount;
                return (
                  <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 400, opacity: maxed ? 0.45 : 1 }}>
                    <input type="checkbox" checked={checked} disabled={maxed} onChange={() => toggleWeekday(day)} />
                    {WEEKDAY_LABELS[day]}
                  </label>
                );
              })}
            </div>
            <p style={{ fontSize: '0.85rem', marginTop: '8px', color: weeklyIncomplete ? '#b91c1c' : 'var(--color-text-tertiary)' }}>
              已选 {doseWeekdays.length}/{weeklyCount} 天，需与每周次数一致
            </p>
          </div>
        )}

        {intervalDays > 0 && (
          <div className="input-block">
            <label>锚定服药日（从该日起按间隔推算）</label>
            <input
              type="date"
              value={doseAnchorDate}
              onChange={e => setDoseAnchorDate(e.target.value)}
              required
            />
            <p style={{ fontSize: '0.85rem', marginTop: '8px', color: anchorIncomplete ? '#b91c1c' : 'var(--color-text-tertiary)' }}>
              隔天一次的周几每周都在变，所以用一个确定吃过药的日期来锚定：该日服药，之后每隔一天服一次；选上次或下次的服药日都行。
            </p>
          </div>
        )}

        <div className="input-block">
          <label>服药时机（与餐食/作息的关系）</label>
          <select value={timingInstruction} onChange={e => setTimingInstruction(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: '1rem' }}>
            <option value="">无特殊要求</option>
            {Object.entries(TIMING_INSTRUCTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {timesPerDay > 0 && (
          <div className="input-block">
            <label>一天内的服药时刻</label>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 400 }}>
                <input type="radio" checked={timeMode === 'default'} onChange={() => handleTimeModeChange('default')} />
                按默认时段
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 400 }}>
                <input type="radio" checked={timeMode === 'custom'} onChange={() => handleTimeModeChange('custom')} />
                自选时段
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 400 }}>
                <input type="radio" checked={timeMode === 'fixed'} onChange={() => handleTimeModeChange('fixed')} />
                固定时间点（严格按时）
              </label>
            </div>
            {timeMode === 'custom' && (
              <div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {DOSE_SLOT_ORDER.map(slot => {
                    const checked = customSlots.includes(slot);
                    const maxed = !checked && customSlots.length >= timesPerDay;
                    return (
                      <label key={slot} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 400, opacity: maxed ? 0.45 : 1 }}>
                        <input type="checkbox" checked={checked} disabled={maxed} onChange={() => toggleSlot(slot)} />
                        {DOSE_SLOT_LABELS[slot]}
                      </label>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.85rem', marginTop: '8px', color: customIncomplete ? '#b91c1c' : 'var(--color-text-tertiary)' }}>
                  已选 {customSlots.length}/{timesPerDay} 个时段，需与每日次数一致；餐前/餐后时机会按所选餐次显示（如「晚餐前」）
                </p>
              </div>
            )}
            {timeMode === 'fixed' && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {fixedTimes.slice(0, timesPerDay).map((time, index) => (
                  <input
                    key={index}
                    type="time"
                    value={time}
                    onChange={e => handleFixedTimeChange(index, e.target.value)}
                    required
                    style={{ padding: '11px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: '1rem' }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="input-block">
          <label>预警阈值（余量不足 N 天时提醒补货）</label>
          <input type="number" value={alertThreshold} onChange={e => setAlertThreshold(Number(e.target.value))} required />
        </div>

        <div className="flex-between gap-4" style={{ marginTop: '24px' }}>
          <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={customIncomplete || weeklyIncomplete || anchorIncomplete} style={{ flex: 2 }}>保存我的医嘱</button>
        </div>
      </form>
    </div>
  );
}
