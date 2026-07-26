/**
 * Server configuration.
 *
 * Secrets policy:
 * - In production (NODE_ENV=production) the server REFUSES to start unless
 *   JWT_SECRET and KEY_ENCRYPTION_SECRET are set and at least 32 chars long.
 * - In development, missing secrets are replaced with random ephemeral values
 *   and a loud warning is printed (sessions/stored keys won't survive restarts).
 */
import crypto from 'node:crypto';
import path from 'node:path';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface AppConfig {
  port: number;
  dataDir: string;
  isProduction: boolean;
  jwtSecret: string;
  keyEncryptionSecret: string;
  adminUsername?: string;
  adminPassword?: string;
  /** Server-side provider keys, used ONLY for the admin user. */
  anthropicApiKey?: string;
  openaiApiKey?: string;
  /** Directory of the built SPA to serve (may not exist in dev/tests). */
  distDir: string;
  /** Login + register: per-IP. */
  authRateLimit: RateLimitConfig;
  /** AI proxy: per-user. */
  aiRateLimit: RateLimitConfig;
}

const MIN_SECRET_LENGTH = 32;

function resolveSecret(
  name: string,
  value: string | undefined,
  isProduction: boolean
): string {
  if (value && value.length >= MIN_SECRET_LENGTH) {
    return value;
  }
  if (isProduction) {
    // Never print the value itself, only which variable is at fault.
    throw new Error(
      `${name} must be set and at least ${MIN_SECRET_LENGTH} characters long in production. ` +
        `Generate one with: openssl rand -hex 32`
    );
  }
  console.warn(
    `\n[2048-simulator] *** WARNING *** ${name} is ${value ? 'too short' : 'not set'}; ` +
      `using a random EPHEMERAL development secret. ` +
      `Sessions and encrypted API keys will NOT survive a server restart. ` +
      `Set ${name} in .env (openssl rand -hex 32) to silence this warning.\n`
  );
  return crypto.randomBytes(32).toString('hex');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === 'production';
  const dataDir =
    env.DATA_DIR || (isProduction ? '/data' : path.resolve(process.cwd(), 'data'));

  return {
    port: Number(env.PORT) || 3000,
    dataDir,
    isProduction,
    jwtSecret: resolveSecret('JWT_SECRET', env.JWT_SECRET, isProduction),
    keyEncryptionSecret: resolveSecret(
      'KEY_ENCRYPTION_SECRET',
      env.KEY_ENCRYPTION_SECRET,
      isProduction
    ),
    adminUsername: env.ADMIN_USERNAME,
    adminPassword: env.ADMIN_PASSWORD,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    distDir: env.DIST_DIR || path.resolve(process.cwd(), 'dist'),
    authRateLimit: { windowMs: 15 * 60 * 1000, max: 20 },
    aiRateLimit: { windowMs: 60 * 60 * 1000, max: 10 },
  };
}
