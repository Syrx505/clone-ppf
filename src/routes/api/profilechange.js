/*
 *
 * change stuff in a users profile
 * TODO: this should be an universal api, privatize etc. should be merged into
 * it
 *
 */
import fs from 'fs';
import path from 'path';

import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { getMediaType } from '../../data/sql/Media.js';
import { setUserAvatar, setCustomFlag } from '../../data/sql/Profile.js';

async function profilechange(req, res) {
  req.tickRateLimiter(15000);
  const { ttag: { t }, user, body: { profile } } = req;

  if (!profile || typeof profile !== 'object') {
    throw new Error('Invalid request, no profile object included');
  }

  const { avatarId, customFlag } = profile;
  let changed = false;
  let needsReload = false;
  if (avatarId === null) {
    changed = true;
    needsReload = true;
    const success = await setUserAvatar(user.id, null);
    if (success) {
      logger.info(`User ${user.name} removed his avatar`);
    } else {
      throw new Error('Could not remove your avatar');
    }
  } else if (typeof avatarId === 'string') {
    changed = true;
    needsReload = true;
    const isLegitMedia = await getMediaType(avatarId) === 'image';
    if (!isLegitMedia) {
      throw new Error(t`Avatar can only be an image`);
    }
    const success = await setUserAvatar(user.id, avatarId);
    if (success) {
      logger.info(`User ${user.name} changed avatar to ${avatarId}`);
    } else {
      throw new Error(t`Could not set your avtar`);
    }
  }

  if (customFlag === null) {
    changed = true;
    needsReload = true;
    const success = await setCustomFlag(user.id, null);
    if (success) {
      logger.info(`User ${user.name} removed his custom flag`);
    } else {
      throw new Error('Could not remove your custom flag');
    }
  } else if (typeof customFlag === 'string') {
    changed = true;
    needsReload = true;
    if (customFlag.length !== 2
      /* eslint-disable max-len */
      || customFlag.includes('/') || customFlag.includes('\\') || customFlag.includes('.')
      || ['zz', 'z1', 'z2', 'z3', 'xx', 'a1', 'a2', 'yy', 'ap'].includes(customFlag)
      || !fs.existsSync(path.join(__dirname, 'public', 'cf', `${customFlag}.gif`))
      /* eslint-enable max-len */
    ) {
      throw new Error('This custom flag is invalid');
    }
    const success = await setCustomFlag(user.id, customFlag);
    if (success) {
      logger.info(`User ${user.name} changed flag to ${customFlag}`);
    } else {
      throw new Error('Could not set your custom flag');
    }
  }

  if (!changed) {
    throw new Error('You did not define anything to change');
  }

  if (needsReload) {
    socketEvents.reloadUser(user.id);
  }

  res.json({
    status: 'ok',
  });
}

export default profilechange;
