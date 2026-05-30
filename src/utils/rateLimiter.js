/**
 * Per-user rate limiter for slash commands.
 * Prevents users from spamming API-heavy commands.
 */

const buckets = new Map(); // userId → { count, resetAt }

const LIMITS = {
  default: { max: 5, windowMs: 10_000 },   // 5 per 10s for normal commands
  heavy:   { max: 2, windowMs: 15_000 },   // 2 per 15s for search/rankings
};

export function checkRateLimit(userId, type = 'default') {
  const limit = LIMITS[type] || LIMITS.default;
  const now = Date.now();
  const key = `${userId}:${type}`;
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { limited: false };
  }

  if (bucket.count >= limit.max) {
    const retryIn = Math.ceil((bucket.resetAt - now) / 1000);
    return { limited: true, retryIn };
  }

  bucket.count++;
  return { limited: false };
}

// Clean up old buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 5 * 60_000);
