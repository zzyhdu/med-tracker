import { useState, useEffect } from 'react';
import { InventoryEngine } from './utils/InventoryEngine';
import type { DrugProfile, DrugTracker, CalculatedInventory } from './utils/InventoryEngine';
import { StorageUtils } from './utils/StorageUtils';
import { InventoryDashboard } from './components/InventoryDashboard';
import { DrugLibraryPanel } from './components/DrugLibraryPanel';
import { TrackerForm } from './components/TrackerForm';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library'>('dashboard');

  const [profiles, setProfiles] = useState<DrugProfile[]>([]);
  const [trackers, setTrackers] = useState<DrugTracker[]>([]);

  const [showAddTrackerForm, setShowAddTrackerForm] = useState(false);
  const [editingTracker, setEditingTracker] = useState<CalculatedInventory | null>(null);

  useEffect(() => {
    setProfiles(StorageUtils.loadProfiles());
    setTrackers(StorageUtils.loadTrackers());
  }, []);

  useEffect(() => {
    if (profiles.length > 0 || localStorage.getItem('med-profiles')) {
      StorageUtils.saveProfiles(profiles);
    }
  }, [profiles]);

  useEffect(() => {
    if (trackers.length > 0 || localStorage.getItem('med-trackers')) {
      StorageUtils.saveTrackers(trackers);
    }
  }, [trackers]);

  const handleSaveProfile = (p: DrugProfile) => {
    setProfiles(prev => {
      const exists = prev.find(x => x.id === p.id);
      if (exists) return prev.map(x => x.id === p.id ? p : x);
      return [...prev, p];
    });
  };

  const handleDeleteProfile = (id: string) => {
    setProfiles(prev => prev.filter(x => x.id !== id));
    setTrackers(prev => prev.filter(t => t.drugId !== id)); // cascading clear
  };

  const handleSaveTracker = (t: DrugTracker) => {
    setTrackers(prev => {
      const exists = prev.find(x => x.drugId === t.drugId);
      if (exists) return prev.map(x => x.drugId === t.drugId ? t : x);
      return [...prev, t];
    });
    setShowAddTrackerForm(false);
    setEditingTracker(null);
  };

  const handleDeleteTracker = (drugId: string) => {
    setTrackers(prev => prev.filter(t => t.drugId !== drugId));
  };

  const handleQuickAdjustTracker = (tracker: DrugTracker, currentInv: number, adjustment: number) => {
    const updated = InventoryEngine.recalibrate(tracker, currentInv + adjustment);
    setTrackers(prev => prev.map(t => t.drugId === tracker.drugId ? updated : t));
  };

  return (
    <>
      <header style={{ marginBottom: '16px' }}>
        <h1 style={{ color: 'var(--color-text-primary)'}}>专业药物管家架构板</h1>
        
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', margin: '16px 0', paddingBottom: '16px' }}>
          <button 
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : ''}`} 
            style={{flex: 1, boxShadow: 'none'}}
            onClick={() => setActiveTab('dashboard')}
          >
            实时库存动态
          </button>
          <button 
            className={`btn ${activeTab === 'library' ? 'btn-primary' : ''}`} 
            style={{flex: 1, boxShadow: 'none'}}
            onClick={() => setActiveTab('library')}
          >
            标准规格配置库
          </button>
        </div>
      </header>

      <main>
        {activeTab === 'dashboard' && (
          <>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>全自动推算，一处配制处处生效</p>
              {!showAddTrackerForm && !editingTracker && (
                <button className="btn btn-primary" onClick={() => {
                  if (profiles.length === 0) {
                    alert('字典库是空的！请先去【配置库】添加基础药物字典！');
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
                profiles={profiles}
                onSave={handleSaveTracker} 
                onCancel={() => setShowAddTrackerForm(false)} 
              />
            ) : editingTracker ? (
              <TrackerForm 
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
