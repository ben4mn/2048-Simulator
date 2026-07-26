/**
 * Zustand store for account/auth state.
 *
 * Deliberately separate from gameStore: auth is optional and orthogonal to
 * simulation state, and keeping it isolated means a backend that isn't
 * running yet (common in dev, since the backend is built concurrently)
 * never blocks the rest of the app. `refresh()` degrades to status 'anon'
 * with no error surfaced on any auth failure — the account features simply
 * become unavailable, the simulator stays fully usable.
 */

import { create } from 'zustand';
import { authApi, type ApiKeyProvider, type AuthUser } from '../services/authApi';

export type AuthStatus = 'unknown' | 'loading' | 'authed' | 'anon';

interface AuthStore {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;

  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  putApiKey: (provider: ApiKeyProvider, apiKey: string) => Promise<boolean>;
  deleteApiKey: (provider: ApiKeyProvider) => Promise<boolean>;
  clearError: () => void;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  status: 'unknown',
  error: null,

  refresh: async () => {
    set({ status: 'loading' });
    try {
      const user = await authApi.me();
      set({ user, status: user ? 'authed' : 'anon', error: null });
    } catch {
      // Backend unreachable or a transient error: fall back to anonymous,
      // non-blocking. The rest of the app must remain fully usable.
      set({ user: null, status: 'anon', error: null });
    }
  },

  login: async (username, password) => {
    set({ error: null });
    try {
      const user = await authApi.login(username, password);
      set({ user, status: 'authed', error: null });
      return true;
    } catch (error) {
      set({ error: errorMessage(error, 'Login failed.') });
      return false;
    }
  },

  register: async (username, password) => {
    set({ error: null });
    try {
      const user = await authApi.register(username, password);
      set({ user, status: 'authed', error: null });
      return true;
    } catch (error) {
      set({ error: errorMessage(error, 'Registration failed.') });
      return false;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: clear local state regardless so the UI always reflects
      // "logged out", even if the network call failed.
    }
    set({ user: null, status: 'anon', error: null });
  },

  putApiKey: async (provider, apiKey) => {
    set({ error: null });
    try {
      await authApi.putApiKey(provider, apiKey);
      await get().refresh();
      return true;
    } catch (error) {
      set({ error: errorMessage(error, 'Failed to save API key.') });
      return false;
    }
  },

  deleteApiKey: async (provider) => {
    set({ error: null });
    try {
      await authApi.deleteApiKey(provider);
      await get().refresh();
      return true;
    } catch (error) {
      set({ error: errorMessage(error, 'Failed to delete API key.') });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
