import { useState } from 'react';
import type { FormEvent } from 'react';
import type { DrugProfile, DrugTracker, CalculatedInventory } from '../utils/InventoryEngine';

interface Props {
  profiles: DrugProfile[];
  initialData?: CalculatedInventory; // The currently calculated one
  onSave: (tracker: DrugTracker) => void;
  onCancel: () => void;
}

function getInventoryInputs(profiles: DrugProfile[], profileId: string, initialData?: CalculatedInventory) {
  const profile = profiles.find(p => p.id === profileId);

  if (!initialData || !profile) {
    return { boxes: 0, pills: 0 };
  }

  const size = profile.packagingSize || 60;
  return {
    boxes: Math.floor(initialData.currentInventory / size),
    pills: initialData.currentInventory % size,
  };
}

export function TrackerForm({ profiles, initialData, onSave, onCancel }: Props) {
  const initialProfileId = initialData ? initialData.id : (profiles[0]?.id || '');
  const initialInputs = getInventoryInputs(profiles, initialProfileId, initialData);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(initialProfileId);
  
  const [inputBoxes, setInputBoxes] = useState<number>(initialInputs.boxes);
  const [inputPills, setInputPills] = useState<number>(initialInputs.pills);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    
    const size = selectedProfile.packagingSize || 60;
    const totalCalculatedInventory = (Number(inputBoxes) * size) + Number(inputPills);
    if (totalCalculatedInventory < 0) return;

    onSave({
      drugId: selectedProfile.id,
      baseInventory: totalCalculatedInventory,
      baseDate: new Date().toISOString()
    });
  };

  if (!selectedProfile) {
    return <div className="card">无可用药品字典，请先去配置库添加。</div>;
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
      <h2>{initialData ? '盘点校准库存 / 批量补齐录入' : '开始追踪新药'}</h2>
      <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
        <div className="input-block">
          <label>关联药品字典规格</label>
          <select 
            value={selectedProfileId} 
            onChange={(e) => setSelectedProfileId(e.target.value)} 
            disabled={!!initialData}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name} (1{p.packagingUnit}={p.packagingSize}{p.pillUnit})</option>
            ))}
          </select>
        </div>

        <div className="input-block">
          <label>{initialData ? '覆盖盘点：请输入目前手里真实的余货总量' : '请输入目前的初始库存量'}</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input type="number" value={inputBoxes} onChange={e => setInputBoxes(Number(e.target.value))} min={0} />
              <div style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--color-text-secondary)' }}>{selectedProfile.packagingUnit}</div>
            </div>
            <span>余</span>
            <div style={{ flex: 1, position: 'relative' }}>
              <input type="number" value={inputPills} onChange={e => setInputPills(Number(e.target.value))} min={0} />
              <div style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--color-text-secondary)' }}>{selectedProfile.pillUnit}</div>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', marginTop: '8px', color: 'var(--color-accent)', fontWeight: 600 }}>
            转换合并计算底层记录值：{(Number(inputBoxes) * (selectedProfile.packagingSize || 60)) + Number(inputPills)} {selectedProfile.pillUnit || '粒'}
          </p>
        </div>

        <div className="flex-between gap-4" style={{ marginTop: '24px' }}>
          <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>取消</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>{initialData ? '保存校准记录' : '开始系统管理'}</button>
        </div>
      </form>
    </div>
  );
}
