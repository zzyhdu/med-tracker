import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InventoryEngine } from './utils/InventoryEngine';
import type { DrugProfile, DrugSpec, DrugTracker, CalculatedInventory } from './utils/InventoryEngine';
import { ApiClient, getInventoryLoadErrorMessage, isAuthenticationError } from './utils/apiClient';
import type { ImportedDrug } from './utils/profileImport';
import { buildBackup, serializeBackup } from './utils/dataTransfer';
import type { BackupData } from './utils/dataTransfer';
import {
  deleteDrugOptimistically,
  deleteProfileOptimistically,
  deleteTrackerOptimistically,
  getInventoryRollbackContext,
  inventoryQueryKeys,
  restoreInventoryRollbackContext,
  saveDrugOptimistically,
  saveProfileOptimistically,
  saveTrackerOptimistically,
} from './utils/inventoryQuery';
import { createConfirmRequest } from './utils/confirmDialog';
import type { ConfirmRequest } from './utils/confirmDialog';
import { createToast } from './utils/toast';
import { clearSessionQueries, sessionQueryKeys, setSessionUser } from './utils/sessionQuery';
import type { ToastMessage, ToastTone } from './utils/toast';
import { InventoryDashboard } from './components/InventoryDashboard';
import { DrugLibraryPanel } from './components/DrugLibraryPanel';
import { TrackerForm } from './components/TrackerForm';
import { ActionsPage } from './components/ActionsPage';
import { SchedulePage } from './components/SchedulePage';

export default function App() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, tone: ToastTone = 'info') => {
    const nextToast = createToast(message, tone);
    setToast(nextToast);
    window.setTimeout(() => {
      setToast(currentToast => currentToast?.id === nextToast.id ? null : currentToast);
    }, 4000);
  };

  const sessionQuery = useQuery({
    queryKey: sessionQueryKeys.session,
    queryFn: ApiClient.getSession,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => ApiClient.login(email, password),
    onSuccess: loggedInUser => {
      setSessionUser(queryClient, loggedInUser);
    },
    onError: error => {
      const message = error instanceof Error ? error.message : '登录失败';
      showToast(message === 'Invalid email or password' ? '密码或账号错误！请检查输入' : message, 'error');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: ApiClient.logout,
    onSettled: () => {
      clearSessionQueries(queryClient);
    },
  });

  const handleLogin = (email: string, password: string) => {
    loginMutation.mutate({ email, password });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (sessionQuery.isLoading) {
    return <LoadingScreen text="正在加载..." />;
  }

  if (!sessionQuery.data) {
    return (
      <div style={{ maxWidth: '400px', margin: '60px auto', padding: '32px', background: 'var(--color-bg)', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--color-text-primary)' }}>用药助手</h1>
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: '32px', fontSize: '0.9rem' }}>请输入账号密码登录</p>
        <LoginForm onLogin={handleLogin} loading={loginMutation.isPending} />
        <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
      </div>
    );
  }

  return <MainApp userId={sessionQuery.data.id} onLogout={handleLogout} onNotify={showToast} toast={toast} onDismissToast={() => setToast(null)} />;
}

function LoadingScreen({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--color-text-secondary)', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-accent)', animation: 'spin 1s linear infinite' }}></div>
      {text}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

interface MainAppProps {
  userId: string;
  onLogout: () => void;
  onNotify: (message: string, tone?: ToastTone) => void;
  toast: ToastMessage | null;
  onDismissToast: () => void;
}

