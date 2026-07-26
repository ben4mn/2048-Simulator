import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../config.js';
import { makeTestApp, type TestApp } from './helpers.js';

describe('config secrets', () => {
  it('refuses to start in production without proper secrets', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() =>
      loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' })
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(32),
        KEY_ENCRYPTION_SECRET: 'short',
      })
    ).toThrow(/KEY_ENCRYPTION_SECRET/);
  });

  it('accepts proper production secrets', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      KEY_ENCRYPTION_SECRET: 'b'.repeat(32),
      PORT: '3123',
      DATA_DIR: '/data',
    });
    expect(config.port).toBe(3123);
    expect(config.dataDir).toBe('/data');
    expect(config.isProduction).toBe(true);
  });

  it('generates ephemeral dev secrets with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const config = loadConfig({ NODE_ENV: 'development' });
      expect(config.jwtSecret).toHaveLength(64);
      expect(config.keyEncryptionSecret).toHaveLength(64);
      expect(warn).toHaveBeenCalled();
      // Never log the generated secret values.
      const logged = warn.mock.calls.flat().join(' ');
      expect(logged).not.toContain(config.jwtSecret);
      expect(logged).not.toContain(config.keyEncryptionSecret);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('static SPA serving', () => {
  let t: TestApp;

  afterEach(() => {
    t.cleanup();
  });

  it('serves index.html fallback with no-cache and hashed assets immutable', async () => {
    // Build a fake dist in its own temp dir (outside the app's dataDir).
    const distDir = fs.mkdtempSync(path.join(os.tmpdir(), '2048-dist-test-'));
    fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>spa</body></html>');
    fs.writeFileSync(path.join(distDir, 'assets', 'index-abc123.js'), 'console.log(1)');
    t = makeTestApp({ overrides: { distDir } });

    const index = await request(t.app).get('/');
    expect(index.status).toBe(200);
    expect(index.headers['cache-control']).toBe('no-cache');
    expect(index.text).toContain('spa');

    const asset = await request(t.app).get('/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');

    // Client-side route falls back to index.html…
    const spaRoute = await request(t.app).get('/results/batch/42');
    expect(spaRoute.status).toBe(200);
    expect(spaRoute.text).toContain('spa');

    // …but unknown API routes stay JSON 404s.
    const api = await request(t.app).get('/api/nope');
    expect(api.status).toBe(404);
    expect(api.body).toEqual({ error: 'Not found' });
  });
});
