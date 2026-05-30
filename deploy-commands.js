import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './src/commands/index.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const body = commands.map(c => c.data.toJSON());

(async () => {
  try {
    console.log(`Deploying ${body.length} slash commands to guild ${process.env.GUILD_ID}...`);
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body },
    );
    console.log(`✅ Successfully deployed ${data.length} commands!`);
    data.forEach(c => console.log(`  /${c.name}`));
  } catch (error) {
    console.error('❌ Deploy failed:', error);
  }
})();
