#!/usr/bin/env tsx
/*
 * Fetches a cover photo for every published blog post that doesn't have one yet.
 *
 * Source priority (configurable via env vars):
 *   1. Pexels        — https://api.pexels.com (needs PEXELS_API_KEY)
 *   2. Unsplash      — https://api.unsplash.com (needs UNSPLASH_ACCESS_KEY)
 *   3. Openverse     — https://api.openverse.org (keyless, CC0/StockSnap)
 *
 * For each post it searches using topic/category keywords, downloads the image as
 * <slug>.jpg and re-encodes to <slug>.webp (on-page <img> uses .webp; .jpg for social).
 *
 * If no provider has a usable photo, it renders a branded cover from the post's title and
 * category (same gradient/icon system as the shipped category fallbacks), so no card is left blank.
 *
 * Posts are read from Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set
 * in .env (so brand-new published posts are picked up automatically); otherwise it falls
 * back to the static list in src/data/blog.ts. Posts that already have a real cover (local
 * files or DB cover column) are skipped; a category fallback is treated as provisional and
 * upgraded to a photo or a generated per-post cover. Newly added covers are registered in the
 * bundledCovers set in src/data/blog.ts and credited in public/blog-covers/CREDITS.txt.
 *
 * Optional: with SUPABASE_SERVICE_ROLE_KEY set, also PATCHes the DB row for each post
 * to set `cover = /blog-covers/<slug>.webp` and a descriptive `cover_alt`.
 *
 * Usage:
 *   pnpm fetch-covers              # fetch missing covers
 *   pnpm fetch-covers --force      # re-fetch even if local files/DB cover exist
 *   pnpm fetch-covers --sync-db    # also write cover/cover_alt to DB (needs service role key)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blogPosts, type BlogPost } from '../src/data/blog';
import { fallbackCoverPath, isFallbackCover, renderCoverSvg, writeCoverFiles } from './cover-art';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const coversDir = path.join(root, 'public', 'blog-covers');
const blogDataSource = path.join(root, 'src', 'data', 'blog.ts');
const creditsFile = path.join(coversDir, 'CREDITS.txt');

const force = process.argv.includes('--force');
const syncDb = process.argv.includes('--sync-db');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

type SourcePost = { slug: string; title: string; cover: string; coverAlt: string; category: string };

async function postsFromSupabase(): Promise<SourcePost[] | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/posts?select=slug,title,cover,cover_alt,category,status&status=eq.published&order=date.desc`;
  try {
    const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      slug: String(r.slug ?? ''),
      title: String(r.title ?? ''),
      cover: String(r.cover ?? ''),
      coverAlt: String(r.cover_alt ?? ''),
      category: String(r.category ?? ''),
    })).filter((p) => p.slug);
  } catch (err) {
    console.warn(`Supabase read failed (${err instanceof Error ? err.message : String(err)}); using static posts.`);
    return null;
  }
}

function bundledSlugs(): string[] {
  const src = fs.readFileSync(blogDataSource, 'utf8');
  const block = src.match(/const bundledCovers = new Set\(\[([\s\S]*?)\]\);/);
  if (!block) return [];
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function updateBundledSlugs(slugs: string[]) {
  const src = fs.readFileSync(blogDataSource, 'utf8');
  const lines = slugs.map((s) => `  ${JSON.stringify(s)},`).join('\n');
  const next = src.replace(
    /const bundledCovers = new Set\(\[[\s\S]*?\]\);/,
    `const bundledCovers = new Set([\n${lines}\n]);`,
  );
  if (next === src) throw new Error('Could not locate bundledCovers set to update.');
  fs.writeFileSync(blogDataSource, next);
}

/** Unified result shape from any provider. */
type CoverMatch = {
  downloadUrl: string;   // direct image URL to download
  alt: string;           // alt/description from provider
  title: string;         // photo title/description for credit line
  creator: string;       // photographer name
  pageUrl: string;       // URL to photo page for attribution
  source: 'pexels' | 'unsplash' | 'openverse';
};

