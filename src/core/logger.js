/**
 * Advanced Logging for PixelPlanet Clone
 * Optimized for Render.com and automatic directory creation
 */

import fs from 'fs';
import path from 'path';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { PORT } from './config.js';

// Qovluqları mütləq yolla (absolute path) təyin edirik ki, sistem çaşmasın
const logDir = path.resolve('log');
const modLogDir = path.resolve('log/moderation');

// Qovluqları proqramın ən başında yaradırıq
[logDir, modLogDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[Logger] Created directory: ${dir}`);
  }
});

// Prefiksləri Render-in gözlədiyi formatda (relativ amma nöqtəsiz) düzəldirik
export const PIXELLOGGER_PREFIX = 'log/pixels-10000-';
const PROXYLOGGER_PREFIX = 'log/proxycheck-10000-';
const MODTOOLLOGGER_PREFIX = 'log/moderation/modtools-10000-';

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
      createSymlink: false, // Render-də xəta verməməsi üçün
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
      maxSize: '10m',
      maxFiles: '14d',
      utc: true,
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
    }),
  ],
});

export default logger;
