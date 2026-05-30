/**
 * Validates all required environment variables on startup.
 * Exits with a clear error message if anything is missing.
 */
import logger from './logger.js';

const REQUIRED = [
  { key: 'DISCORD_TOKEN',   hint: 'Get from discord.com/developers → Your App → Bot tab → Reset Token' },
  { key: 'CLIENT_ID',       hint: 'Get from discord.com/developers → Your App → General Information → Application ID' },
  { key: 'GUILD_ID',        hint: 'Right-click your server in Discord → Copy Server ID (enable Developer Mode first)' },
  { key: 'COC_API_TOKEN',   hint: 'Get from developer.clashofclans.com → My Account → Create Key' },
  { key: 'CLAN_TAG',        hint: 'Your clan tag from in-game e.g. #ABC123' },
];

export function validateEnv() {
  const missing = REQUIRED.filter(r => !process.env[r.key] || process.env[r.key].trim() === '');
  if (missing.length === 0) {
    logger.info('[Env] ✅ All environment variables present');
    return;
  }
  logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.error('❌ MISSING REQUIRED ENVIRONMENT VARIABLES:');
  missing.forEach(r => {
    logger.error(`   • ${r.key}`);
    logger.error(`     → ${r.hint}`);
  });
  logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.error('Set these in your .env file then restart the bot.');
  process.exit(1);
}
