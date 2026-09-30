/*
 * Right-sized images for photos stored in the Supabase "covers" bucket.
 *
 * Supabase Storage can resize and re-encode a public image on the fly
 * (/storage/v1/render/image/public/… ?width=&format=webp). Without it a phone downloads the full-size
 * original (an about-me PNG was 1.7 MB for a 340 px slot). Anything that isn't a Supabase raster
 * image — static files, demo-mode data: URLs, SVG/GIF — is returned untouched.
 */

const OBJECT_PATH = '/storage/v1/object/public/';
const RENDER_PATH = '/storage/v1/render/image/public/';

const canResize = (url: string) => url.includes(OBJECT_PATH) && /\.(png|jpe?g|webp)(\?|$)/i.test(url);

/** `url` resized to `width` pixels wide as WebP (never upscaled). */
export function resizedImage(url: string, width: number, quality = 72): string {
  if (!canResize(url)) return url;
  const base = url.split('?')[0].replace(OBJECT_PATH, RENDER_PATH);
  return `${base}?width=${width}&quality=${quality}&format=webp`;
}

/** A `srcset` for `url`, or undefined when the image can't be resized. */
export function imageSrcSet(url: string, widths: number[]): string | undefined {
  if (!canResize(url)) return undefined;
  return widths.map((w) => `${resizedImage(url, w)} ${w}w`).join(', ');
}
