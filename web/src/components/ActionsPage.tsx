import { useMemo, useState } from 'react';
import { joinInventory, frequencyShortLabel } from '../utils/InventoryEngine';
import type { DoseSlot, DrugProfile, DrugSpec, DrugTracker, CalculatedInventory } from '../utils/InventoryEngine';
import {
  DOSE_SLOT_LABELS,
  EVERY_N_DAYS,
  TIMING_INSTRUCTION_LABELS,
  buildDoseReminders,
  buildRestockReminders,
  currentDoseSlot,
  isDoseAtSlot,
  isDoseDueToday,
  nextDoseDateOnAnchor,
  resolveDoseChips,
  resolveDoseChipsAtSlot,
  resolveDoseChipsForToday,
} from '../utils/reminders';

interface Props {
  profiles: DrugProfile[];
  drugs: DrugSpec[];
  trackers: DrugTracker[];
  onQuickAdjust: (tracker: DrugTracker, currentInv: number, adjustment: number) => void;
}

/** 服药提醒的视图：now=只看当前时段该吃的，all=今天一整天 */
type DoseView = 'now' | 'all';

export function ActionsPage({ profiles, drugs, trackers, onQuickAdjust }: Props) {
  const [doseView, setDoseView] = useState<DoseView>('now');

  const calculatedMeds = useMemo(
    () => joinInventory(profiles, drugs, trackers),
    [profiles, drugs, trackers],
  );

  const doseReminders = useMemo(() => buildDoseReminders(calculatedMeds), [calculatedMeds]);
  const restockReminders = useMemo(() => buildRestockReminders(calculatedMeds), [calculatedMeds]);

  const nowSlot = currentDoseSlot();
  // 「今天全部」= 今天（全部时段）该吃的：按服药日过滤，不按时段过滤
  const visibleDoses = doseView === 'all'
    ? doseReminders.filter(med => isDoseDueToday(med))
    : doseReminders.filter(med => isDoseAtSlot(med, nowSlot) && isDoseDueToday(med));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex-between">
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>服药提醒</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={doseView === 'now' ? 'btn btn-primary' : 'btn'}
              onClick={() => setDoseView('now')}
            >
              当前时段
            </button>
            <button
              className={doseView === 'all' ? 'btn btn-primary' : 'btn'}
              onClick={() => setDoseView('all')}
            >
              今天全部
            </button>
          </div>
        </div>
        {calculatedMeds.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ marginBottom: '16px' }}>还没有追踪任何药品。</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)' }}>请先在「规格库」建立医嘱，再到「库存」页加入新追踪。</p>
          </div>
        ) : doseReminders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>今日服药安排为空，追踪中的药品都没有医嘱频次。</p>
          </div>
        ) : visibleDoses.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {doseView === 'now'
                ? `当前时段（${DOSE_SLOT_LABELS[nowSlot]}）没有服药安排，切到「今天全部」可看完整计划。`
                : '今天没有服药安排，今天不是任何追踪药品的服药日。'}
            </p>
          </div>
        ) : (
          visibleDoses.map(med => (
            <DoseCard key={med.profileId} med={med} slot={doseView === 'now' ? nowSlot : undefined} />
          ))
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>补货提醒</h2>
        {restockReminders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>暂无需要补货的药品。</p>
          </div>
        ) : (
          restockReminders.map(med => (
            <RestockCard key={med.profileId} med={med} onQuickAdjust={onQuickAdjust} />
          ))
        )}
      </section>
    </div>
  );
}

