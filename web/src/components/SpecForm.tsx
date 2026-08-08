import { useState } from 'react';
import type { FormEvent } from 'react';
import type { DrugSpec } from '../utils/InventoryEngine';

interface Props {
  initialData?: DrugSpec;
  onSave: (drug: DrugSpec) => void;
  onCancel: () => void;
}

/**
 * 药物规格表单：只管物理规格（名称 + 包装换算），不含任何医嘱内容。
 * 规格是全用户共享的，创建后其他用户可以直接引用或复制副本。
 */
export function SpecForm({ initialData, onSave, onCancel }: Props) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [packagingSize, setPackagingSize] = useState<number>(initialData?.packagingSize ?? 60);
  const [packagingUnit, setPackagingUnit] = useState<string>(initialData?.packagingUnit ?? '盒');
  const [pillUnit, setPillUnit] = useState<string>(initialData?.pillUnit ?? '粒');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || packagingSize <= 0) return;

    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      createdBy: initialData?.createdBy ?? '',
      name: name.trim(),
      packagingSize: Number(packagingSize),
      packagingUnit: packagingUnit.trim() || '盒',
      pillUnit: pillUnit.trim() || '粒',
    });
  };

  return (
    <div className="card">
      <h2>{initialData ? '编辑药物规格' : '新增药物规格'}</h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)', marginBottom: '16px' }}>
        规格库全员共享：您创建的规格，其他用户可以直接引用，也可以复制副本后自行调整。
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

        <div className="flex-between gap-4" style={{ marginTop: '24px' }}>
          <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>取消</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>保存药物规格</button>
        </div>
      </form>
    </div>
  );
}
