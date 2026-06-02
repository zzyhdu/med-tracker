import { useMemo } from 'react';
import { InventoryEngine, FREQUENCY_LABELS } from '../utils/InventoryEngine';
import type { DrugProfile, DrugTracker, CalculatedInventory } from '../utils/InventoryEngine';

interface Props {
  profiles: DrugProfile[];
  trackers: DrugTracker[];
  onRecalibrate: (med: CalculatedInventory) => void;
  onDeleteTracker: (drugId: string) => void;
  onQuickAdjust: (tracker: DrugTracker, currentInv: number, adjustment: number) => void;
}

export function InventoryDashboard({ profiles, trackers, onRecalibrate, onDeleteTracker, onQuickAdjust }: Props) {
  const calculatedMeds = useMemo(() => {
    const results: CalculatedInventory[] = [];
    for (const tracker of trackers) {
      const profile = profiles.find(p => p.id === tracker.drugId);
      if (profile) {
        results.push(InventoryEngine.calculate(profile, tracker));
      }
    }
    return results.sort((a, b) => {
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
  }, [profiles, trackers]);

  if (calculatedMeds.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ marginBottom: '16px' }}>看板空空如也，您目前没有追踪任何药物。</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)' }}>请在“配置库”建立基本规格信息，然后点击“加入新追踪”。</p>
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
          <div key={med.id} className="card">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem' }}>{med.name}</h2>
              {med.isLowStock ? (
                <span className="badge badge-danger">余量不足预警</span>
              ) : (
                <span className="badge badge-success">库存满点健康</span>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>实时推算纯净余量</p>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: med.isLowStock ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                  {boxes > 0 ? `${boxes}` : ''}
                  {boxes > 0 ? <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}>{boxUnit} </span> : ''}
                  
                  {boxes > 0 && pills > 0 ? <span style={{fontSize: '1rem', fontWeight: 400}}>余 </span> : ''}
                  
                  {pills > 0 || boxes === 0 ? `${pills}` : ''}
                  {(pills > 0 || boxes === 0) ? <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}>{pillUnit}</span> : null}

                  <div style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--color-text-tertiary)', marginTop: '-2px' }}>解包算总库: {med.currentInventory}{pillUnit}</div>
                </div>
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>预计仍可维持</p>
                <div style={{ fontSize: '1.85rem', fontWeight: 700 }}>
                  {med.daysRemaining === Number.POSITIVE_INFINITY ? '0' : med.daysRemaining} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--color-text-secondary)' }}>天</span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <p style={{ width: '100%', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
                门诊标准医嘱: <strong style={{color: 'var(--color-text-primary)'}}>{med.frequency ? FREQUENCY_LABELS[med.frequency] : '每日需总服'} - 每次 {med.dosePerTime || med.dailyDosage}</strong> {pillUnit}
              </p>
              <div className="flex-between" style={{ width: '100%', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn" style={{borderStyle: 'dashed', backgroundColor: 'transparent'}} title="损耗微调" onClick={() => onQuickAdjust(med, med.currentInventory, -1)}>-1{pillUnit}</button>
                  <button className="btn" style={{borderStyle: 'dashed', backgroundColor: 'transparent'}} title="多出微调" onClick={() => onQuickAdjust(med, med.currentInventory, 1)}>+1{pillUnit}</button>
                  <button className="btn btn-primary" title="复诊后买大包装补货" onClick={() => onQuickAdjust(med, med.currentInventory, size)}>已买 +1{boxUnit}</button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                   <button className="btn" onClick={() => onRecalibrate(med)}>盘点重入</button>
                   <button className="btn btn-danger" onClick={() => onDeleteTracker(med.drugId)}>停用</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
