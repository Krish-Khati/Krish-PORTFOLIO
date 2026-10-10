#!/usr/bin/env tsx
/*
 * Fetches a cover photo for every published blog post that doesn't have one yet.
 *
 * Source: Openverse (https://api.openverse.org) — keyless, and the same CC0/StockSnap
 * collection the existing covers came from. For each post it searches using the post's
 * cover_alt (falling back to its title), downloads the image as <slug>.jpg and re-encodes
 * it to <slug>.webp (what the on-page <img> uses; the .jpg is for social previews).
 *
 * Posts are read from Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set in
 * .env, so brand-new published posts are picked up automatically; otherwise it falls back to
 * the static list in src/data/blog.ts. Posts that already have a cover (in the DB or as local
 * files) are skipped. Newly added covers are registered in the bundledCovers set in
 * src/data/blog.ts and credited in public/blog-covers/CREDITS.txt.
 *
 * Usage: pnpm fetch-covers        (add --force to re-fetch posts that already have covers)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blogPosts, type BlogPost } from '../src/data/blog';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const coversDir = path.join(root, 'public', 'blog-covers');
const blogDataSource = path.join(root, 'src', 'data', 'blog.ts');
const creditsFile = path.join(coversDir, 'CREDITS.txt');

const force = process.argv.includes('--force');

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

type OpenverseResult = {
  title?: string; creator?: string; foreign_landing_url?: string;
  thumbnail?: string; width?: number; height?: number; filetype?: string;
};

// Openverse's StockSnap catalog only matches short, generic queries, so instead of sending the
// literal cover_alt ("Screenshot of the ... app") we map the post's topic to a search phrase that
// actually returns a fitting photo, then relax to the title, category and finally generic terms.
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

async function openverseSearch(query: string): Promise<OpenverseResult | null> {
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
    return (data.results ?? []).find(
      (r) => r.thumbnail && (r.filetype ?? 'jpg') === 'jpg' && (r.width ?? 0) >= (r.height ?? 0),
    ) ?? null;
  } catch {
    return null;
  }
}

async function downloadImage(url: string, dest: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'krish-portfolio cover fetcher' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function encodeCover(jpg: string, webp: string) {
  const sharp = (await import('sharp')).default;
  // Re-encode the .jpg (used for social previews) at a sane size, then the .webp for the page.
  await sharp(jpg).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${jpg}.tmp`);
  fs.renameSync(`${jpg}.tmp`, jpg);
  await sharp(jpg).webp({ quality: 82 }).toFile(webp);
}

async function main() {
  loadEnv();
  fs.mkdirSync(coversDir, { recursive: true });

  const posts: SourcePost[] = (await postsFromSupabase()) ?? blogPosts.map((p: BlogPost) => ({
    slug: p.slug, title: p.title, cover: p.cover ?? '', coverAlt: p.coverAlt ?? '', category: p.category,
  }));

  const registered = bundledSlugs();
  const addedCredits: string[] = [];
  const usedImages = new Set<string>();

  for (const post of posts) {
    const jpg = path.join(coversDir, `${post.slug}.jpg`);
    const webp = path.join(coversDir, `${post.slug}.webp`);
    const haveBoth = fs.existsSync(jpg) && fs.existsSync(webp);
    if (haveBoth && !force) {
      if (!registered.includes(post.slug)) registered.push(post.slug);
      console.log(`skip   ${post.slug} (already has cover)`);
      continue;
    }
    if (post.cover && !force) {
      console.log(`skip   ${post.slug} (cover set in admin)`);
      continue;
    }

    let match: OpenverseResult | null = null;
    let matchedQuery = '';
    for (const query of queryCandidates(post, post.category)) {
      const found = await openverseSearch(query);
      if (found && !usedImages.has(found.foreign_landing_url ?? '')) {
        match = found;
        matchedQuery = query;
        break;
      }
    }
    if (!match?.thumbnail) {
      console.warn(`miss   ${post.slug} (no Openverse result)`);
      continue;
    }

    try {
      const full = `${match.thumbnail.replace(/\/$/, '')}/?full_size=true&compressed=false`;
      await downloadImage(full, jpg);
      await encodeCover(jpg, webp);
      usedImages.add(match.foreign_landing_url ?? '');
      addedCredits.push(
        `${post.slug}.jpg — "${match.title ?? post.title}" by ${match.creator ?? 'Unknown'} — ${match.foreign_landing_url ?? ''}`,
      );
      if (!registered.includes(post.slug)) registered.push(post.slug);
      console.log(`done   ${post.slug} <- "${match.title ?? ''}" by ${match.creator ?? 'Unknown'} (q="${matchedQuery}")`);
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
