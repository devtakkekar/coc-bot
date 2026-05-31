import { incrementStat } from '../utils/store.js';
import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import * as api from '../utils/cocApi.js';
import * as cache from '../utils/cache.js';
import { warEmbed, CWL_COLOR, RAID_COLOR, GAMES_COLOR, WAR_COLOR, cocDateToUnix } from '../utils/embeds.js';
import { getChannel, getState, setState, getRole } from '../utils/store.js';
import logger from '../utils/logger.js';
import config from '../../config.js';

const tag = () => {
  const t = process.env.CLAN_TAG || config.clan.tag;
  if (!t) throw new Error('CLAN_TAG not set');
  return t;
};

async function sendToChannel(client, channelKey, embed, roleKey = null) {
  const channelId = getChannel(channelKey);
  if (!channelId) { logger.warn(`[Monitor] No channel set for: ${channelKey}`); return; }
  try {
    const channel = await client.channels.fetch(channelId);
    const roleId = roleKey ? getRole(roleKey) : null;
    await channel.send({ content: roleId ? `<@&${roleId}>` : undefined, embeds: [embed] });
    incrementStat('notificationsSent');
    logger.info(`[Monitor] ✅ Notified #${channel.name} [${channelKey}]${roleId ? ' + ping' : ''}`);
  } catch (e) {
    logger.error(`[Monitor] ❌ Failed ${channelKey}: ${e.message}`);
    const adminId = getChannel('admin');
    if (adminId && channelKey !== 'admin') {
      try { const ch = await client.channels.fetch(adminId); await ch.send({ content: `⚠️ Failed to send **${channelKey}** notification: ${e.message}` }); } catch {}
    }
  }
}

function minutesUntil(cocTimeStr) {
  if (!cocTimeStr) return Infinity;
  return (cocDateToUnix(cocTimeStr) * 1000 - Date.now()) / 60000;
}

async function fetchWar() {
  try {
    const war = await api.getCurrentWar(tag());
    cache.setWar(war);
    logger.info(`[Cache] ✅ War: ${war.state} vs ${war.opponent?.name ?? 'N/A'}`);
    return war;
  } catch (e) { logger.error(`[Cache] War fetch failed: ${e.message}`); return cache.getWar(); }
}

async function fetchRaids() {
  try {
    const data = await api.getCapitalRaidSeason(tag(), '?limit=1');
    const season = data.items?.[0] ?? null;
    cache.setRaids(season);
    logger.info(`[Cache] ✅ Raids: ${season?.state ?? 'none'}`);
    return season;
  } catch (e) { logger.error(`[Cache] Raids fetch failed: ${e.message}`); return cache.getRaids(); }
}

async function fetchCWL() {
  try {
    const group = await api.getCWLGroup(tag());
    cache.setCWL(group);
    logger.info(`[Cache] ✅ CWL: ${group.season}`);
    return group;
  } catch (e) { logger.info(`[Cache] CWL not active: ${e.message}`); cache.setCWL(null); return null; }
}

async function checkWar(client, war) {
  if (!war) { logger.warn('[War] No war data'); return; }
  const state = war.state;
  const prevState = getState('war');
  logger.info(`[War] state=${state} prev=${prevState}`);

  if (state !== prevState) {
    setState('war', state);
    setState('war_end_warned', false);
    setState('war_start_warned', false);
    setState('war_stale_fetch_triggered', false);
    logger.info(`[War] 🔔 ${prevState} → ${state}`);

    if (state === 'notInWar') { logger.info('[War] War closed, ready for next'); return; }

    if (state === 'preparation') {
      await sendToChannel(client, 'war',
        warEmbed(war, WAR_COLOR).setTitle('📋 War Declared! Preparation Day Started')
          .setDescription(`War vs **${war.opponent?.name}** declared!\nBattle Day: <t:${cocDateToUnix(war.startTime)}:f>`),
        'war');
    } else if (state === 'inWar') {
      await sendToChannel(client, 'war',
        warEmbed(war, WAR_COLOR).setTitle('⚔️ Battle Day Has Begun!')
          .setDescription(`War vs **${war.opponent?.name}** is live!\nAttacks end <t:${cocDateToUnix(war.endTime)}:R>.`),
        'war');
    } else if (state === 'warEnded') {
      const us = war.clan, them = war.opponent;
      const won = us.stars > them.stars, tied = us.stars === them.stars;
      await sendToChannel(client, 'war',
        warEmbed(war, won ? 0x2ecc71 : tied ? 0xf4a723 : 0xe74c3c)
          .setTitle(`🏁 War Ended — ${won ? '🏆 Victory!' : tied ? '🤝 Tie!' : '💀 Defeat...'}`)
          .setDescription(`Final: **${us.name}** ⭐${us.stars} vs **${them.name}** ⭐${them.stars}`),
        'war');
    }
    return;
  }

  if (state === 'preparation') {
    const minsLeft = minutesUntil(war.startTime);
    logger.info(`[War] Prep — ${Math.round(minsLeft)}min until battle`);
    if (minsLeft > 0 && minsLeft <= config.polling.warStartWarnMinutes && !getState('war_start_warned')) {
      setState('war_start_warned', true);
      await sendToChannel(client, 'war',
        warEmbed(war, WAR_COLOR).setTitle(`⏰ War Starting in ${config.polling.warStartWarnMinutes} Minutes!`)
          .setDescription(`Battle Day begins <t:${cocDateToUnix(war.startTime)}:R>! Get ready!`),
        'war');
    }
  }

  if (state === 'inWar') {
    const minsLeft = minutesUntil(war.endTime);
    logger.info(`[War] Battle — ${Math.round(minsLeft)}min remaining`);
    if (minsLeft < -30 && !getState('war_stale_fetch_triggered')) {
      setState('war_stale_fetch_triggered', true);
      logger.warn('[War] ⚠️ War overdue — forcing fresh fetch');
      const freshWar = await fetchWar();
      if (freshWar && freshWar.state !== state) { setState('war_stale_fetch_triggered', false); await checkWar(client, freshWar); }
      return;
    }
    if (minsLeft > 0 && minsLeft <= config.polling.warEndWarnMinutes && !getState('war_end_warned')) {
      setState('war_end_warned', true);
      await sendToChannel(client, 'war',
        warEmbed(war, WAR_COLOR).setTitle(`⏰ War Ending in ${config.polling.warEndWarnMinutes} Minutes!`)
          .setDescription(`War ends <t:${cocDateToUnix(war.endTime)}:R>! Last chance to attack!`),
        'war');
    }
  }
}

