/**
 * Hand-rolled in-memory fixed-window rate limiter.
 *
 * SINGLE-PROCESS ASSUMPTION: buckets live in this process's memory. This app
 * deploys as one Node process in one container, so that is fine. If it is
 * ever scaled to multiple processes/replicas, limits would apply per process
 * and this module would need a shared store (e.g. SQLite or Redis).
 */
import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyFn: (req: Request) => string;
  message: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, keyFn, message } = options;
  const buckets = new Map<string, Bucket>();

  // Lazy cleanup so the map cannot grow unbounded between windows.
  let lastSweep = Date.now();
  function sweep(now: number): void {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    sweep(now);

    const key = keyFn(req);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}
