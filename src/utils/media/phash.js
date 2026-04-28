/*
 * Calculate a perceptual hash of an image, based on sharp-phash
 * https://github.com/btd/sharp-phash/blob/master/index.js
 *
 * MIT License
 *
 * Copyright (c) 2016 Denis Bardadym
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import sharp from 'sharp';

const SAMPLE_SIZE = 32;
const LOW_SIZE = 8;


function initSQRT(N) {
  const c = new Array(N);
  for (let i = 1; i < N; i++) {
    c[i] = 1;
  }
  c[0] = 1 / Math.sqrt(2.0);
  return c;
}

function initCOS(N) {
  const cosines = new Array(N);
  for (let k = 0; k < N; k++) {
    cosines[k] = new Array(N);
    for (let n = 0; n < N; n++) {
      cosines[k][n] = Math.cos(((2 * k + 1) / (2.0 * N)) * n * Math.PI);
    }
  }
  return cosines;
}

const SQRT = initSQRT(SAMPLE_SIZE);
const COS = initCOS(SAMPLE_SIZE);

function applyDCT(f, size) {
  const N = size;

  const F = new Array(N);
  for (let u = 0; u < N; u++) {
    F[u] = new Array(N);
    for (let v = 0; v < N; v++) {
      let sum = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          sum += COS[i][u] * COS[j][v] * f[i][j];
        }
      }
      sum *= (SQRT[u] * SQRT[v]) / 4;
      F[u][v] = sum;
    }
  }
  return F;
}

export default async function pHash(image) {
  const data = await sharp(image)
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'fill' })
    .greyscale()
    .rotate()
    .raw()
    .toBuffer();
  // copy signal
  const s = new Array(SAMPLE_SIZE);
  for (let x = 0; x < SAMPLE_SIZE; x += 1) {
    s[x] = new Array(SAMPLE_SIZE);
    for (let y = 0; y < SAMPLE_SIZE; y += 1) {
      s[x][y] = data[SAMPLE_SIZE * y + x];
    }
  }

  // apply 2D DCT II
  const dct = applyDCT(s, SAMPLE_SIZE);

  // get AVG on high frequencies
  let totalSum = 0;
  for (let x = 0; x < LOW_SIZE; x += 1) {
    for (let y = 0; y < LOW_SIZE; y += 1) {
      totalSum += dct[x + 1][y + 1];
    }
  }

  const avg = totalSum / (LOW_SIZE * LOW_SIZE);

  const hash = new Uint8Array(
    Math.ceil(LOW_SIZE * LOW_SIZE / 8),
  );

  for (let x = 0; x < LOW_SIZE; x += 1) {
    for (let y = 0; y < LOW_SIZE; y += 1) {
      if (dct[x + 1][y + 1] > avg) {
        const pos = LOW_SIZE * x + y;
        const posInByte = pos % 8;
        hash[(pos - posInByte) / 8] |= 1 << (7 - posInByte);
      }
    }
  }

  let hexHash = '';
  for (let i = 0; i < hash.byteLength; i += 1) {
    let hex = hash[i].toString(16);
    if (hex.length === 1) {
      hex = `0${hex}`;
    }
    hexHash += hex;
  }

  return hexHash;
}
