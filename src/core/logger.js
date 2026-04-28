import fs from 'fs';
import path from 'path';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { PORT } from './config.js';

// Proqramın işlədiyi ana qovluğu tapırıq
const ROOT_DIR = process.cwd();
const LOG_BASE = path.join(ROOT_DIR, 'log');
const MOD_LOG_BASE = path.join(LOG_BASE, 'moderation');

// Qovluqları mütləq yolla yaradırıq
[LOG_BASE, MOD_LOG_BASE].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[Logger] Ensuring directory exists at: ${dir}`);
  }
});

// Winston üçün fayl yollarını mütləq yola çeviririk
export const PIXELLOGGER_PREFIX = path.join(LOG_BASE, `pixels-${PORT}-`);
const PROXYLOGGER_PREFIX = path.join(LOG_BASE, `proxycheck-${PORT}-`);
const MODTOOLLOGGER_PREFIX = path.join(MOD_LOG_BASE, `modtools-${PORT}-`);

const logger = createLogger({
  level: 'info',
  format: format.combine(format.splat(), format.simple()),
  transports: [new transports.Console()],
});

export const pixelLogger = createLogger({
  format: format.printf(({ message }) => message),
  transports: [
    new DailyRotateFile({
      filename: `${PIXELLOGGER_PREFIX}%DATE%.log`,
      maxFiles: '14d',
      utc: true,
    }),
  ],
});

export const proxyLogger = createLogger({
  format: format.combine(format.splat(), format.simple()),
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
