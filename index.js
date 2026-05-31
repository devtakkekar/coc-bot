import 'dotenv/config';

// ── Hardcoded clan tag ────────────────────────────────────────────────────────
import config from './config.js';
process.env.CLAN_TAG = config.clan.tag;

import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { commands } from './src/commands/index.js';
import { startEventMonitors } from './src/events/monitor.js';
import { startStatusRotation } from './src/events/status.js';
import { hydrateFromDisk } from './src/utils/cache.js';
import { initReminders } from './src/utils/reminders.js';
import { validateEnv } from './src/utils/validate.js';
import { startPurgeScheduler } from './src/utils/cachePurge.js';
import { incrementStat, getBotStartTime } from './src/utils/store.js';
import logger from './src/utils/logger.js';
import { mkdirSync } from 'fs';

mkdirSync('./data', { recursive: true });
mkdirSync('./logs', { recursive: true });

validateEnv();
getBotStartTime(); // record first-ever start time

hydrateFromDisk(); // load cache from disk before anything starts

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.commands = new Collection();
for (const cmd of commands) {
  client.commands.set(cmd.data.name, cmd);
}

logger.info(`📦 Loaded ${commands.length} commands`);

client.once('clientReady', async () => {
  logger.info(`✅ Logged in as ${client.user.tag}`);
  logger.info(`📌 Clan: ${process.env.CLAN_TAG}`);

  initReminders(client);
  startPurgeScheduler();
  await startStatusRotation(client);
  await startEventMonitors(client);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  incrementStat('commandsRun');
  logger.info(`[CMD] /${interaction.commandName} — ${interaction.user.tag}`);

  try {
    await command.execute(interaction);
  } catch (error) {
    incrementStat('errors');
    logger.error(`[CMD] /${interaction.commandName} failed: ${error.message}`);
    const msg = { content: '❌ An error occurred. Please try again.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
});

process.on('unhandledRejection', (err) => { incrementStat('errors'); logger.error(`Unhandled: ${err}`); });
process.on('uncaughtException',  (err) => { incrementStat('errors'); logger.error(`Uncaught: ${err}`); });

client.login(process.env.DISCORD_TOKEN);
