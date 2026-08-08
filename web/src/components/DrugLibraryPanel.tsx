import { useMemo, useState } from 'react';
import { formatDosage, frequencyShortLabel } from '../utils/InventoryEngine';
import type { DrugProfile, DrugSpec } from '../utils/InventoryEngine';
import type { ImportedDrug } from '../utils/profileImport';
import type { BackupData } from '../utils/dataTransfer';
import { DOSE_SLOT_LABELS, TIMING_INSTRUCTION_LABELS, WEEKDAY_LABELS } from '../utils/reminders';
import { ProfileImportPanel } from './ProfileImportPanel';
import { BackupPanel } from './BackupPanel';
import { SpecForm } from './SpecForm';
import { InstructionForm } from './InstructionForm';

interface Props {
  drugs: DrugSpec[];
  profiles: DrugProfile[];
  currentUserId: string;
  onSaveDrug: (drug: DrugSpec) => void;
  onDeleteDrug: (id: string) => void;
  onCopyDrug: (drug: DrugSpec) => void;
  onSaveProfile: (profile: DrugProfile) => void;
  onDeleteProfile: (id: string) => void;
  onImportProfiles: (items: ImportedDrug[]) => void;
  onExportBackup: () => void;
  onImportBackup: (data: BackupData) => void;
  importing: boolean;
}

type View = 'list' | 'spec-form' | 'instruction-form' | 'import' | 'backup';

/**
 * 规格字典库：共享药物规格与个人医嘱分区管理。
 * - 规格全员共用：别人的规格可直接引用，想调整就复制副本；
 * - 医嘱私人所有：每款药一条，驱动库存推算。
 */
