import path from 'path';

import { MEDIA_FOLDER } from '../../core/config.js';

/**
 * get paths for icon and thumbnail
 * @param filePath path of existing media file
 * @return { thumbFilePath, iconFilePath }
 */
export function getThumbnailPaths(filePath) {
  const { dir, name, ext } = path.parse(filePath);
  let thumbFilePath = path.join(dir, `${name}_${ext.substring(1)}`);
  const iconFilePath = `${thumbFilePath}_icon.webp`;
  const screencapFilePath = `${thumbFilePath}_full.webp`;
  thumbFilePath += '_thumb.webp';
  return { thumbFilePath, iconFilePath, screencapFilePath };
}

/**
 * create path to media file by shortid and extension, (this maybe shouldn't be
 * in this file?)
 * @param shortId
 * @param extension
 * @return local path to media file
 */
export function constructMediaPath(shortId, extension, type) {
  // eslint-disable-next-line max-len
  const folder = path.join(MEDIA_FOLDER, shortId.substring(0, 2), shortId.substring(2, 4));
  if (type === 't') {
    // thumbnail
    return path.join(folder, `${shortId.substring(4)}_${extension}_thumb.webp`);
  }
  if (type === 'i') {
    // icon
    return path.join(folder, `${shortId.substring(4)}_${extension}_icon.webp`);
  }
  return path.join(folder, `${shortId.substring(4)}.${extension}`);
}

const typeToExt = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/jpg': ['jpeg', 'jpg'],
  'image/png': 'png',
  'image/gif': 'gif',
  /*
   * no support in sharpjs yet
   * 'image/jxl': 'jxl',
   */
  'image/webp': 'webp',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};

/**
 * check if mime type fit to its extension
 * @param mimeType
 * @param filename
 * @return boolean
 */
export function mimeTypeFitsToExt(mimeType, filename) {
  const allowedExtensions = typeToExt[mimeType];
  const seperator = filename.lastIndexOf('.');
  if (seperator === -1 || !allowedExtensions) {
    return false;
  }
  const extension = filename.substring(seperator + 1);

  if (Array.isArray(allowedExtensions)) {
    return allowedExtensions.includes(extension);
  }
  return extension === allowedExtensions;
}

/**
 * check if mime type is allowed to be uploaded
 * @param mimeType
 * @return boolean
 */
export function isMimeTypeAllowed(mimeType) {
  if (typeToExt[mimeType]) {
    return true;
  }
  return false;
}

/**
 * get all media from a list of links
 * @param links Array of links or mediaIds
 * @return [[shortId, extension], ...]
 */
export function getMediaFromLinks(links) {
  const media = [];
  for (let i = 0; i < links.length; i += 1) {
    const link = links[i];
    if (link.startsWith('/m/') && link[4] !== '/' && link[9] === '/') {
      /*
       * relative llink
       */
      const shortId = link.substring(3, 9);
      let extEnd = link.indexOf('&', 10);
      if (extEnd === -1) {
        extEnd = link.length;
      }
      const extension = link.substring(
        link.lastIndexOf('.', extEnd) + 1, extEnd,
      );
      media.push([shortId, extension]);
    } else if (link[6] === ':' && link.length > 8) {
      /*
       * mediaId
       */
      media.push(link.split(':'));
    }
  }
  return media;
}

/**
 * get translated reason for media ban
 * @param ttag for translation
 * @param reason reason as number
 * @param mbid uuid of ban
 * @param [filename]
 */
export function mediaBanReasonToDescription(ttag, reason, mbid, filename) {
  const { t } = ttag;
  switch (reason) {
    case 1:
      /* t: This media is banned xyz */
      reason = t`for containing graphic violence`;
      break;
    case 2:
      /* t: This media is banned xyz */
      reason = t`for containing CSAM`;
      break;
    case 3:
      /* t: This media is banned xyz */
      reason = t`for being degenerate`;
      break;
    case 4:
      /* t: This media is banned xyz */
      reason = t`for being an attempt to scam people`;
      break;
    case 5:
      /* t: This media is banned xyz */
      reason = t`for glorifying terrorism`;
      break;
    case 6:
      /* t: This media is banned xyz */
      reason = t`because it is propaganda`;
      break;
    case 7:
      /* t: This media is banned xyz */
      reason = t`for containing personal information`;
      break;
    default:
      reason = '';
  }
  if (filename) {
    return t`The file ${filename} is banned ${reason}. Ban ID: ${mbid}`;
  }
  return t`This media is banned ${reason}. Ban ID: ${mbid}`;
}
