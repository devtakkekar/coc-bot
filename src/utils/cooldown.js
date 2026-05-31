import config from '../../config.js';

const cooldowns = new Map();

export function checkCooldown(userId, command, overrideMs = null) {
  // Allow per-call override, otherwise pull from config
  let cooldownMs = overrideMs;
  if (!cooldownMs) {
    if (command === 'warattacks')       cooldownMs = config.cooldowns.warAttacksMinutes * 60_000;
    else if (command === 'warrefresh_btn')  cooldownMs = config.cooldowns.warRefreshButtonSeconds * 1000;
    else if (command === 'raidsrefresh_btn') cooldownMs = config.cooldowns.raidRefreshButtonSeconds * 1000;
    else cooldownMs = 60_000; // fallback 1 min
  }

  const key = `${userId}:${command}`;
  const last = cooldowns.get(key) || 0;
  const elapsed = Date.now() - last;

  if (elapsed < cooldownMs) {
    return { onCooldown: true, remainingMs: cooldownMs - elapsed };
  }
  cooldowns.set(key, Date.now());
  return { onCooldown: false, remainingMs: 0 };
}

setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, ts] of cooldowns.entries()) {
    if (ts < cutoff) cooldowns.delete(key);
  }
}, 60 * 60 * 1000);