export function DrugLibraryPanel({
  drugs,
  profiles,
  currentUserId,
  onSaveDrug,
  onDeleteDrug,
  onCopyDrug,
  onSaveProfile,
  onDeleteProfile,
  onImportProfiles,
  onExportBackup,
  onImportBackup,
  importing,
}: Props) {
  const [view, setView] = useState<View>('list');
  const [editingDrug, setEditingDrug] = useState<DrugSpec | undefined>(undefined);
  const [editingProfile, setEditingProfile] = useState<DrugProfile | undefined>(undefined);

  const specById = useMemo(() => new Map(drugs.map(drug => [drug.id, drug])), [drugs]);

  // 我创建的规格置顶，其余按药名排序，方便在共享池里找药
  const sortedDrugs = useMemo(() => (
    [...drugs].sort((a, b) => {
      const mineA = a.createdBy === currentUserId ? 0 : 1;
      const mineB = b.createdBy === currentUserId ? 0 : 1;
      if (mineA !== mineB) return mineA - mineB;
      return a.name.localeCompare(b.name);
    })
  ), [drugs, currentUserId]);

  const closeForms = () => {
    setView('list');
    setEditingDrug(undefined);
    setEditingProfile(undefined);
  };

  const openSpecForm = (drug?: DrugSpec) => {
    setEditingDrug(drug);
    setView('spec-form');
  };

  const openInstructionForm = (profile?: DrugProfile) => {
    setEditingProfile(profile);
    setView('instruction-form');
  };

  const handleSaveDrug = (drug: DrugSpec) => {
    // 新建时后端会以会话用户为创建者；这里补齐 createdBy 让乐观更新立即可见
    onSaveDrug(drug.createdBy ? drug : { ...drug, createdBy: currentUserId });
    closeForms();
  };

  const handleSaveProfile = (profile: DrugProfile) => {
    onSaveProfile(profile);
    closeForms();
  };

  if (view === 'spec-form') {
    return <SpecForm initialData={editingDrug} onSave={handleSaveDrug} onCancel={closeForms} />;
  }

  if (view === 'instruction-form') {
    return <InstructionForm drugs={drugs} initialData={editingProfile} onSave={handleSaveProfile} onCancel={closeForms} />;
  }

  if (view === 'import') {
    return (
      <ProfileImportPanel
        onImportProfiles={onImportProfiles}
        onCancel={closeForms}
        importing={importing}
      />
    );
  }

  if (view === 'backup') {
    return (
      <BackupPanel
        onExport={onExportBackup}
        onImport={onImportBackup}
        onCancel={closeForms}
        importing={importing}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex-between" style={{ marginBottom: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>共享药物规格</h2>
          <button className="btn btn-primary" onClick={() => openSpecForm()}>+ 新增规格</button>
        </div>

        {sortedDrugs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>规格库是空的。创建第一款药物规格，全用户即可共享引用。</p>
          </div>
        ) : (
          sortedDrugs.map(drug => {
            const isMine = drug.createdBy === currentUserId;
            return (
              <div key={drug.id} className="card flex-between" style={{ padding: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px', color: 'var(--color-text-primary)' }}>
                    {drug.name}{' '}
                    {isMine
                      ? <span className="badge badge-success">我创建的</span>
                      : <span className="badge">共享</span>}
                  </h3>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                    规格: 1{drug.packagingUnit || '盒'}={drug.packagingSize || 60}{drug.pillUnit || '粒'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '12px' }}>
                  {isMine ? (
                    <>
                      <button className="btn" style={{ width: '100%', minWidth: '130px' }} onClick={() => openSpecForm(drug)}>修改规格</button>
                      <button className="btn btn-danger" style={{ width: '100%', minWidth: '130px' }} onClick={() => onDeleteDrug(drug.id)}>删除规格</button>
                    </>
                  ) : (
                    <button className="btn" style={{ width: '100%', minWidth: '130px' }} onClick={() => onCopyDrug(drug)}>复制副本</button>
                  )}
                </div>
              </div>
            );
          })
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => setView('import')}>批量导入 JSON</button>
          <button className="btn" style={{ flex: 1 }} onClick={() => setView('backup')}>备份与迁移</button>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex-between" style={{ marginBottom: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>我的医嘱</h2>
          <button
            className="btn btn-primary"
            onClick={() => openInstructionForm()}
            disabled={drugs.length === 0}
            title={drugs.length === 0 ? '请先在上方创建药物规格' : undefined}
          >
            + 新增医嘱
          </button>
        </div>

        {profiles.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>还没有医嘱。从上方共享规格中选一款药，记录您自己的服用方法。</p>
          </div>
        ) : (
          profiles.map(profile => {
            const drug = specById.get(profile.drugId);
            const pillUnit = drug?.pillUnit || '粒';
            return (
              <div key={profile.id} className="card flex-between" style={{ padding: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px', color: 'var(--color-text-primary)' }}>
                    {drug?.name ?? '（规格已删除）'}
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                    <span>
                      用法：<strong style={{ color: 'var(--color-accent)' }}>{profile.frequency ? frequencyShortLabel(profile.frequency) : '每日总量'}，每次 {formatDosage(profile.dosePerTime || profile.dailyDosage)} {pillUnit}</strong>
                    </span>
                    {profile.timingInstruction && (
                      <span>{TIMING_INSTRUCTION_LABELS[profile.timingInstruction]}</span>
                    )}
                    {profile.doseWeekdays && profile.doseWeekdays.length > 0 && (
                      <span>{profile.doseWeekdays.map(day => WEEKDAY_LABELS[day]).join(' / ')}</span>
                    )}
                    {profile.doseAnchorDate && (
                      <span>自 {profile.doseAnchorDate} 起隔日</span>
                    )}
                    {profile.doseTimes && profile.doseTimes.length > 0 && (
                      <span>{profile.doseTimes.join(' / ')} 服用</span>
                    )}
                    {!(profile.doseTimes && profile.doseTimes.length > 0) && profile.doseSlots && profile.doseSlots.length > 0 && (
                      <span>{profile.doseSlots.map(slot => DOSE_SLOT_LABELS[slot]).join(' / ')}</span>
                    )}
                    <span style={{ color: 'var(--color-text-tertiary)' }}>
                      日均消耗 {formatDosage(profile.dailyDosage)} {pillUnit}
                    </span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>
                      余量不足 {formatDosage(profile.alertThresholdDays)} 天时预警
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '12px' }}>
                  <button className="btn" style={{ width: '100%', minWidth: '130px' }} onClick={() => openInstructionForm(profile)}>修改医嘱</button>
                  <button className="btn btn-danger" style={{ width: '100%', minWidth: '130px' }} onClick={() => onDeleteProfile(profile.id)}>删除医嘱</button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
