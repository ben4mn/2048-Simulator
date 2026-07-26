/**
 * Auth API client — wraps the endpoints described in docs/api-contract.md.
 *
 * All requests use `credentials: 'include'` so the httpOnly session cookie
 * round-trips. Every method surfaces a readable error message (including a
 * dedicated 429 message) via AuthApiError rather than throwing raw
 * Response/JSON parsing failures.
 */

export type ApiKeyProvider = 'anthropic' | 'openai';

export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
  keys: {
    anthropic: boolean;
    openai: boolean;
  };
}

/** Thrown for any non-2xx response; `status` is 0 for network-level failures. */
export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  if (response.status === 429) {
    return 'Too many attempts. Please wait a bit before trying again.';
  }

  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
  } catch {
    // Body wasn't JSON — fall through to the generic message below.
  }

  return fallback;
}

async function request<T>(path: string, init: RequestInit, fallbackError: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'include' });
  } catch {
    throw new AuthApiError(
      'Could not reach the server. It may not be running — the app still works without an account.',
      0
    );
  }

  if (!response.ok) {
    throw new AuthApiError(await extractErrorMessage(response, fallbackError), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return undefined as T;
  }
}

export const authApi = {
  async register(username: string, password: string): Promise<AuthUser> {
    const { user } = await request<{ user: AuthUser }>(
      '/api/auth/register',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username, password }) },
      'Registration failed.'
    );
    return user;
  },

  async login(username: string, password: string): Promise<AuthUser> {
    const { user } = await request<{ user: AuthUser }>(
      '/api/auth/login',
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username, password }) },
      'Invalid username or password.'
    );
    return user;
  },

  async logout(): Promise<void> {
    await request<void>('/api/auth/logout', { method: 'POST' }, 'Logout failed.');
  },

  /** Returns null (rather than throwing) when there is no active session. */
  async me(): Promise<AuthUser | null> {
    try {
      const { user } = await request<{ user: AuthUser }>(
        '/api/auth/me',
        { method: 'GET' },
        'Failed to load account.'
      );
      return user;
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
  },

  async putApiKey(provider: ApiKeyProvider, apiKey: string): Promise<void> {
    await request<void>(
      '/api/account/api-key',
      { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ provider, apiKey }) },
      'Failed to save API key.'
    );
  },

  async deleteApiKey(provider: ApiKeyProvider): Promise<void> {
    await request<void>(
      '/api/account/api-key',
      { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ provider }) },
      'Failed to delete API key.'
    );
  },
};
