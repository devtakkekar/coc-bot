/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           CLASH OF CLANS BOT — CENTRAL CONFIG FILE              ║
 * ║  Edit this file to configure every aspect of your bot.          ║
 * ║  No need to touch any other file for normal customisation.      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const config = {

  // ────────────────────────────────────────────────────────────────────────────
  // CLAN
  // ────────────────────────────────────────────────────────────────────────────
  clan: {
    tag: '#2RRP882G2',
    name: '',
  },

  // ────────────────────────────────────────────────────────────────────────────
  // DISCORD WEBHOOK LOGGING
  // All bot logs (info, warnings, errors) can be forwarded to a Discord channel
  // via a webhook. Each log level can go to a separate webhook URL, or all
  // can share the same one. Set to null to disable that level.
  //
  // How to create a webhook:
  //   1. Go to your Discord server → Channel Settings → Integrations → Webhooks
  //   2. Click "New Webhook", give it a name (e.g. "Bot Logs")
  //   3. Copy the Webhook URL and paste it below
  // ────────────────────────────────────────────────────────────────────────────
  webhooks: {
    // Master switch — set false to disable ALL webhook logging
    enabled: true,

    // Minimum log level to send to Discord.
    // Options: 'error' | 'warn' | 'info' | 'debug'
    // 'error'  = only errors
    // 'warn'   = errors + warnings
    // 'info'   = errors + warnings + info (recommended)
    // 'debug'  = everything (very noisy)
    minLevel: 'info',

    // Send error logs to this webhook (red embeds)
    // Set to null to disable
    errorUrl: null,
    // Example: 'https://discord.com/api/webhooks/123456789/abcdefgh...'

    // Send warn logs to this webhook (yellow embeds)
    // Set to null to use errorUrl as fallback, or disable
    warnUrl: null,

    // Send info logs to this webhook (blue embeds)
    // Set to null to use errorUrl as fallback, or disable
    infoUrl: null,

    // If you want ALL levels going to ONE webhook, just set errorUrl
    // and leave warnUrl + infoUrl as null — they will fall back to errorUrl.

    // Rate limiting — minimum ms between webhook messages (Discord limit: 30/min)
    // Increase if you see "You are being rate limited" errors from Discord
    minIntervalMs: 2000,

    // Maximum queue size — if logs pile up faster than they send, older ones
    // are dropped to prevent memory issues
    maxQueueSize: 50,

    // Include timestamp in webhook embeds
    showTimestamp: true,

    // Bot name shown on webhook messages
    username: 'CoC Bot Logs',

    // Avatar URL for the webhook bot user (optional, leave null for default)
    avatarUrl: null,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // CACHE
  // ────────────────────────────────────────────────────────────────────────────
  cache: {
    clanRefreshHours: 12,
    eventRefreshHours: 6,
    purgeAfterDays: 7,
    purgeSchedule: '0 0 * * 0',
  },

  // ────────────────────────────────────────────────────────────────────────────
  // POLLING & NOTIFICATIONS
  // ────────────────────────────────────────────────────────────────────────────
  polling: {
    timerCheckMinutes: 5,
    warStartWarnMinutes: 30,
    warEndWarnMinutes: 60,
    raidEndWarnMinutes: 60,
    clanGamesWarnDaysBefore: 1,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // BOT STATUS ROTATION
  // ────────────────────────────────────────────────────────────────────────────
  status: {
    rotateEverySeconds: 10,
    show: {
      clanName:    true,
      memberCount: true,
      warWins:     true,
      warLeague:   true,
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  // RATE LIMITING
  // ────────────────────────────────────────────────────────────────────────────
  rateLimit: {
    default: { maxRequests: 5, windowSeconds: 10 },
    heavy:   { maxRequests: 2, windowSeconds: 15 },
  },

  // ────────────────────────────────────────────────────────────────────────────
  // COMMAND COOLDOWNS
  // ────────────────────────────────────────────────────────────────────────────
  cooldowns: {
    warAttacksMinutes: 60,
    warRefreshButtonSeconds: 30,
    raidRefreshButtonSeconds: 30,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // REMINDERS
  // ────────────────────────────────────────────────────────────────────────────
  reminders: {
    maxHours: 24,
    minMinutes: 1,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // EMBEDS & APPEARANCE
  // ────────────────────────────────────────────────────────────────────────────
  embeds: {
    colorMain:   0xF4A723,
    colorWar:    0xE74C3C,
    colorCWL:    0x9B59B6,
    colorRaid:   0x2ECC71,
    colorGames:  0x3498DB,
    footerText:  'Clash of Clans Bot',
    leaderboardSize: 15,
    warMapSize:      15,
    searchMaxResults: 10,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // LOGGING
  // ────────────────────────────────────────────────────────────────────────────
  logging: {
    level: 'info',
    retentionDays: 7,
    files: {
      error:    'logs/error.log',
      combined: 'logs/combined.log',
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  // CLAN GAMES SCHEDULE
  // ────────────────────────────────────────────────────────────────────────────
  clanGames: {
    startDay: 22,
    endDay:   28,
    startHourUTC: 8,
    endHourUTC:   8,
  },

};

export default config;
