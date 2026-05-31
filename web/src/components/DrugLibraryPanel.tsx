import { useState } from 'react';
import type { FormEvent } from 'react';
import { FREQUENCY_LABELS, FREQUENCY_MULTIPLIERS } from '../utils/InventoryEngine';
import type { DrugProfile } from '../utils/InventoryEngine';

interface Props {
  profiles: DrugProfile[];
  onSaveProfile: (profile: DrugProfile) => void;
  onDeleteProfile: (id: string) => void;
}

export function DrugLibraryPanel({ profiles, onSaveProfile, onDeleteProfile }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  
  const [frequency, setFrequency] = useState<string>('qd');
  const [dosePerTime, setDosePerTime] = useState<number>(1);

  const [packagingSize, setPackagingSize] = useState<number>(60);
  const [packagingUnit, setPackagingUnit] = useState<string>('盒');
  const [pillUnit, setPillUnit] = useState<string>('粒');
  const [alertThreshold, setAlertThreshold] = useState<number>(14);

  const [showForm, setShowForm] = useState(false);

  const openForm = (profile?: DrugProfile) => {
    if (profile) {
      setEditingId(profile.id);
      setName(profile.name);
      setFrequency(profile.frequency || 'qd');
      setDosePerTime(profile.dosePerTime || profile.dailyDosage);
      setPackagingSize(profile.packagingSize || 60);
      setPackagingUnit(profile.packagingUnit || '盒');
      setPillUnit(profile.pillUnit || '粒');
      setAlertThreshold(profile.alertThresholdDays);
    } else {
      setEditingId(null);
      setName('');
      setFrequency('qd');
      setDosePerTime(1);
      setPackagingSize(60);
      setPackagingUnit('盒');
      setPillUnit('粒');
      setAlertThreshold(14);
    }
    setShowForm(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || dosePerTime < 0 || packagingSize <= 0) return;

    // Resolve clinical math into engine metric
    const rawMultiplier = FREQUENCY_MULTIPLIERS[frequency] ?? 1;
    const computedDailyDosage = dosePerTime * rawMultiplier;

    onSaveProfile({
      id: editingId || crypto.randomUUID(),
      name: name.trim(),
      frequency,
      dosePerTime: Number(dosePerTime),
      dailyDosage: Number(computedDailyDosage),
      packagingSize: Number(packagingSize),
      packagingUnit: packagingUnit.trim() || '盒',
      pillUnit: pillUnit.trim() || '粒',
      alertThresholdDays: Number(alertThreshold)
    });
    setShowForm(false);
  };

  if (showForm) {
    return (
      <div className="card">
        <h2>{editingId ? '编辑药品门诊配置' : '新增药品主记录'}</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)', marginBottom: '16px' }}>
          完全还原门诊医嘱标准，让推算精准无感。修改此处的处方会自动对首页追踪卡片生效。
        </p>
        <form onSubmit={handleSubmit}>
          <div className="input-block">
            <label>药品名称</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: 'var(--color-bg)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid var(--color-border)' }}>
            <div className="input-block" style={{ marginBottom: 0, flex: 1, minWidth: '130px' }}>
              <label>大包装类型</label>
              <select value={packagingUnit} onChange={e => setPackagingUnit(e.target.value)} required style={{ width: '100%', padding: '11px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: '1rem' }}>
                <option value="盒">盒</option>
                <option value="瓶">瓶</option>
                <option value="排">排</option>
                <option value="板">板</option>
                <option value="袋">袋</option>
                <option value="支">支</option>
              </select>
            </div>
            <div className="input-block" style={{ marginBottom: 0, flex: 1, minWidth: '130px' }}>
              <label>单次最小单位</label>
              <select value={pillUnit} onChange={e => setPillUnit(e.target.value)} required style={{ width: '100%', padding: '11px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: '1rem' }}>
                <option value="粒">粒</option>
                <option value="片">片</option>
                <option value="颗">颗</option>
                <option value="丸">丸</option>
                <option value="贴">贴</option>
                <option value="毫升(ml)">毫升(ml)</option>
              </select>
            </div>
            <div className="input-block" style={{ marginBottom: 0, flex: 2, minWidth: '200px' }}>
              <label>换算关系：1 {packagingUnit} = 多少 {pillUnit}？</label>
              <input type="number" value={packagingSize} onChange={e => setPackagingSize(Number(e.target.value))} required />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="input-block" style={{ flex: 1, minWidth: '200px' }}>
              <label>【医嘱】临床服药频次 (如 qd/bid/qod)</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)} required style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', fontSize: '1rem' }}>
                {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                   <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="input-block" style={{ flex: 1, minWidth: '150px' }}>
              <label>【医嘱】单次服下几个 {pillUnit}？</label>
              <input type="number" step="0.1" value={dosePerTime} onChange={e => setDosePerTime(Number(e.target.value))} required />
            </div>
          </div>

          <div className="input-block">
            <label>预警阈值（余量少于几天发生红牌警告）</label>
            <input type="number" value={alertThreshold} onChange={e => setAlertThreshold(Number(e.target.value))} required />
          </div>

          <div className="flex-between gap-4" style={{ marginTop: '24px' }}>
            <button type="button" className="btn" onClick={() => setShowForm(false)} style={{ flex: 1 }}>取消</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>保存规格字典</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="flex-between" style={{ marginBottom: '8px' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>全部系统规格字典</h2>
        <button className="btn btn-primary" onClick={() => openForm()}>+ 新增药品规格</button>
      </div>
      
      {profiles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>字典库是空的。请先新增一种药品的标准规格，然后去库存看板中选用它。</p>
        </div>
      ) : (
        profiles.map(p => (
          <div key={p.id} className="card flex-between" style={{ padding: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '8px', color: 'var(--color-text-primary)' }}>{p.name}</h3>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                <span>规格: 1{p.packagingUnit}={p.packagingSize}{p.pillUnit}</span>
                <span>
                 门诊医嘱: <strong style={{color: 'var(--color-accent)'}}> {p.frequency ? FREQUENCY_LABELS[p.frequency] : '每日总计'} - 每次 {p.dosePerTime || p.dailyDosage} {p.pillUnit}</strong>
                </span>
                <span style={{ color: 'var(--color-text-tertiary)'}}>
                  (后台预扣量: {p.dailyDosage.toFixed(2)}/天)
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '12px' }}>
              <button className="btn" style={{ width: '100%', minWidth: '130px'}} onClick={() => openForm(p)}>修改规格/医嘱</button>
              <button className="btn btn-danger" style={{ width: '100%', minWidth: '130px'}} onClick={() => { if(window.confirm('彻底删除此字典？此操作会令追踪看板里同款药失效。')) onDeleteProfile(p.id); }}>归档删除</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
