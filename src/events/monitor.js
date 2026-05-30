import { incrementStat } from '../utils/store.js';
import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import * as api from '../utils/cocApi.js';
import * as cache from '../utils/cache.js';
import { warEmbed, CWL_COLOR, RAID_COLOR, GAMES_COLOR, WAR_COLOR, cocDateToUnix } from '../utils/embeds.js';
import { getChannel, getState, setState, getRole } from '../utils/store.js';
import logger from '../utils/logger.js';

// ── Clan tag helper — always read at call time ────────────────────────────────
const tag = () => {
  const t = process.env.CLAN_TAG;
  if (!t) throw new Error('CLAN_TAG not set');
  return t;
};

// ── Send helper with optional role ping ───────────────────────────────────────
async function sendToChannel(client, channelKey, embed, roleKey = null) {
  const channelId = getChannel(channelKey);
  if (!channelId) { logger.warn(`[Monitor] No channel set for: ${channelKey}`); return; }
  try {
    const channel = await client.channels.fetch(channelId);
    const roleId = roleKey ? getRole(roleKey) : null;
    const content = roleId ? `<@&${roleId}>` : undefined;
    await channel.send({ content, embeds: [embed] });
    incrementStat('notificationsSent'); logger.info(`[Monitor] ✅ Notified #${channel.name} [${channelKey}]${roleId ? ' + role ping' : ''}`);
  } catch (e) {
    logger.error(`[Monitor] ❌ Failed to notify ${channelKey}: ${e.message}`);
    const adminId = getChannel('admin');
    if (adminId && channelKey !== 'admin') {
      try {
        const ch = await client.channels.fetch(adminId);
        await ch.send({ content: `⚠️ Failed to send **${channelKey}** notification: ${e.message}` });
      } catch {}
    }
  }
}

function minutesUntil(cocTimeStr) {
  if (!cocTimeStr) return Infinity;
  return (cocDateToUnix(cocTimeStr) * 1000 - Date.now()) / 60000;
}

// ── API fetchers — always use tag() so it's read fresh ────────────────────────
async function fetchWar() {
  try {
    const war = await api.getCurrentWar(tag());
    cache.setWar(war);
    logger.info(`[Cache] ✅ War refreshed — state: ${war.state} vs: ${war.opponent?.name ?? 'N/A'}`);
    return war;
  } catch (e) {
    logger.error(`[Cache] War fetch failed: ${e.message}`);
    return cache.getWar(); // return stale cache as fallback
  }
}

async function fetchRaids() {
  try {
    const data = await api.getCapitalRaidSeason(tag(), '?limit=1');
    const season = data.items?.[0] ?? null;
    cache.setRaids(season);
    logger.info(`[Cache] ✅ Raids refreshed — state: ${season?.state ?? 'none'}`);
    return season;
  } catch (e) {
    logger.error(`[Cache] Raids fetch failed: ${e.message}`);
    return cache.getRaids();
  }
}

async function fetchCWL() {
  try {
    const group = await api.getCWLGroup(tag());
    cache.setCWL(group);
    logger.info(`[Cache] ✅ CWL refreshed — season: ${group.season}`);
    return group;
  } catch (e) {
    logger.info(`[Cache] CWL not active: ${e.message}`);
    cache.setCWL(null);
    return null;
  }
}

