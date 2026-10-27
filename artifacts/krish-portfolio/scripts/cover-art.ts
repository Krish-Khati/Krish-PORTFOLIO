/*
 * Branded fallback cover art for blog posts that no stock-photo provider could cover.
 *
 * The same dark-green gradient, dot grid, icon tile and typography are used for every generated
 * cover, so a post without a photo looks intentional rather than broken. Category covers are
 * shipped as static assets; fetch-blog-covers.ts also renders a per-post version with the title.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Bot, Code2, Compass, GraduationCap, Megaphone, Tag, type LucideIcon } from 'lucide-react';

const FALLBACK_COVERS: Record<string, string> = {
  Journey: 'fallback-journey.webp',
  Learning: 'fallback-learning.webp',
  Projects: 'fallback-projects.webp',
  AI: 'fallback-ai.webp',
  Marketing: 'fallback-marketing.webp',
};

export const fallbackCoverName = (category: string) =>
  FALLBACK_COVERS[category] ?? 'fallback-default.webp';

export const fallbackCoverPath = (category: string) =>
  `/blog-covers/${fallbackCoverName(category)}`;

export const isFallbackCover = (cover: string) =>
  /\/blog-covers\/fallback-[a-z-]+\.webp$/.test(cover);

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Journey: Compass,
  Learning: GraduationCap,
  Projects: Code2,
  AI: Bot,
  Marketing: Megaphone,
};

const iconFor = (category: string) => CATEGORY_ICONS[category] ?? Tag;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function iconMarkup(category: string, size: number, opacity = 1) {
  return renderToStaticMarkup(
    createElement(iconFor(category), {
      size,
      strokeWidth: 1.4,
      color: '#2ecc71',
      opacity,
    }),
  );
}

/** Greedy wrap that keeps titles to three readable lines. */
function wrapTitle(title: string, maxChars = 28, maxLines = 3) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:!?]+$/, '')}…`;
  }
  return lines;
}

export function renderCoverSvg(opts: { title: string; category: string; eyebrow?: string }) {
  const { title, category } = opts;
  const eyebrow = (opts.eyebrow ?? category).toUpperCase();
  const lines = wrapTitle(title);
  const lineHeight = 66;
  const firstBaseline = lines.length === 1 ? 340 : lines.length === 2 ? 310 : 280;
  const titleText = lines
    .map(
      (line, index) =>
        `<text x="600" y="${firstBaseline + index * lineHeight}" text-anchor="middle" fill="#ffffff" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="54" font-weight="700">${escapeXml(line)}</text>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1411"/>
      <stop offset="0.55" stop-color="#10201a"/>
      <stop offset="1" stop-color="#14231f"/>
    </linearGradient>
    <radialGradient id="glow-a" cx="0.18" cy="0.12" r="0.62">
      <stop offset="0" stop-color="#2ecc71" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#2ecc71" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-b" cx="0.92" cy="0.96" r="0.58">
      <stop offset="0" stop-color="#16a085" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#16a085" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="1.5" cy="1.5" r="1.5" fill="#ffffff" fill-opacity="0.08"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow-a)"/>
  <rect width="1200" height="630" fill="url(#glow-b)"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <rect x="32" y="32" width="1136" height="566" rx="28" fill="none" stroke="#2ecc71" stroke-opacity="0.22" stroke-width="2"/>
  <g transform="translate(420, 90)" opacity="0.05">${iconMarkup(category, 360)}</g>
  <g transform="translate(552, 64)">
    <rect width="96" height="96" rx="24" fill="#2ecc71" fill-opacity="0.1" stroke="#2ecc71" stroke-opacity="0.35"/>
    <g transform="translate(19, 19)">${iconMarkup(category, 58)}</g>
  </g>
  <text x="600" y="222" text-anchor="middle" fill="#2ecc71" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="4">${escapeXml(eyebrow)}</text>
  ${titleText}
  <text x="600" y="548" text-anchor="middle" fill="#9fb8ae" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-size="16" font-weight="600" letter-spacing="4">KRISH KHATI</text>
  <rect x="568" y="566" width="64" height="3" rx="1.5" fill="#2ecc71"/>
</svg>`;
}

export async function writeCoverFiles(svg: string, jpgPath: string, webpPath: string) {
  const sharp = (await import('sharp')).default;
  const source = Buffer.from(svg);
  await sharp(source).jpeg({ quality: 88, mozjpeg: true }).toFile(jpgPath);
  await sharp(source).webp({ quality: 88 }).toFile(webpPath);
}
