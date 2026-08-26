import type { RequestHandler } from 'express';
import { sendError } from '../utils/api-response.js';

const buckets = new Map<string, { startedAt: number; count: number }>();

export function rateLimit(name: string, windowMs: number, maxRequests: number): RequestHandler {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      if (buckets.size > 10000) {
        for (const [bucketKey, value] of buckets) {
          if (now - value.startedAt >= windowMs) buckets.delete(bucketKey);
        }
      }
      buckets.set(key, { startedAt: now, count: 1 });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      sendError(res, 'RATE_LIMITED', 'Too many requests; please try again later', 429);
      return;
    }
    next();
  };
}
