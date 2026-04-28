/*
 * stores perceptive hashes for images
 */
import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';

const ImageHash = sequelize.define('ImageHash', {
  /*
   * id of media table, primary key and foreign key
   */
  mid: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },

  /*
   * perceptive hash, 64bit integer, resolved via hamming distance
   */
  pHash: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },
});


export async function addImageHash(shortId, extension, pHash) {
  try {
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO ImageHashes (mid, pHash) SELECT m.id, CONV(?, 16, 10) AS pHash FROM Media m WHERE m.shortId = ? AND m.extension = ?', {
        replacements: [pHash, shortId, extension],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
  } catch (error) {
    console.error(`SQL Error on addImageHash: ${error.message}`);
  }
}

export default ImageHash;
