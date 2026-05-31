import { useState, useEffect } from 'react';
import { InventoryEngine } from './utils/InventoryEngine';
import type { DrugProfile, DrugTracker, CalculatedInventory } from './utils/InventoryEngine';
import { ApiClient } from './utils/apiClient';
import type { AuthUser } from './utils/apiClient';
import { CloudStorageUtils } from './utils/StorageUtils';
import { InventoryDashboard } from './components/InventoryDashboard';
import { DrugLibraryPanel } from './components/DrugLibraryPanel';
import { TrackerForm } from './components/TrackerForm';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

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
        <LoginForm onLogin={setUser} />
      </div>
    );
  }

  return <MainApp onLogout={handleLogout} />;
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

function MainApp({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library'>('dashboard');

  const [profiles, setProfiles] = useState<DrugProfile[]>([]);
  const [trackers, setTrackers] = useState<DrugTracker[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddTrackerForm, setShowAddTrackerForm] = useState(false);
  const [editingTracker, setEditingTracker] = useState<CalculatedInventory | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [loadedProfiles, loadedTrackers] = await Promise.all([
        CloudStorageUtils.loadProfiles(),
        CloudStorageUtils.loadTrackers()
      ]);
      setProfiles(loadedProfiles);
      setTrackers(loadedTrackers);
      setLoading(false);
    }
    loadData();
  }, []);

  const handleSaveProfile = async (p: DrugProfile) => {
    setProfiles(prev => {
      const exists = prev.find(x => x.id === p.id);
      if (exists) return prev.map(x => x.id === p.id ? p : x);
      return [...prev, p];
    });
    await CloudStorageUtils.saveProfile(p);
  };

  const handleDeleteProfile = async (id: string) => {
    setProfiles(prev => prev.filter(x => x.id !== id));
    setTrackers(prev => prev.filter(t => t.drugId !== id));
    await CloudStorageUtils.deleteProfile(id);
  };

  const handleSaveTracker = async (t: DrugTracker) => {
    setTrackers(prev => {
      const exists = prev.find(x => x.drugId === t.drugId);
      if (exists) return prev.map(x => x.drugId === t.drugId ? t : x);
      return [...prev, t];
    });
    setShowAddTrackerForm(false);
    setEditingTracker(null);
    await CloudStorageUtils.saveTracker(t);
  };

  const handleDeleteTracker = async (drugId: string) => {
    setTrackers(prev => prev.filter(t => t.drugId !== drugId));
    await CloudStorageUtils.deleteTracker(drugId);
  };

  const handleQuickAdjustTracker = async (tracker: DrugTracker, currentInv: number, adjustment: number) => {
    const updated = InventoryEngine.recalibrate(tracker, currentInv + adjustment);
    setTrackers(prev => prev.map(t => t.drugId === tracker.drugId ? updated : t));
    await CloudStorageUtils.saveTracker(updated);
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
                    alert('字典库是空的！请先去【字典库】添加基础药物字典！');
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
    </>
  );
}

function LoginForm({ onLogin }: { onLogin: (user: AuthUser) => void }) {
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
      alert(message === 'Invalid email or password' ? '密码或账号错误！请检查输入' : message);
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
