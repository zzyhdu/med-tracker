import type { QueryClient } from '@tanstack/react-query';
import type { DrugProfile, DrugTracker } from './InventoryEngine';
import {
  deleteProfileLocally,
  deleteTrackerLocally,
  upsertProfile,
  upsertTracker,
} from './stateUpdates';

export const inventoryQueryKeys = {
  profiles: ['profiles'] as const,
  trackers: ['trackers'] as const,
};

export interface InventoryRollbackContext {
  previousProfiles: DrugProfile[];
  previousTrackers: DrugTracker[];
}

export function getInventoryRollbackContext(queryClient: QueryClient): InventoryRollbackContext {
  return {
    previousProfiles: queryClient.getQueryData<DrugProfile[]>(inventoryQueryKeys.profiles) ?? [],
    previousTrackers: queryClient.getQueryData<DrugTracker[]>(inventoryQueryKeys.trackers) ?? [],
  };
}

export function restoreInventoryRollbackContext(
  queryClient: QueryClient,
  context: InventoryRollbackContext,
) {
  queryClient.setQueryData(inventoryQueryKeys.profiles, context.previousProfiles);
  queryClient.setQueryData(inventoryQueryKeys.trackers, context.previousTrackers);
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

export function deleteTrackerOptimistically(queryClient: QueryClient, drugId: string) {
  queryClient.setQueryData<DrugTracker[]>(inventoryQueryKeys.trackers, currentTrackers => (
    deleteTrackerLocally(currentTrackers ?? [], drugId)
  ));
}

export function invalidateInventoryQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.profiles });
  queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.trackers });
}