async function checkRaids(client, season) {
  if (!season) return;
  const state = season.state, startTime = season.startTime, prevKey = getState('raid_season');
  logger.info(`[Raid] state=${state} start=${startTime} prev=${prevKey}`);

  if (startTime !== prevKey) {
    setState('raid_season', startTime);
    setState('raid_end_warned', false);
    if (state === 'ongoing') {
      await sendToChannel(client, 'raid',
        new EmbedBuilder().setColor(RAID_COLOR).setTitle('🏰 Raid Weekend Has Started!')
          .setDescription(`Capital Raid Weekend is now active!\nEnds <t:${cocDateToUnix(season.endTime)}:R>`)
          .addFields({ name: '🏅 Medal Reward', value: `${season.offensiveReward ?? '?'}`, inline: true },
                     { name: '🛡️ Defense Reward', value: `${season.defensiveReward ?? '?'}`, inline: true })
          .setTimestamp().setFooter({ text: config.embeds.footerText }),
        'raid');
    } else if (state === 'ended') {
      await sendToChannel(client, 'raid',
        new EmbedBuilder().setColor(RAID_COLOR).setTitle('🏁 Raid Weekend Ended!')
          .addFields({ name: '💰 Total Loot', value: `${season.capitalTotalLoot ?? 0}`, inline: true },
                     { name: '⚔️ Raids Done', value: `${season.raidsCompleted ?? 0}`, inline: true },
                     { name: '🏅 Medal Reward', value: `${season.offensiveReward ?? 0}`, inline: true })
          .setTimestamp().setFooter({ text: config.embeds.footerText }),
        'raid');
    }
    return;
  }

  if (state === 'ongoing') {
    const minsLeft = minutesUntil(season.endTime);
    logger.info(`[Raid] ${Math.round(minsLeft)}min remaining`);
    if (minsLeft > 0 && minsLeft <= config.polling.raidEndWarnMinutes && !getState('raid_end_warned')) {
      setState('raid_end_warned', true);
      await sendToChannel(client, 'raid',
        new EmbedBuilder().setColor(RAID_COLOR).setTitle(`⏰ Raid Weekend Ending in ${config.polling.raidEndWarnMinutes} Minutes!`)
          .setDescription(`Raids end <t:${cocDateToUnix(season.endTime)}:R>! Use all your attacks!`)
          .addFields({ name: '💰 Loot So Far', value: `${season.capitalTotalLoot ?? 0}` })
          .setTimestamp().setFooter({ text: config.embeds.footerText }),
        'raid');
    }
  }
}

async function checkCWL(client, group) {
  if (!group) return;
  if (group.season !== getState('cwl_season')) {
    setState('cwl_season', group.season);
    await sendToChannel(client, 'cwl',
      new EmbedBuilder().setColor(CWL_COLOR).setTitle('🏆 CWL Has Started!')
        .setDescription(`Clan War Leagues **${group.season}** active!\n**${group.warLeague?.name}** — ${group.clans?.length} clans`)
        .addFields({ name: 'Clans in Group', value: group.clans?.map(c => c.name).join(', ') || 'N/A' })
        .setTimestamp().setFooter({ text: config.embeds.footerText }),
      'cwl');
  }
}

