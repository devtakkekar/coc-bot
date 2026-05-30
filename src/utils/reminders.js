/**
 * Persistent reminder system.
 * Saves to disk, reloads on startup, fires via setTimeout.
 */
import { getReminders, addReminder, removeReminder } from './store.js';
import logger from './logger.js';
import { baseEmbed } from './embeds.js';
import { randomUUID } from 'crypto';

let _client = null;

export function initReminders(client) {
  _client = client;
  const reminders = getReminders();
  const now = Date.now();
  let restored = 0;
  let expired = 0;

  for (const r of reminders) {
    const delay = r.fireAt - now;
    if (delay <= 0) {
      // Already past — fire immediately with a note it was delayed
      fireReminder(r, true);
      expired++;
    } else {
      scheduleReminder(r, delay);
      restored++;
    }
  }

  if (reminders.length > 0) {
    logger.info(`[Reminders] Restored ${restored} reminder(s), fired ${expired} overdue`);
  }
}

export function createReminder(discordId, guildName, message, ms) {
  const reminder = {
    id: randomUUID(),
    discordId,
    guildName,
    message,
    fireAt: Date.now() + ms,
    createdAt: Date.now(),
  };
  addReminder(reminder);
  scheduleReminder(reminder, ms);
  return reminder;
}

function scheduleReminder(reminder, delay) {
  setTimeout(() => fireReminder(reminder, false), delay);
}

async function fireReminder(reminder, wasDelayed) {
  removeReminder(reminder.id);
  if (!_client) return;
  try {
    const user = await _client.users.fetch(reminder.discordId);
    const embed = baseEmbed('⏰ Reminder!')
      .setDescription(`**${reminder.message}**`)
      .addFields(
        { name: 'Set in', value: reminder.guildName || 'DM', inline: true },
        wasDelayed ? { name: '⚠️ Note', value: 'Bot was restarted — this reminder fired late', inline: true } : { name: '\u200b', value: '\u200b', inline: true }
      );
    await user.send({ embeds: [embed] });
    logger.info(`[Reminders] Fired reminder for ${reminder.discordId}: "${reminder.message}"`);
  } catch (e) {
    logger.warn(`[Reminders] Could not DM user ${reminder.discordId}: ${e.message}`);
  }
}
