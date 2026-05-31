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
    // Your clan tag (include the #)
    tag: '#2RRP882G2',

    // Display name used in some embeds (leave blank to fetch from API)
    name: '',
  },

  // ────────────────────────────────────────────────────────────────────────────
  // CACHE
  // How long before data is considered stale and re-fetched from the API.
  // Lower = more up-to-date but more API calls. Higher = fewer calls.
  // ────────────────────────────────────────────────────────────────────────────
  cache: {
    // Hours before clan profile is re-fetched (used for status rotation)
    clanRefreshHours: 12,

    // Hours before war/raids/CWL data is re-fetched
    eventRefreshHours: 6,

    // How many days of cache/logs to keep before auto-purge removes them
    purgeAfterDays: 7,

    // Auto-purge schedule — cron format (default: every Sunday at midnight UTC)
    purgeSchedule: '0 0 * * 0',
  },

  // ────────────────────────────────────────────────────────────────────────────
  // POLLING & NOTIFICATIONS
  // ────────────────────────────────────────────────────────────────────────────
  polling: {
    // How often (minutes) to run timer-based notification checks from cache.
    // These checks use NO API calls — only cached endTime/startTime values.
    timerCheckMinutes: 5,

    // Minutes before battle day starts to send "War Starting Soon" alert
    warStartWarnMinutes: 30,

    // Minutes before war ends to send "War Ending Soon" alert
    warEndWarnMinutes: 60,

    // Minutes before raid weekend ends to send "Raids Ending Soon" alert
    raidEndWarnMinutes: 60,

    // Days before clan games end to send "Clan Games Ending" warning
    clanGamesWarnDaysBefore: 1,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // BOT STATUS ROTATION
  // ────────────────────────────────────────────────────────────────────────────
  status: {
    // How many seconds between each status rotation
    rotateEverySeconds: 10,

    // Which statuses to show — set to false to disable any
    show: {
      clanName: true,   // 🏰 Playing: ClanName
      memberCount: true,   // 👥 Watching: X/50 Players
      warWins: true,   // ⚔️ Competing: X Wars Won
      warLeague: true,   // 🏆 Watching: War League Name
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  // RATE LIMITING
  // Prevents users from spamming commands.
  // ────────────────────────────────────────────────────────────────────────────
  rateLimit: {
    // Default limit — applies to most commands
    default: {
      maxRequests: 5,       // max commands
      windowSeconds: 10,    // per this many seconds
    },
    // Heavy limit — applies to search/rankings commands
    heavy: {
      maxRequests: 2,
      windowSeconds: 15,
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  // COMMAND COOLDOWNS
  // Per-user cooldowns for commands that always hit the API.
  // ────────────────────────────────────────────────────────────────────────────
  cooldowns: {
    // /warattacks — always fetches live data, limit how often per user
    warAttacksMinutes: 60,

    // /warrefresh refresh button — per-user button cooldown
    warRefreshButtonSeconds: 30,

    // /raidsrefresh refresh button
    raidRefreshButtonSeconds: 30,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // REMINDERS
  // ────────────────────────────────────────────────────────────────────────────
  reminders: {
    // Maximum reminder duration a user can set
    maxHours: 24,

    // Minimum reminder duration
    minMinutes: 1,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // EMBEDS & APPEARANCE
  // ────────────────────────────────────────────────────────────────────────────
  embeds: {
    // Main color (hex) used for general embeds
    colorMain: 0xF4A723,      // Gold

    // War embed color
    colorWar: 0xE74C3C,       // Red

    // CWL embed color
    colorCWL: 0x9B59B6,       // Purple

    // Raid Weekend embed color
    colorRaid: 0x2ECC71,      // Green

    // Clan Games embed color
    colorGames: 0x3498DB,     // Blue

    // Footer text shown on all embeds
    footerText: 'Clash of Clans Bot',

    // Max members shown in leaderboard commands
    leaderboardSize: 15,

    // Max war map positions shown per side
    warMapSize: 15,

    // Max search results for /searchclans
    searchMaxResults: 10,
  },

  // ────────────────────────────────────────────────────────────────────────────
  // LOGGING
  // ────────────────────────────────────────────────────────────────────────────
  logging: {
    // Log level: 'error' | 'warn' | 'info' | 'debug'
    level: 'info',

    // Keep log files for this many days before auto-purge removes them
    retentionDays: 7,

    // Log file names
    files: {
      error: 'logs/error.log',
      combined: 'logs/combined.log',
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  // CLAN GAMES SCHEDULE
  // CoC runs Clan Games from the 22nd to 28th of each month.
  // Only change these if Supercell changes the schedule.
  // ────────────────────────────────────────────────────────────────────────────
  clanGames: {
    startDay: 22,
    endDay: 28,
    startHourUTC: 8,
    endHourUTC: 8,
  },

};

export default config;
