import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { COC_COLOR, WAR_COLOR, RAID_COLOR } from '../utils/embeds.js';

const CATEGORIES = {
  clan: {
    label: '🏰 Clan', color: COC_COLOR,
    description: 'Commands for clan info, members and leaderboards.',
    commands: [
      { name: '/clan [tag]',            desc: 'Full clan profile — badge, trophies, war record' },
      { name: '/members [tag]',         desc: 'List all members with TH level, trophies & donations' },
      { name: '/donations [tag]',       desc: 'Donation leaderboard sorted by troops sent' },
      { name: '/trophies [tag]',        desc: 'Trophy leaderboard sorted by current trophies' },
      { name: '/clanleaderboard [tag]', desc: 'Combined score board (trophies + donations + war stars)' },
      { name: '/searchclans <name>',    desc: 'Search for clans by name (min 3 chars)' },
    ],
  },
  player: {
    label: '👤 Player', color: COC_COLOR,
    description: 'Commands for player profiles, linking and comparisons.',
    commands: [
      { name: '/player [tag]',           desc: 'Full player profile — heroes, league, donations' },
      { name: '/link <tag>',             desc: 'Link your Discord to your CoC tag' },
      { name: '/unlink',                 desc: 'Unlink your CoC account from Discord' },
      { name: '/compare <tag1> <tag2>',  desc: 'Side-by-side player comparison with ✅/❌ winners' },
      { name: '/upgrades [tag]',         desc: 'Show troop/spell/hero max progress' },
      { name: '/whois @user',            desc: "Look up a Discord member's linked CoC profile" },
      { name: '/townhall <level>',       desc: 'What unlocks at a given Town Hall level (TH1–17)' },
    ],
  },
  war: {
    label: '⚔️ War', color: WAR_COLOR,
    description: 'Commands for war status, logs and attack tracking.',
    commands: [
      { name: '/war [tag]',         desc: 'Live war status — scores, stars, time remaining' },
      { name: '/warrefresh',        desc: 'War status with a live 🔄 Refresh button' },
      { name: '/warmap',            desc: 'Visual map of all positions and attack stars' },
      { name: '/warlog [tag]',      desc: 'Last 10 wars with W/L results' },
      { name: '/warattacks [tag]',  desc: "Who hasn't used all their attacks (fresh data, 1hr cooldown)" },
      { name: '/warstats [tag]',    desc: "A player's attack details in current war" },
      { name: '/cwl [tag]',         desc: 'CWL group info — season, league, clans' },
    ],
  },
  events: {
    label: '🏰 Raids & Events', color: RAID_COLOR,
    description: 'Commands for Capital Raids, Clan Games and seasonal info.',
    commands: [
      { name: '/raids [tag]',  desc: 'Capital Raid Weekend stats — loot, medals, raids done' },
      { name: '/raidsrefresh', desc: 'Raid stats with a live 🔄 Refresh button' },
      { name: '/goldpass',     desc: 'Current Gold Pass season start/end dates' },
      { name: '/season',       desc: 'Current Legend League season info' },
    ],
  },
  rankings: {
    label: '🏆 Rankings', color: 0xf39c12,
    description: 'Global and local leaderboards and league info.',
    commands: [
      { name: '/rankings <loc> <type>', desc: 'Top rankings by country (clans, players, builder base, capital)' },
      { name: '/locations',             desc: 'List all location IDs for /rankings' },
      { name: '/leagues',               desc: 'All Trophy League tiers' },
      { name: '/warleagues',            desc: 'All War League tiers' },
    ],
  },
  utility: {
    label: '🛠️ Utility', color: 0x95a5a6,
    description: 'General utility commands.',
    commands: [
      { name: '/remind <time> <msg>', desc: 'Bot DMs you a reminder — persists through restarts (max 24h)' },
      { name: '/poll <question>',     desc: 'Creates a ✅/❌ reaction poll' },
      { name: '/help',                desc: 'Shows this help menu' },
    ],
  },
  admin: {
    label: '🔐 Admin Only', color: 0xe74c3c,
    description: '🔒 Requires **Administrator** permission. Hidden from non-admins in Discord.',
    commands: [
      { name: '/setchannel <event> <channel>', desc: 'Set notification channel for war, CWL, raids, games, announcements or admin alerts' },
      { name: '/setrole <event> <role>',       desc: 'Set a role to ping when an event notification fires' },
      { name: '/channels',                     desc: 'View all configured channels and ping roles' },
      { name: '/announce <message>',           desc: 'Send a clan announcement to the general channel' },
      { name: '/cachestatus',                  desc: 'View age of all cached data and last purge info' },
      { name: '/forcepurgecache',              desc: 'Manually purge stale cache and old logs' },
      { name: '/stats',                        desc: 'Bot uptime, memory, commands run, API calls, errors, webhook status' },
      { name: '/webhooktest',                  desc: 'Send a test message to all configured log webhooks' },
    ],
  },
};

