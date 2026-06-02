import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import type { AuthUser } from './apiClient';
import { clearSessionQueries, sessionQueryKeys, setSessionUser } from './sessionQuery';
import { inventoryQueryKeys } from './inventoryQuery';

const user: AuthUser = {
  id: 'user-1',
  email: 'test@example.com',
};

function createQueryClientStub() {
  return {
    setQueryData: vi.fn(),
    removeQueries: vi.fn(),
  } as unknown as QueryClient;
}

describe('session query helpers', () => {
  it('stores the current session user in the query cache', () => {
    const queryClient = createQueryClientStub();

    setSessionUser(queryClient, user);

    expect(queryClient.setQueryData).toHaveBeenCalledWith(sessionQueryKeys.session, user);
  });

  it('stores null in the session cache when there is no logged-in user', () => {
    const queryClient = createQueryClientStub();

    setSessionUser(queryClient, null);

    expect(queryClient.setQueryData).toHaveBeenCalledWith(sessionQueryKeys.session, null);
  });

  it('clears session and private inventory query caches on logout', () => {
    const queryClient = createQueryClientStub();

    clearSessionQueries(queryClient);

    expect(queryClient.setQueryData).toHaveBeenCalledWith(sessionQueryKeys.session, null);
    expect(queryClient.removeQueries).toHaveBeenCalledWith({ queryKey: inventoryQueryKeys.profiles });
    expect(queryClient.removeQueries).toHaveBeenCalledWith({ queryKey: inventoryQueryKeys.trackers });
  });
});
