import { ActivityType } from 'discord.js';
import * as api from '../utils/cocApi.js';
import * as cache from '../utils/cache.js';
import logger from '../utils/logger.js';

let statusIndex = 0;

function buildStatuses() {
  const clan = cache.getClan();
  if (!clan) return [{ name: '⚔️ Clash of Clans', type: ActivityType.Playing }];
  return [
    { name: `🏰 ${clan.name}`, type: ActivityType.Playing },
    { name: `👥 ${clan.members}/50 Players`, type: ActivityType.Watching },
    { name: `⚔️ ${clan.warWins ?? 0} Wars Won`, type: ActivityType.Competing },
    { name: `🏆 ${clan.warLeague?.name ?? 'Unranked'}`, type: ActivityType.Watching },
  ];
}

async function refreshClan() {
  try {
    const clan = await api.getClan(process.env.CLAN_TAG);
    cache.setClan(clan);
    logger.info(`[Status] Clan refreshed: ${clan.name} | ${clan.members}/50 | ${clan.warWins} wars`);
  } catch (e) {
    logger.error(`[Status] Clan fetch failed: ${e.message}`);
  }
}

export async function startStatusRotation(client) {
  // Only fetch if cache is stale (may have been hydrated from disk)
  if (cache.isClanStale()) {
    await refreshClan();
  } else {
    logger.info('[Status] Using cached clan data for status');
  }

  // Refresh every 12 hours
  setInterval(refreshClan, 12 * 60 * 60 * 1000);

  // Set immediately
  const statuses = buildStatuses();
  client.user.setPresence({ activities: [{ name: statuses[0].name, type: statuses[0].type }], status: 'online' });

  // Rotate every 10 seconds — zero API calls, just reads from cache
  setInterval(() => {
    statusIndex++;
    const s = buildStatuses()[statusIndex % buildStatuses().length];
    client.user.setPresence({ activities: [{ name: s.name, type: s.type }], status: 'online' });
  }, 10_000);

  logger.info('[Status] ✅ Rotating every 10s | Refresh every 12h');
}
