import type { DrugProfile, DrugTracker } from './InventoryEngine';

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
    throw new Error(payload?.error?.message || `Request failed with status ${response.status}`);
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
    const data = await request<TrackerResponse>(`/api/trackers/${encodeURIComponent(tracker.drugId)}`, {
      method: 'PUT',
      body: JSON.stringify(tracker),
    });
    return data.tracker;
  }

  static async deleteTracker(drugId: string): Promise<boolean> {
    const data = await request<OkResponse>(`/api/trackers/${encodeURIComponent(drugId)}`, {
      method: 'DELETE',
    });
    return data.ok;
  }
}
