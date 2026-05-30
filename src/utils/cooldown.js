/**
 * Per-user cooldown tracker (separate from rate limiter).
 * Used for commands that always hit the API regardless of cache.
 */
const cooldowns = new Map(); // `userId:command` → lastUsedAt (ms)

/**
 * Check if a user is on cooldown for a specific command.
 * @param {string} userId
 * @param {string} command
 * @param {number} cooldownMs - cooldown duration in ms
 * @returns {{ onCooldown: boolean, remainingMs: number }}
 */
export function checkCooldown(userId, command, cooldownMs) {
  const key = `${userId}:${command}`;
  const last = cooldowns.get(key) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < cooldownMs) {
    return { onCooldown: true, remainingMs: cooldownMs - elapsed };
  }
  cooldowns.set(key, Date.now());
  return { onCooldown: false, remainingMs: 0 };
}

// Clean up entries older than 24h every hour
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, ts] of cooldowns.entries()) {
    if (ts < cutoff) cooldowns.delete(key);
  }
}, 60 * 60 * 1000);