function MainApp({ userId, onLogout, onNotify, toast, onDismissToast }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<'actions' | 'schedule' | 'dashboard' | 'library'>('actions');
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const queryClient = useQueryClient();

  const drugsQuery = useQuery({
    queryKey: inventoryQueryKeys.drugs,
    queryFn: ApiClient.listDrugs,
  });

  const profilesQuery = useQuery({
    queryKey: inventoryQueryKeys.profiles,
    queryFn: ApiClient.listProfiles,
  });

  const trackersQuery = useQuery({
    queryKey: inventoryQueryKeys.trackers,
    queryFn: ApiClient.listTrackers,
  });

  const drugs = drugsQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];
  const trackers = trackersQuery.data ?? [];
  const loading = drugsQuery.isLoading || profilesQuery.isLoading || trackersQuery.isLoading;
  const loadError = drugsQuery.error ?? profilesQuery.error ?? trackersQuery.error;
  const sessionExpiredToastShown = useRef(false);

  useEffect(() => {
    if (!isAuthenticationError(loadError)) return;

    clearSessionQueries(queryClient);
    if (!sessionExpiredToastShown.current) {
      onNotify(getInventoryLoadErrorMessage(loadError), 'error');
      sessionExpiredToastShown.current = true;
    }
  }, [loadError, onNotify, queryClient]);

  const retryInventoryLoad = () => {
    drugsQuery.refetch();
    profilesQuery.refetch();
    trackersQuery.refetch();
  };

  const [showAddTrackerForm, setShowAddTrackerForm] = useState(false);
  const [editingTracker, setEditingTracker] = useState<CalculatedInventory | null>(null);

  const reportStorageFailure = (message: string) => {
    onNotify(message, 'error');
  };

  const saveProfileMutation = useMutation({
    mutationFn: ApiClient.saveProfile,
    onMutate: async (profile: DrugProfile) => {
      await queryClient.cancelQueries({ queryKey: inventoryQueryKeys.profiles });
      const context = getInventoryRollbackContext(queryClient);
      saveProfileOptimistically(queryClient, profile);
      return context;
    },
    onError: (_error, _profile, context) => {
      if (context) restoreInventoryRollbackContext(queryClient, context);
      reportStorageFailure('保存药品规格失败，已恢复到修改前的状态。请稍后重试。');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.profiles });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: ApiClient.deleteProfile,
    onMutate: async (profileId: string) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: inventoryQueryKeys.profiles }),
        queryClient.cancelQueries({ queryKey: inventoryQueryKeys.trackers }),
      ]);
      const context = getInventoryRollbackContext(queryClient);
      deleteProfileOptimistically(queryClient, profileId);
      return context;
    },
    onError: (_error, _profileId, context) => {
      if (context) restoreInventoryRollbackContext(queryClient, context);
      reportStorageFailure('删除药品规格失败，已恢复到删除前的状态。请稍后重试。');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.trackers });
    },
  });

  const saveDrugMutation = useMutation({
    mutationFn: ApiClient.saveDrug,
    onMutate: async (drug: DrugSpec) => {
      await queryClient.cancelQueries({ queryKey: inventoryQueryKeys.drugs });
      const context = getInventoryRollbackContext(queryClient);
      saveDrugOptimistically(queryClient, drug);
      return context;
    },
    onError: (_error, _drug, context) => {
      if (context) restoreInventoryRollbackContext(queryClient, context);
      reportStorageFailure('保存药物规格失败，已恢复到修改前的状态。请稍后重试。');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.drugs });
    },
  });

  const deleteDrugMutation = useMutation({
    mutationFn: ApiClient.deleteDrug,
    onMutate: async (drugId: string) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: inventoryQueryKeys.drugs }),
        queryClient.cancelQueries({ queryKey: inventoryQueryKeys.profiles }),
        queryClient.cancelQueries({ queryKey: inventoryQueryKeys.trackers }),
      ]);
      const context = getInventoryRollbackContext(queryClient);
      deleteDrugOptimistically(queryClient, drugId);
      return context;
    },
    onError: (error, _drugId, context) => {
      if (context) restoreInventoryRollbackContext(queryClient, context);
      const message = error instanceof Error && error.message === 'Drug is referenced by other users'
        ? '该规格正被其他用户的医嘱引用，无法删除。'
        : '删除药物规格失败，已恢复到删除前的状态。请稍后重试。';
      reportStorageFailure(message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.drugs });
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.trackers });
    },
  });

  const saveTrackerMutation = useMutation({
    mutationFn: ApiClient.saveTracker,
    onMutate: async (tracker: DrugTracker) => {
      await queryClient.cancelQueries({ queryKey: inventoryQueryKeys.trackers });
      const context = getInventoryRollbackContext(queryClient);
      saveTrackerOptimistically(queryClient, tracker);
      return context;
    },
    onError: (_error, tracker, context) => {
      if (context) restoreInventoryRollbackContext(queryClient, context);
      setShowAddTrackerForm(!context?.previousTrackers.some(previousTracker => previousTracker.profileId === tracker.profileId));
      setEditingTracker(null);
      reportStorageFailure('保存库存追踪失败，已恢复到修改前的状态。请稍后重试。');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.trackers });
    },
  });

  const deleteTrackerMutation = useMutation({
    mutationFn: ApiClient.deleteTracker,
    onMutate: async (drugId: string) => {
      await queryClient.cancelQueries({ queryKey: inventoryQueryKeys.trackers });
      const context = getInventoryRollbackContext(queryClient);
      deleteTrackerOptimistically(queryClient, drugId);
      return context;
    },
    onError: (_error, _drugId, context) => {
      if (context) restoreInventoryRollbackContext(queryClient, context);
      reportStorageFailure('停用库存追踪失败，已恢复到停用前的状态。请稍后重试。');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.trackers });
    },
  });

  const handleSaveProfile = (p: DrugProfile) => {
    saveProfileMutation.mutate(p);
  };

  const handleSaveDrug = (d: DrugSpec) => {
    saveDrugMutation.mutate(d);
  };

  const handleCopyDrug = async (drug: DrugSpec) => {
    try {
      await ApiClient.saveDrug({ ...drug, id: crypto.randomUUID(), createdBy: userId });
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.drugs });
      onNotify(`已复制「${drug.name}」为您的规格副本，可自由修改。`, 'success');
    } catch {
      reportStorageFailure('复制规格副本失败，请稍后重试。');
    }
  };

  const handleDeleteDrug = (id: string) => {
    const drug = drugs.find(item => item.id === id);
    setConfirmRequest(createConfirmRequest({
      title: '确认删除药物规格？',
      message: drug
        ? `将删除规格「${drug.name}」，您为它建立的医嘱与库存追踪会一并删除。若规格正被其他用户引用，后端会拒绝删除。`
        : '将删除该规格，您为它建立的医嘱与库存追踪会一并删除。',
      confirmLabel: '删除规格',
      onConfirm: () => deleteDrugMutation.mutate(id),
    }));
  };

  // 批量导入：规格按名字复用共享库（没有则以我的名义新建），医嘱按 drugId 幂等 upsert。
  // 逐条顺序执行且不用乐观更新，避免多条并发互相覆盖回滚快照。
  const [importing, setImporting] = useState(false);
  const handleImportProfiles = async (items: ImportedDrug[]) => {
    setImporting(true);
    const failed: string[] = [];
    const knownDrugs = [...drugs];
    for (const item of items) {
      try {
        let drug = knownDrugs.find(candidate => candidate.name === item.name);
        if (!drug) {
          drug = await ApiClient.saveDrug({
            id: crypto.randomUUID(),
            createdBy: userId,
            name: item.name,
            packagingSize: item.packagingSize,
            packagingUnit: item.packagingUnit,
            pillUnit: item.pillUnit,
          });
          knownDrugs.push(drug);
        }

        const existingProfile = profiles.find(candidate => candidate.drugId === drug.id);
        await ApiClient.saveProfile({
          id: existingProfile?.id ?? crypto.randomUUID(),
          drugId: drug.id,
          frequency: item.frequency,
          dosePerTime: item.dosePerTime,
          dailyDosage: item.dailyDosage,
          alertThresholdDays: item.alertThresholdDays,
          timingInstruction: item.timingInstruction,
          doseTimes: item.doseTimes,
          doseSlots: item.doseSlots,
          doseWeekdays: item.doseWeekdays,
          doseAnchorDate: item.doseAnchorDate,
        });
      } catch {
        failed.push(item.name);
      }
    }
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.drugs });
    queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.profiles });
    if (failed.length === 0) {
      onNotify(`成功导入 ${items.length} 条药品规格与医嘱。`, 'success');
    } else {
      onNotify(`导入完成：成功 ${items.length - failed.length} 条，失败 ${failed.length} 条（${failed[0]} 等）。`, 'error');
    }
  };

  // 备份导出：下载当前账号的完整数据快照（规格 + 医嘱 + 追踪），用于跨实例迁移
  const handleExportBackup = () => {
    const backup = buildBackup({ drugs, profiles, trackers, userId });
    const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    link.href = url;
    link.download = `med-tracker-backup-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onNotify(`已导出备份：规格 ${backup.drugs.length} 条、医嘱 ${backup.profiles.length} 条、追踪 ${backup.trackers.length} 条。`, 'success');
  };

  // 备份导入：与批量导入同源的策略 —— 规格按名字复用/新建，医嘱按药品覆盖，
  // 追踪挂在医嘱后（缺医嘱的追踪记为失败）。顺序执行，最后统一刷新。
  const handleImportBackup = async (data: BackupData) => {
    setImporting(true);
    const failed: string[] = [];
    const knownDrugs = [...drugs];
    const profileIdByDrugId = new Map(profiles.map(profile => [profile.drugId, profile.id]));

    for (const item of data.drugs) {
      try {
        let drug = knownDrugs.find(candidate => candidate.name === item.name);
        if (!drug) {
          drug = await ApiClient.saveDrug({
            id: crypto.randomUUID(),
            createdBy: userId,
            name: item.name,
            packagingSize: item.packagingSize,
            packagingUnit: item.packagingUnit,
            pillUnit: item.pillUnit,
          });
          knownDrugs.push(drug);
        }
      } catch {
        failed.push(`规格「${item.name}」`);
      }
    }

    for (const item of data.profiles) {
      const drug = knownDrugs.find(candidate => candidate.name === item.drugName);
      if (!drug) {
        failed.push(`医嘱「${item.drugName}」（规格缺失）`);
        continue;
      }
      try {
        const saved = await ApiClient.saveProfile({
          id: profileIdByDrugId.get(drug.id) ?? crypto.randomUUID(),
          drugId: drug.id,
          frequency: item.frequency,
          dosePerTime: item.dosePerTime,
          dailyDosage: item.dailyDosage,
          alertThresholdDays: item.alertThresholdDays,
          timingInstruction: item.timingInstruction,
          doseTimes: item.doseTimes,
          doseSlots: item.doseSlots,
          doseWeekdays: item.doseWeekdays,
          doseAnchorDate: item.doseAnchorDate,
        });
        profileIdByDrugId.set(drug.id, saved.id);
      } catch {
        failed.push(`医嘱「${item.drugName}」`);
      }
    }

    for (const item of data.trackers) {
      const drug = knownDrugs.find(candidate => candidate.name === item.drugName);
      const profileId = drug ? profileIdByDrugId.get(drug.id) : undefined;
      if (!profileId) {
        failed.push(`追踪「${item.drugName}」（缺少对应医嘱）`);
        continue;
      }
      try {
        await ApiClient.saveTracker({ profileId, baseInventory: item.baseInventory, baseDate: item.baseDate });
      } catch {
        failed.push(`追踪「${item.drugName}」`);
      }
    }

    setImporting(false);
    queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.drugs });
    queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.profiles });
    queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.trackers });
    const total = data.profiles.length + data.trackers.length;
    if (failed.length === 0) {
      onNotify(`备份导入完成：规格 ${data.drugs.length} 条、医嘱 ${data.profiles.length} 条、追踪 ${data.trackers.length} 条。`, 'success');
    } else {
      onNotify(`导入完成：${total - failed.length} 条成功，${failed.length} 条失败（${failed[0]} 等）。`, 'error');
    }
  };

  const handleDeleteProfile = (id: string) => {
    const profile = profiles.find(item => item.id === id);
    const drugName = profile ? drugs.find(item => item.id === profile.drugId)?.name : undefined;
    setConfirmRequest(createConfirmRequest({
      title: '确认删除医嘱？',
      message: drugName
        ? `将删除「${drugName}」的医嘱，并停用看板里同款药的追踪。共享规格不受影响。`
        : '将删除该医嘱，并停用看板里同款药的追踪。共享规格不受影响。',
      confirmLabel: '删除医嘱',
      onConfirm: () => deleteProfileMutation.mutate(id),
    }));
  };

  const handleSaveTracker = (t: DrugTracker) => {
    setShowAddTrackerForm(false);
    setEditingTracker(null);
    saveTrackerMutation.mutate(t);
  };

  const handleDeleteTracker = (profileId: string) => {
    const profile = profiles.find(item => item.id === profileId);
    const drugName = profile ? drugs.find(item => item.id === profile.drugId)?.name : undefined;
    setConfirmRequest(createConfirmRequest({
      title: '确认停用库存追踪？',
      message: drugName
        ? `将停止追踪「${drugName}」的库存。医嘱与共享规格都会保留。`
        : '将停止追踪该药品库存。医嘱与共享规格都会保留。',
      confirmLabel: '停用追踪',
      onConfirm: () => deleteTrackerMutation.mutate(profileId),
    }));
  };

  const handleQuickAdjustTracker = (tracker: DrugTracker, currentInv: number, adjustment: number) => {
    const updated = InventoryEngine.recalibrate(tracker, currentInv + adjustment);
    // recalibrate 会展开调用方传入的合并视图字段，落库前收敛回纯净的 tracker 形状
    saveTrackerMutation.mutate({
      profileId: updated.profileId,
      baseInventory: updated.baseInventory,
      baseDate: updated.baseDate,
    });
  };

  if (loading) {
    return <LoadingScreen text="正在加载..." />;
  }

  if (loadError && !isAuthenticationError(loadError)) {
    return (
      <>
        <InventoryErrorState message={getInventoryLoadErrorMessage(loadError)} onRetry={retryInventoryLoad} />
        <ToastViewport toast={toast} onDismiss={onDismissToast} />
      </>
    );
  }

  return (
    <>
      <header style={{ marginBottom: '16px' }}>
        <div className="flex-between">
          <h1 style={{ color: 'var(--color-text-primary)' }}>用药助手</h1>
          <button className="btn" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={onLogout}>退出登录</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', margin: '16px 0', paddingBottom: '16px' }}>
          <button
            className={`btn ${activeTab === 'actions' ? 'btn-primary' : ''}`}
            style={{ flex: 1, boxShadow: 'none' }}
            onClick={() => setActiveTab('actions')}
          >
            今日服药
          </button>
          <button
            className={`btn ${activeTab === 'schedule' ? 'btn-primary' : ''}`}
            style={{ flex: 1, boxShadow: 'none' }}
            onClick={() => setActiveTab('schedule')}
          >
            日程
          </button>
          <button
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : ''}`}
            style={{ flex: 1, boxShadow: 'none' }}
            onClick={() => setActiveTab('dashboard')}
          >
            库存
          </button>
          <button
            className={`btn ${activeTab === 'library' ? 'btn-primary' : ''}`}
            style={{ flex: 1, boxShadow: 'none' }}
            onClick={() => setActiveTab('library')}
          >
            规格库
          </button>
        </div>
      </header>

      <main>
        {activeTab === 'actions' && (
          <ActionsPage
            profiles={profiles}
            drugs={drugs}
            trackers={trackers}
            onQuickAdjust={handleQuickAdjustTracker}
          />
        )}

        {activeTab === 'schedule' && (
          <SchedulePage
            profiles={profiles}
            drugs={drugs}
            trackers={trackers}
          />
        )}

        {activeTab === 'dashboard' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              {!showAddTrackerForm && !editingTracker && (
                <button className="btn btn-primary" onClick={() => {
                  if (profiles.length === 0) {
                    onNotify('还没有医嘱，请先在「规格库」为您的药建立医嘱。', 'info');
                    setActiveTab('library');
                    return;
                  }
                  setShowAddTrackerForm(true)
                }}>
                  + 加入新追踪
                </button>
              )}
            </div>

            {showAddTrackerForm ? (
              <TrackerForm
                key="new-tracker"
                profiles={profiles}
                drugs={drugs}
                onSave={handleSaveTracker}
                onCancel={() => setShowAddTrackerForm(false)}
              />
            ) : editingTracker ? (
              <TrackerForm
                key={`edit-${editingTracker.profileId}`}
                profiles={profiles}
                drugs={drugs}
                initialData={editingTracker}
                onSave={handleSaveTracker}
                onCancel={() => setEditingTracker(null)}
              />
            ) : (
              <InventoryDashboard
                profiles={profiles}
                drugs={drugs}
                trackers={trackers}
                onRecalibrate={setEditingTracker}
                onDeleteTracker={handleDeleteTracker}
                onQuickAdjust={handleQuickAdjustTracker}
              />
            )}
          </>
        )}

        {activeTab === 'library' && (
          <DrugLibraryPanel
            drugs={drugs}
            profiles={profiles}
            currentUserId={userId}
            onSaveDrug={handleSaveDrug}
            onDeleteDrug={handleDeleteDrug}
            onCopyDrug={handleCopyDrug}
            onSaveProfile={handleSaveProfile}
            onDeleteProfile={handleDeleteProfile}
            onImportProfiles={handleImportProfiles}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            importing={importing}
          />
        )}
      </main>
      <ConfirmDialog
        request={confirmRequest}
        onCancel={() => setConfirmRequest(null)}
        onConfirm={() => {
          confirmRequest?.onConfirm();
          setConfirmRequest(null);
        }}
      />
      <ToastViewport toast={toast} onDismiss={onDismissToast} />
    </>
  );
}

function ConfirmDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!request) return null;

  return (
    <div className="confirm-backdrop" role="presentation">
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={`${request.id}-title`}>
        <h2 id={`${request.id}-title`}>{request.title}</h2>
        <p>{request.message}</p>
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={onCancel}>{request.cancelLabel}</button>
          <button
            type="button"
            className={`btn ${request.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card" style={{ maxWidth: '520px', margin: '60px auto', textAlign: 'center' }}>
      <h2 style={{ color: 'var(--color-text-primary)', marginBottom: '12px' }}>同步失败</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>{message}</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>重新加载</button>
    </div>
  );
}

interface LoginFormProps {
  onLogin: (email: string, password: string) => void;
  loading: boolean;
}

function LoginForm({ onLogin, loading }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="input-block" style={{ marginBottom: 0 }}>
        <label>邮箱</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="input-block" style={{ marginBottom: 0 }}>
        <label>密码</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  );
}

function ToastViewport({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  if (!toast) return null;

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      <div className={`toast toast-${toast.tone}`}>
        <span>{toast.message}</span>
        <button type="button" className="toast-close" aria-label="关闭提示" onClick={onDismiss}>×</button>
      </div>
    </div>
  );
}