// ============================ PEXELS ============================
async function pexelsSearch(query: string): Promise<CoverMatch | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '15');
  url.searchParams.set('orientation', 'landscape');
  try {
    const res = await fetch(url, { headers: { Authorization: key, Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    const photo = data.photos?.find((p) => p.src?.large2x && (p.width ?? 0) >= (p.height ?? 0));
    if (!photo) return null;
    return {
      downloadUrl: photo.src.large2x,
      alt: photo.alt?.trim() || '',
      title: photo.alt?.trim() || query,
      creator: photo.photographer ?? 'Unknown',
      pageUrl: photo.url ?? '',
      source: 'pexels',
    };
  } catch {
    return null;
  }
}

interface PexelsPhoto {
  id: number; width: number; height: number; url: string; photographer: string;
  src: { original: string; large2x: string; large: string; medium: string; small: string;
         portrait: string; landscape: string; tiny: string };
  alt: string;
}

// ============================ UNSPLASH ============================
async function unsplashSearch(query: string): Promise<CoverMatch | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '15');
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('content_filter', 'low');
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1', Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: UnsplashPhoto[] };
    const photo = data.results?.find((p) => p.urls?.regular && (p.width ?? 0) >= (p.height ?? 0));
    if (!photo) return null;
    return {
      downloadUrl: photo.urls.regular,
      alt: (photo.alt_description ?? photo.description ?? '').trim(),
      title: (photo.description ?? photo.alt_description ?? query).trim(),
      creator: photo.user?.name ?? 'Unknown',
      pageUrl: photo.links?.html ?? '',
      source: 'unsplash',
    };
  } catch {
    return null;
  }
}

interface UnsplashPhoto {
  id: string; width: number; height: number; description: string | null; alt_description: string | null;
  urls: { raw: string; full: string; regular: string; small: string; thumb: string };
  user: { name: string; username: string; links: { html: string } };
  links: { self: string; html: string; download: string; download_location: string };
}

// ============================ OPENVERSE (keyless fallback) ============================
type OpenverseResult = {
  title?: string; creator?: string; foreign_landing_url?: string;
  thumbnail?: string; width?: number; height?: number; filetype?: string;
};

async function openverseSearch(query: string): Promise<CoverMatch | null> {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', query);
  url.searchParams.set('license', 'cc0');
  url.searchParams.set('source', 'stocksnap');
  url.searchParams.set('page_size', '12');
  url.searchParams.set('mature', 'false');
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: OpenverseResult[] };
    const r = (data.results ?? []).find(
      (x) => x.thumbnail && (x.filetype ?? 'jpg') === 'jpg' && (x.width ?? 0) >= (x.height ?? 0),
    );
    if (!r || !r.thumbnail) return null;
    return {
      downloadUrl: `${r.thumbnail.replace(/\/$/, '')}/?full_size=true&compressed=false`,
      alt: '',
      title: r.title ?? query,
      creator: r.creator ?? 'Unknown',
      pageUrl: r.foreign_landing_url ?? '',
      source: 'openverse',
    };
  } catch {
    return null;
  }
}

// ============================ SEARCH PIPELINE ============================

const TOPIC_QUERIES: { re: RegExp; q: string[] }[] = [
  { re: /game|play store|android|memory match/i, q: ['mobile phone'] },
  { re: /voice|assistant|jarvis|speech|microphone|audio/i, q: ['microphone equipment'] },
  { re: /government|scheme|yojana|india|document|form/i, q: ['documents'] },
  { re: /portfolio|website|web app|design|homepage|resume/i, q: ['desk laptop'] },
  { re: /blog|automate|workflow|github|supabase|post/i, q: ['laptop code'] },
  { re: /python|code|coding|programming|c\+\+/i, q: ['coding programming'] },
  { re: /marketing|analytics|seo|chart|traffic/i, q: ['marketing analytics'] },
  { re: /ai|robot|model|machine/i, q: ['robot technology'] },
];

const CATEGORY_QUERIES: Record<string, string[]> = {
  Projects: ['technology computer', 'desk laptop'],
  AI: ['robot technology', 'technology computer'],
  Marketing: ['marketing analytics', 'analytics charts'],
  Learning: ['coding programming', 'laptop code'],
  Journey: ['desk laptop', 'macbook laptop'],
};

