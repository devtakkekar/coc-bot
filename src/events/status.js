import { ActivityType } from 'discord.js';
import * as api from '../utils/cocApi.js';
import * as cache from '../utils/cache.js';
import logger from '../utils/logger.js';
import config from '../../config.js';

let statusIndex = 0;

function buildStatuses() {
  const clan = cache.getClan();
  if (!clan) return [{ name: '⚔️ Clash of Clans', type: ActivityType.Playing }];
  const all = [
    config.status.show.clanName    ? { name: `🏰 ${clan.name}`,                          type: ActivityType.Playing }    : null,
    config.status.show.memberCount ? { name: `👥 ${clan.members}/50 Players`,             type: ActivityType.Watching }   : null,
    config.status.show.warWins     ? { name: `⚔️ ${clan.warWins ?? 0} Wars Won`,          type: ActivityType.Competing }  : null,
    config.status.show.warLeague   ? { name: `🏆 ${clan.warLeague?.name ?? 'Unranked'}`,  type: ActivityType.Watching }   : null,
  ].filter(Boolean);
  return all.length ? all : [{ name: '⚔️ Clash of Clans', type: ActivityType.Playing }];
}

async function refreshClan() {
  try {
    const clan = await api.getClan(config.clan.tag);
    cache.setClan(clan);
    logger.info(`[Status] Clan refreshed: ${clan.name} | ${clan.members}/50`);
  } catch (e) {
    logger.error(`[Status] Clan fetch failed: ${e.message}`);
  }
}

export async function startStatusRotation(client) {
  if (cache.isClanStale()) await refreshClan();
  else logger.info('[Status] Using cached clan data');

  // Refresh every N hours as configured
  setInterval(refreshClan, config.cache.clanRefreshHours * 60 * 60 * 1000);

  // Set immediately
  const statuses = buildStatuses();
  client.user.setPresence({ activities: [{ name: statuses[0].name, type: statuses[0].type }], status: 'online' });

  // Rotate every N seconds as configured
  setInterval(() => {
    statusIndex++;
    const list = buildStatuses();
    const s = list[statusIndex % list.length];
    client.user.setPresence({ activities: [{ name: s.name, type: s.type }], status: 'online' });
  }, config.status.rotateEverySeconds * 1000);

  logger.info(`[Status] ✅ Rotating every ${config.status.rotateEverySeconds}s | Refresh every ${config.cache.clanRefreshHours}h`);
}
