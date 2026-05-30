import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import * as api from '../utils/cocApi.js';
import { getClan as getCached } from '../utils/cache.js';
import { clanEmbed, baseEmbed, COC_COLOR } from '../utils/embeds.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { validateTag } from '../utils/cocApi.js';

function errorEmbed(msg) {
  return new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Error').setDescription(msg).setTimestamp();
}

export default [

  {
    data: new SlashCommandBuilder()
      .setName('clan')
      .setDescription('Get info about a clan')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const tag = interaction.options.getString('tag') || process.env.CLAN_TAG;
      if (!validateTag(tag)) return interaction.editReply({ embeds: [errorEmbed('Invalid tag format. Use something like `#ABC123`')] });
      try {
        const isOwn = tag === process.env.CLAN_TAG;
        const clan = isOwn && getCached() ? getCached() : await api.getClan(tag);
        await interaction.editReply({ embeds: [clanEmbed(clan)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('members')
      .setDescription('List clan members')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const tag = interaction.options.getString('tag') || process.env.CLAN_TAG;
      try {
        const data = await api.getClanMembers(tag);
        const members = data.items || [];
        const rows = members.map((m, i) =>
          `\`${String(i+1).padStart(2)}\` **${m.name}** | TH${m.townHallLevel} | 🏆${m.trophies} | 🎁${m.donations}`
        ).join('\n');
        await interaction.editReply({ embeds: [baseEmbed(`👥 Members (${members.length}/50)`).setDescription(rows.slice(0, 4000) || 'No members.')] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('donations')
      .setDescription('Donation leaderboard')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const tag = interaction.options.getString('tag') || process.env.CLAN_TAG;
      try {
        const data = await api.getClanMembers(tag);
        const members = (data.items || []).sort((a,b) => (b.donations||0)-(a.donations||0)).slice(0,15);
        const rows = members.map((m,i) => `\`${String(i+1).padStart(2)}.\` **${m.name}** — 🎁${m.donations} sent | 📦${m.donationsReceived} recv`).join('\n');
        await interaction.editReply({ embeds: [baseEmbed('🎁 Donation Leaderboard').setDescription(rows)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('trophies')
      .setDescription('Trophy leaderboard')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const tag = interaction.options.getString('tag') || process.env.CLAN_TAG;
      try {
        const data = await api.getClanMembers(tag);
        const members = (data.items || []).sort((a,b) => (b.trophies||0)-(a.trophies||0)).slice(0,15);
        const rows = members.map((m,i) => `\`${String(i+1).padStart(2)}.\` **${m.name}** — 🏆${m.trophies} | TH${m.townHallLevel}`).join('\n');
        await interaction.editReply({ embeds: [baseEmbed('🏆 Trophy Leaderboard').setDescription(rows)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('clanleaderboard')
      .setDescription('Combined clan leaderboard (trophies + donations + war stars)')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const tag = interaction.options.getString('tag') || process.env.CLAN_TAG;
      try {
        const data = await api.getClanMembers(tag);
        const members = (data.items || []).map(m => ({
          name: m.name,
          th: m.townHallLevel,
          score: (m.trophies || 0) + (m.donations || 0) * 2 + (m.warStars || 0) * 5,
          trophies: m.trophies || 0,
          donations: m.donations || 0,
          warStars: m.warStars || 0,
        })).sort((a,b) => b.score - a.score).slice(0,15);
        const rows = members.map((m,i) => `\`${String(i+1).padStart(2)}.\` **${m.name}** — 🏆${m.trophies} | 🎁${m.donations} | ⭐${m.warStars} | Score: **${m.score}**`).join('\n');
        await interaction.editReply({ embeds: [baseEmbed('🥇 Combined Clan Leaderboard').setDescription(rows).setFooter({ text: 'Score = Trophies + (Donations×2) + (War Stars×5)' })] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('searchclans')
      .setDescription('Search for clans by name')
      .addStringOption(o => o.setName('name').setDescription('Clan name (min 3 chars)').setRequired(true))
      .addIntegerOption(o => o.setName('limit').setDescription('Results (1-10)').setMinValue(1).setMaxValue(10).setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id, 'heavy');
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const name = interaction.options.getString('name');
      const limit = interaction.options.getInteger('limit') || 5;
      if (name.length < 3) return interaction.editReply({ embeds: [errorEmbed('Clan name must be at least 3 characters.')] });
      try {
        const data = await api.searchClans({ name, limit });
        const clans = data.items || [];
        if (!clans.length) return interaction.editReply({ embeds: [baseEmbed('🔍 No Results').setDescription('No clans found with that name.')] });
        const rows = clans.map((c,i) => `\`${i+1}.\` **${c.name}** [\`${c.tag}\`] | Lv${c.clanLevel} | 👥${c.members}/50 | 🏆${c.clanPoints}`).join('\n');
        await interaction.editReply({ embeds: [baseEmbed(`🔍 Clans matching "${name}"`).setDescription(rows)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

];
