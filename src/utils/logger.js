import { createLogger, format, transports } from 'winston';
import { existsSync, mkdirSync } from 'fs';
import config from '../../config.js';
import { WebhookTransport } from './webhookLogger.js';

if (!existsSync('./logs')) mkdirSync('./logs', { recursive: true });

// ── Formats ───────────────────────────────────────────────────────────────────
const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, stack }) =>
    stack
      ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
      : `[${timestamp}] ${level.toUpperCase()}: ${message}`
  )
);

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message }) =>
    `[${timestamp}] ${level}: ${message}`
  )
);

// ── Base transports (console + files) ─────────────────────────────────────────
const loggerTransports = [
  new transports.Console({ format: consoleFormat }),
  new transports.File({ filename: config.logging.files.error,    level: 'error', format: fileFormat }),
  new transports.File({ filename: config.logging.files.combined, format: fileFormat }),
];

// ── Webhook transport (added only if configured) ──────────────────────────────
const webhookActive =
  config.webhooks?.enabled &&
  (config.webhooks.errorUrl || config.webhooks.warnUrl || config.webhooks.infoUrl);

if (webhookActive) {
  loggerTransports.push(
    new WebhookTransport({ level: config.webhooks.minLevel || 'info' })
  );
}

// ── Create logger ─────────────────────────────────────────────────────────────
const logger = createLogger({
  level: config.logging.level,
  format: fileFormat,
  transports: loggerTransports,
});

// ── Startup status message ────────────────────────────────────────────────────
if (config.webhooks?.enabled) {
  if (webhookActive) {
    const active = [
      config.webhooks.errorUrl ? '🔴 error' : null,
      config.webhooks.warnUrl  ? '🟡 warn'  : null,
      config.webhooks.infoUrl  ? '🔵 info'  : null,
    ].filter(Boolean);
    logger.info(`[Webhook] ✅ Active — channels: ${active.join(', ')} | min level: ${config.webhooks.minLevel}`);
  } else {
    logger.warn('[Webhook] Enabled but no URLs configured — add webhooks.errorUrl in config.js');
  }
} else {
  logger.info('[Webhook] Disabled (set webhooks.enabled = true in config.js to enable)');
}

export default logger;
