import { logger } from '../../common/logger';

const cache = new Map();

function loadImageDataMv2(size, url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      document.documentElement.appendChild(canvas);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Cannot load image data'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, size, size);
      canvas.remove();
      resolve(data);
    };
    img.onerror = () => {
      reject(new Error(`Failed to load icon image: ${url}`));
    };
  });
}

const loadImageDataMv3 = async (size, url) => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Network response was not ok for url: ${url}`);
    }
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const offscreenCanvas = new OffscreenCanvas(size, size);
    const ctx = offscreenCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Cannot load image data');
    }

    ctx.drawImage(bitmap, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    return imageData;
  } catch (error) {
    logger.error('[ext.iconsCache]: failed to load image:', error);
    throw error;
  }
};

async function getImageData(size, url) {
  const loadImageDataFn = __IS_MV3__ ? loadImageDataMv3 : loadImageDataMv2;
  const imageData = cache.get(url);
  if (!imageData) {
    const data = await loadImageDataFn(Number(size), url);
    cache.set(url, data);
    return [size, data];
  }

  return [size, imageData];
}

/**
 * Matches urls from browserAction.setIcon 'path' property with cached ImageData values
 * and returns 'imageData' object for this action.
 */
export async function getIconImageData(path) {
  const imageDataEntriesPromises = Object.entries(path).map(([size, url]) => getImageData(size, url));

  const imageDataEntries = await Promise.all(imageDataEntriesPromises);

  return Object.fromEntries(imageDataEntries);
}