// ── War notification logic ────────────────────────────────────────────────────
async function checkWar(client, war) {
  if (!war) { logger.warn('[War] No war data in cache'); return; }

  const state = war.state;
  const prevState = getState('war');
  logger.info(`[War] state=${state} prev=${prevState}`);

  // ── State changed ──
  if (state !== prevState) {
    setState('war', state);
    setState('war_end_warned', false);
    setState('war_start_warned', false);
    logger.info(`[War] 🔔 State changed: ${prevState} → ${state}`);

    if (state === 'notInWar') {
      // War just ended and fully closed — reset so next war is detected fresh
      logger.info('[War] War fully closed, ready for next war detection');
      return;
    }

    if (state === 'preparation') {
      await sendToChannel(client, 'war',
        warEmbed(war, WAR_COLOR)
          .setTitle('📋 War Declared! Preparation Day Started')
          .setDescription(`War vs **${war.opponent?.name}** declared!\nBattle Day: <t:${cocDateToUnix(war.startTime)}:f>`),
        'war'
      );
    } else if (state === 'inWar') {
      await sendToChannel(client, 'war',
        warEmbed(war, WAR_COLOR)
          .setTitle('⚔️ Battle Day Has Begun!')
          .setDescription(`War vs **${war.opponent?.name}** is live!\nAttacks end <t:${cocDateToUnix(war.endTime)}:R>.`),
        'war'
      );
    } else if (state === 'warEnded') {
      const us = war.clan, them = war.opponent;
      const won = us.stars > them.stars, tied = us.stars === them.stars;
      const result = won ? '🏆 Victory!' : tied ? '🤝 It\'s a Tie!' : '💀 Defeat...';
      await sendToChannel(client, 'war',
        warEmbed(war, won ? 0x2ecc71 : tied ? 0xf4a723 : 0xe74c3c)
          .setTitle(`🏁 War Ended — ${result}`)
          .setDescription(`Final: **${us.name}** ⭐${us.stars} vs **${them.name}** ⭐${them.stars}`),
        'war'
      );
    }
    return;
  }

  // ── Same state — timer checks using cached endTime/startTime ──
  if (state === 'preparation') {
    const minsLeft = minutesUntil(war.startTime);
    logger.info(`[War] Prep — ${Math.round(minsLeft)}min until battle | warned: ${getState('war_start_warned')}`);
    if (minsLeft > 0 && minsLeft <= 30 && !getState('war_start_warned')) {
      setState('war_start_warned', true);
      await sendToChannel(client, 'war',
        warEmbed(war, WAR_COLOR)
          .setTitle('⏰ War Starting in 30 Minutes!')
          .setDescription(`Battle Day begins <t:${cocDateToUnix(war.startTime)}:R>! Get ready!`),
        'war'
      );
    }
  }

  if (state === 'inWar') {
    const minsLeft = minutesUntil(war.endTime);
    logger.info(`[War] Battle — ${Math.round(minsLeft)}min remaining | warned: ${getState('war_end_warned')}`);

    // If minutes remaining is very negative (war long over) but state hasn't
    // updated — force a fresh fetch to detect warEnded/notInWar
    if (minsLeft < -30 && !getState('war_stale_fetch_triggered')) {
      setState('war_stale_fetch_triggered', true);
      logger.warn('[War] ⚠️ War end time passed but state still inWar — forcing fresh fetch');
      const freshWar = await fetchWar();
      if (freshWar && freshWar.state !== state) {
        setState('war_stale_fetch_triggered', false);
        await checkWar(client, freshWar);
      }
      return;
    }

    if (minsLeft > 0 && minsLeft <= 60 && !getState('war_end_warned')) {
      setState('war_end_warned', true);
      await sendToChannel(client, 'war',
        warEmbed(war, WAR_COLOR)
          .setTitle('⏰ War Ending in 1 Hour!')
          .setDescription(`War ends <t:${cocDateToUnix(war.endTime)}:R>! Last chance to attack!`),
        'war'
      );
    }
  }
}

// ── Raid notification logic ───────────────────────────────────────────────────
async function checkRaids(client, season) {
  if (!season) { logger.warn('[Raid] No raid data'); return; }
  const state = season.state;
  const startTime = season.startTime;
  const prevKey = getState('raid_season');
  logger.info(`[Raid] state=${state} startTime=${startTime} prev=${prevKey}`);

  if (startTime !== prevKey) {
    setState('raid_season', startTime);
    setState('raid_end_warned', false);
    if (state === 'ongoing') {
      await sendToChannel(client, 'raid',
        new EmbedBuilder().setColor(RAID_COLOR)
          .setTitle('🏰 Raid Weekend Has Started!')
          .setDescription(`Capital Raid Weekend is now active!\nEnds <t:${cocDateToUnix(season.endTime)}:R>`)
          .addFields(
            { name: '🏅 Medal Reward', value: `${season.offensiveReward ?? '?'}`, inline: true },
            { name: '🛡️ Defense Reward', value: `${season.defensiveReward ?? '?'}`, inline: true },
          ).setTimestamp().setFooter({ text: 'Clash of Clans Bot' }),
        'raid'
      );
    } else if (state === 'ended') {
      await sendToChannel(client, 'raid',
        new EmbedBuilder().setColor(RAID_COLOR)
          .setTitle('🏁 Raid Weekend Ended!')
          .addFields(
            { name: '💰 Total Loot', value: `${season.capitalTotalLoot ?? 0}`, inline: true },
            { name: '⚔️ Raids Done', value: `${season.raidsCompleted ?? 0}`, inline: true },
            { name: '🏅 Medal Reward', value: `${season.offensiveReward ?? 0}`, inline: true },
          ).setTimestamp().setFooter({ text: 'Clash of Clans Bot' }),
        'raid'
      );
    }
    return;
  }

  if (state === 'ongoing') {
    const minsLeft = minutesUntil(season.endTime);
    logger.info(`[Raid] ${Math.round(minsLeft)}min remaining | warned: ${getState('raid_end_warned')}`);
    if (minsLeft > 0 && minsLeft <= 60 && !getState('raid_end_warned')) {
      setState('raid_end_warned', true);
      await sendToChannel(client, 'raid',
        new EmbedBuilder().setColor(RAID_COLOR)
          .setTitle('⏰ Raid Weekend Ending in 1 Hour!')
          .setDescription(`Raids end <t:${cocDateToUnix(season.endTime)}:R>! Use all your attacks!`)
          .addFields({ name: '💰 Loot So Far', value: `${season.capitalTotalLoot ?? 0}` })
          .setTimestamp().setFooter({ text: 'Clash of Clans Bot' }),
        'raid'
      );
    }
  }
}

