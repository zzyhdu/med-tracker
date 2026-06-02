import { describe, expect, it } from 'vitest';
import { ApiError, getInventoryLoadErrorMessage, isAuthenticationError } from './apiClient';

describe('ApiError', () => {
  it('keeps the HTTP status with the error message', () => {
    const error = new ApiError('Authentication required', 401);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Authentication required');
    expect(error.status).toBe(401);
    expect(error.name).toBe('ApiError');
  });
});

describe('isAuthenticationError', () => {
  it('detects 401 API errors', () => {
    expect(isAuthenticationError(new ApiError('Authentication required', 401))).toBe(true);
  });

  it('does not treat non-401 errors as authentication failures', () => {
    expect(isAuthenticationError(new ApiError('Internal server error', 500))).toBe(false);
    expect(isAuthenticationError(new Error('Authentication required'))).toBe(false);
  });
});

describe('getInventoryLoadErrorMessage', () => {
  it('returns a session-expired message for authentication failures', () => {
    expect(getInventoryLoadErrorMessage(new ApiError('Authentication required', 401))).toBe('登录已过期，请重新登录。');
  });

  it('returns a general sync failure message for other API failures', () => {
    expect(getInventoryLoadErrorMessage(new ApiError('Internal server error', 500))).toBe('无法同步库存数据，请检查网络或稍后重试。');
  });

  it('returns a general sync failure message for unknown failures', () => {
    expect(getInventoryLoadErrorMessage(new Error('network failed'))).toBe('无法同步库存数据，请检查网络或稍后重试。');
  });
});
