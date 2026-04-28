/**
 * Sequelize SQL
 */

/* eslint-disable max-len */

import Sequelize from 'sequelize';

import {
  MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PW, LOG_MYSQL,
} from '../../core/config.js';

// MYSQL_PORT-u config-dən çəkə bilmirsə, birbaşa 26936 istifadə edək
const MYSQL_PORT = process.env.MYSQL_PORT || 26936;

const sequelize = new Sequelize(MYSQL_DATABASE, MYSQL_USER, MYSQL_PW, {
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  dialect: 'mysql',
  define: {
    timestamps: false,
  },
  pool: {
    min: 0,
    max: 10,
    idle: 10000,
    acquire: 30000, // Qoşulma müddətini 30 saniyəyə qaldırdıq
  },
  // eslint-disable-next-line no-console
  logging: (LOG_MYSQL) ? (sql) => console.info(sql) : false,
  dialectOptions: {
    connectTimeout: 30000, // Timeout-u 30 saniyə etdik
    multipleStatements: true,
    maxPreparedStatements: 100,
    supportBigNumbers: true,
    // AİVEN ÜÇÜN KRİTİK SSL AYARI:
    ssl: {
      rejectUnauthorized: false
    }
  },
});

/**
 * nest raw queries
 */
export function nestQuery(query, primaryKey) {
  if (!query?.length) {
    if (primaryKey) {
      return [];
    }
    return null;
  }
  const ret = [];

  const mainColumns = [];
  const nestedColumns = [];
  const columns = Object.keys(query[0]);
  let i = columns.length;
  while (i > 0) {
    i -= 1;
    const k = columns[i];
    const seperator = k.indexOf('.');
    if (seperator === -1) {
      mainColumns.push(k);
    } else {
      nestedColumns.push(
        [k.substring(0, seperator), k.substring(seperator + 1)],
      );
    }
  }

  i = query.length;
  while (i > 0) {
    i -= 1;
    const row = query[i];

    let target;
    if (primaryKey) {
      const primary = row[primaryKey];
      target = ret.find(
        (r) => r[primaryKey].toString() === primary.toString(),
      );
    } else {
      // eslint-disable-next-line prefer-destructuring
      target = ret[0];
    }

    if (!target) {
      target = {};
      mainColumns.forEach((k) => {
        target[k] = row[k];
      });
      nestedColumns.forEach(([k]) => {
        target[k] = [];
      });
      ret.push(target);
    }

    const nestedObj = {};
    const notNullObj = {};
    let u = nestedColumns.length;
    while (u > 0) {
      u -= 1;
      const [k, v] = nestedColumns[u];
      if (!nestedObj[k]) {
        nestedObj[k] = {};
      }
      const value = row[`${k}.${v}`];
      const obj = nestedObj[k];
      obj[v] = value;
      if (value !== null) {
        notNullObj[k] = obj;
      }
    }

    const notNullKeys = Object.keys(notNullObj);
    u = notNullKeys.length;
    while (u > 0) {
      u -= 1;
      const k = notNullKeys[u];
      target[k].push(nestedObj[k]);
    }
  }

  return (primaryKey) ? ret : ret[0];
}

function jsonReplacer(key, value) {
  if (key) {
    const originalValue = this[key];
    let modifier;
    if (originalValue instanceof Date) {
      modifier = 'ts';
      value = originalValue.getTime();
    }
    if (modifier) {
      value = `ts(${value})`;
    }
  }
  return value;
}

function jsonReviver(key, value, context) {
  if (context && typeof value === 'string' && value.endsWith(')')) {
    const openingBreaket = value.indexOf('(');
    if (openingBreaket !== -1) {
      const parsedValue = value.substring(openingBreaket + 1, value.length - 1);
      const modifier = value.substring(0, openingBreaket);
      switch (modifier) {
        case 'ts':
          return new Date(Number(parsedValue));
        default:
          // nothing
      }
    }
  }
  return value;
}

export function sequelizeRawToJson(rawObject) {
  return JSON.stringify(rawObject, jsonReplacer);
}

export function jsonToSequelizeRaw(json) {
  return JSON.parse(json, jsonReviver);
}

/*
 * estabish database connection
 */
