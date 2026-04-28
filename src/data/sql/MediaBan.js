/*
 * bans of mdia
 */
import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { generateUUID } from '../../utils/hash.js';

const MediaBan = sequelize.define('MediaBan', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uuid: {
    type: 'BINARY(16)',
    allowNull: false,
    unique: 'uuid',
    defaultValue: generateUUID,
  },

  muid: {
    type: DataTypes.INTEGER.UNSIGNED,
  },

  /*
   * according to MEDIA_BAN_REASONS
   * 1: gore,
   * 2: csam,
   * 3: degeneracy,
   * 4: scam,
   * 5: terrorism,
   * 6: propaganda,
   * 7: doxing,
   */
  reason: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  pHash: {
    type: DataTypes.BIGINT.UNSIGNED,
    unique: 'phash',
  },

  hash: {
    type: 'BINARY(32)',
    unique: 'hash',
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * check if media is banned
 * @param [hashes] sha256 hash
 * @param [pHash] perceptive hash
 * @return [{ uuid, hash, pHash, reason }, ...]
 */
export async function hasMediaBan(hashes, pHashes) {
  const where = [];
  let replacements = [];

  if (hashes) {
    if (Array.isArray(hashes)) {
      if (hashes.length) {
        where.push(`hash IN (SELECT h.hash FROM (${
          hashes.map(() => 'SELECT UNHEX(?) AS \'hash\'').join(' UNION ALL ')
        }) AS h)`);
        replacements = replacements.concat(hashes);
      }
    } else {
      where.push('hash = UNHEX(?)');
      replacements.push(hashes);
    }
  }

  try {
    if (where.length) {
      const models = await sequelize.query(
        // eslint-disable-next-line max-len
        `SELECT BIN_TO_UUID(uuid) AS mbid, LOWER(HEX(hash)) AS hash, reason FROM MediaBans WHERE ${
          where.join(' OR ')
        }`, {
          replacements,
          type: QueryTypes.SELECT,
          raw: true,
        },
      );
      if (models?.length) {
        return models;
      }
    }

    if (pHashes) {
      if (Array.isArray(pHashes)) {
        if (pHashes.length) {
          for (let i = 0; i < pHashes.length; i += 1) {
            const pHash = pHashes[i];
            // eslint-disable-next-line no-await-in-loop
            const models = await sequelize.query(
              'CALL GET_CLOSE_BANNED_IMAGE(?)', {
                replacements: [pHash],
                raw: true,
                types: QueryTypes.SELECT,
              },
            );
            if (models?.length) {
              return models;
            }
          }
        }
      } else {
        const models = await sequelize.query(
          'CALL GET_CLOSE_BANNED_IMAGE(?)', {
            replacements: [pHashes],
            raw: true,
            types: QueryTypes.SELECT,
          },
        );
        if (models?.length) {
          return models;
        }
      }
    }
  } catch (error) {
    console.error(`SQL Error on hasMediaBan: ${error.message}`);
  }
  return [];
}

/**
 * ban media by id
 * @param mediaId shortId:extension
 * @param reason MEDIA_BAN_REASON
 * @param muid id of the mod that bans
 * @return mediaSqlIdif success, null otherwise
 */
export async function banMedia(mediaId, reason, muid = null) {
  try {
    if (!mediaId || !reason) {
      return null;
    }
    const [shortId, extension] = mediaId.split(':');
    if (!shortId || !extension) {
      return null;
    }
    const model = await sequelize.query(
      'SELECT id FROM Media WHERE shortId = ? AND extension = ?', {
        replacements: [shortId, extension],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    if (!model) {
      return null;
    }
    const mediaSqlId = model.id;
    await sequelize.query(
      // eslint-disable-next-line max-len
      `INSERT IGNORE INTO MediaBans (uuid, muid, reason, hash, pHash, createdAt) SELECT ?, ?, ?, m.hash, i.pHash, NOW() FROM Media m
  LEFT JOIN ImageHashes i ON i.mid = m.id
WHERE m.id = ?`, {
        replacements: [generateUUID(), muid, reason, mediaSqlId],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return mediaSqlId;
  } catch (error) {
    console.error('SQL Error on banMedia:', error.message);
    return null;
  }
}

/**
 * unban media by uuid
 * @param mediaBanUuid
 * @return sucess boolean
 */
export async function unbanMedia(mediaBanUuid) {
  try {
    if (!mediaBanUuid) {
      return false;
    }
    await sequelize.query(
      'DELETE FROM MediaBans WHERE uuid = UUID_TO_BIN(?)', {
        replacements: [mediaBanUuid],
        raw: true,
        type: QueryTypes.DELETE,
      },
    );
    return true;
  } catch (error) {
    console.error('SQL Error on unbanMedia:', error.message);
    return false;
  }
}

export default MediaBan;
