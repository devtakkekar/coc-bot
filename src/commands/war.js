import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import * as api from '../utils/cocApi.js';
import { getWar as getCachedWar, setWar } from '../utils/cache.js';
import { warEmbed, baseEmbed, WAR_COLOR, cocDateToUnix } from '../utils/embeds.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { checkCooldown } from '../utils/cooldown.js';

function errorEmbed(msg) {
  return new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Error').setDescription(msg).setTimestamp();
}

// Always fetch fresh war data for a given tag, update cache if it's our clan
async function fetchWar(tag) {
  const war = await api.getCurrentWar(tag);
  if (tag.replace(/^#/,'').toUpperCase() === process.env.CLAN_TAG.replace(/^#/,'').toUpperCase()) {
    setWar(war);
  }
  return war;
}

export default [

  // ── /war ─────────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('war')
      .setDescription('Show current war status')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const inputTag = interaction.options.getString('tag');
      const tag = inputTag || process.env.CLAN_TAG;
      try {
        // Use cache for own clan, always fetch for other clans
        const isOwn = !inputTag;
        const war = isOwn && getCachedWar() ? getCachedWar() : await fetchWar(tag);
        if (war.state === 'notInWar') return interaction.editReply({ embeds: [baseEmbed('😴 Not in War').setDescription('Your clan is not currently in a war.')] });
        await interaction.editReply({ embeds: [warEmbed(war)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  // ── /warlog ───────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('warlog')
      .setDescription('Show recent war log')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const tag = interaction.options.getString('tag') || process.env.CLAN_TAG;
      try {
        const data = await api.getClanWarLog(tag);
        const wars = (data.items || []).slice(0, 10);
        if (!wars.length) return interaction.editReply({ embeds: [baseEmbed('📜 War Log').setDescription('War log is private or empty.')] });
        const rows = wars.map(w => {
          const result = w.result === 'win' ? '✅' : w.result === 'lose' ? '❌' : '🤝';
          return `${result} vs **${w.opponent?.name ?? 'Unknown'}** | ⭐${w.clan?.stars}–${w.opponent?.stars} | 💥${Number(w.clan?.destructionPercentage??0).toFixed(1)}%`;
        }).join('\n');
        await interaction.editReply({ embeds: [baseEmbed('📜 Recent War Log').setDescription(rows)] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  // ── /warattacks — always fresh API call, 1hr per-user cooldown ────────────
  {
    data: new SlashCommandBuilder()
      .setName('warattacks')
      .setDescription('Show who hasn\'t attacked yet (always fresh data, 1hr cooldown per user)')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      // 1 hour cooldown per user — command always hits API so we limit it
      const { onCooldown, remainingMs } = checkCooldown(interaction.user.id, 'warattacks', 60 * 60 * 1000);
      if (onCooldown) {
        const mins = Math.ceil(remainingMs / 60_000);
        return interaction.reply({
          content: `⏳ This command fetches live data and can only be used once per hour per user. Try again in **${mins} minute${mins !== 1 ? 's' : ''}**.`,
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      const tag = interaction.options.getString('tag') || process.env.CLAN_TAG;

      try {
        // Always fresh — no cache
        const war = await fetchWar(tag);

        if (war.state === 'notInWar') return interaction.editReply({ embeds: [baseEmbed('😴 Not in War').setDescription('Not currently in a war.')] });
        if (war.state === 'preparation') return interaction.editReply({ embeds: [baseEmbed('📋 Preparation Day').setDescription('War hasn\'t started yet — check back when battle day begins!')] });

        const attacksPerMember = war.attacksPerMember || 2;
        const members = war.clan?.members || [];
        const notDone = members
          .filter(m => (m.attacks?.length ?? 0) < attacksPerMember)
          .sort((a, b) => a.mapPosition - b.mapPosition);
        const done = members.filter(m => (m.attacks?.length ?? 0) >= attacksPerMember);

        const notDoneRows = notDone
          .map(m => `\`${String(m.mapPosition).padStart(2)}\` **${m.name}** (TH${m.townhallLevel}) — ${m.attacks?.length ?? 0}/${attacksPerMember} ⚔️`)
          .join('\n');

        const embed = new EmbedBuilder()
          .setColor(WAR_COLOR)
          .setTitle(`⚔️ War Attacks — ${war.clan.name} vs ${war.opponent.name}`)
          .addFields(
            { name: `❌ Haven't Used All Attacks (${notDone.length})`, value: notDoneRows || '🎉 Everyone has attacked!', inline: false },
            { name: `✅ Done (${done.length}/${members.length})`, value: `${done.map(m => m.name).join(', ') || 'None yet'}`, inline: false },
          )
          .setFooter({ text: `Live data — War ends ${war.endTime ? new Date(cocDateToUnix(war.endTime)*1000).toUTCString() : 'N/A'} | Cooldown: 1hr/user` })
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  // ── /warstats ─────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('warstats')
      .setDescription('Show a player\'s attack details in current war')
      .addStringOption(o => o.setName('tag').setDescription('Player tag (leave blank for linked account)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const { getLinkedTag } = await import('../utils/store.js');
      let playerTag = interaction.options.getString('tag') || getLinkedTag(interaction.user.id);
      if (!playerTag) return interaction.editReply({ embeds: [errorEmbed('No tag provided and no linked account. Use `/link` first.')] });
      playerTag = playerTag.startsWith('#') ? playerTag.toUpperCase() : `#${playerTag.toUpperCase()}`;
      try {
        const war = getCachedWar() || await fetchWar(process.env.CLAN_TAG);
        if (!war || war.state === 'notInWar') return interaction.editReply({ embeds: [baseEmbed('😴 Not in War')] });
        const member = war.clan?.members?.find(m => m.tag === playerTag);
        if (!member) return interaction.editReply({ embeds: [errorEmbed('Player not found in current war lineup.')] });
        const attacks = member.attacks || [];
        const attackRows = attacks.length
          ? attacks.map((a, i) => {
              const def = war.opponent?.members?.find(m => m.tag === a.defenderTag);
              return `Attack ${i+1}: vs **${def?.name ?? 'Unknown'}** (TH${def?.townhallLevel ?? '?'}) — ⭐${a.stars} | 💥${a.destructionPercentage}%`;
            }).join('\n')
          : 'No attacks yet.';
        const embed = baseEmbed(`⚔️ ${member.name} — War Stats`)
          .addFields(
            { name: '🗺️ Map Position', value: `#${member.mapPosition}`,                              inline: true },
            { name: '🏠 Town Hall',    value: `${member.townhallLevel}`,                              inline: true },
            { name: '⭐ Total Stars',  value: `${attacks.reduce((s,a) => s+a.stars, 0)}`,             inline: true },
            { name: '⚔️ Attacks Used',value: `${attacks.length}/${war.attacksPerMember||2}`,         inline: true },
            { name: '📋 Details',      value: attackRows,                                             inline: false },
          );
        await interaction.editReply({ embeds: [embed] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  // ── /cwl ──────────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('cwl')
      .setDescription('Show CWL group info')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const tag = interaction.options.getString('tag') || process.env.CLAN_TAG;
      try {
        const { getCWL: getCachedCWL } = await import('../utils/cache.js');
        const isOwn = tag === process.env.CLAN_TAG;
        const group = isOwn && getCachedCWL() ? getCachedCWL() : await api.getCWLGroup(tag);
        const embed = new EmbedBuilder().setColor(0x9B59B6)
          .setTitle('🏆 CWL Group')
          .addFields(
            { name: `Season: ${group.season}`, value: group.clans?.map((c,i) => `\`${i+1}.\` **${c.name}** [\`${c.tag}\`]`).join('\n') || 'N/A' },
            { name: 'War League', value: group.warLeague?.name || 'Unknown', inline: true },
            { name: 'Rounds', value: `${group.rounds?.length || 0}`, inline: true },
          ).setTimestamp().setFooter({ text: 'Clash of Clans Bot' });
        await interaction.editReply({ embeds: [embed] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed('CWL not active or data unavailable.')] }); }
    },
  },

  // ── /raids ────────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('raids')
      .setDescription('Show Capital Raid Weekend stats')
      .addStringOption(o => o.setName('tag').setDescription('Clan tag (leave blank for server clan)').setRequired(false)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Slow down! Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const tag = interaction.options.getString('tag') || process.env.CLAN_TAG;
      try {
        const { getRaids: getCachedRaids } = await import('../utils/cache.js');
        const isOwn = !interaction.options.getString('tag');
        let season = isOwn ? getCachedRaids() : null;
        if (!season) {
          const data = await api.getCapitalRaidSeason(tag, '?limit=1');
          season = data.items?.[0];
        }
        if (!season) return interaction.editReply({ embeds: [baseEmbed('🏰 Raid Weekend').setDescription('No raid data available.')] });
        const embed = new EmbedBuilder().setColor(0x2ECC71)
          .setTitle('🏰 Capital Raid Weekend')
          .addFields(
            { name: 'State',            value: season.state || 'N/A',                                                   inline: true },
            { name: 'Start',            value: season.startTime ? `<t:${cocDateToUnix(season.startTime)}:f>` : 'N/A',  inline: true },
            { name: 'End',              value: season.endTime   ? `<t:${cocDateToUnix(season.endTime)}:f>`   : 'N/A',  inline: true },
            { name: '💰 Total Loot',    value: `${season.capitalTotalLoot ?? 0}`,                                       inline: true },
            { name: '⚔️ Raids Done',   value: `${season.raidsCompleted ?? 0}`,                                         inline: true },
            { name: '🏅 Medal Reward', value: `${season.offensiveReward ?? 0}`,                                        inline: true },
            { name: '🛡️ Def Reward',   value: `${season.defensiveReward ?? 0}`,                                       inline: true },
            { name: '👥 Members',       value: `${season.members?.length ?? 0}`,                                        inline: true },
          ).setTimestamp().setFooter({ text: 'Clash of Clans Bot' });
        await interaction.editReply({ embeds: [embed] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

];
