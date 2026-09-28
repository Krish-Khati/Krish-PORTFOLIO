import type { BlogBlock, BlogFaq } from '../data/blog';
import { linksIn, stripInline } from './inline';

/*
 * A simple 0–100 SEO score for the admin panel (post editor + posts list). Each check is worth a
 * fixed number of points; the labels double as a to-do list for the editor.
 */

export type SeoInput = {
  title: string;
  seoTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  focusKeyword?: string;
  slug: string;
  blocks: BlogBlock[];
  faqs?: BlogFaq[];
  cover?: string;
  coverAlt?: string;
};

export type SeoCheck = { id: string; label: string; ok: boolean; points: number };
export type SeoLevel = 'good' | 'ok' | 'poor';
export type SeoResult = { score: number; level: SeoLevel; checks: SeoCheck[] };

export const SEO_TITLE_MAX = 60;
export const META_MIN = 140;
export const META_MAX = 160;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const has = (text: string, kw: string) => !!kw && ` ${norm(text)} `.includes(` ${kw} `);

export function seoScore(p: SeoInput): SeoResult {
  const kw = norm(p.focusKeyword ?? '');
  const title = (p.seoTitle?.trim() || p.title).trim();
  const meta = (p.metaDescription?.trim() || p.excerpt?.trim() || '');
  const firstP = p.blocks.find((b) => b.type === 'p');
  const firstText = firstP && firstP.type === 'p' ? stripInline(firstP.text) : '';
  const h2s = p.blocks.filter((b) => b.type === 'h2').map((b) => (b.type === 'h2' ? b.text : ''));
  const texts = p.blocks.flatMap((b) => (b.type === 'list' ? b.items : b.type === 'code' ? [] : [b.text]));
  const links = texts.flatMap(linksIn);
  const postLinks = new Set(links.filter((l) => l.href.startsWith('/blog/')).map((l) => l.href));
  const pageLinks = links.filter((l) => l.href === '/projects' || l.href.startsWith('/#contact'));
  const words = texts.map(stripInline).join(' ').split(/\s+/).filter(Boolean).length;
  const slugWords = p.slug.split('-').filter(Boolean);
  const kwWords = kw.split(' ').filter((w) => w.length > 2);
  const kwInSlug = kwWords.length > 0 && kwWords.filter((w) => slugWords.includes(w)).length / kwWords.length >= 0.6;

  const checks: SeoCheck[] = [
    { id: 'kw', label: 'Focus keyword is set', ok: !!kw, points: 10 },
    { id: 'title-len', label: `SEO title is 30–${SEO_TITLE_MAX} characters`, ok: title.length >= 30 && title.length <= SEO_TITLE_MAX, points: 10 },
    { id: 'title-kw', label: 'Keyword appears in the SEO title', ok: has(title, kw), points: 10 },
    { id: 'meta-len', label: `Meta description is ${META_MIN}–${META_MAX} characters`, ok: meta.length >= META_MIN && meta.length <= META_MAX, points: 10 },
    { id: 'meta-kw', label: 'Keyword appears in the meta description', ok: has(meta, kw), points: 5 },
    { id: 'slug-len', label: 'Slug is short (max 6 words, 60 characters)', ok: !!p.slug && p.slug.length <= 60 && slugWords.length <= 6, points: 5 },
    { id: 'slug-kw', label: 'Slug contains the keyword', ok: kwInSlug, points: 5 },
    { id: 'first-p', label: 'Keyword appears in the first paragraph', ok: has(firstText, kw), points: 10 },
    { id: 'h2', label: 'Keyword appears in at least one heading (##)', ok: h2s.some((h) => has(h, kw)), points: 5 },
    { id: 'internal', label: 'Links to 2+ of your other posts', ok: postLinks.size >= 2, points: 10 },
    { id: 'page-link', label: 'Links to your projects or contact page', ok: pageLinks.length > 0, points: 5 },
    { id: 'faq', label: 'Has an FAQ section (3+ questions)', ok: (p.faqs?.length ?? 0) >= 3, points: 5 },
    { id: 'length', label: 'At least 600 words', ok: words >= 600, points: 10 },
    { id: 'cover', label: 'Cover image with alt text', ok: !!p.cover?.trim() && !!p.coverAlt?.trim(), points: 5 },
  ];
  const score = checks.reduce((sum, c) => sum + (c.ok ? c.points : 0), 0);
  return { score, level: score >= 80 ? 'good' : score >= 50 ? 'ok' : 'poor', checks };
}
