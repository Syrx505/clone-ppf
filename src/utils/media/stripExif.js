/*
 * strip exif data from media
 */
import { spawn } from 'child_process';

const queue = [];
let isStripping = false;
let exiftoolProcess;
let responseBuffer = '';

function spawnExiftool(resultCallback) {
  console.log('Spawn exiftool');
  exiftoolProcess = spawn('exiftool', [
    '-stay_open', 'True', '-@', '-',
  ], {
    shell: process.platform === 'win32',
  });

  const cleanUp = () => {
    if (exiftoolProcess) {
      exiftoolProcess.stdin.destroy();
      exiftoolProcess.stdout.destroy();
      exiftoolProcess = null;
    }
    for (let i = 0; i < queue.length; i += 1) {
      queue[i][1]();
    }
    queue.length = 0;
    responseBuffer = '';
    isStripping = false;
  };

  exiftoolProcess.on('close', cleanUp);
  exiftoolProcess.on('error', cleanUp);

  exiftoolProcess.stdout.on('data', (data) => {
    responseBuffer += data.toString();

    if (responseBuffer.includes('{ready}')) {
      const responses = responseBuffer.split('{ready}');

      for (let i = 0; i < responses.length - 1; i++) {
        const response = responses[i].trim();
        /*
         * errors is also on stdout
         */
        if (response && queue.length > 0) {
          const [filename, callback] = queue.shift();
          if (response.toLowerCase().includes('error')) {
            console.error(
              `MEDIA: EXIF stripping failed for ${filename}: ${response}`,
            );
          }
          callback();
        }
      }

      responseBuffer = responses[responses.length - 1] || '';
      setTimeout(resultCallback, 10);
    }
  });
}

export function destruct() {
  console.log('End exiftool child process');
  return new Promise((resolve) => {
    if (exiftoolProcess && !exiftoolProcess.killed) {
      exiftoolProcess.stdin.write('-stay_open\nFalse\n-execute\n');
      setTimeout(() => {
        if (exiftoolProcess && !exiftoolProcess.killed) {
          exiftoolProcess.kill('SIGTERM');
        }
        resolve();
      }, 1000);
    }
  });
}

function stripExifFromQueue() {
  if (!queue.length) {
    isStripping = false;
    return;
  }
  isStripping = true;
  if (!exiftoolProcess) {
    spawnExiftool(stripExifFromQueue);
  }
  const command = `${queue[0][0]}\n-all=\n-overwrite_original\n-execute\n`;

  exiftoolProcess.stdin.write(command, (error) => {
    if (error) {
      queue.shift()[1]();
      stripExifFromQueue();
    }
  });
}

export default function stripExif(filename) {
  return new Promise((resolve) => {
    queue.push([filename, resolve]);
    if (!isStripping) {
      stripExifFromQueue();
    }
  });
}
