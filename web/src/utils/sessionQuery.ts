import type { QueryClient } from '@tanstack/react-query';
import type { AuthUser } from './apiClient';
import { inventoryQueryKeys } from './inventoryQuery';

export const sessionQueryKeys = {
  session: ['session'] as const,
};

export function setSessionUser(queryClient: QueryClient, user: AuthUser | null) {
  queryClient.setQueryData(sessionQueryKeys.session, user);
}

export function clearSessionQueries(queryClient: QueryClient) {
  setSessionUser(queryClient, null);
  queryClient.removeQueries({ queryKey: inventoryQueryKeys.profiles });
  queryClient.removeQueries({ queryKey: inventoryQueryKeys.trackers });
}