function buildOverviewEmbed() {
  const total = Object.values(CATEGORIES).reduce((t, c) => t + c.commands.length, 0);
  return new EmbedBuilder()
    .setColor(COC_COLOR)
    .setTitle('⚔️ Clash of Clans Bot — Help')
    .setDescription('Use the **dropdown menu** below to browse commands by category.\n\u200b')
    .addFields(
      ...Object.values(CATEGORIES).map(c => ({
        name: c.label,
        value: `${c.commands.length} commands`,
        inline: true,
      })),
      { name: '\u200b', value: '\u200b', inline: false },
      {
        name: '💡 Tips',
        value: [
          '• `[tag]` = optional, defaults to your server\'s clan',
          '• Use `/link <tag>` once — then skip typing your tag on most commands',
          '• `/warrefresh` and `/raidsrefresh` have live update buttons',
          '• `/warattacks` always fetches live data (1hr per-user cooldown)',
          '• Admin commands are only visible to Administrators',
        ].join('\n'),
      }
    )
    .setFooter({ text: `${total} commands total` })
    .setTimestamp();
}

function buildCategoryEmbed(key) {
  const cat = CATEGORIES[key];
  if (!cat) return null;
  return new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(`${cat.label} Commands`)
    .setDescription(cat.description)
    .addFields(cat.commands.map(cmd => ({ name: `\`${cmd.name}\``, value: cmd.desc, inline: false })))
    .setFooter({ text: 'Use the menu below to switch categories' })
    .setTimestamp();
}

function buildMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('📂 Choose a category...')
      .addOptions(
        { label: 'Overview',           description: 'All categories at a glance',             value: 'overview',  emoji: '📋' },
        { label: 'Clan',               description: 'Clan info, members, leaderboards',        value: 'clan',      emoji: '🏰' },
        { label: 'Player',             description: 'Profiles, linking, comparisons',           value: 'player',    emoji: '👤' },
        { label: 'War',                description: 'War status, map, attack tracking',         value: 'war',       emoji: '⚔️' },
        { label: 'Raids & Events',     description: 'Raids, Clan Games, Gold Pass',             value: 'events',    emoji: '🏴' },
        { label: 'Rankings',           description: 'Global/local leaderboards',                value: 'rankings',  emoji: '🏆' },
        { label: 'Utility',            description: 'Reminders, polls',                         value: 'utility',   emoji: '🛠️' },
        { label: '🔐 Admin Commands',  description: 'Channels, roles, stats, webhook logging',  value: 'admin',     emoji: '🔐' },
      )
  );
}

export default [
  {
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show all available bot commands'),
    async execute(interaction) {
      await interaction.reply({
        embeds: [buildOverviewEmbed()],
        components: [buildMenu()],
        ephemeral: true,
      });

      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.customId === 'help_category' && i.user.id === interaction.user.id,
        time: 5 * 60_000,
      });

      collector.on('collect', async i => {
        const embed = i.values[0] === 'overview'
          ? buildOverviewEmbed()
          : buildCategoryEmbed(i.values[0]);
        await i.update({ embeds: [embed], components: [buildMenu()] });
      });

      collector.on('end', async () => {
        try {
          const disabled = new ActionRowBuilder().addComponents(
            StringSelectMenuBuilder.from(buildMenu().components[0]).setDisabled(true)
          );
          await interaction.editReply({ components: [disabled] });
        } catch {}
      });
    },
  },
];
