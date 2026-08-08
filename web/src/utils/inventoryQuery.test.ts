import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import type { DrugProfile, DrugSpec, DrugTracker } from './InventoryEngine';
import {
  deleteDrugOptimistically,
  deleteProfileOptimistically,
  deleteTrackerOptimistically,
  getInventoryRollbackContext,
  inventoryQueryKeys,
  invalidateInventoryQueries,
  saveDrugOptimistically,
  saveProfileOptimistically,
  saveTrackerOptimistically,
} from './inventoryQuery';

const drugA: DrugSpec = {
  id: 'da',
  createdBy: 'u1',
  name: '阿莫西林',
  packagingSize: 24,
  packagingUnit: '盒',
  pillUnit: '粒',
};

const profileA: DrugProfile = {
  id: 'pa',
  drugId: 'da',
  dailyDosage: 1,
  alertThresholdDays: 7,
};

const profileB: DrugProfile = {
  id: 'pb',
  drugId: 'db',
  dailyDosage: 2,
  alertThresholdDays: 14,
};

const trackerA: DrugTracker = {
  profileId: 'pa',
  baseInventory: 10,
  baseDate: '2026-01-01T00:00:00.000Z',
};

const trackerB: DrugTracker = {
  profileId: 'pb',
  baseInventory: 20,
  baseDate: '2026-01-01T00:00:00.000Z',
};

function createQueryClientStub(initial: {
  drugs?: DrugSpec[];
  profiles?: DrugProfile[];
  trackers?: DrugTracker[];
}) {
  const cache = new Map<string, unknown>();
  cache.set(JSON.stringify(inventoryQueryKeys.drugs), initial.drugs);
  cache.set(JSON.stringify(inventoryQueryKeys.profiles), initial.profiles);
  cache.set(JSON.stringify(inventoryQueryKeys.trackers), initial.trackers);

  return {
    cache,
    client: {
      getQueryData: vi.fn((key: unknown[]) => cache.get(JSON.stringify(key))),
      setQueryData: vi.fn((key: unknown[], valueOrUpdater: unknown) => {
        const cacheKey = JSON.stringify(key);
        const current = cache.get(cacheKey);
        const next = typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (current: unknown) => unknown)(current)
          : valueOrUpdater;
        cache.set(cacheKey, next);
      }),
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient,
  };
}

describe('inventory query helpers', () => {
  it('captures drug, profile and tracker rollback context from the query cache', () => {
    const { client } = createQueryClientStub({ drugs: [drugA], profiles: [profileA], trackers: [trackerA] });

    expect(getInventoryRollbackContext(client)).toEqual({
      previousDrugs: [drugA],
      previousProfiles: [profileA],
      previousTrackers: [trackerA],
    });
  });

  it('optimistically saves a drug in the query cache', () => {
    const { client, cache } = createQueryClientStub({ drugs: [drugA] });
    const updatedDrug = { ...drugA, name: '阿莫西林（胶囊）' };

    saveDrugOptimistically(client, updatedDrug);

    expect(cache.get(JSON.stringify(inventoryQueryKeys.drugs))).toEqual([updatedDrug]);
  });

  it('optimistically deletes a drug with its profiles and trackers', () => {
    const { client, cache } = createQueryClientStub({
      drugs: [drugA],
      profiles: [profileA, profileB],
      trackers: [trackerA, trackerB],
    });

    deleteDrugOptimistically(client, 'da');

    expect(cache.get(JSON.stringify(inventoryQueryKeys.drugs))).toEqual([]);
    expect(cache.get(JSON.stringify(inventoryQueryKeys.profiles))).toEqual([profileB]);
    expect(cache.get(JSON.stringify(inventoryQueryKeys.trackers))).toEqual([trackerB]);
  });

  it('optimistically saves a profile in the query cache', () => {
    const { client, cache } = createQueryClientStub({ profiles: [profileA] });
    const updatedProfile = { ...profileA, dailyDosage: 3 };

    saveProfileOptimistically(client, updatedProfile);

    expect(cache.get(JSON.stringify(inventoryQueryKeys.profiles))).toEqual([updatedProfile]);
  });

  it('optimistically deletes a profile and its tracker in the query cache', () => {
    const { client, cache } = createQueryClientStub({ profiles: [profileA, profileB], trackers: [trackerA, trackerB] });

    deleteProfileOptimistically(client, 'pa');

    expect(cache.get(JSON.stringify(inventoryQueryKeys.profiles))).toEqual([profileB]);
    expect(cache.get(JSON.stringify(inventoryQueryKeys.trackers))).toEqual([trackerB]);
  });

  it('optimistically saves and deletes trackers in the query cache', () => {
    const { client, cache } = createQueryClientStub({ trackers: [trackerA] });
    const updatedTracker = { ...trackerA, baseInventory: 15 };

    saveTrackerOptimistically(client, updatedTracker);
    expect(cache.get(JSON.stringify(inventoryQueryKeys.trackers))).toEqual([updatedTracker]);

    deleteTrackerOptimistically(client, 'pa');
    expect(cache.get(JSON.stringify(inventoryQueryKeys.trackers))).toEqual([]);
  });

  it('invalidates all inventory queries', () => {
    const { client } = createQueryClientStub({});

    invalidateInventoryQueries(client);

    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: inventoryQueryKeys.drugs });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: inventoryQueryKeys.profiles });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: inventoryQueryKeys.trackers });
  });
});