function DoseCard({ med, slot }: { med: CalculatedInventory; slot?: DoseSlot }) {
  const pillUnit = med.pillUnit || '粒';
  // 徽标始终反映全天方案；chip 列表按视图收窄：「当前时段」只显示本时段，「今天全部」只显示今天那剂
  const allChips = resolveDoseChips(med);
  const doseTimes = slot ? resolveDoseChipsAtSlot(med, slot) : resolveDoseChipsForToday(med);
  const dosePerTime = med.dosePerTime || med.dailyDosage;
  const timingLabel = med.timingInstruction ? TIMING_INSTRUCTION_LABELS[med.timingInstruction] : null;

  const badge = allChips.kind === 'fixed'
    ? <span className="badge badge-success">固定时间</span>
    : allChips.kind === 'weekly'
      ? <span className="badge badge-success">每周{allChips.times.length}次</span>
      : allChips.kind === 'slots'
        ? <span className="badge badge-success">每日{allChips.times.length}次</span>
        : <span className="badge">{med.frequency ? frequencyShortLabel(med.frequency) : '无固定频次'}</span>;

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.1rem' }}>{med.name}</h3>
        {badge}
      </div>

      {doseTimes.kind !== 'none' ? (
        <>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {doseTimes.times.map(time => (
              <span
                key={time}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  fontSize: '0.9rem',
                }}
              >
                {time} <strong style={{ color: 'var(--color-text-primary)' }}>{dosePerTime}{pillUnit}</strong>
              </span>
            ))}
          </div>
          {doseTimes.kind === 'interval' && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>
              按间隔推算的参考时间，可在医嘱里改成固定时间。
            </p>
          )}
          {timingLabel && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>{timingLabel}</p>
          )}
        </>
      ) : (
        <p style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
          {med.frequency === 'prn'
            ? `按需服用，单次参考剂量 ${dosePerTime}${pillUnit}。`
            : `按医嘱「${med.frequency ? frequencyShortLabel(med.frequency) : '无固定频次'}」服用，单次 ${dosePerTime}${pillUnit}。`}
          {timingLabel && ` ${timingLabel}。`}
        </p>
      )}

      {med.frequency && med.frequency in EVERY_N_DAYS && med.doseAnchorDate && (
        <p style={{ fontSize: '0.85rem', marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
          锚定 {med.doseAnchorDate} 起每隔 {EVERY_N_DAYS[med.frequency] - 1} 天服用；
          {isDoseDueToday(med)
            ? ' 今天是服药日。'
            : ` 今天不服，下次 ${nextDoseDateOnAnchor(med.doseAnchorDate, EVERY_N_DAYS[med.frequency]).toLocaleDateString('zh-CN')}。`}
        </p>
      )}

      <p style={{ fontSize: '0.85rem', color: med.isLowStock ? 'var(--color-danger)' : 'var(--color-text-tertiary)' }}>
        {med.daysRemaining === Number.POSITIVE_INFINITY
          ? '按需服用，不做余量推算。'
          : `余量约可维持 ${med.daysRemaining} 天${med.isLowStock ? '，请尽快补货' : ''}。`}
      </p>
    </div>
  );
}

function RestockCard({ med, onQuickAdjust }: {
  med: CalculatedInventory;
  onQuickAdjust: Props['onQuickAdjust'];
}) {
  const size = med.packagingSize || 60;
  const boxUnit = med.packagingUnit || '盒';
  const pillUnit = med.pillUnit || '粒';

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.1rem' }}>{med.name}</h3>
        <span className="badge badge-danger">需要补货</span>
      </div>

      <p style={{ fontSize: '0.9rem', marginBottom: '16px', color: 'var(--color-text-secondary)' }}>
        剩余 <strong style={{ color: 'var(--color-danger)' }}>{med.currentInventory}{pillUnit}</strong>
        {med.daysRemaining === Number.POSITIVE_INFINITY
          ? '（按需服用）'
          : <>，约可维持 <strong style={{ color: 'var(--color-danger)' }}>{med.daysRemaining} 天</strong></>}
        ，预警阈值 {med.alertThresholdDays} 天。
      </p>

      <button
        className="btn btn-primary"
        onClick={() => onQuickAdjust(med, med.currentInventory, size)}
      >
        已买 +1{boxUnit}
      </button>
    </div>
  );
}
