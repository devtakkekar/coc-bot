/**
 * Discord Webhook Logger
 * ──────────────────────
 * Forwards bot logs to Discord via webhook.
 * - Queued delivery respects Discord's 30 req/min rate limit
 * - Per-level webhook URLs (error / warn / info all configurable)
 * - Falls back: warnUrl → errorUrl, infoUrl → errorUrl
 * - Drops oldest messages when queue exceeds maxQueueSize
 * - Batches don't share embeds — each log is its own message (readable)
 */
import config from '../../config.js';

const LEVELS = {
  error: { priority: 0, color: 0xe74c3c, emoji: '🔴', label: 'ERROR' },
  warn:  { priority: 1, color: 0xf39c12, emoji: '🟡', label: 'WARN'  },
  info:  { priority: 2, color: 0x3498db, emoji: '🔵', label: 'INFO'  },
  debug: { priority: 3, color: 0x95a5a6, emoji: '⚪', label: 'DEBUG' },
};

const MIN_PRIORITY = LEVELS[config.webhooks?.minLevel]?.priority ?? 2;

let queue   = [];
let sending = false;
let lastAt  = 0;

function resolveUrl(level) {
  const c = config.webhooks;
  if (!c) return null;
  if (level === 'error') return c.errorUrl || null;
  if (level === 'warn')  return c.warnUrl  || c.errorUrl || null;
  return                        c.infoUrl  || c.errorUrl || null;
}

function buildPayload(entry) {
  const lvl = LEVELS[entry.level] || LEVELS.info;

  // Extract [Tag] prefix from message for the author field
  const tagMatch = entry.message.match(/^\[([^\]]+)\]/);
  const authorName = tagMatch
    ? `${lvl.emoji} ${tagMatch[1]}`
    : `${lvl.emoji} ${lvl.label}`;

  // Truncate long messages
  const desc = entry.message.length > 3900
    ? entry.message.slice(0, 3900) + '\n… (truncated)'
    : entry.message;

  const embed = {
    color: lvl.color,
    author: { name: authorName },
    description: `\`\`\`\n${desc}\n\`\`\``,
  };

  if (config.webhooks.showTimestamp) {
    embed.timestamp = new Date(entry.timestamp || Date.now()).toISOString();
  }

  return {
    username:   config.webhooks.username  || 'CoC Bot Logs',
    avatar_url: config.webhooks.avatarUrl || undefined,
    embeds: [embed],
  };
}

async function processQueue() {
  if (sending || queue.length === 0) return;
  sending = true;

  // Honour minimum interval to avoid Discord rate limits
  const gap = config.webhooks.minIntervalMs - (Date.now() - lastAt);
  if (gap > 0) await sleep(gap);

  const entry = queue.shift();
  const url   = resolveUrl(entry.level);

  if (url) {
    try {
      const { default: fetch } = await import('node-fetch');
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildPayload(entry)),
      });

      if (res.status === 429) {
        // Rate limited by Discord — put message back and wait
        const retryAfter = parseInt(res.headers.get('retry-after') || '2000', 10);
        queue.unshift(entry);
        await sleep(retryAfter);
      }
    } catch {
      // Silently drop — logging webhook errors would cause infinite recursion
    }
  }

  lastAt  = Date.now();
  sending = false;
  if (queue.length > 0) setImmediate(processQueue);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Enqueue a message for delivery to Discord webhook.
 * Called by the winston transport below.
 */
export function enqueueWebhookLog(level, message, timestamp) {
  if (!config.webhooks?.enabled) return;

  const priority = LEVELS[level]?.priority ?? 2;
  if (priority > MIN_PRIORITY) return;       // below configured threshold
  if (!resolveUrl(level)) return;            // no URL configured

  // Drop oldest if queue is full
  const max = config.webhooks.maxQueueSize ?? 50;
  if (queue.length >= max) queue.shift();

  queue.push({ level, message, timestamp });
  processQueue();
}

/**
 * Winston-compatible custom transport (ESM-safe, no class extension needed).
 * Winston accepts any object with a `log(info, callback)` method as a transport
 * when passed to the `transports` array via createLogger — but it actually needs
 * the class. We use winston-transport (bundled with winston) via createRequire.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const require    = createRequire(import.meta.url);

let WinstonTransport;
try {
  WinstonTransport = require('winston-transport');
} catch {
  // Fallback if not available separately — use EventEmitter base
  const { EventEmitter } = await import('events');
  WinstonTransport = class extends EventEmitter {
    constructor(opts = {}) { super(); this.level = opts.level || 'info'; }
  };
}

export class WebhookTransport extends WinstonTransport {
  constructor(opts = {}) {
    super(opts);
    this.name = 'discord-webhook';
  }

  log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    enqueueWebhookLog(info.level, info[Symbol.for('message')] || info.message, info.timestamp);
    if (callback) callback();
  }
}