const STOP_WORDS = new Set(
  ('a an the my i me we our you your it its is are was were be been being to of in on for with and or ' +
    'but how what why when where who which that this these those own first about as at by from into over ' +
    'than then there here up down out off just only also very more most new free using use used built build ' +
    'building show shows showing tiny personal interface colorful wooden background screen laptop').split(' '),
);

function keywords(text: string, n: number): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w) && w.length > 2)
    .slice(0, n)
    .join(' ');
}

function queryCandidates(post: SourcePost, category: string): string[] {
  const text = `${post.title} ${post.coverAlt}`;
  return [
    ...TOPIC_QUERIES.filter((t) => t.re.test(text)).flatMap((t) => t.q),
    keywords(post.coverAlt, 2),
    keywords(post.title, 3),
    ...(CATEGORY_QUERIES[category] ?? []),
    'technology computer',
    'desk laptop',
    'coding programming',
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);
}

/** Try each configured provider in priority order for each query candidate. */
async function findCover(post: SourcePost, category: string, usedUrls: Set<string>): Promise<CoverMatch | null> {
  const candidates = queryCandidates(post, category);
  // Build provider list in priority order based on available keys
  const providers: ((q: string) => Promise<CoverMatch | null>)[] = [];
  if (process.env.PEXELS_API_KEY) providers.push(pexelsSearch);
  if (process.env.UNSPLASH_ACCESS_KEY) providers.push(unsplashSearch);
  providers.push(openverseSearch); // always available as final fallback

  for (const query of candidates) {
    for (const provider of providers) {
      const match = await provider(query);
      if (match && !usedUrls.has(match.pageUrl)) {
        return { ...match, downloadUrl: match.downloadUrl }; // matchedQuery stored separately
      }
    }
  }
  return null;
}

// ============================ ALT TEXT ============================

/** Build a descriptive, keyword-rich alt from the image's own alt + the post's title. */
function buildAlt(post: SourcePost, imageAlt: string, matchedQuery: string): string {
  const base = imageAlt && imageAlt.trim() ? imageAlt.trim() : `photo matching "${matchedQuery}"`;
  // Keep it concise but SEO-rich: describe the image then tie to the post topic
  const alt = `${base}, illustrating the post "${post.title}"`;
  return alt.slice(0, 250); // reasonable alt length
}

/** Alt text for the generated cover, which is a graphic rather than a stock photo. */
function fallbackAlt(post: SourcePost): string {
  return `A dark green gradient cover with a ${post.category} icon for “${post.title}”`;
}

// ============================ DB SYNC (optional) ============================

async function syncCoverToDb(post: SourcePost, webpPath: string, alt: string): Promise<void> {
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!svcKey || !url) {
    console.log(`  (DB sync skipped: SUPABASE_SERVICE_ROLE_KEY not set)`);
    return;
  }
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/posts?slug=eq.${encodeURIComponent(post.slug)}`;
  try {
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        apikey: svcKey,
        Authorization: `Bearer ${svcKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ cover: webpPath, cover_alt: alt }),
    });
    if (res.ok) {
      console.log(`  DB updated: cover + cover_alt for ${post.slug}`);
    } else {
      const txt = await res.text();
      console.warn(`  DB sync failed for ${post.slug}: HTTP ${res.status} ${txt}`);
    }
  } catch (err) {
    console.warn(`  DB sync error for ${post.slug}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================ UTIL ============================

async function downloadImage(url: string, dest: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'krish-portfolio cover fetcher' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function encodeCover(jpg: string, webp: string) {
  const sharp = (await import('sharp')).default;
  await sharp(jpg).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${jpg}.tmp`);
  fs.renameSync(`${jpg}.tmp`, jpg);
  await sharp(jpg).webp({ quality: 82 }).toFile(webp);
}

// ============================ MAIN ============================

