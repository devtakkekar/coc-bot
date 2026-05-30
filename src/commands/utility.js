import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { baseEmbed, COC_COLOR, WAR_COLOR, cocDateToUnix } from '../utils/embeds.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { checkCooldown } from '../utils/cooldown.js';
import { getLinkedTag, getLinkedDiscord } from '../utils/store.js';
import { createReminder } from '../utils/reminders.js';
import * as api from '../utils/cocApi.js';
import * as cache from '../utils/cache.js';

function errorEmbed(msg) {
  return new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Error').setDescription(msg).setTimestamp();
}

function parseTime(str) {
  const match = str.match(/^(?:(\d+)h)?(?:(\d+)m)?$/i);
  if (!match || (!match[1] && !match[2])) return null;
  return (parseInt(match[1]||0) * 60 + parseInt(match[2]||0)) * 60_000;
}

// Always reads tag at call time — fixes the "not found" bug
function getClanTag() { return process.env.CLAN_TAG; }

export default [

  // ── /remind ───────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('remind')
      .setDescription('Set a reminder — bot will DM you (survives restarts)')
      .addStringOption(o => o.setName('time').setDescription('e.g. 30m, 2h, 1h30m (max 24h)').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('What to remind you about').setRequired(true)),
    async execute(interaction) {
      const timeStr = interaction.options.getString('time');
      const message = interaction.options.getString('message');
      const ms = parseTime(timeStr);
      if (!ms) return interaction.reply({ content: '❌ Invalid time. Use `30m`, `2h`, `1h30m`', ephemeral: true });
      if (ms > 24 * 60 * 60 * 1000) return interaction.reply({ content: '❌ Max 24 hours.', ephemeral: true });
      if (ms < 60_000) return interaction.reply({ content: '❌ Minimum 1 minute.', ephemeral: true });
      createReminder(interaction.user.id, interaction.guild?.name ?? 'DM', message, ms);
      const fireAt = Math.floor((Date.now() + ms) / 1000);
      await interaction.reply({
        embeds: [baseEmbed('⏰ Reminder Set!')
          .setDescription(`I'll DM you about **${message}**`)
          .addFields({ name: 'Fires at', value: `<t:${fireAt}:f> (<t:${fireAt}:R>)` })],
        ephemeral: true,
      });
    },
  },

  // ── /poll ─────────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('poll')
      .setDescription('Create a yes/no poll')
      .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true)),
    async execute(interaction) {
      const question = interaction.options.getString('question');
      const embed = new EmbedBuilder()
        .setColor(COC_COLOR).setTitle('📊 Clan Poll')
        .setDescription(`**${question}**`)
        .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp().setFooter({ text: 'React below to vote!' });
      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      await msg.react('✅');
      await msg.react('❌');
    },
  },

  // ── /whois ────────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('whois')
      .setDescription('Look up a Discord member\'s linked CoC profile')
      .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(true)),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();
      const user = interaction.options.getUser('user');
      const tag = getLinkedTag(user.id);
      if (!tag) return interaction.editReply({ embeds: [errorEmbed(`**${user.displayName}** hasn't linked a CoC account. They can use \`/link\`.`)] });
      try {
        const { playerEmbed } = await import('../utils/embeds.js');
        const p = await api.getPlayer(tag);
        await interaction.editReply({ embeds: [playerEmbed(p).setAuthor({ name: `${user.displayName}'s CoC Profile`, iconURL: user.displayAvatarURL() })] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  // ── /warrefresh — fixed: reads CLAN_TAG at call time ─────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('warrefresh')
      .setDescription('Live war status with a 🔄 Refresh button'),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();

      const { warEmbed } = await import('../utils/embeds.js');

      async function buildWarPayload() {
        try {
          const clanTag = getClanTag(); // read fresh every time
          const war = await api.getCurrentWar(clanTag);
          cache.setWar(war); // update cache with fresh data
          if (war.state === 'notInWar') {
            return { embeds: [baseEmbed('😴 Not in War').setDescription('Not currently in a war.')], components: [] };
          }
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('war_refresh_btn').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
          );
          return { embeds: [warEmbed(war, WAR_COLOR).setFooter({ text: `Last updated: ${new Date().toUTCString()}` })], components: [row] };
        } catch (e) {
          return { embeds: [errorEmbed(`Failed to fetch war: ${e.message}`)], components: [] };
        }
      }

      const payload = await buildWarPayload();
      await interaction.editReply(payload);

      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.customId === 'war_refresh_btn',
        time: 10 * 60_000,
      });

      collector.on('collect', async i => {
        const { onCooldown, remainingMs } = checkCooldown(i.user.id, 'warrefresh_btn', 30_000);
        if (onCooldown) {
          await i.reply({ content: `⏳ Refresh cooldown: ${Math.ceil(remainingMs/1000)}s`, ephemeral: true });
          return;
        }
        await i.deferUpdate();
        await i.editReply(await buildWarPayload());
      });

      collector.on('end', async () => {
        try {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('war_refresh_btn').setLabel('🔄 Refresh (expired)').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          await interaction.editReply({ components: [row] });
        } catch {}
      });
    },
  },

  // ── /raidsrefresh — fixed: reads CLAN_TAG at call time ───────────────────
  {
    data: new SlashCommandBuilder()
      .setName('raidsrefresh')
      .setDescription('Raid Weekend stats with a 🔄 Refresh button'),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();

      async function buildRaidPayload() {
        try {
          const clanTag = getClanTag(); // read fresh every time
          const data = await api.getCapitalRaidSeason(clanTag, '?limit=1');
          const season = data.items?.[0];
          if (!season) return { embeds: [baseEmbed('🏰 Raid Weekend').setDescription('No data available.')], components: [] };
          cache.setRaids(season);
          const embed = new EmbedBuilder().setColor(0x2ECC71)
            .setTitle('🏰 Capital Raid Weekend')
            .addFields(
              { name: 'State',            value: season.state || 'N/A',                                                  inline: true },
              { name: 'Ends',             value: season.endTime ? `<t:${cocDateToUnix(season.endTime)}:R>` : 'N/A',     inline: true },
              { name: '💰 Total Loot',    value: `${season.capitalTotalLoot ?? 0}`,                                      inline: true },
              { name: '⚔️ Raids Done',   value: `${season.raidsCompleted ?? 0}`,                                        inline: true },
              { name: '🏅 Medal Reward', value: `${season.offensiveReward ?? 0}`,                                       inline: true },
              { name: '👥 Members',       value: `${season.members?.length ?? 0}`,                                       inline: true },
            ).setTimestamp().setFooter({ text: `Last updated: ${new Date().toUTCString()}` });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('raid_refresh_btn').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
          );
          return { embeds: [embed], components: [row] };
        } catch (e) { return { embeds: [errorEmbed(`Failed to fetch raids: ${e.message}`)], components: [] }; }
      }

      await interaction.editReply(await buildRaidPayload());

      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.customId === 'raid_refresh_btn',
        time: 10 * 60_000,
      });
      collector.on('collect', async i => {
        const { onCooldown, remainingMs } = checkCooldown(i.user.id, 'raidsrefresh_btn', 30_000);
        if (onCooldown) { await i.reply({ content: `⏳ ${Math.ceil(remainingMs/1000)}s cooldown`, ephemeral: true }); return; }
        await i.deferUpdate();
        await i.editReply(await buildRaidPayload());
      });
      collector.on('end', async () => {
        try {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('raid_refresh_btn').setLabel('🔄 Refresh (expired)').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          await interaction.editReply({ components: [row] });
        } catch {}
      });
    },
  },

  // ── /warmap ───────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('warmap')
      .setDescription('Visual war map showing all positions and attack results'),
    async execute(interaction) {
      const { limited, retryIn } = checkRateLimit(interaction.user.id);
      if (limited) return interaction.reply({ content: `⏳ Try again in ${retryIn}s.`, ephemeral: true });
      await interaction.deferReply();

      const war = cache.getWar() || await api.getCurrentWar(getClanTag()).catch(() => null);
      if (!war || war.state === 'notInWar') return interaction.editReply({ embeds: [baseEmbed('😴 Not in War').setDescription('No active war.')] });
      if (war.state === 'preparation') return interaction.editReply({ embeds: [baseEmbed('📋 Preparation Day').setDescription('Map available when battle day begins.')] });

      const us = (war.clan?.members || []).slice().sort((a,b) => a.mapPosition - b.mapPosition);
      const them = (war.opponent?.members || []).slice().sort((a,b) => a.mapPosition - b.mapPosition);

      const buildSide = (members) => members.slice(0, 15).map(m => {
        const attacks = m.attacks || [];
        const stars = attacks.reduce((s,a) => s + a.stars, 0);
        const starStr = stars > 0 ? '⭐'.repeat(Math.min(stars, 6)) : '·';
        return `\`${String(m.mapPosition).padStart(2)}\` TH${m.townhallLevel} **${m.name}** ${starStr} (${attacks.length}/${war.attacksPerMember||2})`;
      }).join('\n');

      await interaction.editReply({ embeds: [
        new EmbedBuilder().setColor(WAR_COLOR)
          .setTitle(`🗺️ War Map — ${war.clan.name} vs ${war.opponent.name}`)
          .setDescription(`**${war.clan.stars ?? 0}⭐** vs **${war.opponent.stars ?? 0}⭐** | ${war.teamSize}v${war.teamSize}`)
          .addFields(
            { name: `🏠 ${war.clan.name}`,       value: buildSide(us)   || 'No data', inline: true },
            { name: `⚔️ ${war.opponent.name}`,   value: buildSide(them) || 'No data', inline: true },
          )
          .setFooter({ text: `Ends: ${war.endTime ? new Date(cocDateToUnix(war.endTime)*1000).toUTCString() : 'N/A'}` })
          .setTimestamp()
      ] });
    },
  },

  // ── /season ───────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('season')
      .setDescription('Show current Legend League season info'),
    async execute(interaction) {
      await interaction.deferReply();
      try {
        const league = await api.getLeague(29000022);
        await interaction.editReply({ embeds: [
          baseEmbed('🏅 Legend League')
            .setDescription(`**${league.name}**\nTop players compete each season.\nUse \`/rankings\` to see current standings.`)
            .addFields({ name: 'League ID', value: `\`${league.id}\``, inline: true })
        ] });
      } catch (e) { await interaction.editReply({ embeds: [errorEmbed(e.message)] }); }
    },
  },

  // ── /townhall ─────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('townhall')
      .setDescription('Show what unlocks at a given Town Hall level')
      .addIntegerOption(o => o.setName('level').setDescription('TH level (1-17)').setMinValue(1).setMaxValue(17).setRequired(true)),
    async execute(interaction) {
      const level = interaction.options.getInteger('level');
      const info = TH_INFO[level];
      if (!info) return interaction.reply({ content: '❌ Invalid TH level.', ephemeral: true });
      await interaction.reply({ embeds: [
        baseEmbed(`🏰 Town Hall ${level}`)
          .addFields(
            { name: '🦸 Heroes',       value: info.heroes,   inline: true },
            { name: '⚙️ Key Unlocks',  value: info.unlocks,  inline: true },
            { name: '🏆 Max Trophies', value: info.trophies, inline: true },
            { name: '📝 Notes',        value: info.notes,    inline: false },
          )
      ] });
    },
  },

];

