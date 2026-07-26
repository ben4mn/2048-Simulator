import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, AuthApiError } from '../authApi';

function mockFetchOnce(options: { ok: boolean; status?: number; jsonBody?: unknown; jsonThrows?: boolean }) {
  const { ok, jsonBody, jsonThrows, status = ok ? 200 : 400 } = options;
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: jsonThrows
      ? vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
      : vi.fn().mockResolvedValue(jsonBody),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const user = { id: 'u1', username: 'ben', isAdmin: false, keys: { anthropic: false, openai: false } };

describe('authApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('register posts credentials with credentials:"include" and returns the user', async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 201, jsonBody: { user } });

    const result = await authApi.register('ben', 'password123');

    expect(result).toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ username: 'ben', password: 'password123' }),
      })
    );
  });

  it('register surfaces a 409 conflict message', async () => {
    mockFetchOnce({ ok: false, status: 409, jsonBody: { error: 'Username already taken' } });
    await expect(authApi.register('ben', 'password123')).rejects.toMatchObject({
      message: 'Username already taken',
      status: 409,
    });
  });

  it('login returns the user on success', async () => {
    mockFetchOnce({ ok: true, jsonBody: { user } });
    const result = await authApi.login('ben', 'password123');
    expect(result).toEqual(user);
  });

  it('login surfaces a 401 message for bad credentials', async () => {
    mockFetchOnce({ ok: false, status: 401, jsonBody: { error: 'Invalid credentials' } });
    await expect(authApi.login('ben', 'wrong')).rejects.toMatchObject({
      message: 'Invalid credentials',
      status: 401,
    });
  });

  it('login surfaces a readable message on 429 rate limiting, even with a non-JSON body', async () => {
    mockFetchOnce({ ok: false, status: 429, jsonThrows: true });
    await expect(authApi.login('ben', 'password123')).rejects.toMatchObject({
      status: 429,
      message: expect.stringMatching(/too many attempts/i),
    });
  });

  it('logout posts and resolves on 204', async () => {
    mockFetchOnce({ ok: true, status: 204 });
    await expect(authApi.logout()).resolves.toBeUndefined();
  });

  it('me returns the user on 200', async () => {
    mockFetchOnce({ ok: true, jsonBody: { user } });
    await expect(authApi.me()).resolves.toEqual(user);
  });

  it('me returns null (not a throw) on 401', async () => {
    mockFetchOnce({ ok: false, status: 401, jsonBody: { error: 'Unauthorized' } });
    await expect(authApi.me()).resolves.toBeNull();
  });

  it('me rethrows non-401 errors', async () => {
    mockFetchOnce({ ok: false, status: 500, jsonBody: { error: 'Server exploded' } });
    await expect(authApi.me()).rejects.toMatchObject({ status: 500 });
  });

  it('a network-level failure surfaces a readable AuthApiError with status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    );
    await expect(authApi.me()).rejects.toBeInstanceOf(AuthApiError);
    await expect(authApi.me()).rejects.toMatchObject({ status: 0 });
  });

  it('putApiKey sends provider + apiKey and resolves on 204', async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 204 });
    await authApi.putApiKey('anthropic', 'sk-ant-test');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/api-key',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify({ provider: 'anthropic', apiKey: 'sk-ant-test' }),
      })
    );
  });

  it('putApiKey surfaces a 400 prefix-mismatch error', async () => {
    mockFetchOnce({ ok: false, status: 400, jsonBody: { error: 'Key does not match provider format' } });
    await expect(authApi.putApiKey('openai', 'sk-ant-wrong')).rejects.toMatchObject({
      message: 'Key does not match provider format',
      status: 400,
    });
  });

  it('deleteApiKey sends provider and resolves on 204', async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 204 });
    await authApi.deleteApiKey('openai');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/api-key',
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ provider: 'openai' }) })
    );
  });
});
