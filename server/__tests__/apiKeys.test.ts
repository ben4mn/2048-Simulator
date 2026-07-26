import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { deriveVaultKey, decryptSecret, encryptSecret } from '../keyVault.js';
import { makeTestApp, registerUser, TEST_VAULT_SECRET, type TestApp } from './helpers.js';

const PLAINTEXT_KEY = 'sk-ant-api03-super-secret-key-material';

describe('API key vault', () => {
  let t: TestApp;
  let cookie: string;

  beforeEach(async () => {
    t = makeTestApp();
    cookie = await registerUser(t.app, 'keyuser');
  });

  afterEach(() => {
    t.cleanup();
  });

  it('requires auth on key endpoints', async () => {
    const put = await request(t.app)
      .put('/api/account/api-key')
      .send({ provider: 'anthropic', apiKey: PLAINTEXT_KEY });
    expect(put.status).toBe(401);
    const del = await request(t.app)
      .delete('/api/account/api-key')
      .send({ provider: 'anthropic' });
    expect(del.status).toBe(401);
  });

  it('stores keys encrypted (ciphertext differs from plaintext, decrypts back)', async () => {
    const res = await request(t.app)
      .put('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'anthropic', apiKey: PLAINTEXT_KEY });
    expect(res.status).toBe(204);

    const row = t.db.raw
      .prepare('SELECT encrypted_key FROM api_keys')
      .get() as { encrypted_key: string };
    expect(row.encrypted_key).not.toContain(PLAINTEXT_KEY);
    expect(row.encrypted_key).not.toBe(PLAINTEXT_KEY);

    const vaultKey = deriveVaultKey(TEST_VAULT_SECRET);
    expect(decryptSecret(vaultKey, row.encrypted_key)).toBe(PLAINTEXT_KEY);
  });

  it('roundtrips arbitrary secrets through the vault primitives', () => {
    const vaultKey = deriveVaultKey(TEST_VAULT_SECRET);
    const stored = encryptSecret(vaultKey, 'sk-abc123');
    expect(stored).not.toContain('sk-abc123');
    expect(decryptSecret(vaultKey, stored)).toBe('sk-abc123');
    // Wrong vault key must fail, not return garbage.
    const wrongKey = deriveVaultKey('w'.repeat(32));
    expect(() => decryptSecret(wrongKey, stored)).toThrow();
  });

  it('reflects stored keys as booleans in /me and supports delete', async () => {
    await request(t.app)
      .put('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'anthropic', apiKey: PLAINTEXT_KEY });

    let me = await request(t.app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.user.keys).toEqual({ anthropic: true, openai: false });

    const del = await request(t.app)
      .delete('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'anthropic' });
    expect(del.status).toBe(204);

    me = await request(t.app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.user.keys).toEqual({ anthropic: false, openai: false });
  });

  it('validates provider and key prefix', async () => {
    const badProvider = await request(t.app)
      .put('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'gemini', apiKey: 'whatever123' });
    expect(badProvider.status).toBe(400);

    // OpenAI key submitted as anthropic → 400
    const mismatch = await request(t.app)
      .put('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'anthropic', apiKey: 'sk-openai-style-key' });
    expect(mismatch.status).toBe(400);

    // Anthropic key submitted as openai → 400
    const mismatch2 = await request(t.app)
      .put('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'openai', apiKey: 'sk-ant-something' });
    expect(mismatch2.status).toBe(400);

    const emptyKey = await request(t.app)
      .put('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'openai', apiKey: '   ' });
    expect(emptyKey.status).toBe(400);

    // A key matching NEITHER provider's prefix must also be rejected —
    // the contract requires a positive prefix match, not just
    // cross-provider mismatch detection.
    for (const provider of ['anthropic', 'openai'] as const) {
      const noPrefix = await request(t.app)
        .put('/api/account/api-key')
        .set('Cookie', cookie)
        .send({ provider, apiKey: 'wrong-prefix-entirely' });
      expect(noPrefix.status).toBe(400);
    }
  });

  it('never leaks key material in any response', async () => {
    const put = await request(t.app)
      .put('/api/account/api-key')
      .set('Cookie', cookie)
      .send({ provider: 'anthropic', apiKey: PLAINTEXT_KEY });
    expect(JSON.stringify(put.body ?? {})).not.toContain(PLAINTEXT_KEY);
    expect(put.text ?? '').not.toContain(PLAINTEXT_KEY);

    const me = await request(t.app).get('/api/auth/me').set('Cookie', cookie);
    const meText = JSON.stringify(me.body);
    expect(meText).not.toContain(PLAINTEXT_KEY);
    expect(meText).not.toContain('sk-ant');
    // keys field is booleans only
    expect(typeof me.body.user.keys.anthropic).toBe('boolean');
  });
});
