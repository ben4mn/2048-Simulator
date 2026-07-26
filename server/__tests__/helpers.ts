import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { createApp, type App2048 } from '../app.js';
import type { AppConfig } from '../config.js';

export const TEST_JWT_SECRET = 't'.repeat(32);
export const TEST_VAULT_SECRET = 'v'.repeat(32);

export interface TestAppOptions {
  overrides?: Partial<AppConfig>;
}

export interface TestApp extends App2048 {
  dataDir: string;
  cleanup: () => void;
}

export function makeTestApp(options: TestAppOptions = {}): TestApp {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), '2048-server-test-'));
  const config: AppConfig = {
    port: 0,
    dataDir,
    isProduction: false,
    jwtSecret: TEST_JWT_SECRET,
    keyEncryptionSecret: TEST_VAULT_SECRET,
    distDir: path.join(dataDir, 'no-dist'), // static serving off by default
    authRateLimit: { windowMs: 15 * 60 * 1000, max: 100 },
    aiRateLimit: { windowMs: 60 * 60 * 1000, max: 100 },
    ...options.overrides,
  };
  const built = createApp(config);
  return {
    ...built,
    dataDir,
    cleanup: () => {
      built.db.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Register a user and return the session cookie header value. */
export async function registerUser(
  app: Express,
  username: string,
  password = 'password123'
): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, password });
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return extractSessionCookie(res.headers['set-cookie']);
}

export function extractSessionCookie(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const session = cookies.find((c) => c.startsWith('session='));
  if (!session) throw new Error('No session cookie in response');
  return session.split(';')[0];
}

/** A fetch stub that mimics a successful Anthropic /v1/messages response. */
export function anthropicOkResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A fetch stub that mimics a successful OpenAI chat completions response. */
export function openaiOkResponse(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
