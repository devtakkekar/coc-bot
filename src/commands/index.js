import clanCommands from './clan.js';
import playerCommands from './player.js';
import warCommands from './war.js';
import adminCommands from './admin.js';
import utilityCommands from './utility.js';
import helpCommands from './help.js';

export const commands = [
  ...clanCommands,
  ...playerCommands,
  ...warCommands,
  ...adminCommands,
  ...utilityCommands,
  ...helpCommands,
];