const TH_INFO = {
  1:  { heroes: 'None', unlocks: 'Cannon, Mortar',                               trophies: '~400',  notes: 'Starting town hall. Very limited defenses.' },
  2:  { heroes: 'None', unlocks: 'Archer Tower, Giant Bomb',                     trophies: '~600',  notes: 'Unlock your first ranged defense.' },
  3:  { heroes: 'None', unlocks: 'Air Defense, Traps',                           trophies: '~800',  notes: 'Air defenses become available.' },
  4:  { heroes: 'None', unlocks: 'Air Sweeper, Giants, Balloons',                trophies: '~1100', notes: 'First wall upgrades and more troops.' },
  5:  { heroes: 'None', unlocks: 'Dark Elixir Drill, Dragons',                   trophies: '~1400', notes: 'Dark Elixir becomes available.' },
  6:  { heroes: 'None', unlocks: 'X-Bow, Healers, Golems',                       trophies: '~1800', notes: 'X-Bow is a major defensive milestone.' },
  7:  { heroes: '👑 Barbarian King',                 unlocks: 'Inferno Tower prep',               trophies: '~2200', notes: 'Barbarian King is your first hero — prioritize upgrading.' },
  8:  { heroes: '👑 BK + 👸 Archer Queen',           unlocks: 'Inferno Tower, Dark Barracks',     trophies: '~2600', notes: 'Archer Queen is the most powerful hero. Major milestone.' },
  9:  { heroes: '👑 BK(max30) + 👸 AQ(max30)',       unlocks: 'X-Bow lvl3, Earthquake Spell',     trophies: '~3200', notes: 'Hero upgrades dominate your upgrade priority.' },
  10: { heroes: '👑 BK(max40) + 👸 AQ(max40)',       unlocks: 'Inferno Tower, Hog Rider',         trophies: '~3600', notes: 'Hog Rider becomes dominant at this level.' },
  11: { heroes: '👑 BK(max50) + 👸 AQ(50) + 🧙 GW', unlocks: 'Grand Warden, Eagle Artillery',    trophies: '~4000', notes: 'Grand Warden and Eagle Artillery are game-changers.' },
  12: { heroes: 'BK(65) + AQ(65) + GW(40)',          unlocks: 'Scattershot, Giga Tesla',          trophies: '~4600', notes: 'Scattershot is extremely powerful. Long upgrade times.' },
  13: { heroes: 'BK(75) + AQ(75) + GW(50) + 🏆 RC', unlocks: 'Royal Champion, Giga Inferno',     trophies: '~5000', notes: 'Royal Champion is your 4th hero.' },
  14: { heroes: 'BK(80) + AQ(80) + GW(55) + RC(45)', unlocks: 'Giga Inferno upgrade, Pet House', trophies: '~5400', notes: 'Hero Pets unlock here — they follow heroes into battle.' },
  15: { heroes: 'BK(90) + AQ(90) + GW(65) + RC(55)', unlocks: 'Spell Tower, Monolith',           trophies: '~5800', notes: 'Monolith is one of the strongest single defenses.' },
  16: { heroes: 'BK(100) + AQ(95) + GW(70) + RC(65)',unlocks: 'Multi-Archer Tower, Ricochet Cannon', trophies: '~6000', notes: 'Major defensive upgrades. Very long build times.' },
  17: { heroes: 'BK(100) + AQ(100) + GW(80) + RC(75)',unlocks: 'Glue Trap, Electrofire Wizard',  trophies: '~6200', notes: 'Latest TH level. Cutting-edge troops and defenses.' },
};
