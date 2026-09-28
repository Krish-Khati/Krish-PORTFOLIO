import { slugify } from '@/lib/text-blocks';

/*
 * Browser-side image SEO for project screenshots, run on every upload before anything leaves the
 * browser: resize to at most 1600px wide, re-encode as WebP (~80% quality) — which also strips
 * EXIF/GPS metadata, since only the pixels are redrawn — and record the final width/height for
 * the <img> tags. Also makes a small thumbnail for the gallery's thumbnail row and a compact JPEG
 * copy to send to the alt-text model.
 */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_UPLOAD_MB = 5;
const MAX_WIDTH = 1600;
const THUMB_WIDTH = 320;
const AI_WIDTH = 1024;
const WEBP_QUALITY = 0.8;

/** A human-readable reason the file can't be used, or null if it's fine. */
export function checkFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    const kind = file.type ? file.type.replace('image/', '').toUpperCase() : 'this file type';
    return `${file.name} is ${kind} — please use JPG, PNG or WebP.`;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_UPLOAD_MB} MB.`;
  }
  return null;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(src: Blob | string): Promise<Decoded> {
  if (typeof src !== 'string' && typeof createImageBitmap === 'function') {
    try {
      // 'from-image' applies the EXIF rotation, so phone photos come out the right way up.
      const bmp = await createImageBitmap(src, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* fall back to <img> below */ }
  }
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    if (typeof src === 'string') img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } catch {
    throw new Error('This image could not be read — it may be damaged or in an unsupported format.');
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  }
}

function draw(img: Decoded, maxWidth: number, background?: string) {
  const scale = Math.min(1, maxWidth / img.width);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.source, 0, 0, width, height);
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** WebP when the browser can encode it (Chrome, Edge, Firefox); otherwise JPEG (older Safari). */
async function encode(canvas: HTMLCanvasElement, quality: number) {
  const webp = await toBlob(canvas, 'image/webp', quality);
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' };
  // JPEG has no transparency — redraw on the site's dark background so transparent PNGs look right.
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d')!;
  ctx.fillStyle = '#0b1411';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  const jpeg = await toBlob(flat, 'image/jpeg', 0.82);
  if (!jpeg) throw new Error('Your browser could not compress this image.');
  return { blob: jpeg, ext: 'jpg' };
}

export type OptimizedImage = {
  blob: Blob;
  thumb: Blob;
  ext: string;
  width: number;
  height: number;
  /** Compact JPEG data URL for the alt-text model. */
  preview: string;
};

export async function optimizeImage(file: File): Promise<OptimizedImage> {
  const img = await decode(file);
  try {
    const main = draw(img, MAX_WIDTH);
    const { blob, ext } = await encode(main, WEBP_QUALITY);
    const { blob: thumb } = await encode(draw(img, THUMB_WIDTH), 0.72);
    const preview = draw(img, AI_WIDTH, '#0b1411').toDataURL('image/jpeg', 0.8);
    return { blob, thumb, ext, width: main.width, height: main.height, preview };
  } finally {
    img.close();
  }
}

/**
 * A compact JPEG data URL of an image that's already online (for "Regenerate alt text" on images
 * that aren't in our own storage). Fails if the image's server doesn't allow cross-origin reads.
 */
export async function previewFromUrl(url: string): Promise<string> {
  const img = await decode(url);
  try {
    return draw(img, AI_WIDTH, '#0b1411').toDataURL('image/jpeg', 0.8);
  } catch {
    throw new Error("This image's server doesn't allow it to be read — upload the image instead.");
  } finally {
    img.close();
  }
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'on', 'in', 'for', 'to', 'its', 'at', 'showing', 'shows', 'screen', 'screenshot', 'page', 'view']);

/** "Fitness Temple pricing page with three membership plans" → "pricing-three-membership-plans". */
export function shortDescription(alt: string, projectName: string) {
  const nameWords = new Set(slugify(projectName).split('-'));
  const words = slugify(alt)
    .split('-')
    .filter((w) => w && !nameWords.has(w) && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return words.slice(0, 5).join('-') || 'screenshot';
}

/** "<project-slug>-<short-description>-<n>.webp" */
export const galleryFileName = (projectSlug: string, description: string, n: number, ext: string) =>
  `${projectSlug || 'project'}-${description}-${n}.${ext}`;
