// DB-backed rate limiter for authenticated API routes.
// In PG mode: persists across restarts and works across multiple instances.
// In mock mode: falls back to in-process Map (soft throttle, resets on restart).

import { isPgMode, getPool } from './pg';

interface RateEntry { count: number; windowStart: number }
const buckets = new Map<string, Map<string, RateEntry>>();

function checkMemoryLimit(bucketId: string, userId: string, max: number, windowMs: number): boolean {
  if (!buckets.has(bucketId)) buckets.set(bucketId, new Map());
  const bucket = buckets.get(bucketId)!;
  const now = Date.now();
  const entry = bucket.get(userId) ?? { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) { entry.count = 0; entry.windowStart = now; }
  if (entry.count >= max) return false;
  entry.count += 1;
  bucket.set(userId, entry);
  return true;
}

/**
 * Returns true if the request should be allowed, false if rate-limited.
 * @param bucketId  Unique string identifying the limit bucket (e.g. 'agent.run')
 * @param userId    The authenticated user ID
 * @param max       Max requests allowed in the window
 * @param windowMs  Window length in milliseconds
 */
export async function checkRateLimit(bucketId: string, userId: string, max: number, windowMs: number): Promise<boolean> {
  if (!isPgMode()) return checkMemoryLimit(bucketId, userId, max, windowMs);
  try {
    const pool = getPool();
    const windowSecs = Math.ceil(windowMs / 1000);
    const { rows } = await pool.query<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM platform.rate_limit_hits
       WHERE bucket_id = $1 AND user_id = $2
         AND hit_at > now() - ($3 || ' seconds')::interval`,
      [bucketId, userId, windowSecs]
    );
    const cnt = rows[0]?.cnt ?? 0;
    if (cnt >= max) return false;
    pool.query(
      `INSERT INTO platform.rate_limit_hits (bucket_id, user_id) VALUES ($1, $2)`,
      [bucketId, userId]
    ).catch(() => {});
    return true;
  } catch {
    return true; // fail open on DB error
  }
}
