/**
 * Express app factory. Kept separate from index.ts so tests can build an app
 * against a temp DATA_DIR without binding a port.
 */
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import type { AppConfig } from './config.js';
import { createDb, type AppDb, type Provider } from './db.js';
import { deriveVaultKey, encryptSecret, decryptSecret } from './keyVault.js';
import {
  clearSessionCookie,
  createRequireAuth,
  setSessionCookie,
  signSession,
  userToJson,
  type AuthedRequest,
} from './auth.js';
import { createRateLimiter } from './rateLimit.js';
import { callProvider, ProviderError } from './aiProxy.js';

const USERNAME_RE = /^[a-z0-9_-]{3,32}$/i;
const PROVIDERS: readonly Provider[] = ['anthropic', 'openai'];
const BCRYPT_ROUNDS = 10;

function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value);
}

/** Requires a positive provider-prefix match (per docs/api-contract.md). */
function keyPrefixError(provider: Provider, apiKey: string): string | null {
  if (provider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
    return apiKey.startsWith('sk-')
      ? 'This looks like an OpenAI API key. Anthropic keys start with "sk-ant-".'
      : 'Anthropic API keys start with "sk-ant-".';
  }
  if (provider === 'openai' && (!apiKey.startsWith('sk-') || apiKey.startsWith('sk-ant-'))) {
    return apiKey.startsWith('sk-ant-')
      ? 'This looks like an Anthropic API key (starts with "sk-ant-"), not an OpenAI key.'
      : 'OpenAI API keys start with "sk-".';
  }
  return null;
}

export interface App2048 {
  app: express.Express;
  db: AppDb;
}

export function createApp(config: AppConfig): App2048 {
  const db = createDb(config.dataDir);
  const vaultKey = deriveVaultKey(config.keyEncryptionSecret);

  if (config.adminUsername && config.adminPassword) {
    db.seedAdmin(config.adminUsername, config.adminPassword);
  }

  const app = express();
  app.set('trust proxy', 1); // behind nginx-proxy-manager; honors X-Forwarded-Proto
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  const requireAuth = createRequireAuth(config, db);

  const authLimiter = createRateLimiter({
    ...config.authRateLimit,
    keyFn: (req) => req.ip ?? 'unknown',
    message: 'Too many attempts. Please try again later.',
  });
  const aiLimiter = createRateLimiter({
    ...config.aiRateLimit,
    keyFn: (req) => `user:${(req as AuthedRequest).user?.id ?? 'anon'}`,
    message: 'AI generation limit reached (10 per hour). Please try again later.',
  });

  // ---- Auth ----------------------------------------------------------------

  app.post('/api/auth/register', authLimiter, (req: Request, res: Response) => {
    const { username, password } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      res.status(400).json({
        error: 'Username must be 3-32 characters using only letters, numbers, "_" or "-".',
      });
      return;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }
    if (db.getUserByUsername(username)) {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }
    const user = db.createUser(username, bcrypt.hashSync(password, BCRYPT_ROUNDS));
    setSessionCookie(config, req, res, signSession(config.jwtSecret, user.id));
    res.status(201).json({ user: userToJson(config, db, user) });
  });

  app.post('/api/auth/login', authLimiter, (req: Request, res: Response) => {
    const { username, password } = (req.body ?? {}) as Record<string, unknown>;
    const user =
      typeof username === 'string' && typeof password === 'string'
        ? db.getUserByUsername(username)
        : undefined;
    if (!user || !bcrypt.compareSync(password as string, user.password_hash)) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }
    setSessionCookie(config, req, res, signSession(config.jwtSecret, user.id));
    res.json({ user: userToJson(config, db, user) });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: userToJson(config, db, req.user!) });
  });

  // ---- API keys ------------------------------------------------------------

  app.put('/api/account/api-key', requireAuth, (req: AuthedRequest, res: Response) => {
    const { provider, apiKey } = (req.body ?? {}) as Record<string, unknown>;
    if (!isProvider(provider)) {
      res.status(400).json({ error: 'provider must be "anthropic" or "openai".' });
      return;
    }
    if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 512) {
      res.status(400).json({ error: 'apiKey must be a non-empty string.' });
      return;
    }
    const prefixError = keyPrefixError(provider, apiKey);
    if (prefixError) {
      res.status(400).json({ error: prefixError });
      return;
    }
    db.upsertApiKey(req.user!.id, provider, encryptSecret(vaultKey, apiKey));
    res.status(204).end();
  });

  app.delete('/api/account/api-key', requireAuth, (req: AuthedRequest, res: Response) => {
    const { provider } = (req.body ?? {}) as Record<string, unknown>;
    if (!isProvider(provider)) {
      res.status(400).json({ error: 'provider must be "anthropic" or "openai".' });
      return;
    }
    db.deleteApiKey(req.user!.id, provider);
    res.status(204).end();
  });

  // ---- AI proxy ------------------------------------------------------------

  app.post(
    '/api/ai/generate-strategy',
    requireAuth,
    aiLimiter,
    async (req: AuthedRequest, res: Response) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (!description || description.length > 2000) {
        res.status(400).json({ error: 'description must be 1-2000 characters.' });
        return;
      }
      const provider: Provider = body.provider === undefined ? 'anthropic' : (body.provider as Provider);
      if (!isProvider(provider)) {
        res.status(400).json({ error: 'provider must be "anthropic" or "openai".' });
        return;
      }
      let model: string | undefined;
      if (body.model !== undefined) {
        if (typeof body.model !== 'string' || !body.model.trim() || body.model.length > 128) {
          res.status(400).json({ error: 'model must be a short string.' });
          return;
        }
        model = body.model.trim();
      }

      // Key resolution: admin → server env keys; others → their stored key.
      const user = req.user!;
      let apiKey: string | undefined;
      if (user.is_admin) {
        apiKey = provider === 'anthropic' ? config.anthropicApiKey : config.openaiApiKey;
      } else {
        const stored = db.getApiKey(user.id, provider);
        if (stored) {
          try {
            apiKey = decryptSecret(vaultKey, stored);
          } catch {
            res.status(500).json({
              error: 'Stored API key could not be decrypted. Please re-enter it.',
            });
            return;
          }
        }
      }
      if (!apiKey) {
        res.status(400).json({
          error: `No API key configured for ${provider}. ${
            user.is_admin
              ? 'Set the server environment key.'
              : 'Add your key under Account settings.'
          }`,
        });
        return;
      }

      try {
        const content = await callProvider(provider, apiKey, description, model);
        res.json({ content });
      } catch (error) {
        if (error instanceof ProviderError) {
          res.status(error.status).json({ error: error.message });
          return;
        }
        res.status(502).json({ error: 'AI provider request failed unexpectedly.' });
      }
    }
  );

  // ---- API 404 + error handling -------------------------------------------

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ---- Static SPA ----------------------------------------------------------

  const indexHtml = path.join(config.distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(config.distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          // Vite emits content-hashed filenames under /assets → cache forever.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    // SPA fallback for client-side routes.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  // JSON error handler (malformed JSON bodies, unexpected errors).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.status === 400 || err.name === 'SyntaxError') {
      res.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }
    console.error('[2048-simulator] Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, db };
}
