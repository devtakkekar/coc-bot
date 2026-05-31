import { EmbedBuilder } from 'discord.js';
import config from '../../config.js';

export const COC_COLOR   = config.embeds.colorMain;
export const WAR_COLOR   = config.embeds.colorWar;
export const CWL_COLOR   = config.embeds.colorCWL;
export const RAID_COLOR  = config.embeds.colorRaid;
export const GAMES_COLOR = config.embeds.colorGames;

export function baseEmbed(title, color = COC_COLOR) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp()
    .setFooter({ text: config.embeds.footerText });
}

export function clanEmbed(clan) {
  return baseEmbed(`${clan.name} [${clan.tag}]`)
    .setThumbnail(clan.badgeUrls?.medium)
    .addFields(
      { name: 'Level',         value: `${clan.clanLevel}`,              inline: true },
      { name: 'Members',       value: `${clan.members}/50`,             inline: true },
      { name: 'Type',          value: clan.type || 'N/A',               inline: true },
      { name: 'War League',    value: clan.warLeague?.name || 'Unranked', inline: true },
      { name: 'War Wins',      value: `${clan.warWins ?? 0}`,           inline: true },
      { name: 'Win Streak',    value: `${clan.warWinStreak ?? 0}`,      inline: true },
      { name: 'Clan Trophies', value: `${clan.clanPoints ?? 0}`,        inline: true },
      { name: 'Capital League',value: clan.capitalLeague?.name || 'Unranked', inline: true },
      { name: 'Description',   value: clan.description || 'No description', inline: false },
    );
}

export function playerEmbed(p) {
  const heroes = p.heroes?.map(h => `${h.name} Lv${h.level}/${h.maxLevel}`).join('\n') || 'None';
  return baseEmbed(`${p.name} [${p.tag}]`)
    .addFields(
      { name: '🏠 Town Hall',     value: `${p.townHallLevel}`,                   inline: true },
      { name: '⭐ XP',            value: `${p.expLevel}`,                         inline: true },
      { name: '🏆 Trophies',      value: `${p.trophies}`,                         inline: true },
      { name: '🔨 Builder Hall',  value: `${p.builderHallLevel ?? 'N/A'}`,        inline: true },
      { name: '🛡️ BB Trophies',  value: `${p.builderBaseTrophies ?? 0}`,          inline: true },
      { name: '💀 War Stars',     value: `${p.warStars ?? 0}`,                    inline: true },
      { name: '🎁 Donations',     value: `${p.donations ?? 0}`,                   inline: true },
      { name: '📦 Received',      value: `${p.donationsReceived ?? 0}`,           inline: true },
      { name: '🏅 League',        value: p.league?.name || 'Unranked',            inline: true },
      { name: '⚔️ Attack Wins',  value: `${p.attackWins ?? 0}`,                  inline: true },
      { name: '🛡️ Defense Wins', value: `${p.defenseWins ?? 0}`,                 inline: true },
      { name: '🏘️ Clan',         value: p.clan ? `${p.clan.name} [${p.clan.tag}]` : 'No Clan', inline: true },
      { name: '🦸 Heroes',        value: heroes,                                  inline: false },
    );
}

export function warEmbed(war, color = WAR_COLOR) {
  const us = war.clan;
  const them = war.opponent;
  const startTime = war.startTime ? `<t:${cocDateToUnix(war.startTime)}:R>` : 'N/A';
  const endTime   = war.endTime   ? `<t:${cocDateToUnix(war.endTime)}:R>`   : 'N/A';
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`⚔️ War: ${us.name} vs ${them.name}`)
    .setThumbnail(us.badgeUrls?.medium)
    .addFields(
      { name: 'State',     value: stateLabel(war.state),  inline: true },
      { name: 'Team Size', value: `${war.teamSize}v${war.teamSize}`, inline: true },
      { name: '\u200b',    value: '\u200b',               inline: true },
      { name: us.name,     value: `⭐ ${us.stars ?? 0} | 💥 ${Number(us.destructionPercentage ?? 0).toFixed(2)}%\nAttacks: ${us.attacks ?? 0}/${war.teamSize * (war.attacksPerMember||2)}`, inline: true },
      { name: them.name,   value: `⭐ ${them.stars ?? 0} | 💥 ${Number(them.destructionPercentage ?? 0).toFixed(2)}%\nAttacks: ${them.attacks ?? 0}/${war.teamSize * (war.attacksPerMember||2)}`, inline: true },
      { name: '\u200b',    value: '\u200b',               inline: true },
      { name: 'War Start', value: startTime,              inline: true },
      { name: 'War End',   value: endTime,                inline: true },
    )
    .setTimestamp()
    .setFooter({ text: config.embeds.footerText });
}

export function cocDateToUnix(str) {
  const d = new Date(
    `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T${str.slice(9,11)}:${str.slice(11,13)}:${str.slice(13,15)}.000Z`
  );
  return Math.floor(d.getTime() / 1000);
}

export function stateLabel(state) {
  const map = {
    notInWar:    '😴 Not in War',
    preparation: '📋 Preparation Day',
    inWar:       '⚔️ Battle Day',
    warEnded:    '🏁 War Ended',
  };
  return map[state] || state;
}
