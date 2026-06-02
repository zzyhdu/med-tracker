import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InventoryEngine } from './utils/InventoryEngine';
import type { DrugProfile, DrugTracker, CalculatedInventory } from './utils/InventoryEngine';
import { ApiClient } from './utils/apiClient';
import type { AuthUser } from './utils/apiClient';
import {
  deleteProfileOptimistically,
  deleteTrackerOptimistically,
  getInventoryRollbackContext,
  inventoryQueryKeys,
  restoreInventoryRollbackContext,
  saveProfileOptimistically,
  saveTrackerOptimistically,
} from './utils/inventoryQuery';
import { createToast } from './utils/toast';
import type { ToastMessage, ToastTone } from './utils/toast';
import { InventoryDashboard } from './components/InventoryDashboard';
import { DrugLibraryPanel } from './components/DrugLibraryPanel';
import { TrackerForm } from './components/TrackerForm';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, tone: ToastTone = 'info') => {
    const nextToast = createToast(message, tone);
    setToast(nextToast);
    window.setTimeout(() => {
      setToast(currentToast => currentToast?.id === nextToast.id ? null : currentToast);
    }, 4000);
  };

  useEffect(() => {
    let mounted = true;

    ApiClient.getSession()
      .then(currentUser => {
        if (mounted) setUser(currentUser);
      })
      .catch(error => {
        console.error('Error checking session:', error);
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setCheckingSession(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await ApiClient.logout();
    setUser(null);
  };

  if (checkingSession) {
    return <LoadingScreen text="正在校验本地安全会话..." />;
  }

  if (!user) {
    return (
      <div style={{ maxWidth: '400px', margin: '60px auto', padding: '32px', background: 'var(--color-bg)', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--color-text-primary)' }}>云端医疗保险柜</h1>
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: '32px', fontSize: '0.9rem' }}>底层已接入私有后端会话与数据库隔离。<br /><br />请输入您的通信口令：</p>
        <LoginForm onLogin={setUser} onError={message => showToast(message, 'error')} />
        <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
      </div>
    );
  }

  return <MainApp onLogout={handleLogout} onNotify={showToast} toast={toast} onDismissToast={() => setToast(null)} />;
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
  onLogout: () => void;
  onNotify: (message: string, tone?: ToastTone) => void;
  toast: ToastMessage | null;
  onDismissToast: () => void;
}

function MainApp({ onLogout, onNotify, toast, onDismissToast }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library'>('dashboard');
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: inventoryQueryKeys.profiles,
    queryFn: ApiClient.listProfiles,
  });

  const trackersQuery = useQuery({
    queryKey: inventoryQueryKeys.trackers,
    queryFn: ApiClient.listTrackers,
  });

  const profiles = profilesQuery.data ?? [];
  const trackers = trackersQuery.data ?? [];
  const loading = profilesQuery.isLoading || trackersQuery.isLoading;

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
      setShowAddTrackerForm(!context?.previousTrackers.some(previousTracker => previousTracker.drugId === tracker.drugId));
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

  const handleDeleteProfile = (id: string) => {
    deleteProfileMutation.mutate(id);
  };

  const handleSaveTracker = (t: DrugTracker) => {
    setShowAddTrackerForm(false);
    setEditingTracker(null);
    saveTrackerMutation.mutate(t);
  };

  const handleDeleteTracker = (drugId: string) => {
    deleteTrackerMutation.mutate(drugId);
  };

  const handleQuickAdjustTracker = (tracker: DrugTracker, currentInv: number, adjustment: number) => {
    const updated = InventoryEngine.recalibrate(tracker, currentInv + adjustment);
    saveTrackerMutation.mutate(updated);
  };

  if (loading) {
    return <LoadingScreen text="正在建立高强加密链路，为您同步主数据库..." />;
  }

  return (
    <>
      <header style={{ marginBottom: '16px' }}>
        <div className="flex-between">
          <h1 style={{ color: 'var(--color-text-primary)' }}>私有医疗保险库</h1>
          <button className="btn" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={onLogout}>安全切网登出</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', margin: '16px 0', paddingBottom: '16px' }}>
          <button
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : ''}`}
            style={{ flex: 1, boxShadow: 'none' }}
            onClick={() => setActiveTab('dashboard')}
          >
            实时库存动态
          </button>
          <button
            className={`btn ${activeTab === 'library' ? 'btn-primary' : ''}`}
            style={{ flex: 1, boxShadow: 'none' }}
            onClick={() => setActiveTab('library')}
          >
            标准规格字典库
          </button>
        </div>
      </header>

      <main>
        {activeTab === 'dashboard' && (
          <>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>数据由私有后端与 PostgreSQL 同步保护</p>
              {!showAddTrackerForm && !editingTracker && (
                <button className="btn btn-primary" onClick={() => {
                  if (profiles.length === 0) {
                    onNotify('字典库是空的！请先去【字典库】添加基础药物字典！', 'info');
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
                onSave={handleSaveTracker}
                onCancel={() => setShowAddTrackerForm(false)}
              />
            ) : editingTracker ? (
              <TrackerForm
                key={`edit-${editingTracker.drugId}`}
                profiles={profiles}
                initialData={editingTracker}
                onSave={handleSaveTracker}
                onCancel={() => setEditingTracker(null)}
              />
            ) : (
              <InventoryDashboard
                profiles={profiles}
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
            profiles={profiles}
            onSaveProfile={handleSaveProfile}
            onDeleteProfile={handleDeleteProfile}
          />
        )}
      </main>
      <ToastViewport toast={toast} onDismiss={onDismissToast} />
    </>
  );
}

function LoginForm({ onLogin, onError }: { onLogin: (user: AuthUser) => void; onError: (message: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await ApiClient.login(email, password);
      onLogin(loggedInUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败';
      onError(message === 'Invalid email or password' ? '密码或账号错误！请检查输入' : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="input-block" style={{ marginBottom: 0 }}>
        <label>邮箱账号</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="input-block" style={{ marginBottom: 0 }}>
        <label>通信密码</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
        {loading ? '校验握手中...' : '安全登入'}
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
