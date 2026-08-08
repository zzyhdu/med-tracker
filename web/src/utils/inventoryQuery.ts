import type { QueryClient } from '@tanstack/react-query';
import type { DrugProfile, DrugSpec, DrugTracker } from './InventoryEngine';
import {
  deleteDrugLocally,
  deleteProfileLocally,
  deleteTrackerLocally,
  upsertDrug,
  upsertProfile,
  upsertTracker,
} from './stateUpdates';

export const inventoryQueryKeys = {
  drugs: ['drugs'] as const,
  profiles: ['profiles'] as const,
  trackers: ['trackers'] as const,
};

/**
 * 乐观更新的回滚机制：mutation 发起前快照三类缓存，
 * 失败时整体恢复，成功后由 invalidate 与后端对齐。
 */
export interface InventoryRollbackContext {
  previousDrugs: DrugSpec[];
  previousProfiles: DrugProfile[];
  previousTrackers: DrugTracker[];
}

export function getInventoryRollbackContext(queryClient: QueryClient): InventoryRollbackContext {
  return {
    previousDrugs: queryClient.getQueryData<DrugSpec[]>(inventoryQueryKeys.drugs) ?? [],
    previousProfiles: queryClient.getQueryData<DrugProfile[]>(inventoryQueryKeys.profiles) ?? [],
    previousTrackers: queryClient.getQueryData<DrugTracker[]>(inventoryQueryKeys.trackers) ?? [],
  };
}

export function restoreInventoryRollbackContext(
  queryClient: QueryClient,
  context: InventoryRollbackContext,
) {
  queryClient.setQueryData(inventoryQueryKeys.drugs, context.previousDrugs);
  queryClient.setQueryData(inventoryQueryKeys.profiles, context.previousProfiles);
  queryClient.setQueryData(inventoryQueryKeys.trackers, context.previousTrackers);
}

export function saveDrugOptimistically(queryClient: QueryClient, drug: DrugSpec) {
  queryClient.setQueryData<DrugSpec[]>(inventoryQueryKeys.drugs, currentDrugs => (
    upsertDrug(currentDrugs ?? [], drug)
  ));
}

export function deleteDrugOptimistically(queryClient: QueryClient, drugId: string) {
  const previousDrugs = queryClient.getQueryData<DrugSpec[]>(inventoryQueryKeys.drugs) ?? [];
  const previousProfiles = queryClient.getQueryData<DrugProfile[]>(inventoryQueryKeys.profiles) ?? [];
  const previousTrackers = queryClient.getQueryData<DrugTracker[]>(inventoryQueryKeys.trackers) ?? [];
  const next = deleteDrugLocally(previousDrugs, previousProfiles, previousTrackers, drugId);

  queryClient.setQueryData(inventoryQueryKeys.drugs, next.drugs);
  queryClient.setQueryData(inventoryQueryKeys.profiles, next.profiles);
  queryClient.setQueryData(inventoryQueryKeys.trackers, next.trackers);
}

export function saveProfileOptimistically(queryClient: QueryClient, profile: DrugProfile) {
  queryClient.setQueryData<DrugProfile[]>(inventoryQueryKeys.profiles, currentProfiles => (
    upsertProfile(currentProfiles ?? [], profile)
  ));
}

export function deleteProfileOptimistically(queryClient: QueryClient, profileId: string) {
  const previousProfiles = queryClient.getQueryData<DrugProfile[]>(inventoryQueryKeys.profiles) ?? [];
  const previousTrackers = queryClient.getQueryData<DrugTracker[]>(inventoryQueryKeys.trackers) ?? [];
  const next = deleteProfileLocally(previousProfiles, previousTrackers, profileId);

  queryClient.setQueryData(inventoryQueryKeys.profiles, next.profiles);
  queryClient.setQueryData(inventoryQueryKeys.trackers, next.trackers);
}

export function saveTrackerOptimistically(queryClient: QueryClient, tracker: DrugTracker) {
  queryClient.setQueryData<DrugTracker[]>(inventoryQueryKeys.trackers, currentTrackers => (
    upsertTracker(currentTrackers ?? [], tracker)
  ));
}

export function deleteTrackerOptimistically(queryClient: QueryClient, profileId: string) {
  queryClient.setQueryData<DrugTracker[]>(inventoryQueryKeys.trackers, currentTrackers => (
    deleteTrackerLocally(currentTrackers ?? [], profileId)
  ));
}

export function invalidateInventoryQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.drugs });
  queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.profiles });
  queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.trackers });
}
