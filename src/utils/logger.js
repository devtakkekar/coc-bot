import { createLogger, format, transports } from 'winston';
import { existsSync, mkdirSync } from 'fs';
import config from '../../config.js';

if (!existsSync('./logs')) mkdirSync('./logs', { recursive: true });

const logger = createLogger({
  level: config.logging.level,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
        : `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'HH:mm:ss' }),
        format.printf(({ timestamp, level, message }) =>
          `[${timestamp}] ${level}: ${message}`
        )
      ),
    }),
    new transports.File({ filename: config.logging.files.error,    level: 'error' }),
    new transports.File({ filename: config.logging.files.combined }),
  ],
});

export default logger;
