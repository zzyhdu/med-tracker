import { describe, expect, it } from 'vitest';
import type { DrugProfile, DrugSpec, DrugTracker } from './InventoryEngine';
import {
  deleteDrugLocally,
  deleteProfileLocally,
  deleteTrackerLocally,
  upsertDrug,
  upsertProfile,
  upsertTracker,
} from './stateUpdates';

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

describe('state update helpers', () => {
  it('updates an existing drug without mutating the previous list', () => {
    const previous = [drugA];
    const updatedDrug = { ...drugA, name: '阿莫西林（胶囊）' };

    const next = upsertDrug(previous, updatedDrug);

    expect(next).toEqual([updatedDrug]);
    expect(previous).toEqual([drugA]);
  });

  it('updates an existing profile without mutating the previous list', () => {
    const previous = [profileA];
    const updatedProfile = { ...profileA, dailyDosage: 3 };

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

  it('removes a drug together with its profiles and trackers', () => {
    const next = deleteDrugLocally([drugA], [profileA, profileB], [trackerA, trackerB], 'da');

    expect(next).toEqual({ drugs: [], profiles: [profileB], trackers: [trackerB] });
  });

  it('removes a profile and its tracker locally', () => {
    const next = deleteProfileLocally([profileA, profileB], [trackerA, trackerB], 'pa');

    expect(next).toEqual({ profiles: [profileB], trackers: [trackerB] });
  });

  it('removes one tracker locally', () => {
    const next = deleteTrackerLocally([trackerA, trackerB], 'pa');

    expect(next).toEqual([trackerB]);
  });
});
