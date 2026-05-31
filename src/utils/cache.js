import { loadCacheFromDisk, saveCacheToDisk } from './store.js';
import logger from './logger.js';
import config from '../../config.js';

const HOUR = 60 * 60 * 1000;

const cache = {
  clan: null, clanFetchedAt: null,
  war: null,  warFetchedAt: null,
  raids: null, raidsFetchedAt: null,
  cwl: null,  cwlFetchedAt: null,
};

function persist() {
  saveCacheToDisk({
    clan: cache.clan, clanFetchedAt: cache.clanFetchedAt,
    war: cache.war,   warFetchedAt: cache.warFetchedAt,
    raids: cache.raids, raidsFetchedAt: cache.raidsFetchedAt,
    cwl: cache.cwl,   cwlFetchedAt: cache.cwlFetchedAt,
  });
}

export function hydrateFromDisk() {
  const saved = loadCacheFromDisk();
  if (!saved) { logger.info('[Cache] No disk cache found, starting fresh'); return; }
  Object.assign(cache, saved);
  logger.info('[Cache] Hydrated from disk');
  logger.info(`[Cache] Clan: ${cache.clan?.name ?? 'none'} | War: ${cache.war?.state ?? 'none'} | Raids: ${cache.raids?.state ?? 'none'}`);
}

export function setClan(data)  { cache.clan  = data; cache.clanFetchedAt  = Date.now(); persist(); }
export function setWar(data)   { cache.war   = data; cache.warFetchedAt   = Date.now(); persist(); }
export function setRaids(data) { cache.raids = data; cache.raidsFetchedAt = Date.now(); persist(); }
export function setCWL(data)   { cache.cwl   = data; cache.cwlFetchedAt   = Date.now(); persist(); }

export function getClan()  { return cache.clan;  }
export function getWar()   { return cache.war;   }
export function getRaids() { return cache.raids; }
export function getCWL()   { return cache.cwl;   }

const age = (t) => t ? Date.now() - t : Infinity;

// Use refresh hours from config
export function isClanStale()  { return age(cache.clanFetchedAt)  > config.cache.clanRefreshHours  * HOUR; }
export function isWarStale()   { return age(cache.warFetchedAt)   > config.cache.eventRefreshHours * HOUR; }
export function isRaidsStale() { return age(cache.raidsFetchedAt) > config.cache.eventRefreshHours * HOUR; }
export function isCWLStale()   { return age(cache.cwlFetchedAt)   > config.cache.eventRefreshHours * HOUR; }

export function cacheStatus() {
  const fmt = (ms) => ms === Infinity ? 'never fetched' : `${Math.round(ms / 60000)}min ago`;
  return {
    clan:  `${cache.clan?.name  ?? 'none'} — fetched ${fmt(age(cache.clanFetchedAt))}`,
    war:   `${cache.war?.state  ?? 'none'} — fetched ${fmt(age(cache.warFetchedAt))}`,
    raids: `${cache.raids?.state ?? 'none'} — fetched ${fmt(age(cache.raidsFetchedAt))}`,
    cwl:   `${cache.cwl?.season ?? 'none'} — fetched ${fmt(age(cache.cwlFetchedAt))}`,
  };
}
