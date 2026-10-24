// Site-wide SEO constants. Plain TS with no Vite/browser imports, so the build-time prerender
// script (scripts/prerender.ts) and the browser share exactly the same values.

/** The production URL. Canonical links, sitemap and social previews always point here. */
export const SITE_URL = 'https://krish-portfolio-dev.vercel.app';
export const SITE_NAME = 'Krish Khati';
export const DEFAULT_TITLE = 'Krish Khati | Software Developer & AI Specialist';

/**
 * Fact-dense identity block. It is the visible About-section paragraph, the paragraph in the
 * prerendered static HTML and the Person JSON-LD description — one string so they can never drift.
 */
export const IDENTITY_SUMMARY =
  'Krish Khati (also known as Krrish Dhiman) is a software developer and AI/digital marketing specialist based in Pundri, Haryana, India. He builds AI-powered tools, web applications, and automation projects, and works with Python, C, and modern AI APIs.';

/** ~155-char snippet for <meta name="description"> and og:description, which search/social truncate. */
export const DEFAULT_DESCRIPTION =
  'Krish Khati (Krrish Dhiman) is a software developer and AI/digital marketing specialist in Pundri, Haryana, India. He builds AI-powered tools and web apps.';

/** 1200×630 green/dark share image used when a page has no cover of its own. */
export const DEFAULT_OG_IMAGE = '/og-default.png';
export const DEFAULT_OG_ALT =
  'Krish Khati — software developer and AI/digital marketing specialist based in Pundri, Haryana, India.';

/** IndexNow key; the matching key file is public/<key>.txt. It's public by design. */
export const INDEXNOW_KEY = 'cdc12c37e7f44adfe1b7b8e92683bd1d';

export const absoluteUrl = (path: string) =>
  /^https?:\/\//i.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

export const postPath = (slug: string) => `/blog/${slug}`;
