// Shared in-process rate limiter for authenticated API routes.
// Keyed by userId so limits are per-user, not per-IP.
// The Map persists across requests in the same Node.js process
// but resets on server restart (acceptable for soft throttling).

interface RateEntry { count: number; windowStart: number }

const buckets = new Map<string, Map<string, RateEntry>>();

/**
 * Returns true if the request should be allowed, false if rate-limited.
 * @param bucketId  A unique string identifying the limit bucket (e.g. 'agent.run')
 * @param userId    The authenticated user ID
 * @param max       Max requests allowed in the window
 * @param windowMs  Window length in milliseconds
 */
export function checkRateLimit(bucketId: string, userId: string, max: number, windowMs: number): boolean {
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
