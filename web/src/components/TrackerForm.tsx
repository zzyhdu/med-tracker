import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { DrugProfile, DrugSpec, DrugTracker, CalculatedInventory } from '../utils/InventoryEngine';

interface Props {
  profiles: DrugProfile[];
  drugs: DrugSpec[];
  initialData?: CalculatedInventory; // The currently calculated one
  onSave: (tracker: DrugTracker) => void;
  onCancel: () => void;
}

function getInventoryInputs(spec: DrugSpec | undefined, initialData?: CalculatedInventory) {
  if (!initialData || !spec) {
    return { boxes: 0, pills: 0 };
  }

  const size = spec.packagingSize || 60;
  return {
    boxes: Math.floor(initialData.currentInventory / size),
    pills: initialData.currentInventory % size,
  };
}

/** 日期输入框需要的本地 yyyy-mm-dd 格式（不能用 toISOString，会偏到 UTC 前一天） */
function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function TrackerForm({ profiles, drugs, initialData, onSave, onCancel }: Props) {
  const specById = useMemo(() => new Map(drugs.map(drug => [drug.id, drug])), [drugs]);

  // 只列出规格仍然存在的医嘱，规格被删的医嘱无法追踪
  const trackableProfiles = useMemo(
    () => profiles.filter(profile => specById.has(profile.drugId)),
    [profiles, specById],
  );

  const initialProfileId = initialData ? initialData.profileId : (trackableProfiles[0]?.id || '');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(initialProfileId);

  const selectedProfile = trackableProfiles.find(p => p.id === selectedProfileId);
  const selectedSpec = selectedProfile ? specById.get(selectedProfile.drugId) : undefined;

  const [inputBoxes, setInputBoxes] = useState<number>(() => getInventoryInputs(
    initialData ? specById.get(initialData.drugId) : undefined,
    initialData,
  ).boxes);
  const [inputPills, setInputPills] = useState<number>(() => getInventoryInputs(
    initialData ? specById.get(initialData.drugId) : undefined,
    initialData,
  ).pills);

  const packagingSize = selectedSpec?.packagingSize || 60;
  const packagingUnit = selectedSpec?.packagingUnit || '盒';
  const pillUnit = selectedSpec?.pillUnit || '粒';

  // 起始日期决定每日自动扣减从哪天算起，允许早于录入当天（如几天前就开始服药）
  const today = toDateInputValue(new Date());
  const [startDate, setStartDate] = useState<string>(today);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    if (!startDate || startDate > today) return;

    const totalCalculatedInventory = (Number(inputBoxes) * packagingSize) + Number(inputPills);
    if (totalCalculatedInventory < 0) return;

    onSave({
      profileId: selectedProfile.id,
      baseInventory: totalCalculatedInventory,
      baseDate: new Date(`${startDate}T00:00:00`).toISOString()
    });
  };

  if (!selectedProfile || !selectedSpec) {
    return <div className="card">无可用医嘱，请先去规格库为您的药建立医嘱。</div>;
  }

  return (
    <div className="card">
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      <h2>{initialData ? '校准库存' : '添加库存追踪'}</h2>
      <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
        <div className="input-block">
          <label>药品（来自您的医嘱）</label>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            disabled={!!initialData}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
          >
            {trackableProfiles.map(profile => {
              const spec = specById.get(profile.drugId);
              return (
                <option key={profile.id} value={profile.id}>
                  {spec?.name} (1{spec?.packagingUnit || '盒'}={spec?.packagingSize || 60}{spec?.pillUnit || '粒'})
                </option>
              );
            })}
          </select>
        </div>

        <div className="input-block">
          <label>{initialData ? '盘点日期（库存从该日起重新推算）' : '开始服用日期（库存从该日起推算）'}</label>
          <input
            type="date"
            value={startDate}
            max={today}
            onChange={e => setStartDate(e.target.value)}
            required
          />
          <p style={{ fontSize: '0.85rem', marginTop: '8px', color: 'var(--color-text-tertiary)' }}>
            默认今天。若几天前已开始服用，请选实际起始日，系统会补齐期间的每日扣减。
          </p>
        </div>

        <div className="input-block">
          <label>{initialData ? '盘点当天的实际余量' : '请输入起始日期当天的库存量'}</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input type="number" value={inputBoxes} onChange={e => setInputBoxes(Number(e.target.value))} min={0} />
              <div style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--color-text-secondary)' }}>{packagingUnit}</div>
            </div>
            <span>余</span>
            <div style={{ flex: 1, position: 'relative' }}>
              <input type="number" value={inputPills} onChange={e => setInputPills(Number(e.target.value))} min={0} />
              <div style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--color-text-secondary)' }}>{pillUnit}</div>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', marginTop: '8px', color: 'var(--color-accent)', fontWeight: 600 }}>
            合计 {(Number(inputBoxes) * packagingSize) + Number(inputPills)} {pillUnit}
          </p>
        </div>

        <div className="flex-between gap-4" style={{ marginTop: '24px' }}>
          <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>取消</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>{initialData ? '保存' : '开始追踪'}</button>
        </div>
      </form>
    </div>
  );
}
