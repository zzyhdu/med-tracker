import type { DrugProfile, DrugSpec, DrugTracker } from './InventoryEngine';

export interface AuthUser {
  id: string;
  email: string;
}

interface SessionResponse {
  user: AuthUser | null;
}

interface LoginResponse {
  user: AuthUser;
}

interface DrugsResponse {
  drugs: DrugSpec[];
}

interface DrugResponse {
  drug: DrugSpec;
}

interface ProfilesResponse {
  profiles: DrugProfile[];
}

interface ProfileResponse {
  profile: DrugProfile;
}

interface TrackersResponse {
  trackers: DrugTracker[];
}

interface TrackerResponse {
  tracker: DrugTracker;
}

interface OkResponse {
  ok: boolean;
}

const GENERAL_INVENTORY_LOAD_ERROR_MESSAGE = '无法同步库存数据，请检查网络或稍后重试。';
const SESSION_EXPIRED_ERROR_MESSAGE = '登录已过期，请重新登录。';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function getInventoryLoadErrorMessage(error: unknown): string {
  if (isAuthenticationError(error)) return SESSION_EXPIRED_ERROR_MESSAGE;
  return GENERAL_INVENTORY_LOAD_ERROR_MESSAGE;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(payload?.error?.message || `Request failed with status ${response.status}`, response.status);
  }

  return payload as T;
}

export class ApiClient {
  static async getSession(): Promise<AuthUser | null> {
    const data = await request<SessionResponse>('/api/session');
    return data.user;
  }

  static async login(email: string, password: string): Promise<AuthUser> {
    const data = await request<LoginResponse>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return data.user;
  }

  static async logout(): Promise<boolean> {
    const data = await request<OkResponse>('/api/logout', { method: 'POST' });
    return data.ok;
  }

  static async listDrugs(): Promise<DrugSpec[]> {
    const data = await request<DrugsResponse>('/api/drugs');
    return data.drugs;
  }

  static async saveDrug(drug: DrugSpec): Promise<DrugSpec> {
    const data = await request<DrugResponse>(`/api/drugs/${encodeURIComponent(drug.id)}`, {
      method: 'PUT',
      body: JSON.stringify(drug),
    });
    return data.drug;
  }

  static async deleteDrug(drugId: string): Promise<boolean> {
    const data = await request<OkResponse>(`/api/drugs/${encodeURIComponent(drugId)}`, {
      method: 'DELETE',
    });
    return data.ok;
  }

  static async listProfiles(): Promise<DrugProfile[]> {
    const data = await request<ProfilesResponse>('/api/profiles');
    return data.profiles;
  }

  static async saveProfile(profile: DrugProfile): Promise<DrugProfile> {
    const data = await request<ProfileResponse>(`/api/profiles/${encodeURIComponent(profile.id)}`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
    return data.profile;
  }

  static async deleteProfile(profileId: string): Promise<boolean> {
    const data = await request<OkResponse>(`/api/profiles/${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
    });
    return data.ok;
  }

  static async listTrackers(): Promise<DrugTracker[]> {
    const data = await request<TrackersResponse>('/api/trackers');
    return data.trackers;
  }

  static async saveTracker(tracker: DrugTracker): Promise<DrugTracker> {
    const data = await request<TrackerResponse>(`/api/trackers/${encodeURIComponent(tracker.profileId)}`, {
      method: 'PUT',
      body: JSON.stringify(tracker),
    });
    return data.tracker;
  }

  static async deleteTracker(profileId: string): Promise<boolean> {
    const data = await request<OkResponse>(`/api/trackers/${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
    });
    return data.ok;
  }
}
