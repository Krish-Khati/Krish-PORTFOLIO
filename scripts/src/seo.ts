import type { SupabaseClient } from '@supabase/supabase-js';

/*
 * SEO helpers shared by auto-blog-post.ts and seo-backfill.ts: length limits that are enforced
 * (and auto-fixed) in code rather than trusted from the model, internal-link checking, the Vercel
 * Deploy Hook, and database writes that survive optional columns not existing yet.
 */

export const SITE_URL = (process.env.SITE_URL || 'https://krish-portfolio-dev.vercel.app').replace(/\/+$/, '');

export const SEO_TITLE_MAX = 60;
export const META_MIN = 140;
export const META_MAX = 160;
export const COVER_ALT_MAX = 125;
export const SLUG_MAX_WORDS = 6;
export const SLUG_MAX_CHARS = 60;

export type Faq = { question: string; answer: string };

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang: string; text: string };

/* ---------- Text helpers ---------- */

const LINK_RE = /\[([^\]\n]+)\]\(((?:\/|https?:\/\/)[^\s)]*)\)/g;

/** Text with [label](href) link syntax replaced by just the label. */
export const stripLinks = (text: string) => text.replace(LINK_RE, '$1');

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const SLUG_STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'for', 'with', 'my', 'your', 'is', 'are', 'by', 'from']);

/** A short keyword slug: filler words dropped, at most 6 words and 60 characters. */
export function shortSlug(text: string) {
  const all = slugify(text).split('-').filter(Boolean);
  const meaningful = all.filter((w) => !SLUG_STOP_WORDS.has(w));
  const words = (meaningful.length >= 2 ? meaningful : all).slice(0, SLUG_MAX_WORDS);
  while (words.length > 1 && words.join('-').length > SLUG_MAX_CHARS) words.pop();
  return words.join('-').slice(0, SLUG_MAX_CHARS);
}

const TRAILING_WEAK_WORDS = /\s+(?:and|or|the|a|an|to|of|with|for|in|on|at|by|as|from|into|about|my|your|how|what|why|when|that|is|just|some|no|without|vs\.?)$/i;

/** Cuts to `max` characters on a word boundary (no ellipsis — titles look better without one). */
export function fitTitle(text: string, max = SEO_TITLE_MAX) {
  let t = squash(text);
  if (t.length <= max) return t;
  // Prefer dropping a subtitle ("Main idea: long subtitle") over chopping mid-phrase.
  const head = t.split(/\s[—–|-]\s|:\s/)[0];
  if (head.length >= 30 && head.length <= max) return head.trim();
  t = t.slice(0, max + 1);
  t = t.slice(0, t.lastIndexOf(' ') > 0 ? t.lastIndexOf(' ') : max);
  for (let i = 0; i < 3 && TRAILING_WEAK_WORDS.test(t); i++) t = t.replace(TRAILING_WEAK_WORDS, '');
  return t.replace(/[\s,;:.–—-]+$/, '');
}

const sentencesOf = (text: string) => squash(text).match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];

/**
 * Forces a meta description into 140–160 characters: too long → cut at a sentence end (or word
 * boundary + "…"); too short → topped up with sentences from `extraSources` (excerpt, first
 * paragraph). Returns the fixed text; it can only stay short if there's genuinely nothing to add.
 */
