import { enqueue } from './apiQueue.js';
import logger from './logger.js';
import { incrementStat } from './store.js';

const BASE_URL = 'https://api.clashofclans.com/v1';

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.COC_API_TOKEN}`,
    Accept: 'application/json',
  };
}

export function encodeTag(tag) {
  const clean = tag.trim().replace(/^#/, '');
  return '%23' + clean.toUpperCase();
}

export function validateTag(tag) {
  return /^#?[A-Z0-9]{3,12}$/i.test(tag.trim());
}

async function cocFetch(path) {
  return enqueue(async () => {
    const fetch = (await import('node-fetch')).default;
    const url = `${BASE_URL}${path}`;
    logger.info(`[API] GET ${url}`);
    incrementStat('apiCalls'); // ← track every call
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const status = res.status;
      incrementStat('apiErrors');
      if (status === 404) throw new Error('Not found — check the tag is correct');
      if (status === 403) throw new Error('Forbidden — war log may be private, or invalid API token');
      if (status === 429) throw new Error('429 Rate limited');
      if (status === 503) throw new Error('503 CoC API is down');
      throw new Error(err.message || `API error ${status}`);
    }
    return res.json();
  });
}

// ── Clans ──────────────────────────────────────────────────────────────────
export const getClan              = (tag) => cocFetch(`/clans/${encodeTag(tag)}`);
export const getClanMembers       = (tag, params = '') => cocFetch(`/clans/${encodeTag(tag)}/members${params}`);
export const getClanWarLog        = (tag) => cocFetch(`/clans/${encodeTag(tag)}/warlog`);
export const getCurrentWar        = (tag) => cocFetch(`/clans/${encodeTag(tag)}/currentwar`);
export const getCWLGroup          = (tag) => cocFetch(`/clans/${encodeTag(tag)}/currentwar/leaguegroup`);
export const getCWLWar            = (warTag) => cocFetch(`/clanwarleagues/wars/${encodeTag(warTag)}`);
export const getCapitalRaidSeason = (tag, params = '') => cocFetch(`/clans/${encodeTag(tag)}/capitalraidseasons${params}`);
export const searchClans          = (params) => cocFetch(`/clans?${new URLSearchParams(params)}`);

// ── Players ────────────────────────────────────────────────────────────────
export const getPlayer = (tag) => cocFetch(`/players/${encodeTag(tag)}`);
export const verifyPlayerToken = async (tag, token) => {
  return enqueue(async () => {
    const fetch = (await import('node-fetch')).default;
    incrementStat('apiCalls');
    const res = await fetch(`${BASE_URL}/players/${encodeTag(tag)}/verifytoken`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.json();
  });
};

// ── Leagues ────────────────────────────────────────────────────────────────
export const getLeagues            = () => cocFetch('/leagues');
export const getLeague             = (id) => cocFetch(`/leagues/${id}`);
export const getWarLeagues         = () => cocFetch('/warleagues');
export const getCapitalLeagues     = () => cocFetch('/capitalleagues');
export const getBuilderBaseLeagues = () => cocFetch('/builderbaseleagues');

// ── Locations ──────────────────────────────────────────────────────────────
export const getLocations                  = () => cocFetch('/locations');
export const getClanRankingsByLocation     = (id, p = '') => cocFetch(`/locations/${id}/rankings/clans${p}`);
export const getPlayerRankingsByLocation   = (id, p = '') => cocFetch(`/locations/${id}/rankings/players${p}`);
export const getClanBuilderBaseRankings    = (id, p = '') => cocFetch(`/locations/${id}/rankings/clans-builder-base${p}`);
export const getPlayerBuilderBaseRankings  = (id, p = '') => cocFetch(`/locations/${id}/rankings/players-builder-base${p}`);
export const getCapitalRankingsByLocation  = (id, p = '') => cocFetch(`/locations/${id}/rankings/capitals${p}`);

// ── Misc ───────────────────────────────────────────────────────────────────
export const getGoldpassSeason = () => cocFetch('/goldpass/seasons/current');
export const getPlayerLabels   = () => cocFetch('/labels/players');
export const getClanLabels     = () => cocFetch('/labels/clans');