async function main() {
  loadEnv();
  fs.mkdirSync(coversDir, { recursive: true });

  const posts: SourcePost[] = (await postsFromSupabase()) ?? blogPosts.map((p: BlogPost) => ({
    slug: p.slug, title: p.title, cover: p.cover ?? '', coverAlt: p.coverAlt ?? '', category: p.category,
  }));

  const registered = bundledSlugs();
  const addedCredits: string[] = [];
  const usedUrls = new Set<string>();

  for (const post of posts) {
    const jpg = path.join(coversDir, `${post.slug}.jpg`);
    const webp = path.join(coversDir, `${post.slug}.webp`);
    const haveBoth = fs.existsSync(jpg) && fs.existsSync(webp);

    if (haveBoth && !force) {
      if (!registered.includes(post.slug)) registered.push(post.slug);
      // A DB row can still be empty (or hold the category placeholder) when a previous run wrote
      // the files but the DB sync failed. Point it at the per-post cover we already have.
      if (syncDb && (!post.cover || isFallbackCover(post.cover))) {
        await syncCoverToDb(post, `/blog-covers/${post.slug}.webp`, post.coverAlt || fallbackAlt(post));
      }
      console.log(`skip   ${post.slug} (already has cover)`);
      continue;
    }
    if (post.cover && !isFallbackCover(post.cover) && !force) {
      console.log(`skip   ${post.slug} (cover set in admin)`);
      continue;
    }

    let match: CoverMatch | null = null;
    let matchedQuery = '';

    // Try to find a cover across all providers
    for (const query of queryCandidates(post, post.category)) {
      for (const provider of [
        process.env.PEXELS_API_KEY ? pexelsSearch : null,
        process.env.UNSPLASH_ACCESS_KEY ? unsplashSearch : null,
        openverseSearch,
      ].filter(Boolean) as ((q: string) => Promise<CoverMatch | null>)[]) {
        const found = await provider(query);
        if (found && !usedUrls.has(found.pageUrl)) {
          match = found;
          matchedQuery = query;
          break;
        }
      }
      if (match) break;
    }

    if (!match) {
      // No provider had a usable photo. Render a branded cover from the post's title and category
      // instead of leaving the card blank; the static category cover remains as a last resort.
      try {
        const svg = renderCoverSvg({ title: post.title, category: post.category });
        await writeCoverFiles(svg, jpg, webp);
        if (!registered.includes(post.slug)) registered.push(post.slug);
        if (syncDb) await syncCoverToDb(post, `/blog-covers/${post.slug}.webp`, fallbackAlt(post));
        console.log(`fallback ${post.slug} (generated branded cover)`);
      } catch (err) {
        console.error(`fallback error ${post.slug}: ${err instanceof Error ? err.message : String(err)}`);
        if (syncDb && !post.cover) {
          await syncCoverToDb(post, fallbackCoverPath(post.category), fallbackAlt(post));
        }
      }
      continue;
    }

    try {
      await downloadImage(match.downloadUrl, jpg);
      await encodeCover(jpg, webp);

      const alt = buildAlt(post, match.alt, matchedQuery);
      usedUrls.add(match.pageUrl);

      const creditLine = `${post.slug}.jpg — "${match.title}" by ${match.creator} — ${match.pageUrl} (via ${match.source})`;
      addedCredits.push(creditLine);

      if (!registered.includes(post.slug)) registered.push(post.slug);
      console.log(`done   ${post.slug} <- "${match.title}" by ${match.creator} [${match.source}] (q="${matchedQuery}")`);

      // Optional DB sync
      if (syncDb) {
        const webpPath = `/blog-covers/${post.slug}.webp`;
        await syncCoverToDb(post, webpPath, alt);
      }
    } catch (err) {
      console.error(`error  ${post.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (addedCredits.length) {
    const sep = fs.readFileSync(creditsFile, 'utf8').endsWith('\n') ? '' : '\n';
    fs.appendFileSync(creditsFile, `${sep}${addedCredits.join('\n')}\n`);
  }

  const current = bundledSlugs();
  const merged = [...current, ...registered.filter((s) => !current.includes(s))];
  if (merged.length !== current.length) {
    updateBundledSlugs(merged);
    console.log(`Registered ${merged.length - current.length} new slug(s) in bundledCovers.`);
  }
  console.log(`Covers ready: ${registered.length} registered, ${addedCredits.length} fetched.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});