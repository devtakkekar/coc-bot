/**
 * Weekly cache purge system.
 * - Automatically purges every Sunday at 12:00 AM UTC
 * - Keeps only the last 7 days of log data
 * - Admin can manually trigger via /forcepurgecache
 * - Records last purge time in stats
 */
import { existsSync, readdirSync, statSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import logger from './logger.js';
import { setStat, getStats } from './store.js';
import { saveCacheToDisk } from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '../../data');
const LOGS_DIR  = join(__dirname, '../../logs');
const ONE_WEEK  = 7 * 24 * 60 * 60 * 1000;

/**
 * Purge stale data:
 * 1. Clear runtime cache (war/raids/cwl/clan older than 1 week)
 * 2. Purge log files older than 7 days
 * 3. Purge expired reminders
 * 4. Record purge timestamp
 */
export async function runCachePurge(manual = false) {
  const label = manual ? '🧹 Manual purge' : '🕛 Scheduled Sunday purge';
  logger.info(`[Purge] ${label} started...`);

  let purgedItems = 0;
  const now = Date.now();
  const cutoff = now - ONE_WEEK;

  // ── 1. Purge disk cache if older than 1 week ──────────────────────────────
  try {
    const cachePath = join(DATA_DIR, 'cache.json');
    if (existsSync(cachePath)) {
      const cacheData = JSON.parse(readFileSync(cachePath, 'utf8'));
      let changed = false;

      const fields = ['clanFetchedAt', 'warFetchedAt', 'raidsFetchedAt', 'cwlFetchedAt'];
      for (const field of fields) {
        if (cacheData[field] && cacheData[field] < cutoff) {
          const dataKey = field.replace('FetchedAt', '');
          cacheData[dataKey] = null;
          cacheData[field] = null;
          changed = true;
          purgedItems++;
          logger.info(`[Purge] Cleared stale cache: ${dataKey}`);
        }
      }

      if (changed) {
        saveCacheToDisk(cacheData);
        logger.info('[Purge] Cache file updated');
      } else {
        logger.info('[Purge] Cache is fresh — nothing to clear');
      }
    }
  } catch (e) {
    logger.error(`[Purge] Cache purge error: ${e.message}`);
  }

  // ── 2. Purge log files older than 7 days ─────────────────────────────────
  try {
    if (existsSync(LOGS_DIR)) {
      const files = readdirSync(LOGS_DIR);
      for (const file of files) {
        const fp = join(LOGS_DIR, file);
        const stat = statSync(fp);
        if (stat.mtimeMs < cutoff) {
          unlinkSync(fp);
          purgedItems++;
          logger.info(`[Purge] Deleted old log: ${file}`);
        }
      }
    }
  } catch (e) {
    logger.error(`[Purge] Log purge error: ${e.message}`);
  }

  // ── 3. Purge expired reminders ────────────────────────────────────────────
  try {
    const remindersPath = join(DATA_DIR, 'reminders.json');
    if (existsSync(remindersPath)) {
      const data = JSON.parse(readFileSync(remindersPath, 'utf8'));
      const before = data.items?.length ?? 0;
      data.items = (data.items || []).filter(r => r.fireAt > cutoff);
      const after = data.items.length;
      if (before !== after) {
        writeFileSync(remindersPath, JSON.stringify(data, null, 2));
        purgedItems += before - after;
        logger.info(`[Purge] Removed ${before - after} expired reminder(s)`);
      }
    }
  } catch (e) {
    logger.error(`[Purge] Reminder purge error: ${e.message}`);
  }

  // ── 4. Record purge stats ─────────────────────────────────────────────────
  setStat('lastPurgeAt', now);
  setStat('lastPurgeType', manual ? 'manual' : 'scheduled');
  setStat('lastPurgeItems', purgedItems);

  logger.info(`[Purge] ✅ Done — ${purgedItems} item(s) purged`);
  return purgedItems;
}

/**
 * Start the weekly auto-purge scheduler.
 * Fires every Sunday at 00:00 UTC.
 */
export function startPurgeScheduler() {
  // Cron: 0 0 * * 0 = every Sunday at midnight UTC
  cron.schedule('0 0 * * 0', async () => {
    logger.info('[Purge] ⏰ Sunday midnight — running scheduled purge');
    await runCachePurge(false).catch(e => logger.error(`[Purge] Scheduler error: ${e.message}`));
  }, { timezone: 'UTC' });

  logger.info('[Purge] ✅ Weekly purge scheduler started (Sundays 00:00 UTC)');
}
