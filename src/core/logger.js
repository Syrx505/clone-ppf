/**
 * Advanced Logging for PixelPlanet Clone
 * Updated to support automatic directory creation
 */

import fs from 'fs';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { PORT } from './config.js';

// Qovluq yollarını təyin edirik
export const PIXELLOGGER_PREFIX = `./log/pixels-${PORT}-`;
const PROXYLOGGER_PREFIX = `./log/proxycheck-${PORT}-`;
const MODTOOLLOGGER_PREFIX = `./log/moderation/modtools-${PORT}-`;

// Qovluqları avtomatik yaradan hissə
// 'recursive: true' sayəsində daxili qovluqları (moderation) da yaradır
const directories = ['./log', './log/moderation'];
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Əsas logger (Konsol üçün)
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.splat(),
    format.simple(),
  ),
  transports: [
    new transports.Console(),
  ],
});

// Piksel hərəkətləri üçün logger
export const pixelLogger = createLogger({
  format: format.printf(({ message }) => message),
  transports: [
    new DailyRotateFile({
      filename: `${PIXELLOGGER_PREFIX}%DATE%.log`,
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});

// Proxy/VPN yoxlamaları üçün logger
export const proxyLogger = createLogger({
  format: format.combine(
    format.splat(),
    format.simple(),
  ),
  transports: [
    new DailyRotateFile({
      level: 'info',
      filename: `${PROXYLOGGER_PREFIX}%DATE%.log`,
      maxsize: '10m',
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});

// Moderator hərəkətləri üçün logger
export const modtoolsLogger = createLogger({
  format: format.printf(({ message }) => message),
  transports: [
    new DailyRotateFile({
      level: 'info',
      filename: `${MODTOOLLOGGER_PREFIX}%DATE%.log`,
      maxSize: '20m',
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});

export default logger;
