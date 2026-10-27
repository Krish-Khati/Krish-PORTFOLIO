/*
 * Regenerates the shipped category fallback covers in public/blog-covers/.
 * Run with: pnpm --filter @workspace/krish-portfolio run generate-fallback-covers
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fallbackCoverName, renderCoverSvg, writeCoverFiles } from './cover-art';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coversDir = path.join(root, 'public', 'blog-covers');

const categories = ['Journey', 'Learning', 'Projects', 'AI', 'Marketing', 'Default'];

fs.mkdirSync(coversDir, { recursive: true });

for (const category of categories) {
  const name = fallbackCoverName(category);
  const title = category === 'Default' ? 'Krish Khati' : category;
  const svg = renderCoverSvg({ title, category, eyebrow: 'KRISH KHATI / BLOG' });
  await writeCoverFiles(
    svg,
    path.join(coversDir, name.replace(/\.webp$/, '.jpg')),
    path.join(coversDir, name),
  );
  console.log(`wrote ${name}`);
}

// Self-check: every category must have both a WebP (on-page) and JPG (social preview) asset.
for (const category of categories) {
  const name = fallbackCoverName(category);
  for (const file of [name, name.replace(/\.webp$/, '.jpg')]) {
    const filePath = path.join(coversDir, file);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1000) {
      throw new Error(`Fallback cover is missing or empty: ${file}`);
    }
  }
}
console.log('All fallback covers verified.');
