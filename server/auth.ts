/**
 * Session auth: httpOnly JWT cookie `session`, 30-day expiry, SameSite=Lax.
 * `secure` is set when running in production AND the request arrived over
 * https (the app sits behind nginx-proxy-manager with `trust proxy` enabled,
 * so req.secure honors X-Forwarded-Proto). Plain http://localhost dev works
 * because the flag is simply omitted there.
 */
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AppConfig } from './config.js';
import type { AppDb, Provider, UserRow } from './db.js';

export const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AuthedRequest extends Request {
  user?: UserRow;
}

export function signSession(jwtSecret: string, userId: number): string {
  return jwt.sign({ sub: String(userId) }, jwtSecret, {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export function setSessionCookie(
  config: AppConfig,
  req: Request,
  res: Response,
  token: string
): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction && req.secure,
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export function verifySession(jwtSecret: string, token: string): number | null {
  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload === 'object' && typeof payload.sub === 'string') {
      const id = Number(payload.sub);
      if (Number.isInteger(id)) return id;
    }
  } catch {
    // invalid/expired token
  }
  return null;
}

export function createRequireAuth(config: AppConfig, db: AppDb) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    const userId = token ? verifySession(config.jwtSecret, token) : null;
    const user = userId !== null ? db.getUserById(userId) : undefined;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    req.user = user;
    next();
  };
}

/**
 * Public `user` shape. NEVER include key material — only booleans indicating
 * whether a key is available per provider. For the admin these reflect the
 * server env keys (the admin always uses those); for everyone else, their
 * stored (encrypted) keys.
 */
export function userToJson(config: AppConfig, db: AppDb, user: UserRow) {
  let keys: Record<Provider, boolean>;
  if (user.is_admin) {
    keys = {
      anthropic: Boolean(config.anthropicApiKey),
      openai: Boolean(config.openaiApiKey),
    };
  } else {
    const providers = db.getKeyProviders(user.id);
    keys = {
      anthropic: providers.includes('anthropic'),
      openai: providers.includes('openai'),
    };
  }
  return {
    id: user.id,
    username: user.username,
    isAdmin: Boolean(user.is_admin),
    keys,
  };
}
