import { createClient } from '@supabase/supabase-js';
import { type Schema, Type } from '@google/genai';
import { pickModelOrder } from './ai-model-picker';
import { generateOnce, newBreakerState, parseModelChoice, parseModelChoiceList } from './ai-generate';
import {
  type Block, cleanFaqs, existingColumns, fitCoverAlt, fitMetaDescription, fitTitle, normalizeKeyword, SEO_TITLE_MAX,
  stripLinks, triggerDeployHook, writeWithOptionalColumns,
} from './seo';

/*
 * One-time (safe to re-run) SEO backfill for posts written before the SEO fields existed. For
 * every post that's missing them, asks the AI (same live model picking as the auto-post script)
 * for a focus keyword, SEO title, meta description, 3–4 FAQs and cover alt text — based ONLY on
 * the post's own text — then fixes the lengths in code and saves them. Slugs and post text are
 * never changed, so no existing URL breaks. Finally triggers the Vercel Deploy Hook so the live
 * pages pick up the new tags.
 *
 * Run it from GitHub: Actions → "SEO backfill" → Run workflow (uses the same secrets as the
 * auto-post workflow). Or locally with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY
 * (and optionally GROQ_API_KEY, VERCEL_DEPLOY_HOOK) set:
 *   pnpm --filter @workspace/scripts run seo-backfill
 * Set OVERWRITE=true to regenerate fields that are already filled in.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OVERWRITE = /^(1|true|yes)$/i.test(process.env.OVERWRITE ?? '');
const TOTAL_BUDGET_MS = 10 * 60 * 1000;

const SEO_COLUMNS = ['seo_title', 'meta_description', 'focus_keyword', 'faqs', 'cover_alt'];

type PostRow = {
  id: string; slug: string; title: string; excerpt: string; category: string; status: string; blocks: Block[];
  seo_title?: string | null; meta_description?: string | null; focus_keyword?: string | null; faqs?: unknown; cover_alt?: string | null;
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    focus_keyword: { type: Type.STRING },
    seo_title: { type: Type.STRING },
    meta_description: { type: Type.STRING },
    faqs: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ['question', 'answer'] },
    },
    cover_alt: { type: Type.STRING },
  },
  required: ['focus_keyword', 'seo_title', 'meta_description', 'faqs', 'cover_alt'],
};

function postText(blocks: Block[]) {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'h2': return `## ${b.text}`;
        case 'list': return b.items.map((i) => `- ${stripLinks(i)}`).join('\n');
        case 'code': return `[code example in ${b.lang}]`;
        default: return stripLinks(b.text);
      }
    })
    .join('\n\n');
}

function buildPrompt(post: PostRow) {
  return [
    'You are an SEO assistant for the personal blog of Krish, a self-taught aspiring software developer from Haryana, India.',
    'Write SEO fields for the EXISTING blog post below. Base everything ONLY on what the post says — never invent facts, ',
    'numbers, jobs, credentials or experiences about Krish.',
    '',
    'Rules:',
    '- focus_keyword: ONE realistic long-tail search phrase (3-6 words, lowercase) a beginner would type into Google, which ' +
      'this post genuinely answers and a new, small blog could rank for. Not a broad term like "python" or "ai".',
    `- seo_title: at most ${SEO_TITLE_MAX} characters, contains the focus keyword near the start, honest, no site name.`,
    '- meta_description: 140 to 160 characters, contains the focus keyword, summarises the post and gives a reason to click.',
    '- faqs: 3 or 4 questions readers might search about this topic, each answered in 2-4 sentences using only information ' +
      'from the post (general, factual knowledge is fine; no invented personal facts).',
    '- cover_alt: a literal description (max 125 characters) of a fitting cover photo; do not start with "image of".',
    '',
    `Title: ${post.title}`,
    `Category: ${post.category}`,
    `Excerpt: ${post.excerpt}`,
    '',
    'Post text:',
    postText(post.blocks),
    '',
    'Return ONLY a JSON object: { "focus_keyword": string, "seo_title": string, "meta_description": string, ' +
      '"faqs": { "question": string, "answer": string }[], "cover_alt": string }',
  ].join('\n');
}

const isFilled = (p: PostRow) =>
  !!p.focus_keyword?.trim() && !!p.seo_title?.trim() && !!p.meta_description?.trim() && cleanFaqs(p.faqs).length >= 3 && !!p.cover_alt?.trim();

async function main() {
  if (!GEMINI_API_KEY && !GROQ_API_KEY) throw new Error('Set GEMINI_API_KEY and/or GROQ_API_KEY.');

  const columns = await existingColumns(supabase, 'posts', SEO_COLUMNS);
  if (!columns.length) {
    console.warn('WARNING: none of the SEO columns exist yet, so there is nothing to fill in.');
    console.warn('Run supabase/add-seo.sql in the Supabase SQL editor first, then run this again.');
    return;
  }
  const missing = SEO_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) console.warn(`WARNING: columns ${missing.join(', ')} don't exist yet — they'll be skipped. Run supabase/add-seo.sql to add them.`);

  const { data, error } = await supabase.from('posts').select('*').order('date', { ascending: true });
  if (error) throw new Error(`Could not read posts: ${error.message}`);
  const posts = (data ?? []) as PostRow[];
  const todo = OVERWRITE ? posts : posts.filter((p) => !isFilled(p));
  console.log(`${posts.length} post(s) in total; ${todo.length} need SEO fields${OVERWRITE ? ' (OVERWRITE=true)' : ''}.`);
  if (!todo.length) return;

  // Reuse the auto-post script's model memory (read-only here) so a known-dead model isn't retried.
  const { data: settings } = await supabase
    .from('auto_post_settings').select('last_working_model, blocked_models').eq('id', 1).maybeSingle();
  const order = await pickModelOrder({
    geminiApiKey: GEMINI_API_KEY,
    groqApiKey: GROQ_API_KEY,
    exclude: parseModelChoiceList(settings?.blocked_models as string | null | undefined),
    preferredFirst: parseModelChoice(settings?.last_working_model as string | null | undefined),
    interleaveTop: 3,
  });

  const genOpts = {
    keys: { geminiApiKey: GEMINI_API_KEY, groqApiKey: GROQ_API_KEY },
    geminiSchema: schema,
    deadline: Date.now() + TOTAL_BUDGET_MS,
    breaker: newBreakerState(),
  };

  let updated = 0;
  let publishedChanged = false;
  const failed: string[] = [];
  for (const post of todo) {
    console.log(`\n→ "${post.title}" (/blog/${post.slug})`);
    try {
      const { data: raw, writer } = await generateOnce(buildPrompt(post), order, genOpts);
      const d = (raw ?? {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      const paragraphs = post.blocks.flatMap((b) => (b.type === 'p' ? [b.text] : []));

      const focusKeyword = normalizeKeyword(str(d.focus_keyword)).split(' ').slice(0, 6).join(' ');
      const seoTitle = fitTitle(str(d.seo_title) || post.title);
      const metaDescription = fitMetaDescription(str(d.meta_description) || post.excerpt, [post.excerpt, ...paragraphs]);
      const faqs = cleanFaqs(d.faqs);
      const coverAlt = fitCoverAlt(str(d.cover_alt), post.title);
      if (!focusKeyword) throw new Error(`${writer} returned no focus keyword`);

      const row: Record<string, unknown> = {
        seo_title: seoTitle, meta_description: metaDescription, focus_keyword: focusKeyword, faqs, cover_alt: coverAlt,
      };
      for (const c of missing) delete row[c];
      await writeWithOptionalColumns(row, SEO_COLUMNS, (r) => supabase.from('posts').update(r).eq('id', post.id));

      updated++;
      if (post.status === 'published') publishedChanged = true;
      console.log(`  keyword: ${focusKeyword}`);
      console.log(`  title (${seoTitle.length}/60): ${seoTitle}`);
      console.log(`  meta (${metaDescription.length} chars): ${metaDescription}`);
      console.log(`  ${faqs.length} FAQs · alt: ${coverAlt} · by ${writer}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push(`${post.slug}: ${reason}`);
      console.error(`  failed: ${reason}`);
    }
  }

  console.log(`\nDone: ${updated} post(s) updated${failed.length ? `, ${failed.length} failed` : ''}.`);
  if (publishedChanged) await triggerDeployHook('SEO backfill');
  if (failed.length) {
    console.error(`Failed posts (re-run to retry just these):\n- ${failed.join('\n- ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
