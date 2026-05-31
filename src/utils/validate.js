import logger from './logger.js';
import config from '../../config.js';

const REQUIRED_ENV = [
  { key: 'DISCORD_TOKEN', hint: 'discord.com/developers → Your App → Bot tab → Reset Token' },
  { key: 'CLIENT_ID',     hint: 'discord.com/developers → Your App → General Information → Application ID' },
  { key: 'GUILD_ID',      hint: 'Right-click server in Discord → Copy Server ID' },
  { key: 'COC_API_TOKEN', hint: 'developer.clashofclans.com → My Account → Create Key' },
];

export function validateEnv() {
  const missing = REQUIRED_ENV.filter(r => !process.env[r.key]?.trim());

  // Clan tag can come from config.js instead of .env
  if (!process.env.CLAN_TAG && !config.clan.tag) {
    missing.push({ key: 'CLAN_TAG', hint: 'Set clan.tag in config.js or CLAN_TAG in .env' });
  }

  if (missing.length === 0) {
    logger.info('[Env] ✅ All required variables present');
    logger.info(`[Config] Clan tag: ${config.clan.tag}`);
    logger.info(`[Config] Cache refresh: clan=${config.cache.clanRefreshHours}h, events=${config.cache.eventRefreshHours}h`);
    logger.info(`[Config] Polling: timer=${config.polling.timerCheckMinutes}min`);
    logger.info(`[Config] Status rotate: ${config.status.rotateEverySeconds}s`);
    return;
  }

  logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.error('❌ MISSING REQUIRED ENVIRONMENT VARIABLES:');
  missing.forEach(r => {
    logger.error(`   • ${r.key}`);
    logger.error(`     → ${r.hint}`);
  });
  logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(1);
}
