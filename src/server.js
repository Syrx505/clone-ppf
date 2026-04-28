/*
 * Entrypoint for main server script
 */

import url from 'url';
import compression from 'compression';
import express from 'express';
import http from 'http';
import rateLimit from 'express-rate-limit';

import forceGC from './core/forceGC.js';
import logger from './core/logger.js';
import rankings from './core/Ranks.js';
import { sync as syncSql } from './data/sql/index.js';
import { connect as connectRedis } from './data/redis/client.js';
import routes from './routes/index.js';
import chatProvider from './core/ChatProvider.js';
import { loadCaptchaFontsFromRedis } from './core/captchaserver.js';
import rpgEvent from './core/RpgEvent.js';
import { initialize as initializeFishing } from './core/Fishing.js';
import canvasCleaner from './core/CanvasCleaner.js';
import mailProvider from './core/MailProvider.js';
import { User } from './middleware/session.js';

import socketEvents from './socket/socketEvents.js';
import SocketServer from './socket/SocketServer.js';
import APISocketServer from './socket/APISocketServer.js';

import {
  PORT, HOST, HOURLY_EVENT, FISHING, BASENAME,
} from './core/config.js';
import { SECOND } from './core/constants.js';

import startAllCanvasLoops from './core/tileserver.js';

if (process.env.NODE_ENV && __dirname) {
  process.chdir(__dirname);
}

const app = express();
app.disable('x-powered-by');

/**
 * 🛠 RENDER ÜÇÜN PROKSİ VƏ RATE LIMIT AYARLARI
 */
app.set('trust proxy', 1); // Render IP-lərini düzgün tanımaq üçün ən başda olmalıdır

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dəqiqə
  max: 1000, // Pixel oyunu üçün sorğu sayını 1000-ə qaldırdıq
  message: 'Həddindən artıq sorğu göndərildi, xahiş edirik bir az gözləyin.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.url.includes('/assets/') || req.url.includes('/tiles/'),
});
app.use(limiter);

// Garbage Collector
setInterval(forceGC, 10 * 60 * SECOND);

const server = http.createServer(app);

// Websockets
const usersocket = new SocketServer();
const apisocket = new APISocketServer();
const wsUrl = `${BASENAME}/ws`;
const apiWsUrl = `${BASENAME}/mcws`;

async function wsupgrade(request, socket, head) {
  const { pathname } = url.parse(request.url);
  try {
    if (pathname === wsUrl) {
      await usersocket.handleUpgrade(request, socket, head);
    } else if (pathname === apiWsUrl) {
      await apisocket.handleUpgrade(request, socket, head);
    } else {
      socket.write('HTTP/1.1 404 Not found\r\n\r\n');
      socket.destroy();
    }
  } catch (err) {
    logger.error(`WebSocket upgrade error: ${err.message}`);
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
  }
}
server.on('upgrade', wsupgrade);

app.use(compression({
  level: 3,
  filter: (req, res) => {
    const contentType = res.getHeader('Content-Type');
    if (contentType === 'application/octet-stream') {
      return true;
    }
    return compression.filter(req, res);
  },
}));

app.use(routes);

// Sync Database & Start
syncSql()
  .then(connectRedis)
  .then(async () => {
    User.setMailProvider(mailProvider);
    chatProvider.initialize();
    startAllCanvasLoops();
    loadCaptchaFontsFromRedis();
    usersocket.initialize();
    apisocket.initialize();
    canvasCleaner.initialize();
    
    const startServer = () => {
      const finalPort = process.env.PORT || PORT || 10000;
      const finalHost = '0.0.0.0'; 

      server.listen(finalPort, finalHost, () => {
        logger.info(`HTTP Server listening on port ${finalPort} at ${finalHost}`);
      });
    };
    startServer();

    server.on('error', (e) => {
      logger.error(`HTTP Server Error ${e.code} occurred, trying again in 5s...`);
      setTimeout(() => {
        server.close();
        startServer();
      }, 5000);
    });
  })
  .then(async () => {
    await socketEvents.initialize();
  })
  .then(async () => {
    rankings.initialize();
    if (HOURLY_EVENT) {
      setTimeout(() => {
        rpgEvent.initialize();
      }, 10000);
    }
    if (FISHING) {
      initializeFishing();
    }
  });
