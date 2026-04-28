/*
 * enforce server wide and user quota
 */

import { getState, setState } from '../../core/SharedState.js';
import { getTotalUsedSpace, getUserUsedSpace } from '../../data/sql/Media.js';
import {
  TOTAL_MEDIA_SIZE_MB, MAX_USER_MEDIA_SIZE_MB,
} from '../../core/config.js';
import { DailyCron } from '../cron.js';

export async function updateTotalQuota() {
  const sizeMb = await getTotalUsedSpace();
  if (sizeMb !== null) {
    await setState('totalMediaUsage', sizeMb);
  }
  return sizeMb;
}

DailyCron.hook(updateTotalQuota);

/**
 * check if we reached our total allowed amount of storage used
 * @return boolean, true if quota surpassed
 */
export async function checkTotalQuotaReached() {
  if (!TOTAL_MEDIA_SIZE_MB) {
    return false;
  }
  let sizeMb = await getState('totalMediaUsage');
  if (sizeMb === null) {
    sizeMb = await updateTotalQuota() || 0;
  }
  return sizeMb > TOTAL_MEDIA_SIZE_MB;
}

/**
 * check if user reached his quota
 * @return boolean, true if quota surpassed
 */
export async function checkUserQuotaReached(userId, ipString) {
  if (!userId && !ipString) {
    return false;
  }
  const sizeMb = await getUserUsedSpace(userId, ipString);
  if (sizeMb === null) {
    // default to quota-reached for user
    return true;
  }
  return sizeMb > MAX_USER_MEDIA_SIZE_MB;
}
