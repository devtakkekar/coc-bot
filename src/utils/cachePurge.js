import { existsSync, readdirSync, statSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import logger from './logger.js';
import { setStat, saveCacheToDisk } from './store.js';
import config from '../../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '../../data');
const LOGS_DIR  = join(__dirname, '../../logs');

export async function runCachePurge(manual = false) {
  const label = manual ? '🧹 Manual purge' : '🕛 Scheduled purge';
  logger.info(`[Purge] ${label} started...`);

  const now = Date.now();
  const cutoff = now - (config.cache.purgeAfterDays * 24 * 60 * 60 * 1000);
  let purgedItems = 0;

  // ── 1. Purge stale cache entries ──────────────────────────────────────────
  try {
    const cachePath = join(DATA_DIR, 'cache.json');
    if (existsSync(cachePath)) {
      const cacheData = JSON.parse(readFileSync(cachePath, 'utf8'));
      let changed = false;
      for (const field of ['clanFetchedAt', 'warFetchedAt', 'raidsFetchedAt', 'cwlFetchedAt']) {
        if (cacheData[field] && cacheData[field] < cutoff) {
          const key = field.replace('FetchedAt', '');
          cacheData[key] = null;
          cacheData[field] = null;
          changed = true;
          purgedItems++;
          logger.info(`[Purge] Cleared stale cache: ${key}`);
        }
      }
      if (changed) saveCacheToDisk(cacheData);
      else logger.info('[Purge] All cache entries are fresh');
    }
  } catch (e) { logger.error(`[Purge] Cache error: ${e.message}`); }

  // ── 2. Purge old log files ────────────────────────────────────────────────
  try {
    if (existsSync(LOGS_DIR)) {
      const logCutoff = now - (config.logging.retentionDays * 24 * 60 * 60 * 1000);
      for (const file of readdirSync(LOGS_DIR)) {
        const fp = join(LOGS_DIR, file);
        if (statSync(fp).mtimeMs < logCutoff) {
          unlinkSync(fp);
          purgedItems++;
          logger.info(`[Purge] Deleted old log: ${file}`);
        }
      }
    }
  } catch (e) { logger.error(`[Purge] Log error: ${e.message}`); }

  // ── 3. Purge expired reminders ────────────────────────────────────────────
  try {
    const rPath = join(DATA_DIR, 'reminders.json');
    if (existsSync(rPath)) {
      const data = JSON.parse(readFileSync(rPath, 'utf8'));
      const before = data.items?.length ?? 0;
      data.items = (data.items || []).filter(r => r.fireAt > cutoff);
      const removed = before - data.items.length;
      if (removed > 0) {
        writeFileSync(rPath, JSON.stringify(data, null, 2));
        purgedItems += removed;
        logger.info(`[Purge] Removed ${removed} expired reminder(s)`);
      }
    }
  } catch (e) { logger.error(`[Purge] Reminder error: ${e.message}`); }

  setStat('lastPurgeAt', now);
  setStat('lastPurgeType', manual ? 'manual' : 'scheduled');
  setStat('lastPurgeItems', purgedItems);
  logger.info(`[Purge] ✅ Done — ${purgedItems} item(s) purged`);
  return purgedItems;
}

export function startPurgeScheduler() {
  cron.schedule(config.cache.purgeSchedule, async () => {
    logger.info('[Purge] ⏰ Running scheduled purge...');
    await runCachePurge(false).catch(e => logger.error(`[Purge] ${e.message}`));
  }, { timezone: 'UTC' });
  logger.info(`[Purge] ✅ Scheduler started (${config.cache.purgeSchedule} UTC)`);
}
