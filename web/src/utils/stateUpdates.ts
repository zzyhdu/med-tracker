import type { DrugProfile, DrugTracker } from './InventoryEngine';

export function upsertProfile(profiles: DrugProfile[], profile: DrugProfile): DrugProfile[] {
  const exists = profiles.some(item => item.id === profile.id);
  if (exists) return profiles.map(item => item.id === profile.id ? profile : item);
  return [...profiles, profile];
}

export function deleteProfileLocally(
  profiles: DrugProfile[],
  trackers: DrugTracker[],
  profileId: string,
): { profiles: DrugProfile[]; trackers: DrugTracker[] } {
  return {
    profiles: profiles.filter(item => item.id !== profileId),
    trackers: trackers.filter(item => item.drugId !== profileId),
  };
}

export function upsertTracker(trackers: DrugTracker[], tracker: DrugTracker): DrugTracker[] {
  const exists = trackers.some(item => item.drugId === tracker.drugId);
  if (exists) return trackers.map(item => item.drugId === tracker.drugId ? tracker : item);
  return [...trackers, tracker];
}

export function deleteTrackerLocally(trackers: DrugTracker[], drugId: string): DrugTracker[] {
  return trackers.filter(item => item.drugId !== drugId);
}
