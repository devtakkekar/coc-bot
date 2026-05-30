import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import * as api from '../utils/cocApi.js';
import { baseEmbed, COC_COLOR, cocDateToUnix } from '../utils/embeds.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { setChannel, getChannel } from '../utils/store.js';
import { cacheStatus } from '../utils/cache.js';

function errorEmbed(msg) {
  return new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Error').setDescription(msg).setTimestamp();
}

// Reminder store (in-memory, per session)
const reminders = new Map();

export default [

  {
    data: new SlashCommandBuilder()
      .setName('leagues')
      .setDescription('List all Trophy Leagues'),
    async execute(interaction) {
      await interaction.deferReply();
      try {
        const data = await api.getLeagues();
        const rows = (data.items||[]).map(l => `**${l.name}** (ID: \`${l.id}\`)`).join('\n');
        await interaction.editReply({ embeds: [baseEmbed('🏅 Trophy Leagues').setDescription(rows)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('warleagues')
      .setDescription('List all War Leagues'),
    async execute(interaction) {
      await interaction.deferReply();
      try {
        const data = await api.getWarLeagues();
        const rows = (data.items||[]).map(l => `**${l.name}** (ID: \`${l.id}\`)`).join('\n');
        await interaction.editReply({ embeds: [baseEmbed('⚔️ War Leagues').setDescription(rows)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('locations')
      .setDescription('List locations for rankings'),
    async execute(interaction) {
      await interaction.deferReply();
      try {
        const data = await api.getLocations();
        const locs = (data.items||[]).filter(l => l.isCountry).slice(0, 50);
        const rows = locs.map(l => `${l.name} — \`${l.id}\``).join('\n');
        await interaction.editReply({ embeds: [baseEmbed('🌍 Locations (Countries)').setDescription(rows.slice(0,4000))] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('rankings')
      .setDescription('Get rankings by location')
      .addIntegerOption(o => o.setName('location_id').setDescription('Location ID from /locations').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Ranking type').setRequired(true)
        .addChoices(
          { name: 'Clans', value: 'clans' },
          { name: 'Players', value: 'players' },
          { name: 'Clans Builder Base', value: 'clans-bb' },
          { name: 'Players Builder Base', value: 'players-bb' },
          { name: 'Capital', value: 'capital' },
        ))
      .addIntegerOption(o => o.setName('limit').setDescription('Results (1-10)').setMinValue(1).setMaxValue(10).setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id, 'heavy');
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const locId = interaction.options.getInteger('location_id');
      const type = interaction.options.getString('type');
      const limit = interaction.options.getInteger('limit') || 5;
      try {
        const qs = `?limit=${limit}`;
        let data;
        if (type === 'clans') data = await api.getClanRankingsByLocation(locId, qs);
        else if (type === 'players') data = await api.getPlayerRankingsByLocation(locId, qs);
        else if (type === 'clans-bb') data = await api.getClanBuilderBaseRankings(locId, qs);
        else if (type === 'players-bb') data = await api.getPlayerBuilderBaseRankings(locId, qs);
        else data = await api.getCapitalRankingsByLocation(locId, qs);
        const items = data.items || [];
        const rows = items.map((item,i) => `\`${String(i+1).padStart(2)}.\` **${item.name}** — ${item.clanPoints||item.trophies||item.builderBaseTrophies||item.clanCapitalPoints||0}`).join('\n');
        await interaction.editReply({ embeds: [baseEmbed(`🏆 ${type} Rankings — Location ${locId}`).setDescription(rows||'No data')] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('goldpass')
      .setDescription('Show current Gold Pass season'),
    async execute(interaction) {
      await interaction.deferReply();
      try {
        const gp = await api.getGoldpassSeason();
        const start = gp.startTime ? `<t:${cocDateToUnix(gp.startTime)}:f>` : 'N/A';
        const end   = gp.endTime   ? `<t:${cocDateToUnix(gp.endTime)}:f>`   : 'N/A';
        await interaction.editReply({ embeds: [baseEmbed('🥇 Gold Pass Season').addFields({ name: 'Starts', value: start, inline: true }, { name: 'Ends', value: end, inline: true })] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('remind')
      .setDescription('Set a reminder — bot will DM you')
      .addStringOption(o => o.setName('time').setDescription('Time e.g. 30m, 2h, 1h30m').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('What to remind you about').setRequired(true)),
    async execute(interaction) {
      const timeStr = interaction.options.getString('time');
      const message = interaction.options.getString('message');
      const ms = parseTime(timeStr);
      if (!ms) return interaction.reply({ content: '❌ Invalid time format. Use e.g. `30m`, `2h`, `1h30m`', ephemeral: true });
      if (ms > 24 * 60 * 60 * 1000) return interaction.reply({ content: '❌ Max reminder time is 24 hours.', ephemeral: true });
      await interaction.reply({ content: `⏰ Got it! I'll remind you about **${message}** in **${timeStr}**.`, ephemeral: true });
      setTimeout(async () => {
        try {
          await interaction.user.send({ embeds: [baseEmbed('⏰ Reminder!').setDescription(`**${message}**\n\nSet in: ${interaction.guild?.name ?? 'DM'}`)] });
        } catch { /* user has DMs disabled */ }
      }, ms);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('announce')
      .setDescription('Send an announcement to a configured channel (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o => o.setName('message').setDescription('Announcement message').setRequired(true))
      .addStringOption(o => o.setName('ping').setDescription('Role/everyone to ping').setRequired(false)),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const message = interaction.options.getString('message');
      const ping = interaction.options.getString('ping') || '';
      const channelId = getChannel('general');
      if (!channelId) return interaction.editReply({ content: '❌ No general channel set. Use `/setchannel` first.' });
      try {
        const channel = await interaction.client.channels.fetch(channelId);
        const embed = new EmbedBuilder()
          .setColor(COC_COLOR)
          .setTitle('📢 Clan Announcement')
          .setDescription(message)
          .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();
        await channel.send({ content: ping ? ping : undefined, embeds: [embed] });
        await interaction.editReply({ content: '✅ Announcement sent!' });
      } catch (e) { await interaction.editReply({ content: `❌ ${e.message}` }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('poll')
      .setDescription('Create a quick yes/no poll')
      .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true)),
    async execute(interaction) {
      const question = interaction.options.getString('question');
      const embed = new EmbedBuilder()
        .setColor(COC_COLOR)
        .setTitle('📊 Clan Poll')
        .setDescription(`**${question}**`)
        .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp()
        .setFooter({ text: 'React below to vote!' });
      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      await msg.react('✅');
      await msg.react('❌');
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('setchannel')
      .setDescription('Set notification channel for events (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o => o.setName('event').setDescription('Event type').setRequired(true)
        .addChoices(
          { name: '⚔️ War Notifications', value: 'war' },
          { name: '🏆 CWL Notifications', value: 'cwl' },
          { name: '🏰 Raid Weekend Notifications', value: 'raid' },
          { name: '🎮 Clan Games Notifications', value: 'games' },
          { name: '📢 General / Announcements', value: 'general' },
          { name: '🚨 Admin Alerts', value: 'admin' },
        ))
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const event = interaction.options.getString('event');
      const channel = interaction.options.getChannel('channel');
      setChannel(event, channel.id);
      const labels = { war:'⚔️ War', cwl:'🏆 CWL', raid:'🏰 Raid', games:'🎮 Clan Games', general:'📢 General', admin:'🚨 Admin' };
      await interaction.editReply({ content: `✅ **${labels[event]}** notifications → ${channel}` });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('cachestatus')
      .setDescription('Show bot cache status (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const s = cacheStatus();
      const embed = baseEmbed('🗄️ Cache Status')
        .addFields(
          { name: '🏰 Clan (refreshes every 12h)', value: s.clan, inline: false },
          { name: '⚔️ War (refreshes every 6h)', value: s.war, inline: false },
          { name: '🏰 Raids (refreshes every 6h)', value: s.raids, inline: false },
          { name: '🏆 CWL (refreshes every 6h)', value: s.cwl, inline: false },
        );
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('channels')
      .setDescription('Show all configured notification channels (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const keys = ['war','cwl','raid','games','general','admin'];
      const labels = { war:'⚔️ War', cwl:'🏆 CWL', raid:'🏰 Raid', games:'🎮 Clan Games', general:'📢 General', admin:'🚨 Admin Alerts' };
      const rows = keys.map(k => {
        const id = getChannel(k);
        return `${labels[k]}: ${id ? `<#${id}>` : '❌ Not set'}`;
      }).join('\n');
      await interaction.editReply({ embeds: [baseEmbed('📋 Configured Channels').setDescription(rows)] });
    },
  },

];

// ── Parse time string e.g. "1h30m", "45m", "2h" ──────────────────────────────
function parseTime(str) {
  const match = str.match(/^(?:(\d+)h)?(?:(\d+)m)?$/i);
  if (!match || (!match[1] && !match[2])) return null;
  const h = parseInt(match[1] || 0);
  const m = parseInt(match[2] || 0);
  return (h * 60 + m) * 60_000;
}
