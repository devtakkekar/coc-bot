import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import * as api from '../utils/cocApi.js';
import { playerEmbed, baseEmbed, COC_COLOR } from '../utils/embeds.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { getLinkedTag, setLinkedTag, removeLinkedTag } from '../utils/store.js';
import { validateTag } from '../utils/cocApi.js';

function errorEmbed(msg) {
  return new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Error').setDescription(msg).setTimestamp();
}

export default [

  {
    data: new SlashCommandBuilder()
      .setName('player')
      .setDescription('Get player profile (uses linked tag if no tag given)')
      .addStringOption(o => o.setName('tag').setDescription('Player tag e.g. #ABC123').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      let tag = interaction.options.getString('tag');
      if (!tag) {
        tag = getLinkedTag(interaction.user.id);
        if (!tag) return interaction.editReply({ embeds: [errorEmbed('No tag provided and no linked account. Use `/link` to link your CoC account first, or provide a tag.')] });
      }
      if (!validateTag(tag)) return interaction.editReply({ embeds: [errorEmbed('Invalid tag format. Use something like `#ABC123`')] });
      try {
        const p = await api.getPlayer(tag);
        await interaction.editReply({ embeds: [playerEmbed(p)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('link')
      .setDescription('Link your Discord account to your Clash of Clans profile')
      .addStringOption(o => o.setName('tag').setDescription('Your player tag e.g. #ABC123').setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const tag = interaction.options.getString('tag');
      if (!validateTag(tag)) return interaction.editReply({ content: '❌ Invalid tag format. Use something like `#ABC123`' });
      try {
        const p = await api.getPlayer(tag);
        setLinkedTag(interaction.user.id, tag.startsWith('#') ? tag : `#${tag}`);
        await interaction.editReply({ content: `✅ Linked to **${p.name}** [\`${p.tag}\`]! You can now use \`/player\` without a tag.` });
      } catch (e) { await interaction.editReply({ content: `❌ ${e.message}` }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('unlink')
      .setDescription('Unlink your Discord account from your CoC profile'),
    async execute(interaction) {
      removeLinkedTag(interaction.user.id);
      await interaction.reply({ content: '✅ Your account has been unlinked.', ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('compare')
      .setDescription('Compare two players side by side')
      .addStringOption(o => o.setName('tag1').setDescription('First player tag').setRequired(true))
      .addStringOption(o => o.setName('tag2').setDescription('Second player tag').setRequired(true)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id, 'heavy');
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const tag1 = interaction.options.getString('tag1');
      const tag2 = interaction.options.getString('tag2');
      if (!validateTag(tag1) || !validateTag(tag2)) return interaction.editReply({ embeds: [errorEmbed('Invalid tag format.')] });
      try {
        const [p1, p2] = await Promise.all([api.getPlayer(tag1), api.getPlayer(tag2)]);
        const row = (label, v1, v2) => {
          const w1 = v1 > v2 ? '✅' : v1 === v2 ? '➖' : '❌';
          const w2 = v2 > v1 ? '✅' : v1 === v2 ? '➖' : '❌';
          return `**${label}**\n${w1} ${v1} vs ${w2} ${v2}`;
        };
        const embed = new EmbedBuilder()
          .setColor(COC_COLOR)
          .setTitle(`⚔️ ${p1.name} vs ${p2.name}`)
          .addFields(
            { name: '🏠 Town Hall',    value: row('TH Level', p1.townHallLevel, p2.townHallLevel),       inline: true },
            { name: '🏆 Trophies',     value: row('Trophies', p1.trophies, p2.trophies),                 inline: true },
            { name: '⭐ War Stars',    value: row('War Stars', p1.warStars??0, p2.warStars??0),           inline: true },
            { name: '🎁 Donations',    value: row('Donations', p1.donations??0, p2.donations??0),         inline: true },
            { name: '⚔️ Attack Wins', value: row('Attack Wins', p1.attackWins??0, p2.attackWins??0),     inline: true },
            { name: '🛡️ Defense Wins',value: row('Defense Wins', p1.defenseWins??0, p2.defenseWins??0),  inline: true },
          )
          .setTimestamp().setFooter({ text: 'Clash of Clans Bot' });
        await interaction.editReply({ embeds: [embed] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('upgrades')
      .setDescription('Show a player\'s currently upgrading buildings/troops')
      .addStringOption(o => o.setName('tag').setDescription('Player tag (leave blank to use linked)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      let tag = interaction.options.getString('tag') || getLinkedTag(interaction.user.id);
      if (!tag) return interaction.editReply({ embeds: [errorEmbed('No tag provided and no linked account. Use `/link` first.')] });
      try {
        const p = await api.getPlayer(tag);
        const upgrading = [];
        const check = (items, type) => {
          (items || []).forEach(item => {
            if (item.superTroopIsActive) upgrading.push(`🔵 **${item.name}** — Super Troop Active`);
          });
        };
        // Check heroes
        (p.heroes || []).forEach(h => {
          if (h.equipment) h.equipment.forEach(e => { if (e.level < e.maxLevel) upgrading.push(`⚙️ **${e.name}** (Hero Equipment) — Lv${e.level}/${e.maxLevel}`); });
        });

        const maxedTroops = (p.troops || []).filter(t => t.level === t.maxLevel).length;
        const totalTroops = (p.troops || []).length;
        const maxedSpells = (p.spells || []).filter(s => s.level === s.maxLevel).length;
        const totalSpells = (p.spells || []).length;
        const maxedHeroes = (p.heroes || []).filter(h => h.level === h.maxLevel).length;
        const totalHeroes = (p.heroes || []).length;

        const embed = baseEmbed(`🔨 ${p.name}'s Progress`)
          .addFields(
            { name: '⚔️ Troops Maxed',  value: `${maxedTroops}/${totalTroops}`,  inline: true },
            { name: '✨ Spells Maxed',   value: `${maxedSpells}/${totalSpells}`,  inline: true },
            { name: '🦸 Heroes Maxed',   value: `${maxedHeroes}/${totalHeroes}`,  inline: true },
            { name: '🏠 Town Hall',      value: `${p.townHallLevel}`,             inline: true },
            { name: '🏰 Builder Hall',   value: `${p.builderHallLevel ?? 'N/A'}`, inline: true },
            { name: '📊 Overall',        value: upgrading.length ? upgrading.join('\n') : '✅ Nothing actively upgrading (or data not exposed by API)', inline: false },
          );
        await interaction.editReply({ embeds: [embed] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

];