export function fitMetaDescription(text: string, extraSources: string[] = []) {
  let t = squash(stripLinks(text));
  if (t.length < META_MIN) {
    const have = new Set(sentencesOf(t).map((s) => s.toLowerCase()));
    for (const source of extraSources) {
      for (const sentence of sentencesOf(stripLinks(source))) {
        if (t.length >= META_MIN) break;
        if (have.has(sentence.toLowerCase())) continue;
        have.add(sentence.toLowerCase());
        t = squash(`${t}${t && !/[.!?]$/.test(t) ? '.' : ''} ${sentence}`);
      }
    }
  }
  if (t.length <= META_MAX) return t;
  // Too long: end on a full sentence if one finishes inside the window…
  const window = t.slice(0, META_MAX);
  const lastStop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '), /[.!?]$/.test(window) ? window.length - 1 : -1);
  if (lastStop + 1 >= META_MIN) return window.slice(0, lastStop + 1).trim();
  // …otherwise cut on a word boundary and add an ellipsis (1 character).
  const cut = t.slice(0, META_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '')}…`;
}

export function normalizeKeyword(raw: string) {
  return squash(raw.toLowerCase().replace(/[^\p{L}\p{N}\s+#-]/gu, ' '));
}

const kwNorm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
/** Whole-phrase, case-insensitive keyword match (ignores punctuation). */
export const containsKeyword = (text: string, keyword: string) => {
  const k = kwNorm(keyword).trim();
  return !!k && kwNorm(stripLinks(text)).includes(` ${k} `);
};

export function cleanFaqs(raw: unknown): Faq[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Faq[] = [];
  for (const f of raw) {
    const q = squash(typeof f?.question === 'string' ? f.question : '');
    const a = squash(typeof f?.answer === 'string' ? f.answer : '');
    const key = q.toLowerCase().replace(/[?.!\s]+$/, '');
    if (!q || !a || seen.has(key)) continue;
    seen.add(key);
    out.push({ question: /[?]$/.test(q) ? q : `${q.replace(/[.!]+$/, '')}?`, answer: a });
  }
  return out.slice(0, 4);
}

export function fitCoverAlt(raw: string, fallback: string) {
  const t = squash(raw).replace(/^(an?\s+)?(image|picture|photo)\s+of\s+/i, '');
  const alt = t || fallback;
  if (alt.length <= COVER_ALT_MAX) return alt;
  const cut = alt.slice(0, COVER_ALT_MAX);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '');
}

/* ---------- Internal links ---------- */

export type LinkTarget = { title: string; slug: string; category: string; excerpt: string };
export const PAGE_LINKS = ['/projects', '/#contact'];

/**
 * Keeps only links that point at real pages (published posts, /projects, /#contact), at most one
 * link per target and 3 post links in total; everything else becomes plain text. Then makes sure
 * there are 2+ post links and 1 projects/contact link, appending one natural closing sentence
 * when the model didn't manage it. Returns the fixed blocks + what was changed.
 */
export function fixInternalLinks(blocks: Block[], targets: LinkTarget[], category: string) {
  const known = new Set([...targets.map((t) => `/blog/${t.slug}`), ...PAGE_LINKS]);
  const used = new Set<string>();
  const notes: string[] = [];
  let postLinks = 0;
  let pageLinks = 0;

  const fixText = (text: string) =>
    text.replace(LINK_RE, (whole, label: string, href: string) => {
      const external = /^https?:\/\//i.test(href);
      if (external) return whole; // external references are fine as-is
      const isPost = href.startsWith('/blog/');
      if (!known.has(href)) {
        notes.push(`removed link to unknown page ${href}`);
        return label;
      }
      if (used.has(href) || (isPost && postLinks >= 3) || (!isPost && pageLinks >= 1)) {
        notes.push(`removed extra link to ${href}`);
        return label;
      }
      used.add(href);
      if (isPost) postLinks++;
      else pageLinks++;
      return whole;
    });

  const out: Block[] = blocks.map((b) => {
    if (b.type === 'p' || b.type === 'quote') return { ...b, text: fixText(b.text) };
    if (b.type === 'list') return { ...b, items: b.items.map(fixText) };
    return b;
  });

  const extras: string[] = [];
  if (postLinks < 2) {
    const candidates = targets
      .filter((t) => !used.has(`/blog/${t.slug}`))
      .sort((a, b) => Number(b.category === category) - Number(a.category === category))
      .slice(0, 2 - postLinks);
    if (candidates.length) {
      const links = candidates.map((t) => `[${t.title.replace(/[[\]]/g, '')}](/blog/${t.slug})`);
      extras.push(`If you want to keep reading, I also wrote about ${links.join(' and ')}.`);
      postLinks += candidates.length;
      notes.push(`added ${candidates.length} related-post link(s)`);
    }
  }
  if (pageLinks < 1) {
    extras.push('You can see what I am building right now on my [projects page](/projects).');
    pageLinks++;
    notes.push('added a projects-page link');
  }
  if (extras.length) out.push({ type: 'p', text: extras.join(' ') });

  return { blocks: out, postLinks, pageLinks, notes };
}

/* ---------- Deploy hook ---------- */

/**
 * Triggers the Vercel Deploy Hook (GitHub secret VERCEL_DEPLOY_HOOK) so the prerendered pages,
 * sitemap.xml and rss.xml are rebuilt; the build then pings IndexNow for new/changed URLs.
 * Never throws — a missing/failed hook only means the site updates on the next deploy.
 */
export async function triggerDeployHook(reason: string): Promise<boolean> {
  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (!hook) {
    console.warn('VERCEL_DEPLOY_HOOK is not set — skipping the site rebuild. The new post will appear in the sitemap on the next deploy.');
    return false;
  }
  try {
    const res = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn(`Vercel Deploy Hook returned HTTP ${res.status} — the site was not rebuilt.`);
      return false;
    }
    console.log(`Triggered a Vercel redeploy (${reason}). Pages, sitemap.xml and rss.xml update in ~1–2 minutes; IndexNow is pinged by that build.`);
    return true;
  } catch (err) {
    console.warn(`Could not reach the Vercel Deploy Hook: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/* ---------- Database writes that tolerate missing optional columns ---------- */

// PostgREST: "Could not find the 'seo_title' column of 'posts' in the schema cache" (PGRST204);
// Postgres: 'column "seo_title" of relation "posts" does not exist' (42703).
export function missingColumn(message: string) {
  return message.match(/Could not find the '(\w+)' column/i)?.[1] ?? message.match(/column "?(\w+)"? (?:of relation "?\w+"? )?does not exist/i)?.[1];
}

export const OPTIONAL_POST_COLUMNS = ['seo_title', 'meta_description', 'focus_keyword', 'faqs', 'cover_alt', 'cover'];

/**
 * Runs an insert/update; if it fails only because an optional column doesn't exist yet (the SQL
 * file hasn't been run), logs a warning, drops that column and tries again. Returns the columns
 * that had to be skipped.
 */
export async function writeWithOptionalColumns(
  row: Record<string, unknown>,
  optional: string[],
  write: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>,
): Promise<string[]> {
  const payload = { ...row };
  const skipped: string[] = [];
  for (;;) {
    const { error } = await write(payload);
    if (!error) return skipped;
    const col = missingColumn(error.message);
    if (col && col in payload && optional.includes(col)) {
      console.warn(`WARNING: column "${col}" doesn't exist yet — saving without it. Run supabase/add-seo.sql in the Supabase SQL editor.`);
      delete payload[col];
      skipped.push(col);
      continue;
    }
    throw new Error(error.message);
  }
}

/** Which of the given columns exist on a table (a missing one makes a select fail). */
export async function existingColumns(supabase: SupabaseClient, table: string, columns: string[]) {
  const present: string[] = [];
  for (const c of columns) {
    const { error } = await supabase.from(table).select(c).limit(1);
    if (!error) present.push(c);
  }
  return present;
}
