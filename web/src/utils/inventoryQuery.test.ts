import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import type { DrugProfile, DrugTracker } from './InventoryEngine';
import {
  deleteProfileOptimistically,
  deleteTrackerOptimistically,
  getInventoryRollbackContext,
  inventoryQueryKeys,
  invalidateInventoryQueries,
  saveProfileOptimistically,
  saveTrackerOptimistically,
} from './inventoryQuery';

const profileA: DrugProfile = {
  id: 'a',
  name: 'A',
  dailyDosage: 1,
  alertThresholdDays: 7,
};

const profileB: DrugProfile = {
  id: 'b',
  name: 'B',
  dailyDosage: 2,
  alertThresholdDays: 14,
};

const trackerA: DrugTracker = {
  drugId: 'a',
  baseInventory: 10,
  baseDate: '2026-01-01T00:00:00.000Z',
};

const trackerB: DrugTracker = {
  drugId: 'b',
  baseInventory: 20,
  baseDate: '2026-01-01T00:00:00.000Z',
};

function createQueryClientStub(initial: {
  profiles?: DrugProfile[];
  trackers?: DrugTracker[];
}) {
  const cache = new Map<string, unknown>();
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
  it('captures profile and tracker rollback context from the query cache', () => {
    const { client } = createQueryClientStub({ profiles: [profileA], trackers: [trackerA] });

    expect(getInventoryRollbackContext(client)).toEqual({
      previousProfiles: [profileA],
      previousTrackers: [trackerA],
    });
  });

  it('optimistically saves a profile in the query cache', () => {
    const { client, cache } = createQueryClientStub({ profiles: [profileA] });
    const updatedProfile = { ...profileA, name: 'A updated' };

    saveProfileOptimistically(client, updatedProfile);

    expect(cache.get(JSON.stringify(inventoryQueryKeys.profiles))).toEqual([updatedProfile]);
  });

  it('optimistically deletes a profile and its tracker in the query cache', () => {
    const { client, cache } = createQueryClientStub({ profiles: [profileA, profileB], trackers: [trackerA, trackerB] });

    deleteProfileOptimistically(client, 'a');

    expect(cache.get(JSON.stringify(inventoryQueryKeys.profiles))).toEqual([profileB]);
    expect(cache.get(JSON.stringify(inventoryQueryKeys.trackers))).toEqual([trackerB]);
  });

  it('optimistically saves and deletes trackers in the query cache', () => {
    const { client, cache } = createQueryClientStub({ trackers: [trackerA] });
    const updatedTracker = { ...trackerA, baseInventory: 15 };

    saveTrackerOptimistically(client, updatedTracker);
    expect(cache.get(JSON.stringify(inventoryQueryKeys.trackers))).toEqual([updatedTracker]);

    deleteTrackerOptimistically(client, 'a');
    expect(cache.get(JSON.stringify(inventoryQueryKeys.trackers))).toEqual([]);
  });

  it('invalidates both inventory queries', () => {
    const { client } = createQueryClientStub({});

    invalidateInventoryQueries(client);

    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: inventoryQueryKeys.profiles });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: inventoryQueryKeys.trackers });
  });
});
