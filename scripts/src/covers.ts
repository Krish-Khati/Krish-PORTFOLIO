/*
 * Category fallback covers shipped in the site's public/blog-covers folder.
 * The automation writes one of these at insert time, so a new post is never saved with an empty cover;
 * fetch-blog-covers.ts later replaces it with a real photo or a generated per-post cover.
 */

const FALLBACK_COVERS: Record<string, string> = {
  Journey: '/blog-covers/fallback-journey.webp',
  Learning: '/blog-covers/fallback-learning.webp',
  Projects: '/blog-covers/fallback-projects.webp',
  AI: '/blog-covers/fallback-ai.webp',
  Marketing: '/blog-covers/fallback-marketing.webp',
};

export const fallbackCoverFor = (category: string) =>
  FALLBACK_COVERS[category] ?? '/blog-covers/fallback-default.webp';
