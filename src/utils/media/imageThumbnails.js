/*
 * create media thumbnails
 */
import fs from 'fs';
import sharp from 'sharp';

export default async function createImageThumbnails(
  filePath, thumbFilePath, iconFilePath,
) {
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    const stats = {
      width: metadata.width,
      height: metadata.height,
    };
    /*
     * first attempt: 320x240
     * second: 200x150
     */
    let previewBuffer = await image.resize(200, 150, {
      fit: 'inside',
      withoutEnlargement: true,
    }).webp({
      quality: 80,
      effort: 4,
    }).toBuffer();

    [, previewBuffer] = await Promise.all([
      fs.promises.writeFile(thumbFilePath, previewBuffer),
      sharp(previewBuffer).resize(48, 48, {
        fit: 'cover',
        position: 'center',
      }).webp({ quality: 75 }).toBuffer(),
    ]);

    const [, { channels }] = await Promise.all([
      fs.promises.writeFile(iconFilePath, previewBuffer),
      sharp(previewBuffer).stats(),
    ]);

    const r = Math.round(channels[0].mean);
    const g = Math.round(channels[1].mean);
    const b = Math.round(channels[2].mean);
    stats.avgColor = (r << 16) | (g << 8) | b;

    return stats;
  } catch (error) {
    console.error(
      `MEDIA: Could not create thumbnails for ${filePath} ${error.message}`,
    );
    throw new Error('Could not create image thumbnails');
  }
}
