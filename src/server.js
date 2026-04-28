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

// REDIS_URL-i buradan sildim, aşağıda process.env ilə yoxlayacağıq
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

// RENDER ÜÇÜN PROKSİ
app.set('trust proxy', 1); 

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  message: 'Həddindən artıq sorğu göndərildi.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.url.includes('/assets/') || req.url.includes('/tiles/'),
});
app.use(limiter);

setInterval(forceGC, 10 * 60 * SECOND);

const server = http.createServer(app);

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
    if (contentType === 'application/octet-stream') return true;
    return compression.filter(req, res);
  },
}));

app.use(routes);

// --- BAŞLATMA LOGİKASI ---
console.log('🔄 Server hazırlanır...');

syncSql()
  .then(() => {
    console.log('✅ MySQL qoşuldu.');
    // REDIS_URL yoxlanışı
    const rUrl = process.env.REDIS_URL || 'Tapılmadı';
    console.log(`🔄 Redis bağlantısı qurulur... URL: ${rUrl.substring(0, 15)}...`);
    return connectRedis();
  })
  .then(async () => {
    console.log('✅ REDIS QOŞULDU!');
    
    User.setMailProvider(mailProvider);
    chatProvider.initialize();
    startAllCanvasLoops();
    loadCaptchaFontsFromRedis();
    usersocket.initialize();
    apisocket.initialize();
    canvasCleaner.initialize();
    
    const finalPort = process.env.PORT || PORT || 10000;
    server.listen(finalPort, '0.0.0.0', () => {
      console.log(`🚀 SERVER ${finalPort} PORTUNDA AKTİVDİR!`);
    });

    server.on('error', (e) => {
      console.error(`❌ Server xətası: ${e.code}`);
    });
  })
  .then(async () => {
    await socketEvents.initialize();
    rankings.initialize();
    if (HOURLY_EVENT) rpgEvent.initialize();
    if (FISHING) initializeFishing();
  })
  .catch(err => {
    console.error('🛑 BAŞLATMA XƏTASI:', err);
  });