async function checkClanGames(client) {
  const now = new Date();
  const day = now.getUTCDate(), month = now.getUTCMonth()+1, year = now.getUTCFullYear();
  const key = `${year}-${month}`;
  const { startDay, endDay, startHourUTC, endHourUTC } = config.clanGames;

  if (key !== getState('games_month')) {
    setState('games_month', key);
    setState('games_notified_start', false);
    setState('games_notified_end', false);
    setState('games_warned_end', false);
  }

  const isActive = day >= startDay && !(day === endDay && now.getUTCHours() >= endHourUTC) && day <= endDay;
  const hasEnded = day > endDay || (day === endDay && now.getUTCHours() >= endHourUTC);
  const endTs = Math.floor(new Date(Date.UTC(year, month-1, endDay, endHourUTC)).getTime()/1000);

  if (isActive && !getState('games_notified_start') && (day > startDay || now.getUTCHours() >= startHourUTC)) {
    setState('games_notified_start', true);
    await sendToChannel(client, 'games',
      new EmbedBuilder().setColor(GAMES_COLOR).setTitle('🎮 Clan Games Have Started!')
        .setDescription(`Clan Games active!\nEnds <t:${endTs}:R>`)
        .setTimestamp().setFooter({ text: config.embeds.footerText }),
      'games');
  }
  if (isActive && day === endDay - config.polling.clanGamesWarnDaysBefore && now.getUTCHours() >= endHourUTC && !getState('games_warned_end')) {
    setState('games_warned_end', true);
    await sendToChannel(client, 'games',
      new EmbedBuilder().setColor(GAMES_COLOR).setTitle('⏰ Clan Games Ending Tomorrow!')
        .setDescription(`Games end <t:${endTs}:R>! Push for final points!`)
        .setTimestamp().setFooter({ text: config.embeds.footerText }),
      'games');
  }
  if (hasEnded && !getState('games_notified_end')) {
    setState('games_notified_end', true);
    await sendToChannel(client, 'games',
      new EmbedBuilder().setColor(GAMES_COLOR).setTitle('🏁 Clan Games Have Ended!')
        .setDescription('Great effort! Rewards coming soon.')
        .setTimestamp().setFooter({ text: config.embeds.footerText }),
      'games');
  }
}

async function healthCheck(client) {
  if (cache.isClanStale()) {
    logger.warn(`[Health] Clan data stale >${config.cache.clanRefreshHours + 1}h`);
    const adminId = getChannel('admin');
    if (adminId) {
      try {
        const ch = await client.channels.fetch(adminId);
        await ch.send({ content: `⚠️ **Bot Health Alert:** Clan data hasn't refreshed in ${config.cache.clanRefreshHours + 1}+ hours. Possible CoC API issue.` });
      } catch {}
    }
  }
}

export async function startEventMonitors(client) {
  logger.info('[Monitor] Initialising...');

  const [war, raids, cwl] = await Promise.all([
    cache.isWarStale()   ? fetchWar()   : Promise.resolve(cache.getWar()),
    cache.isRaidsStale() ? fetchRaids() : Promise.resolve(cache.getRaids()),
    cache.isCWLStale()   ? fetchCWL()   : Promise.resolve(cache.getCWL()),
  ]);
  await checkWar(client, war);
  await checkRaids(client, raids);
  await checkCWL(client, cwl);
  await checkClanGames(client);

  // Timer checks — uses config interval, zero API calls
  cron.schedule(`*/${config.polling.timerCheckMinutes} * * * *`, async () => {
    logger.info('[Monitor] ⏱ Timer check...');
    await checkWar(client, cache.getWar()).catch(e => logger.error(e.message));
    await checkRaids(client, cache.getRaids()).catch(e => logger.error(e.message));
    await checkClanGames(client).catch(e => logger.error(e.message));
  });

  // API refresh — every N hours from config
  cron.schedule(`0 */${config.cache.eventRefreshHours} * * *`, async () => {
    logger.info(`[Monitor] 🔄 ${config.cache.eventRefreshHours}hr API refresh... (tag: ${tag()})`);
    const [w, r, c] = await Promise.all([fetchWar(), fetchRaids(), fetchCWL()]);
    await checkWar(client, w).catch(e => logger.error(e.message));
    await checkRaids(client, r).catch(e => logger.error(e.message));
    await checkCWL(client, c).catch(e => logger.error(e.message));
  });

  cron.schedule('0 * * * *', () => healthCheck(client).catch(e => logger.error(e.message)));

  logger.info(`[Monitor] ✅ Timer: ${config.polling.timerCheckMinutes}min | API: ${config.cache.eventRefreshHours}hr`);
}