export const sync = async (alter = false) => {
  await sequelize.sync({ alter: { drop: alter } });

  const functions = {
    IP_TO_BIN: `CREATE FUNCTION IF NOT EXISTS IP_TO_BIN(ip VARCHAR(39)) RETURNS VARBINARY(8) DETERMINISTIC CONTAINS SQL
BEGIN
  DECLARE longBin VARBINARY(16);
  SET longBin = INET6_ATON(ip);
  IF LENGTH(longBin) > 4
    THEN
      RETURN SUBSTRING(longBin, 1, 8);
    ELSE
      RETURN (longBin);
  END IF;
END`,
    BIN_TO_IP: `CREATE FUNCTION IF NOT EXISTS BIN_TO_IP(bin VARBINARY(8)) RETURNS VARCHAR(21) DETERMINISTIC CONTAINS SQL
BEGIN
  RETURN (INET6_NTOA(IF(LENGTH(bin) > 4, CAST(bin as BINARY(16)), bin)));
END`,
    NORMALIZE_TPID: `CREATE FUNCTION IF NOT EXISTS NORMALIZE_TPID(provider TINYINT(4) UNSIGNED, tip VARCHAR(80)) RETURNS VARCHAR(80) DETERMINISTIC CONTAINS SQL
BEGIN
  DECLARE atPos TINYINT UNSIGNED;
  IF provider != 1 THEN
    RETURN NULL;
  END IF;
  SET atPos = LOCATE('@', tip);
  IF atPos = 0 THEN
    RETURN NULL;
  END IF;
  RETURN (LOWER(CONCAT(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(tip, '@', 1), '+', 1), '.', ''),'@',(SUBSTRING_INDEX(tip, '@', -1)))));
END`,
    UUID_TO_BIN: `CREATE FUNCTION IF NOT EXISTS UUID_TO_BIN(uuid CHAR(36)) RETURNS BINARY(16) DETERMINISTIC
BEGIN
  RETURN UNHEX(REPLACE(uuid, '-', ''));
END`,
    BIN_TO_UUID: `CREATE FUNCTION IF NOT EXISTS BIN_TO_UUID(bin_uuid BINARY(16)) RETURNS CHAR(36) DETERMINISTIC
BEGIN
    DECLARE hex_uuid CHAR(32);
    SET hex_uuid = HEX(bin_uuid);
    RETURN LOWER(CONCAT(
        SUBSTR(hex_uuid, 1, 8), '-',
        SUBSTR(hex_uuid, 9, 4), '-',
        SUBSTR(hex_uuid, 13, 4), '-',
        SUBSTR(hex_uuid, 17, 4), '-',
        SUBSTR(hex_uuid, 21, 12)
    ));
END`,
    STORE_CHAT_MESSAGE: `CREATE PROCEDURE IF NOT EXISTS STORE_CHAT_MESSAGE(IN p_cid INT UNSIGNED, IN p_uid INT UNSIGNED, IN p_message VARCHAR(200) CHARSET utf8mb4) NOT DETERMINISTIC MODIFIES SQL DATA
BEGIN
  UPDATE Channels SET lastMessage = NOW() WHERE id = p_cid;
  INSERT INTO Messages (message, uid, cid, createdAt) VALUES (p_message, p_uid, p_cid, NOW());
  SELECT LAST_INSERT_ID() AS id;
END`,
    GET_CLOSE_IMAGE: `CREATE PROCEDURE IF NOT EXISTS GET_CLOSE_IMAGE(IN p_pHash CHAR(16)) READS SQL DATA
BEGIN
  DECLARE i_pHash BIGINT UNSIGNED;
  SET i_pHash = CONV(p_pHash, 16, 10);
  SELECT extension, shortId, type, width, height, avgColor FROM ImageHashes ih
    INNER JOIN Media m ON m.id = ih.mid
  WHERE BIT_COUNT(pHash ^ i_pHash) < 2 LIMIT 1;
END`,
    GET_CLOSE_BANNED_IMAGE: `CREATE PROCEDURE IF NOT EXISTS GET_CLOSE_BANNED_IMAGE(IN p_pHash CHAR(16)) READS SQL DATA
BEGIN
  DECLARE i_pHash BIGINT UNSIGNED;
  SET i_pHash = CONV(p_pHash, 16, 10);
  SELECT BIN_TO_UUID(uuid) AS mbid, LOWER(HEX(hash)) AS hash, reason FROM MediaBans WHERE BIT_COUNT(pHash ^ i_pHash) < 9 LIMIT 1;
END`,
    GET_USER_ALLOWANCE: `CREATE PROCEDURE IF NOT EXISTS GET_USER_ALLOWANCE(uid INTEGER UNSIGNED) READS SQL DATA
BEGIN
  SELECT
    (SELECT bid FROM UserBans ub WHERE ub.uid = uid LIMIT 1) AS userBanId,
    (SELECT tb.bid FROM Users u INNER JOIN ThreePIDs t ON t.uid = u.id INNER JOIN ThreePIDBans tb ON tb.tid = t.id WHERE u.id = uid LIMIT 1) AS tpidBanId;
END`,
    WHOIS_REFERRAL_OF_IP: `CREATE PROCEDURE IF NOT EXISTS WHOIS_REFERRAL_OF_IP(ip VARCHAR(39)) READS SQL DATA
BEGIN
  DECLARE binIp VARBINARY(8);
  SET binIp = IP_TO_BIN(ip);
  SELECT host FROM WhoisReferrals WHERE min <= binIp AND max >= binIp AND LENGTH(binIP) = LENGTH(min);
END`,
  };

  const isMariaDB = (await sequelize.query('SELECT VERSION() AS version'))[0][0].version.includes('MariaDB');
  if (!isMariaDB) {
    delete functions.UUID_TO_BIN;
    delete functions.BIN_TO_UUID;
  }

  const promises = [];
  for (const name of Object.keys(functions)) {
    if (alter) {
      if (functions[name].includes('PROCEDURE')) {
        promises.push(sequelize.query(`DROP PROCEDURE IF EXISTS ${name}`, { raw: true }));
      } else if (functions[name].includes('FUNCTION')) {
        promises.push(sequelize.query(`DROP FUNCTION IF EXISTS ${name}`, { raw: true }));
      }
    }
    promises.push(sequelize.query(functions[name]));
  }
  try {
    await Promise.all(promises);
  } catch (err) {
    throw new Error(`Error on creating SQL Function: ${err.message}`);
  }
};

export default sequelize;

export default sequelize;
