import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { setChannel, getChannel, setRole, getRole, getStats, getBotStartTime, setStat } from '../utils/store.js';
import { cacheStatus } from '../utils/cache.js';
import { baseEmbed, COC_COLOR } from '../utils/embeds.js';
import { runCachePurge } from '../utils/cachePurge.js';
import { enqueueWebhookLog } from '../utils/webhookLogger.js';
import logger from '../utils/logger.js';
import config from '../../config.js';

function errorEmbed(msg) {
  return new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ Error').setDescription(msg).setTimestamp();
}

function formatUptime(ms) {
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return `${d}d ${h%24}h ${m%60}m`;
  if (h > 0) return `${h}h ${m%60}m`;
  return `${m}m ${s%60}s`;
}

function formatDate(ts) {
  if (!ts) return 'Never';
  return `<t:${Math.floor(ts/1000)}:f> (<t:${Math.floor(ts/1000)}:R>)`;
}

export default [

  // ── /setchannel ────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('setchannel')
      .setDescription('Set notification channel for an event (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o => o.setName('event').setDescription('Event type').setRequired(true)
        .addChoices(
          { name: '⚔️ War Notifications',       value: 'war'     },
          { name: '🏆 CWL Notifications',       value: 'cwl'     },
          { name: '🏰 Raid Notifications',      value: 'raid'    },
          { name: '🎮 Clan Games',              value: 'games'   },
          { name: '📢 General / Announcements', value: 'general' },
          { name: '🚨 Admin Alerts',            value: 'admin'   },
        ))
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const event   = interaction.options.getString('event');
      const channel = interaction.options.getChannel('channel');
      setChannel(event, channel.id);
      const labels = { war:'⚔️ War', cwl:'🏆 CWL', raid:'🏰 Raid', games:'🎮 Clan Games', general:'📢 General', admin:'🚨 Admin' };
      logger.info(`[Admin] Channel set: ${event} → #${channel.name} by ${interaction.user.tag}`);
      await interaction.editReply({ content: `✅ **${labels[event]}** notifications → ${channel}` });
    },
  },

  // ── /setrole ───────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('setrole')
      .setDescription('Set a role to ping for event notifications (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o => o.setName('event').setDescription('Event type').setRequired(true)
        .addChoices(
          { name: '⚔️ War',        value: 'war'   },
          { name: '🏆 CWL',        value: 'cwl'   },
          { name: '🏰 Raids',      value: 'raid'  },
          { name: '🎮 Clan Games', value: 'games' },
        ))
      .addRoleOption(o => o.setName('role').setDescription('Role to ping (leave blank to clear)').setRequired(false)),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const event = interaction.options.getString('event');
      const role  = interaction.options.getRole('role');
      if (role) {
        setRole(event, role.id);
        logger.info(`[Admin] Role set: ${event} → @${role.name}`);
        await interaction.editReply({ content: `✅ **${event}** notifications will ping ${role}` });
      } else {
        setRole(event, null);
        await interaction.editReply({ content: `✅ Role ping cleared for **${event}**` });
      }
    },
  },

  // ── /channels ──────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('channels')
      .setDescription('Show all configured channels and ping roles (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const keys   = ['war','cwl','raid','games','general','admin'];
      const labels = { war:'⚔️ War', cwl:'🏆 CWL', raid:'🏰 Raid', games:'🎮 Clan Games', general:'📢 General', admin:'🚨 Admin' };
      const rows   = keys.map(k => {
        const chId   = getChannel(k);
        const roleId = getRole(k);
        return `${labels[k]}: ${chId ? `<#${chId}>` : '❌ Not set'}${roleId ? ` | ping: <@&${roleId}>` : ''}`;
      }).join('\n');
      await interaction.editReply({ embeds: [baseEmbed('📋 Channels & Ping Roles').setDescription(rows)] });
    },
  },

  // ── /cachestatus ───────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('cachestatus')
      .setDescription('Show bot cache status (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const s     = cacheStatus();
      const stats = getStats();
      const lastPurge = stats.lastPurgeAt
        ? `${formatDate(stats.lastPurgeAt)} — ${stats.lastPurgeType ?? '?'} (${stats.lastPurgeItems ?? 0} items)`
        : 'Never run';
      await interaction.editReply({ embeds: [
        baseEmbed('🗄️ Cache Status')
          .addFields(
            { name: '🏰 Clan (12h refresh)',  value: s.clan,    inline: false },
            { name: '⚔️ War (6h refresh)',    value: s.war,     inline: false },
            { name: '🏰 Raids (6h refresh)', value: s.raids,   inline: false },
            { name: '🏆 CWL (6h refresh)',   value: s.cwl,     inline: false },
            { name: '🧹 Last Purge',          value: lastPurge, inline: false },
            { name: '📅 Next Auto-Purge',     value: `Every Sunday 00:00 UTC (schedule: \`${config.cache.purgeSchedule}\`)`, inline: false },
          )
      ] });
    },
  },

  // ── /announce ──────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('announce')
      .setDescription('Send a clan announcement (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o => o.setName('message').setDescription('Announcement text').setRequired(true))
      .addStringOption(o => o.setName('ping').setDescription('Optional ping e.g. @everyone').setRequired(false)),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const message   = interaction.options.getString('message');
      const ping      = interaction.options.getString('ping') || '';
      const channelId = getChannel('general');
      if (!channelId) return interaction.editReply({ content: '❌ No general channel set. Use `/setchannel` first.' });
      try {
        const channel = await interaction.client.channels.fetch(channelId);
        await channel.send({
          content: ping || undefined,
          embeds: [new EmbedBuilder().setColor(COC_COLOR)
            .setTitle('📢 Clan Announcement').setDescription(message)
            .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp()],
        });
        logger.info(`[Admin] Announcement sent by ${interaction.user.tag}`);
        await interaction.editReply({ content: '✅ Announcement sent!' });
      } catch (e) { await interaction.editReply({ content: `❌ ${e.message}` }); }
    },
  },

  // ── /stats ─────────────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Show bot statistics (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const s      = getStats();
      const uptime = formatUptime(Date.now() - getBotStartTime());
      const mem    = process.memoryUsage();

      const webhookStatus = config.webhooks?.enabled
        ? (config.webhooks.errorUrl || config.webhooks.warnUrl || config.webhooks.infoUrl)
          ? `✅ Active (min: ${config.webhooks.minLevel})`
          : '⚠️ Enabled but no URLs set'
        : '❌ Disabled';

      await interaction.editReply({ embeds: [
        baseEmbed('📊 Bot Statistics')
          .addFields(
            { name: '⏱️ Uptime',             value: uptime,                                    inline: true  },
            { name: '💾 Memory',             value: `${Math.round(mem.heapUsed/1024/1024)}MB`, inline: true  },
            { name: '📦 Node.js',            value: process.version,                           inline: true  },
            { name: '📨 Commands Run',       value: `${s.commandsRun ?? 0}`,                  inline: true  },
            { name: '🌐 API Calls',          value: `${s.apiCalls ?? 0}`,                     inline: true  },
            { name: '❌ API Errors',         value: `${s.apiErrors ?? 0}`,                    inline: true  },
            { name: '📣 Notifications',      value: `${s.notificationsSent ?? 0}`,            inline: true  },
            { name: '⚠️ Errors',             value: `${s.errors ?? 0}`,                       inline: true  },
            { name: '🔗 Webhook Logging',    value: webhookStatus,                             inline: true  },
            { name: '🧹 Last Purge',         value: s.lastPurgeAt ? `${formatDate(s.lastPurgeAt)} (${s.lastPurgeType}, ${s.lastPurgeItems} items)` : 'Never', inline: false },
          )
      ] });
    },
  },

  // ── /forcepurgecache ───────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('forcepurgecache')
      .setDescription('Manually purge stale cache and old logs (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      logger.info(`[Admin] Manual cache purge triggered by ${interaction.user.tag}`);
      try {
        const purgedItems = await runCachePurge(true);
        await interaction.editReply({ embeds: [
          baseEmbed('🧹 Cache Purge Complete').setColor(0x2ecc71)
            .setDescription('Successfully purged stale data.')
            .addFields(
              { name: '🗑️ Items Purged', value: `${purgedItems}`,                              inline: true },
              { name: '📅 Purged At',    value: `<t:${Math.floor(Date.now()/1000)}:f>`,        inline: true },
              { name: 'ℹ️ What was cleared', value: '• Cache older than 7 days\n• Log files older than 7 days\n• Expired reminders', inline: false },
            )
        ] });
      } catch (e) {
        logger.error(`[Admin] Force purge failed: ${e.message}`);
        await interaction.editReply({ embeds: [errorEmbed(`Purge failed: ${e.message}`)] });
      }
    },
  },

  // ── /webhooktest ───────────────────────────────────────────────────────────
  {
    data: new SlashCommandBuilder()
      .setName('webhooktest')
      .setDescription('Send a test message to all configured log webhooks (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });

      if (!config.webhooks?.enabled) {
        return interaction.editReply({ content: '❌ Webhook logging is disabled. Set `webhooks.enabled = true` in `config.js`.' });
      }

      const hasUrl = config.webhooks.errorUrl || config.webhooks.warnUrl || config.webhooks.infoUrl;
      if (!hasUrl) {
        return interaction.editReply({ content: '❌ No webhook URLs configured. Add at least `webhooks.errorUrl` in `config.js`.' });
      }

      const ts = new Date().toISOString();

      // Fire one test message at each active level
      if (config.webhooks.errorUrl) {
        enqueueWebhookLog('error', `[WebhookTest] 🔴 Error level test — triggered by ${interaction.user.tag}`, ts);
      }
      if (config.webhooks.warnUrl || config.webhooks.errorUrl) {
        enqueueWebhookLog('warn',  `[WebhookTest] 🟡 Warn level test — triggered by ${interaction.user.tag}`, ts);
      }
      if (config.webhooks.infoUrl || config.webhooks.errorUrl) {
        enqueueWebhookLog('info',  `[WebhookTest] 🔵 Info level test — triggered by ${interaction.user.tag}`, ts);
      }

      logger.info(`[Admin] Webhook test triggered by ${interaction.user.tag}`);

      const lines = [
        config.webhooks.errorUrl ? `🔴 **Error URL:** set` : null,
        config.webhooks.warnUrl  ? `🟡 **Warn URL:** set` : `🟡 **Warn URL:** using error fallback`,
        config.webhooks.infoUrl  ? `🔵 **Info URL:** set` : `🔵 **Info URL:** using error fallback`,
        `📊 **Min Level:** ${config.webhooks.minLevel}`,
        `⏱️ **Rate limit:** ${config.webhooks.minIntervalMs}ms between messages`,
      ].filter(Boolean).join('\n');

      await interaction.editReply({ embeds: [
        baseEmbed('🔗 Webhook Test Sent').setColor(0x2ecc71)
          .setDescription('Test messages queued for delivery. Check your webhook channel(s) in a few seconds.')
          .addFields({ name: 'Configuration', value: lines, inline: false })
      ] });
    },
  },

];
