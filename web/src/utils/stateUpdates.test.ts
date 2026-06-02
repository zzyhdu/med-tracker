import { describe, expect, it } from 'vitest';
import type { DrugProfile, DrugTracker } from './InventoryEngine';
import {
  deleteProfileLocally,
  deleteTrackerLocally,
  upsertProfile,
  upsertTracker,
} from './stateUpdates';

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

describe('state update helpers', () => {
  it('updates an existing profile without mutating the previous list', () => {
    const previous = [profileA];
    const updatedProfile = { ...profileA, name: 'A updated' };

    const next = upsertProfile(previous, updatedProfile);

    expect(next).toEqual([updatedProfile]);
    expect(previous).toEqual([profileA]);
  });

  it('adds a new tracker without mutating the previous list', () => {
    const previous = [trackerA];

    const next = upsertTracker(previous, trackerB);

    expect(next).toEqual([trackerA, trackerB]);
    expect(previous).toEqual([trackerA]);
  });

  it('removes a profile and its tracker locally', () => {
    const next = deleteProfileLocally([profileA, profileB], [trackerA, trackerB], 'a');

    expect(next).toEqual({ profiles: [profileB], trackers: [trackerB] });
  });

  it('removes one tracker locally', () => {
    const next = deleteTrackerLocally([trackerA, trackerB], 'a');

    expect(next).toEqual([trackerB]);
  });
});