// ── CWL checks ────────────────────────────────────────────────────────────────
async function checkCWL(client, group) {
  if (!group) return;
  const season = group.season;
  if (season !== getState('cwl_season')) {
    setState('cwl_season', season);
    await sendToChannel(client, 'cwl',
      new EmbedBuilder().setColor(CWL_COLOR)
        .setTitle('🏆 CWL Has Started!')
        .setDescription(`Clan War Leagues **${season}** is active!\n**${group.warLeague?.name}** — ${group.clans?.length} clans`)
        .addFields({ name: 'Clans in Group', value: group.clans?.map(c => c.name).join(', ') || 'N/A' })
        .setTimestamp().setFooter({ text: 'Clash of Clans Bot' }),
      'cwl'
    );
  }
}

// ── Clan Games ────────────────────────────────────────────────────────────────
async function checkClanGames(client) {
  const now = new Date();
  const day = now.getUTCDate(), month = now.getUTCMonth()+1, year = now.getUTCFullYear();
  const key = `${year}-${month}`;
  if (key !== getState('games_month')) {
    setState('games_month', key);
    setState('games_notified_start', false);
    setState('games_notified_end', false);
    setState('games_warned_end', false);
  }
  const isActive = day >= 22 && !(day === 28 && now.getUTCHours() >= 8) && day <= 28;
  const hasEnded = day > 28 || (day === 28 && now.getUTCHours() >= 8);
  const endTs = Math.floor(new Date(Date.UTC(year, month-1, 28, 8)).getTime()/1000);

  if (isActive && !getState('games_notified_start') && (day > 22 || now.getUTCHours() >= 8)) {
    setState('games_notified_start', true);
    await sendToChannel(client, 'games',
      new EmbedBuilder().setColor(GAMES_COLOR)
        .setTitle('🎮 Clan Games Have Started!').setDescription(`Clan Games active!\nEnds <t:${endTs}:R>`)
        .setTimestamp().setFooter({ text: 'Clash of Clans Bot' }),
      'games'
    );
  }
  if (isActive && day === 27 && now.getUTCHours() >= 8 && !getState('games_warned_end')) {
    setState('games_warned_end', true);
    await sendToChannel(client, 'games',
      new EmbedBuilder().setColor(GAMES_COLOR)
        .setTitle('⏰ Clan Games Ending Tomorrow!').setDescription(`Games end <t:${endTs}:R>!`)
        .setTimestamp().setFooter({ text: 'Clash of Clans Bot' }),
      'games'
    );
  }
  if (hasEnded && !getState('games_notified_end')) {
    setState('games_notified_end', true);
    await sendToChannel(client, 'games',
      new EmbedBuilder().setColor(GAMES_COLOR)
        .setTitle('🏁 Clan Games Have Ended!').setDescription('Great effort! Rewards coming soon.')
        .setTimestamp().setFooter({ text: 'Clash of Clans Bot' }),
      'games'
    );
  }
}

// ── Health check ──────────────────────────────────────────────────────────────
async function healthCheck(client) {
  if (cache.isClanStale()) {
    logger.warn('[Health] Clan data stale >13h');
    const adminId = getChannel('admin');
    if (adminId) {
      try {
        const ch = await client.channels.fetch(adminId);
        await ch.send({ content: '⚠️ **Bot Health Alert:** Clan data hasn\'t refreshed in 13+ hours. Possible CoC API issue.' });
      } catch {}
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
export async function startEventMonitors(client) {
  logger.info('[Monitor] Initialising...');

  // Fetch fresh on boot (or use disk cache if still fresh)
  const [war, raids, cwl] = await Promise.all([
    cache.isWarStale()   ? fetchWar()   : Promise.resolve(cache.getWar()),
    cache.isRaidsStale() ? fetchRaids() : Promise.resolve(cache.getRaids()),
    cache.isCWLStale()   ? fetchCWL()   : Promise.resolve(cache.getCWL()),
  ]);

  await checkWar(client, war);
  await checkRaids(client, raids);
  await checkCWL(client, cwl);
  await checkClanGames(client);

  // Every 5 min — timer checks using cached data (0 API calls)
  cron.schedule('*/5 * * * *', async () => {
    logger.info('[Monitor] ⏱ Timer check...');
    await checkWar(client, cache.getWar()).catch(e => logger.error(e.message));
    await checkRaids(client, cache.getRaids()).catch(e => logger.error(e.message));
    await checkClanGames(client).catch(e => logger.error(e.message));
  });

  // Every 6 hours — fresh API fetch
  // Note: tag() is called inside fetchWar/fetchRaids/fetchCWL so it's always fresh
  cron.schedule('0 */6 * * *', async () => {
    logger.info(`[Monitor] 🔄 6hr API refresh... (tag: ${process.env.CLAN_TAG})`);
    const [w, r, c] = await Promise.all([fetchWar(), fetchRaids(), fetchCWL()]);
    await checkWar(client, w).catch(e => logger.error(e.message));
    await checkRaids(client, r).catch(e => logger.error(e.message));
    await checkCWL(client, c).catch(e => logger.error(e.message));
  });

  // Every hour — health check
  cron.schedule('0 * * * *', () => healthCheck(client).catch(e => logger.error(e.message)));

  logger.info('[Monitor] ✅ Running (timer: 5min | API refresh: 6hr | health: 1hr)');
}
