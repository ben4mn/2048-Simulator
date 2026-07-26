import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../authStore';
import { authApi } from '../../services/authApi';

const user = { id: 'u1', username: 'ben', isAdmin: false, keys: { anthropic: false, openai: false } };

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'unknown', error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refresh() sets status "authed" and stores the user when a session exists', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue(user);
    await useAuthStore.getState().refresh();
    expect(useAuthStore.getState().status).toBe('authed');
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('refresh() sets status "anon" (no user, no error) when there is no session', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue(null);
    await useAuthStore.getState().refresh();
    expect(useAuthStore.getState().status).toBe('anon');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('refresh() degrades to "anon" without surfacing an error when the backend is unreachable', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('Could not reach the server'));
    await useAuthStore.getState().refresh();
    expect(useAuthStore.getState().status).toBe('anon');
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('login() success sets user + status "authed"', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(user);
    const ok = await useAuthStore.getState().login('ben', 'password123');
    expect(ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('authed');
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('login() failure surfaces the error message and returns false without changing status', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Invalid username or password.'));
    const ok = await useAuthStore.getState().login('ben', 'wrong');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBe('Invalid username or password.');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('register() success authenticates the new user', async () => {
    vi.spyOn(authApi, 'register').mockResolvedValue(user);
    const ok = await useAuthStore.getState().register('ben', 'password123');
    expect(ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('authed');
  });

  it('register() failure surfaces the error', async () => {
    vi.spyOn(authApi, 'register').mockRejectedValue(new Error('Username already taken'));
    const ok = await useAuthStore.getState().register('ben', 'password123');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBe('Username already taken');
  });

  it('logout() clears user/status even if the network call fails', async () => {
    useAuthStore.setState({ user, status: 'authed' });
    vi.spyOn(authApi, 'logout').mockRejectedValue(new Error('network down'));
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().status).toBe('anon');
  });

  it('putApiKey() success re-fetches the user via refresh()', async () => {
    useAuthStore.setState({ user, status: 'authed' });
    vi.spyOn(authApi, 'putApiKey').mockResolvedValue(undefined);
    const updatedUser = { ...user, keys: { ...user.keys, anthropic: true } };
    vi.spyOn(authApi, 'me').mockResolvedValue(updatedUser);

    const ok = await useAuthStore.getState().putApiKey('anthropic', 'sk-ant-test');
    expect(ok).toBe(true);
    expect(useAuthStore.getState().user).toEqual(updatedUser);
  });

  it('putApiKey() failure surfaces the error and returns false', async () => {
    vi.spyOn(authApi, 'putApiKey').mockRejectedValue(new Error('Key does not match provider format'));
    const ok = await useAuthStore.getState().putApiKey('openai', 'bad-key');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBe('Key does not match provider format');
  });

  it('deleteApiKey() success re-fetches the user via refresh()', async () => {
    useAuthStore.setState({ user, status: 'authed' });
    vi.spyOn(authApi, 'deleteApiKey').mockResolvedValue(undefined);
    const updatedUser = { ...user, keys: { ...user.keys, anthropic: false } };
    vi.spyOn(authApi, 'me').mockResolvedValue(updatedUser);

    const ok = await useAuthStore.getState().deleteApiKey('anthropic');
    expect(ok).toBe(true);
    expect(useAuthStore.getState().user).toEqual(updatedUser);
  });

  it('clearError() resets the error field', () => {
    useAuthStore.setState({ error: 'boom' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
