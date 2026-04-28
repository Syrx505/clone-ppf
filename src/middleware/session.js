/*
 * express middlewares for handling user sessions
 */
import { parse as parseCookie } from 'cookie';
import { HOUR, USER_FLAGS } from '../core/constants.js';
import { TIMEBLOCK_USERS } from '../core/config.js';
import {
  resolveSession, createSession, removeSession, resolveSessionUid,
  resolveSessionUidAndAge,
} from '../data/sql/Session.js';
import { parseListOfBans } from '../data/sql/Ban.js';
import { touchUser } from '../data/sql/User.js';
import { sign, unsign } from '../utils/hash.js';


export class User {
  id;
  userlvl;
  #data;
  #token;
  isBanned = null;
  isMuted = null;
  channelIds = new Map();
  blockedInterval = null;
  banRecheckTs = null;

  constructor(data, token) {
    this.id = data.id;
    this.userlvl = data.userlvl;
    this.#token = token;
    this.#data = data;

    const channelsByType = Object.values(data.channels);
    for (let i = 0; i < channelsByType.length; i += 1) {
      const typeChannels = channelsByType[i];
      for (let u = 0; u < typeChannels.length; u += 1) {
        const typeChannel = typeChannels[u];
        this.channelIds.set(typeChannel[0], typeChannel[4]);
      }
    }

    const [isBanned, isMuted, banRecheckTs] = parseListOfBans(data.bans);
    this.isBanned = isBanned;
    this.isMuted = isMuted;
    this.banRecheckTs = banRecheckTs;
    if (TIMEBLOCK_USERS) {
      const timeBlockProps = TIMEBLOCK_USERS.get(this.id);
      if (timeBlockProps) {
        [this.blockedInterval] = timeBlockProps;
      }
    }
  }

  static mailProvider;
  static setMailProvider(mailProvider) {
    User.mailProvider = mailProvider;
  }
  get data() { return this.#data; }
  get name() { return this.#data.name; }
  get token() { return this.#token; }
  get isPrivate() { return (this.#data.flags & (0x01 << USER_FLAGS.PRIV)) !== 0; }

  touch(ipString) {
    if (this.#data.lastSeen.getTime() > Date.now() - 10 * 60 * 1000) {
      return false;
    }
    return touchUser(this.id, ipString);
  }

  hasChannel(cid) { return this.channelIds.has(cid); }
  hasChannelMuted(cid) { return this.channelIds.get(cid); }
  refresh() { return this.getAllowance(true); }

  async getAllowance(refresh = false) {
    if (refresh || (this.banRecheckTs !== null && this.banRecheckTs < Date.now())) {
      const data = await resolveSession(this.#token);
      if (data) {
        this.userlvl = data.userlvl;
        this.#data = data;
        const [isBanned, isMuted, banRecheckTs] = parseListOfBans(data.bans);
        this.isBanned = isBanned;
        this.isMuted = isMuted;
        this.banRecheckTs = banRecheckTs;
      } else {
        return { isBanned: this.isBanned, isMuted: this.isMuted, loggedOut: true };
      }
    }
    return { isBanned: this.isBanned, isMuted: this.isMuted };
  }
}

async function resolveSessionOfRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = unsign(cookies['ppfun.session']);
  const userData = await resolveSession(token);
  if (!userData) {
    delete req.user;
  } else {
    req.user = new User(userData, token);
  }
}

export async function resolveSessionUidOfRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = unsign(cookies['ppfun.session']);
  return resolveSessionUid(token);
}

export async function resolveSessionUidAndAgeOfRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = unsign(cookies['ppfun.session']);
  return resolveSessionUidAndAge(token);
}

export async function verifySession(req, res, next) {
  await resolveSessionOfRequest(req);
  next();
}

export async function verifySessionPromisified(req, res, next) {
  if (!req.promise) req.promise = [];
  req.promise.push(resolveSessionOfRequest(req));
  next();
}

export function ensureLoggedIn(req, res, next) {
  if (!req.user) {
    const errorMessage = req.ttag ? req.ttag.t`You are not logged in` : 'You are not logged in';
    const error = new Error(errorMessage);
    error.status = 401;
    return next(error);
  }
  next();
}

export async function openSession(req, res, userId, durationHours = 720, noCookie = false) {
  const { ip, lang } = req;
  const [token, newLocation] = await createSession(userId, durationHours, ip, req.device);
  
  if (!token) return null;

  const userData = await resolveSession(token);
  if (!userData) {
    delete req.user;
    return null;
  }

  req.user = new User(userData, token);
  req.user.touch(ip.ipString);

  if (newLocation) {
    User.mailProvider?.sendNewLocationMail(req.user.id, req.ip.getHost(), lang, ip.ipString);
  }

  if (!noCookie) {
    const actualDuration = durationHours === null ? 24 * 365 * 15 : durationHours;
    const cookieOptions = { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'None' 
    };

    if (actualDuration > 0) {
      cookieOptions.expires = new Date(Date.now() + actualDuration * HOUR);
    }
    res.cookie('ppfun.session', sign(token), cookieOptions);
  }
  return token;
}

export function clearCookie(req, res) {
  res.clearCookie('ppfun.session', {
    httpOnly: true, 
    secure: true, 
    sameSite: 'None'
  });
}

export async function closeSession(req, res) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = unsign(cookies['ppfun.session']);
  const success = await removeSession(token);
  clearCookie(req, res);
  delete req.user;
  return success;
}
