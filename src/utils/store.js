import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

function filePath(name) { return join(DATA_DIR, name); }
function ensureDir() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }

function loadFile(name) {
  ensureDir();
  const p = filePath(name);
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}
function saveFile(name, data) {
  ensureDir();
  writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function getChannel(key)            { return loadFile('settings.json')[key] ?? null; }
export function setChannel(key, id)        { const d = loadFile('settings.json'); d[key] = id; saveFile('settings.json', d); }
export function getState(key)              { return loadFile('settings.json')[`state_${key}`] ?? null; }
export function setState(key, value)       { const d = loadFile('settings.json'); d[`state_${key}`] = value; saveFile('settings.json', d); }
export function getRole(key)               { return loadFile('settings.json')[`role_${key}`] ?? null; }
export function setRole(key, id)           { const d = loadFile('settings.json'); d[`role_${key}`] = id; saveFile('settings.json', d); }

// ── Cache persistence ─────────────────────────────────────────────────────────
export function loadCacheFromDisk()        { return existsSync(filePath('cache.json')) ? JSON.parse(readFileSync(filePath('cache.json'), 'utf8')) : null; }
export function saveCacheToDisk(data)      { ensureDir(); writeFileSync(filePath('cache.json'), JSON.stringify(data, null, 2)); }

// ── Player links ──────────────────────────────────────────────────────────────
export function getLinkedTag(discordId)    { return loadFile('links.json')[discordId] ?? null; }
export function setLinkedTag(id, tag)      { const d = loadFile('links.json'); d[id] = tag; saveFile('links.json', d); }
export function removeLinkedTag(id)        { const d = loadFile('links.json'); delete d[id]; saveFile('links.json', d); }
export function getLinkedDiscord(tag)      { const d = loadFile('links.json'); return Object.entries(d).find(([,t]) => t === tag)?.[0] ?? null; }

// ── Persistent reminders ──────────────────────────────────────────────────────
export function getReminders()             { return loadFile('reminders.json').items ?? []; }
export function addReminder(r)             { const d = loadFile('reminders.json'); d.items = [...(d.items||[]), r]; saveFile('reminders.json', d); }
export function removeReminder(id)         { const d = loadFile('reminders.json'); d.items = (d.items||[]).filter(r => r.id !== id); saveFile('reminders.json', d); }

// ── Stats — atomic increment to avoid race conditions ─────────────────────────
export function incrementStat(key, amount = 1) {
  const d = loadFile('stats.json');
  d[key] = (d[key] || 0) + amount;
  saveFile('stats.json', d);
}
export function setStat(key, value) {
  const d = loadFile('stats.json');
  d[key] = value;
  saveFile('stats.json', d);
}
export function getStats()                 { return loadFile('stats.json'); }
export function getBotStartTime()          {
  const d = loadFile('stats.json');
  if (!d.startTime) { d.startTime = Date.now(); saveFile('stats.json', d); }
  return d.startTime;
}
