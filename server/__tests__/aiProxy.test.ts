import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  anthropicOkResponse,
  makeTestApp,
  openaiOkResponse,
  registerUser,
  type TestApp,
} from './helpers.js';

const USER_KEY = 'sk-ant-api03-user-stored-key';
const ADMIN_ENV_KEY = 'sk-ant-api03-admin-env-key';

describe('POST /api/ai/generate-strategy', () => {
  let t: TestApp;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    t = makeTestApp({
      overrides: {
        adminUsername: 'admin',
        adminPassword: 'adminpass123',
        anthropicApiKey: ADMIN_ENV_KEY,
      },
    });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    t.cleanup();
  });

  async function loginAdmin(): Promise<string> {
    const res = await request(t.app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'adminpass123' });
    return (res.headers['set-cookie']![0] as string).split(';')[0];
  }

  it('requires auth', async () => {
    const res = await request(t.app)
      .post('/api/ai/generate-strategy')
      .send({ description: 'corner strategy' });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates description length', async () => {
    const cookie = await registerUser(t.app, 'aiuser0');
    for (const description of ['', '   ', 'x'.repeat(2001)]) {
      const res = await request(t.app)
        .post('/api/ai/generate-strategy')
        .set('Cookie', cookie)
        .send({ description });
      expect(res.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 when a non-admin user has no stored key', async () => {
    const cookie = await registerUser(t.app, 'aiuser1');
    const res = await request(t.app)
      .post('/api/ai/generate-strategy')
      .set('Cookie', cookie)
      .send({ description: 'keep max tile in corner' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No API key configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the stored (decrypted) key for non-admin users — anthropic', async () => {
    const cookie = await registerUser(t.app, 'aiuser2');
    await request(t.app)
      .put('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'anthropic', apiKey: USER_KEY });

    fetchMock.mockResolvedValueOnce(anthropicOkResponse('{"strategyName":"X","rules":[]}'));
    const res = await request(t.app)
      .post('/api/ai/generate-strategy')
      .set('Cookie', cookie)
      .send({ description: 'keep max tile in corner' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ content: '{"strategyName":"X","rules":[]}' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(USER_KEY);
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBeUndefined();
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBe(2000);
    expect(body.model).toBe('claude-sonnet-5');
    expect(body.system).toContain('2048 game strategy designer');
    // The client-sent description is the only user-controlled content.
    expect(body.messages).toEqual([{ role: 'user', content: 'keep max tile in corner' }]);
  });

  it('uses the server env key for the admin user', async () => {
    const cookie = await loginAdmin();
    fetchMock.mockResolvedValueOnce(anthropicOkResponse('ok'));
    const res = await request(t.app)
      .post('/api/ai/generate-strategy')
      .set('Cookie', cookie)
      .send({ description: 'snake pattern' });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(ADMIN_ENV_KEY);
  });

  it('admin without env key for the provider gets 400', async () => {
    const cookie = await loginAdmin();
    const res = await request(t.app)
      .post('/api/ai/generate-strategy')
      .set('Cookie', cookie)
      .send({ description: 'snake pattern', provider: 'openai' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls OpenAI with json_object response format and capped tokens', async () => {
    const cookie = await registerUser(t.app, 'aiuser3');
    await request(t.app)
      .put('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'openai', apiKey: 'sk-openai-user-key' });

    fetchMock.mockResolvedValueOnce(openaiOkResponse('{"rules":[]}'));
    const res = await request(t.app)
      .post('/api/ai/generate-strategy')
      .set('Cookie', cookie)
      .send({ description: 'merge greedily', provider: 'openai', model: 'gpt-5' });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('{"rules":[]}');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-openai-user-key');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-5');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.max_completion_tokens).toBe(2000);
    expect(body.messages[0].role).toBe('system');
  });

  it('surfaces provider errors as readable 502s, with model-retired hint on 404', async () => {
    const cookie = await loginAdmin();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'model not found' } }), {
        status: 404,
      })
    );
    const notFound = await request(t.app)
      .post('/api/ai/generate-strategy')
      .set('Cookie', cookie)
      .send({ description: 'test', model: 'claude-ancient-1' });
    expect(notFound.status).toBe(502);
    expect(notFound.body.error).toMatch(/retired/i);
    expect(notFound.body.error).toContain('claude-ancient-1');

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 529 })
    );
    const overloaded = await request(t.app)
      .post('/api/ai/generate-strategy')
      .set('Cookie', cookie)
      .send({ description: 'test' });
    expect(overloaded.status).toBe(502);
    expect(overloaded.body.error).toContain('overloaded');

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const network = await request(t.app)
      .post('/api/ai/generate-strategy')
      .set('Cookie', cookie)
      .send({ description: 'test' });
    expect(network.status).toBe(502);
    expect(network.body.error).toMatch(/Could not reach/i);
  });

  it('never leaks key material in AI responses or errors', async () => {
    const cookie = await loginAdmin();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'bad request' } }), { status: 400 })
    );
    const res = await request(t.app)
      .post('/api/ai/generate-strategy')
      .set('Cookie', cookie)
      .send({ description: 'test' });
    expect(res.text).not.toContain(ADMIN_ENV_KEY);
    expect(res.text).not.toContain(USER_KEY);
  });

  it('rate limits per user with 429', async () => {
    const limited = makeTestApp({
      overrides: { aiRateLimit: { windowMs: 60 * 60 * 1000, max: 2 } },
    });
    try {
      const cookieA = await registerUser(limited.app, 'limita');
      const cookieB = await registerUser(limited.app, 'limitb');
      // No stored keys → each request 400s, but still counts toward the limit.
      for (let i = 0; i < 2; i++) {
        const res = await request(limited.app)
          .post('/api/ai/generate-strategy')
          .set('Cookie', cookieA)
          .send({ description: 'test' });
        expect(res.status).toBe(400);
      }
      const third = await request(limited.app)
        .post('/api/ai/generate-strategy')
        .set('Cookie', cookieA)
        .send({ description: 'test' });
      expect(third.status).toBe(429);
      expect(third.body.error).toMatch(/limit/i);

      // Per-user, not global: another user is unaffected.
      const other = await request(limited.app)
        .post('/api/ai/generate-strategy')
        .set('Cookie', cookieB)
        .send({ description: 'test' });
      expect(other.status).toBe(400);
    } finally {
      limited.cleanup();
    }
  });
});
