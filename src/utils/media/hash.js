/*
 * calculte sha256 hash of file
 */
import fs from 'fs';
import { createHash } from 'crypto';

export default function calculateHash(filepath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filepath);
    const cryptHash = createHash('sha256');

    readStream.on('data', (chunk) => {
      cryptHash.update(chunk);
    });
    readStream.on('end', () => {
      resolve(cryptHash.digest('hex'));
    });
    readStream.on('error', (error) => {
      reject(error);
    });
  });
}
