import config from '../../config.js';

const buckets = new Map();

export function checkRateLimit(userId, type = 'default') {
  const cfg = type === 'heavy' ? config.rateLimit.heavy : config.rateLimit.default;
  const limit = { max: cfg.maxRequests, windowMs: cfg.windowSeconds * 1000 };
  const now = Date.now();
  const key = `${userId}:${type}`;
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { limited: false };
  }
  if (bucket.count >= limit.max) {
    return { limited: true, retryIn: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { limited: false };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 5 * 60_000);
