import { useMemo } from 'react';
import { joinInventory, FREQUENCY_MULTIPLIERS, formatDosage, frequencyShortLabel } from '../utils/InventoryEngine';
import type { DrugProfile, DrugSpec, DrugTracker, CalculatedInventory } from '../utils/InventoryEngine';
import { DOSE_SLOT_LABELS, TIMING_INSTRUCTION_LABELS, WEEKDAY_LABELS } from '../utils/reminders';

interface Props {
  profiles: DrugProfile[];
  drugs: DrugSpec[];
  trackers: DrugTracker[];
  onRecalibrate: (med: CalculatedInventory) => void;
  onDeleteTracker: (profileId: string) => void;
  onQuickAdjust: (tracker: DrugTracker, currentInv: number, adjustment: number) => void;
}

export function InventoryDashboard({ profiles, drugs, trackers, onRecalibrate, onDeleteTracker, onQuickAdjust }: Props) {
  const calculatedMeds = useMemo(() => {
    return joinInventory(profiles, drugs, trackers).sort((a, b) => {
      // 亮红灯的优先置顶
      if (a.isLowStock && !b.isLowStock) return -1;
      if (!a.isLowStock && b.isLowStock) return 1;
      
      // 按需服用的药（Infinity）排到最底下
      if (a.daysRemaining === Number.POSITIVE_INFINITY && b.daysRemaining === Number.POSITIVE_INFINITY) {
        return a.name.localeCompare(b.name);
      }
      if (a.daysRemaining === Number.POSITIVE_INFINITY) return 1;
      if (b.daysRemaining === Number.POSITIVE_INFINITY) return -1;
      
      // 剩下的按可吃天数从小到大排（快吃完的在最前面）
      return a.daysRemaining - b.daysRemaining;
    });
  }, [profiles, drugs, trackers]);

  if (calculatedMeds.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ marginBottom: '16px' }}>还没有追踪任何药品。</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)' }}>请先在「规格库」为您的药建立医嘱，再点右上角「加入新追踪」。</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {calculatedMeds.map(med => {
        const size = med.packagingSize || 60;
        const boxUnit = med.packagingUnit || '盒';
        const pillUnit = med.pillUnit || '粒';

        const boxes = Math.floor(med.currentInventory / size);
        const pills = med.currentInventory % size;

        return (
          <div key={med.profileId} className="card">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem' }}>{med.name}</h2>
              {med.isLowStock && <span className="badge badge-danger">余量不足</span>}
            </div>

            <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>当前余量</p>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: med.isLowStock ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                  {boxes > 0 ? `${boxes}` : ''}
                  {boxes > 0 ? <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}>{boxUnit} </span> : ''}

                  {boxes > 0 && pills > 0 ? <span style={{fontSize: '1rem', fontWeight: 400}}>余 </span> : ''}

                  {pills > 0 || boxes === 0 ? `${pills}` : ''}
                  {(pills > 0 || boxes === 0) ? <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}>{pillUnit}</span> : null}

                  <div style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                    共 {formatDosage(med.currentInventory)}{pillUnit} · 起算于 {new Date(med.baseDate).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>预计可服用</p>
                <div style={{ fontSize: '1.85rem', fontWeight: 700 }}>
                  {med.daysRemaining === Number.POSITIVE_INFINITY ? '0' : med.daysRemaining} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}>天</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ width: '100%', marginBottom: '8px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                  用法：<strong style={{color: 'var(--color-text-primary)'}}>{med.frequency ? frequencyShortLabel(med.frequency) : '每日总量'}，每次 {formatDosage(med.dosePerTime || med.dailyDosage)}{pillUnit}</strong>
                  {med.frequency === 'prn' && '（按需服用，无固定剂量扣减）'}
                  {(!med.frequency || (FREQUENCY_MULTIPLIERS[med.frequency] ?? 0) >= 1) && `（每日共 ${formatDosage(med.dailyDosage)}${pillUnit}）`}
                  {med.frequency && med.frequency !== 'prn' && (FREQUENCY_MULTIPLIERS[med.frequency] ?? 0) < 1 && (FREQUENCY_MULTIPLIERS[med.frequency] ?? 0) > 0 && `（折算每日 ${formatDosage(med.dailyDosage)}${pillUnit}）`}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                  包装规格：1{boxUnit} = {size}{pillUnit}
                  {med.timingInstruction && ` · ${TIMING_INSTRUCTION_LABELS[med.timingInstruction]}`}
                  {med.doseWeekdays && med.doseWeekdays.length > 0 && ` · ${med.doseWeekdays.map(day => WEEKDAY_LABELS[day]).join(' / ')}`}
                  {med.doseAnchorDate && ` · 自 ${med.doseAnchorDate} 起隔日`}
                  {med.doseTimes && med.doseTimes.length > 0 && ` · ${med.doseTimes.join(' / ')} 服用`}
                  {!(med.doseTimes && med.doseTimes.length > 0) && med.doseSlots && med.doseSlots.length > 0 && ` · ${med.doseSlots.map(slot => DOSE_SLOT_LABELS[slot]).join(' / ')}`}
                </p>
              </div>
              <div className="flex-between" style={{ width: '100%', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn" style={{borderStyle: 'dashed', backgroundColor: 'transparent'}} title={`手动减 1${pillUnit}`} onClick={() => onQuickAdjust(med, med.currentInventory, -1)}>-1{pillUnit}</button>
                  <button className="btn" style={{borderStyle: 'dashed', backgroundColor: 'transparent'}} title={`手动加 1${pillUnit}`} onClick={() => onQuickAdjust(med, med.currentInventory, 1)}>+1{pillUnit}</button>
                  <button className="btn btn-primary" onClick={() => onQuickAdjust(med, med.currentInventory, size)}>已买 +1{boxUnit}</button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                   <button className="btn" onClick={() => onRecalibrate(med)}>校准库存</button>
                   <button className="btn btn-danger" onClick={() => onDeleteTracker(med.profileId)}>停止追踪</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
