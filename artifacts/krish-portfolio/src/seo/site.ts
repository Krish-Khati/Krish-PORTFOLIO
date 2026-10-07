// Site-wide SEO constants. Plain TS with no Vite/browser imports, so the build-time prerender
// script (scripts/prerender.ts) and the browser share exactly the same values.

/** The production URL. Canonical links, sitemap and social previews always point here. */
export const SITE_URL = 'https://krish-portfolio-dev.vercel.app';
export const SITE_NAME = 'Krish Khati';
export const DEFAULT_TITLE = 'Krish Khati | AI Developer';
export const DEFAULT_DESCRIPTION =
  'Krish Khati - AI Developer building AI-powered apps, chatbots and web projects: gym website design, memory match game, AI language translator and calculator app UI.';

/** 1200×630 green/dark share image used when a page has no cover of its own. */
export const DEFAULT_OG_IMAGE = '/og-default.png';
export const DEFAULT_OG_ALT = 'Krish Khati — AI developer. Blog and projects.';

/** IndexNow key; the matching key file is public/<key>.txt. It's public by design. */
export const INDEXNOW_KEY = 'cdc12c37e7f44adfe1b7b8e92683bd1d';

export const absoluteUrl = (path: string) =>
  /^https?:\/\//i.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

export const postPath = (slug: string) => `/blog/${slug}`;
