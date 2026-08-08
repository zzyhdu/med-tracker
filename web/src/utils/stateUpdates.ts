import type { DrugProfile, DrugSpec, DrugTracker } from './InventoryEngine';

/**
 * 纯函数式的本地数组增删改，供 React Query 乐观更新使用。
 * 级联规则与后端外键 on delete cascade 对齐：
 * 删规格 → 连带所有引用它的医嘱与追踪；删医嘱 → 连带其追踪。
 */

export function upsertDrug(drugs: DrugSpec[], drug: DrugSpec): DrugSpec[] {
  const exists = drugs.some(item => item.id === drug.id);
  if (exists) return drugs.map(item => item.id === drug.id ? drug : item);
  return [...drugs, drug];
}

export function upsertProfile(profiles: DrugProfile[], profile: DrugProfile): DrugProfile[] {
  const exists = profiles.some(item => item.id === profile.id);
  if (exists) return profiles.map(item => item.id === profile.id ? profile : item);
  return [...profiles, profile];
}

export function upsertTracker(trackers: DrugTracker[], tracker: DrugTracker): DrugTracker[] {
  const exists = trackers.some(item => item.profileId === tracker.profileId);
  if (exists) return trackers.map(item => item.profileId === tracker.profileId ? tracker : item);
  return [...trackers, tracker];
}

export function deleteDrugLocally(
  drugs: DrugSpec[],
  profiles: DrugProfile[],
  trackers: DrugTracker[],
  drugId: string,
): { drugs: DrugSpec[]; profiles: DrugProfile[]; trackers: DrugTracker[] } {
  const removedProfileIds = new Set(
    profiles.filter(profile => profile.drugId === drugId).map(profile => profile.id),
  );
  return {
    drugs: drugs.filter(item => item.id !== drugId),
    profiles: profiles.filter(profile => !removedProfileIds.has(profile.id)),
    trackers: trackers.filter(tracker => !removedProfileIds.has(tracker.profileId)),
  };
}

export function deleteProfileLocally(
  profiles: DrugProfile[],
  trackers: DrugTracker[],
  profileId: string,
): { profiles: DrugProfile[]; trackers: DrugTracker[] } {
  return {
    profiles: profiles.filter(item => item.id !== profileId),
    trackers: trackers.filter(item => item.profileId !== profileId),
  };
}

export function deleteTrackerLocally(trackers: DrugTracker[], profileId: string): DrugTracker[] {
  return trackers.filter(item => item.profileId !== profileId);
}
