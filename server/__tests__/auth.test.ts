import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { extractSessionCookie, makeTestApp, registerUser, type TestApp } from './helpers.js';

describe('auth endpoints', () => {
  let t: TestApp;

  beforeEach(() => {
    t = makeTestApp();
  });

  afterEach(() => {
    t.cleanup();
  });

  describe('POST /api/auth/register', () => {
    it('creates a user, sets an httpOnly session cookie, returns 201 with user shape', async () => {
      const res = await request(t.app)
        .post('/api/auth/register')
        .send({ username: 'Alice_1', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user).toEqual({
        id: expect.any(Number),
        username: 'alice_1', // stored lowercase
        isAdmin: false,
        keys: { anthropic: false, openai: false },
      });
      const cookie = res.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toMatch(/^session=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      // http request in dev → no Secure flag, cookie works on localhost
      expect(cookie).not.toMatch(/Secure/);
    });

    it('rejects invalid usernames and short passwords with 400', async () => {
      for (const username of ['ab', 'a'.repeat(33), 'bad name', 'ütf', '']) {
        const res = await request(t.app)
          .post('/api/auth/register')
          .send({ username, password: 'password123' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeTruthy();
      }
      const shortPw = await request(t.app)
        .post('/api/auth/register')
        .send({ username: 'validname', password: 'short' });
      expect(shortPw.status).toBe(400);
    });

    it('rejects duplicate usernames case-insensitively with 409', async () => {
      await registerUser(t.app, 'dupuser');
      const res = await request(t.app)
        .post('/api/auth/register')
        .send({ username: 'DupUser', password: 'password123' });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials (case-insensitive username)', async () => {
      await registerUser(t.app, 'loginuser', 'hunter2hunter2');
      const res = await request(t.app)
        .post('/api/auth/login')
        .send({ username: 'LoginUser', password: 'hunter2hunter2' });
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('loginuser');
      expect(extractSessionCookie(res.headers['set-cookie'])).toMatch(/^session=/);
    });

    it('returns 401 on wrong password and unknown user', async () => {
      await registerUser(t.app, 'loginuser2');
      const bad = await request(t.app)
        .post('/api/auth/login')
        .send({ username: 'loginuser2', password: 'wrongpassword' });
      expect(bad.status).toBe(401);
      const unknown = await request(t.app)
        .post('/api/auth/login')
        .send({ username: 'nosuchuser', password: 'password123' });
      expect(unknown.status).toBe(401);
    });
  });

  describe('GET /api/auth/me + logout', () => {
    it('returns the user with a valid cookie, 401 without', async () => {
      const cookie = await registerUser(t.app, 'meuser');
      const me = await request(t.app).get('/api/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(200);
      expect(me.body.user.username).toBe('meuser');

      const anon = await request(t.app).get('/api/auth/me');
      expect(anon.status).toBe(401);

      const garbage = await request(t.app)
        .get('/api/auth/me')
        .set('Cookie', 'session=not-a-jwt');
      expect(garbage.status).toBe(401);
    });

    it('logout returns 204 and clears the cookie', async () => {
      const cookie = await registerUser(t.app, 'byeuser');
      const res = await request(t.app).post('/api/auth/logout').set('Cookie', cookie);
      expect(res.status).toBe(204);
      const cleared = res.headers['set-cookie']?.[0] ?? '';
      expect(cleared).toMatch(/^session=;/);
    });
  });

  it('admin seeding: seeds on boot, re-hashes when password changes, reports env keys', async () => {
    const admin = makeTestApp({
      overrides: {
        adminUsername: 'ben',
        adminPassword: 'adminpass123',
        anthropicApiKey: 'sk-ant-env-key',
      },
    });
    try {
      const login = await request(admin.app)
        .post('/api/auth/login')
        .send({ username: 'ben', password: 'adminpass123' });
      expect(login.status).toBe(200);
      expect(login.body.user.isAdmin).toBe(true);
      // Admin key flags reflect server env keys, not stored keys.
      expect(login.body.user.keys).toEqual({ anthropic: true, openai: false });

      // Reboot with a changed password against the same DATA_DIR → re-hash.
      admin.db.close();
      const rebooted = makeTestApp({
        overrides: {
          dataDir: admin.dataDir,
          adminUsername: 'ben',
          adminPassword: 'newadminpass456',
        },
      });
      const relogin = await request(rebooted.app)
        .post('/api/auth/login')
        .send({ username: 'ben', password: 'newadminpass456' });
      expect(relogin.status).toBe(200);
      const oldPw = await request(rebooted.app)
        .post('/api/auth/login')
        .send({ username: 'ben', password: 'adminpass123' });
      expect(oldPw.status).toBe(401);
      rebooted.db.close();
    } finally {
      admin.cleanup();
    }
  });

  it('rate limits login/register per IP with 429', async () => {
    const limited = makeTestApp({
      overrides: { authRateLimit: { windowMs: 60_000, max: 3 } },
    });
    try {
      // Shared bucket across register + login.
      for (let i = 0; i < 3; i++) {
        const res = await request(limited.app)
          .post('/api/auth/login')
          .send({ username: 'nobody', password: 'password123' });
        expect(res.status).toBe(401);
      }
      const fourth = await request(limited.app)
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'password123' });
      expect(fourth.status).toBe(429);
      expect(fourth.body.error).toBeTruthy();
    } finally {
      limited.cleanup();
    }
  });
});
