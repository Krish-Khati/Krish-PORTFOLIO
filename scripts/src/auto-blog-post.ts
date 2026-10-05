import { createClient } from '@supabase/supabase-js';
import { type Schema, Type } from '@google/genai';
import { pickModelOrder, type ModelChoice } from './ai-model-picker';
import { generateOnce, newBreakerState, parseModelChoice, parseModelChoiceList } from './ai-generate';
import {
  type Block, cleanFaqs, containsKeyword, type Faq, fitCoverAlt, fitMetaDescription, fitTitle, fixInternalLinks,
  type LinkTarget, normalizeKeyword, OPTIONAL_POST_COLUMNS, SEO_TITLE_MAX, shortSlug, stripLinks, triggerDeployHook,
  writeWithOptionalColumns,
} from './seo';

/*
 * Runs on a schedule (see .github/workflows/auto-blog-post.yml) to write one blog post for the
 * Krish portfolio and insert it into Supabase. No model names are hardcoded here: ai-model-picker
 * asks Gemini and Groq what models actually exist right now and ranks them, so this file never
 * needs a model name bumped by hand. The first pass alternates the top 3 models of each provider
 * (Gemini #1, Groq #1, Gemini #2, ...) so one overloaded provider can't burn the whole run before
 * the other is tried; a provider is skipped entirely once 2 of its models return 503 in a row.
 * Whichever model works is remembered in Supabase and tried first next time; a model that's
 * actually gone (404) is remembered too, and excluded from then on.
 *
 * Every post also comes with SEO fields (focus keyword, SEO title, meta description, short keyword
 * slug, FAQs, cover alt text) and 2–3 internal links. Lengths and links are checked and auto-fixed
 * in code (seo.ts); the keyword placement is checked too, with one retry if the model missed it.
 * When the post is published automatically, the Vercel Deploy Hook rebuilds the site so the post
 * gets its prerendered page + sitemap/RSS entry (and that build pings IndexNow).
 *
 * Also runnable by hand via the "Run workflow" button on the GitHub Actions tab, or locally with
 * GEMINI_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set (GROQ_API_KEY and
 * VERCEL_DEPLOY_HOOK are optional).
 */

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const categories = ['Journey', 'Learning', 'Projects', 'AI', 'Marketing'] as const;
type Category = (typeof categories)[number];

type GeneratedPost = {
  title: string; excerpt: string; category: Category; blocks: Block[];
  focusKeyword: string; seoTitle: string; metaDescription: string; slug: string; faqs: Faq[]; coverAlt: string;
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// GitHub Models (an earlier free backup) was retired in July 2026, so Groq is the backup instead.
// Optional override: set these GitHub repo variables to try specific model ids first (comma
// separated) before falling back to the automatically ranked list. Leave unset for fully
// automatic model selection.
const GEMINI_MODELS_OVERRIDE = parseCsvEnv('GEMINI_MODELS');
const GROQ_MODELS_OVERRIDE = parseCsvEnv('GROQ_MODELS');

function parseCsvEnv(name: string): string[] | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

// Stop trying more models after this long, so a run with many candidates still finishes well
// inside the GitHub Actions job's timeout.
const TOTAL_MODEL_BUDGET_MS = 8 * 60 * 1000;

const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

function wordCount(blocks: Block[]) {
  return blocks
    .map((b) => stripLinks(b.type === 'list' ? b.items.join(' ') : b.text))
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

const PERSONA = `You are ghostwriting a blog post as Krish, an AI developer from a small town \
(Pundri, Kaithal) in Haryana, India. He builds AI-powered apps, chatbots and assistants with Python and \
modern AI tools (Claude Code, VS Code, Supabase, Gemini), and also does video editing and content creation. \
He writes in first person, in friendly, \
simple, practical English — honest about what he does and doesn't know yet, never boastful. He never invents \
statistics, quotes, credentials, jobs, or experiences that weren't given to him as notes.`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    excerpt: { type: Type.STRING, description: 'A 1-2 line summary shown on the blog list.' },
    category: { type: Type.STRING, enum: [...categories] },
    blocks: {
      type: Type.ARRAY,
      description: 'The post body as structured blocks. Use h2 for section headings, p for paragraphs, ' +
        'list for bullet points, quote for a short pull-quote, and code only for real code the topic needs.',
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['p', 'h2', 'quote', 'list', 'code'] },
          text: { type: Type.STRING, description: 'Used by p, h2, quote and code blocks.' },
          items: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Used by list blocks only.' },
          lang: { type: Type.STRING, description: 'Used by code blocks only, e.g. "js" or "python".' },
        },
        required: ['type'],
      },
    },
    focus_keyword: { type: Type.STRING, description: 'Realistic long-tail search phrase, 3-6 words, lowercase.' },
    seo_title: { type: Type.STRING, description: 'Max 60 characters, contains the focus keyword.' },
    meta_description: { type: Type.STRING, description: '140-160 characters, contains the focus keyword.' },
    slug: { type: Type.STRING, description: 'Short keyword slug, 3-6 lowercase hyphenated words.' },
    faqs: {
      type: Type.ARRAY,
      description: '3 or 4 questions readers search for, with short answers.',
      items: {
        type: Type.OBJECT,
        properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } },
        required: ['question', 'answer'],
      },
    },
    cover_alt: { type: Type.STRING, description: 'Alt text for a cover image, max 125 characters.' },
  },
  required: ['title', 'excerpt', 'category', 'blocks', 'focus_keyword', 'seo_title', 'meta_description', 'slug', 'faqs', 'cover_alt'],
};

function buildPrompt(opts: {
  topicTitle?: string;
  topicNotes?: string;
  topicCategory?: Category;
  existingTitles: string[];
  linkTargets: LinkTarget[];
  feedback?: string;
}) {
  const parts = [PERSONA, ''];

  if (opts.topicTitle) {
    parts.push(`Write today's post about this topic idea: "${opts.topicTitle}".`);
    if (opts.topicNotes) {
      parts.push(
        `Krish's own notes/experience to build the post around. These notes are the MAIN source — use them, ` +
        `don't ignore them, and don't add personal facts that aren't in them:\n${opts.topicNotes}`,
      );
    }
    if (opts.topicCategory) parts.push(`It must use the category "${opts.topicCategory}".`);
  } else {
    parts.push(
      'No topic was queued, so pick a fresh, specific topic yourself — something Krish would plausibly have ' +
      'learned or worked on recently, based on his categories (Journey, Learning, Projects, AI, Marketing). ' +
      'Pick whichever one of those five categories fits best.',
    );
    if (opts.existingTitles.length) {
      parts.push(`Do not repeat or closely rephrase any of these existing post titles:\n- ${opts.existingTitles.join('\n- ')}`);
    }
  }

  parts.push(
    '',
    'Requirements:',
    '- 800 to 1200 words total across all blocks.',
    '- Clear section headings (h2 blocks), short paragraphs, and a practical, honest takeaway at the end.',
    '- No made-up statistics, no fake quotes from other people, no claims about things Krish did not do.',
    '- Simple, friendly, first-person English — like a real journal/blog entry, not marketing copy.',
    '',
    'SEO requirements (this is a new, small blog, so aim for searches it can realistically rank for):',
    '- focus_keyword: ONE realistic long-tail search phrase (3-6 words, lowercase) that a beginner would actually ' +
      'type into Google, specific to this post — not a broad, competitive term like "python" or "ai tools".',
    '- Use the exact focus_keyword naturally in the FIRST paragraph (the first "p" block) and in at least one h2 heading. ' +
      'Never stuff it; it should read naturally.',
    `- seo_title: at most ${SEO_TITLE_MAX} characters, focus keyword near the start, honest (no clickbait), no site name.`,
    '- meta_description: 140 to 160 characters, includes the focus keyword, summarises the post and gives a reason to click.',
    '- slug: short keyword slug, 3-6 lowercase words joined by hyphens, based on the focus keyword (no dates).',
    '- faqs: 3 or 4 questions a reader might search about this topic, each with a helpful 2-4 sentence answer that ' +
      'agrees with the post. No invented personal facts about Krish in the answers.',
    '- cover_alt: a literal description (max 125 characters) of a fitting cover photo for this post; do not start with "image of".',
  );

  if (opts.linkTargets.length) {
    parts.push(
      '- Internal links: inside "p" or "list" text, add 2 or 3 markdown links to the most related posts below, using ' +
        'EXACTLY the paths shown, with natural link text (never "click here"), e.g. ' +
        `[a few natural words about that post](/blog/${opts.linkTargets[0].slug}).`,
      '- Also add exactly ONE link to either [my projects](/projects) or [get in touch](/#contact).',
      '- Never link to any other page or invent URLs.',
      'Existing posts you can link to:',
      ...opts.linkTargets.map((t) => `- "${t.title}" — /blog/${t.slug} (${t.category}): ${t.excerpt}`),
    );
  } else {
    parts.push('- Add exactly ONE markdown link to either [my projects](/projects) or [get in touch](/#contact) inside a "p" block.');
  }

  parts.push(
    '',
    'Return ONLY a single JSON object, no markdown fences, no extra text, in exactly this shape:',
    '{ "title": string, "excerpt": string, "category": one of "Journey" | "Learning" | "Projects" | "AI" | "Marketing", ' +
    '"blocks": Block[], "focus_keyword": string, "seo_title": string, "meta_description": string, "slug": string, ' +
    '"faqs": { "question": string, "answer": string }[], "cover_alt": string }',
    'Where each Block is one of:',
    '{ "type": "h2" | "p" | "quote", "text": string }',
    '{ "type": "list", "items": string[] }',
    '{ "type": "code", "lang": string, "text": string }',
  );

  if (opts.feedback) parts.push('', `Your previous attempt had problems: ${opts.feedback}. Fix these and try again.`);

  return parts.join('\n');
}

type Validation =
  | { ok: true; post: GeneratedPost; seoIssues: string[]; fixes: string[] }
  | { ok: false; reason: string };

// Hard checks (structure, word count) reject the attempt. SEO problems that can be fixed in code
// are fixed (lengths, slug, links); the ones that can't (keyword placement, too few FAQs) are
// returned as `seoIssues` so the caller can ask the model once more.
function validate(data: unknown, existingTitles: string[], linkTargets: LinkTarget[]): Validation {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'response was not a JSON object' };
  const d = data as Record<string, unknown>;

  if (typeof d.title !== 'string' || !d.title.trim()) return { ok: false, reason: 'title is missing or empty' };
  if (existingTitles.some((t) => t.toLowerCase() === (d.title as string).trim().toLowerCase())) {
    return { ok: false, reason: 'title duplicates an existing post' };
  }
  if (typeof d.excerpt !== 'string' || !d.excerpt.trim()) return { ok: false, reason: 'excerpt is missing or empty' };
  if (typeof d.category !== 'string' || !categories.includes(d.category as Category)) {
    return { ok: false, reason: `category must be one of ${categories.join(', ')}` };
  }
  if (!Array.isArray(d.blocks) || d.blocks.length < 3) return { ok: false, reason: 'blocks must be an array with at least 3 entries' };

  const blocks: Block[] = [];
  for (const raw of d.blocks) {
    if (!raw || typeof raw !== 'object') return { ok: false, reason: 'a block was not an object' };
    const b = raw as Record<string, unknown>;
    switch (b.type) {
      case 'p': case 'h2': case 'quote':
        if (typeof b.text !== 'string' || !b.text.trim()) return { ok: false, reason: `a ${b.type} block is missing text` };
        blocks.push({ type: b.type, text: b.text.trim() });
        break;
      case 'list':
        if (!Array.isArray(b.items) || !b.items.length || b.items.some((i) => typeof i !== 'string' || !i.trim())) {
          return { ok: false, reason: 'a list block has invalid items' };
        }
        blocks.push({ type: 'list', items: (b.items as string[]).map((i) => i.trim()) });
        break;
      case 'code':
        if (typeof b.text !== 'string' || !b.text.trim()) return { ok: false, reason: 'a code block is missing text' };
        blocks.push({ type: 'code', lang: typeof b.lang === 'string' && b.lang.trim() ? b.lang.trim() : 'text', text: b.text });
        break;
      default:
        return { ok: false, reason: `unknown block type "${String(b.type)}"` };
    }
  }

  const words = wordCount(blocks);
  if (words < 800 || words > 1200) return { ok: false, reason: `word count was ${words}, needs to be 800-1200` };

  const title = d.title.trim();
  const excerpt = d.excerpt.trim();
  const category = d.category as Category;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const seoIssues: string[] = [];
  const fixes: string[] = [];

  // Focus keyword
  let focusKeyword = normalizeKeyword(str(d.focus_keyword));
  if (!focusKeyword) {
    seoIssues.push('focus_keyword was missing');
    focusKeyword = normalizeKeyword(title).split(' ').slice(0, 6).join(' ');
  } else if (focusKeyword.split(' ').length > 8) {
    fixes.push('focus keyword shortened to 6 words');
    focusKeyword = focusKeyword.split(' ').slice(0, 6).join(' ');
  }

  const firstParagraph = blocks.find((b) => b.type === 'p');
  if (!firstParagraph || firstParagraph.type !== 'p' || !containsKeyword(firstParagraph.text, focusKeyword)) {
    seoIssues.push(`the exact focus keyword "${focusKeyword}" must appear in the first paragraph`);
  }
  if (!blocks.some((b) => b.type === 'h2' && containsKeyword(b.text, focusKeyword))) {
    seoIssues.push(`the exact focus keyword "${focusKeyword}" must appear in at least one h2 heading`);
  }

  // SEO title (max 60)
  const rawSeoTitle = str(d.seo_title) || title;
  const seoTitle = fitTitle(rawSeoTitle);
  if (seoTitle !== rawSeoTitle) fixes.push(`SEO title shortened from ${rawSeoTitle.length} to ${seoTitle.length} characters`);

  // Meta description (140–160)
  const rawMeta = str(d.meta_description) || excerpt;
  const paragraphs = blocks.flatMap((b) => (b.type === 'p' ? [b.text] : []));
  const metaDescription = fitMetaDescription(rawMeta, [excerpt, ...paragraphs]);
  if (metaDescription !== rawMeta) fixes.push(`meta description adjusted from ${rawMeta.length} to ${metaDescription.length} characters`);

  // Short keyword slug
  const slug = shortSlug(str(d.slug) || focusKeyword || title) || shortSlug(title) || 'post';

  // FAQs (3–4)
  const faqs = cleanFaqs(d.faqs);
  if (faqs.length < 3) seoIssues.push(`faqs needs 3 or 4 question/answer pairs (got ${faqs.length})`);

  // Cover alt text
  const coverAlt = fitCoverAlt(str(d.cover_alt), title);

  // Internal links: unknown/duplicate links removed, missing ones topped up.
  const linked = fixInternalLinks(blocks, linkTargets, category);
  fixes.push(...linked.notes);

  return {
    ok: true,
    post: { title, excerpt, category, blocks: linked.blocks, focusKeyword, seoTitle, metaDescription, slug, faqs, coverAlt },
    seoIssues,
    fixes,
  };
}

async function generateValidPost(opts: {
  topicTitle?: string; topicNotes?: string; topicCategory?: Category; existingTitles: string[];
  linkTargets: LinkTarget[]; order: ModelChoice[];
  onOverloaded: (choice: ModelChoice) => void;
  onPermanentlyUnavailable: (choice: ModelChoice) => void;
}): Promise<{ post: GeneratedPost; writer: string; usedChoice: ModelChoice; seoIssues: string[]; fixes: string[] }> {
  const genOpts = {
    keys: { geminiApiKey: GEMINI_API_KEY, groqApiKey: process.env.GROQ_API_KEY },
    geminiSchema: responseSchema,
    deadline: Date.now() + TOTAL_MODEL_BUDGET_MS,
    breaker: newBreakerState(),
    onOverloaded: opts.onOverloaded,
    onPermanentlyUnavailable: opts.onPermanentlyUnavailable,
  };
  const check = (data: unknown) => validate(data, opts.existingTitles, opts.linkTargets);

  const first = await generateOnce(buildPrompt(opts), opts.order, genOpts);
  const firstCheck = check(first.data);
  if (firstCheck.ok && !firstCheck.seoIssues.length) return { ...firstCheck, writer: first.writer, usedChoice: first.usedChoice };

  const feedback = firstCheck.ok ? firstCheck.seoIssues.join('; ') : firstCheck.reason;
  console.warn(`First attempt (${first.writer}) ${firstCheck.ok ? 'missed some SEO rules' : 'was invalid'} (${feedback}), retrying once…`);

  let second: Awaited<ReturnType<typeof generateOnce>>;
  try {
    second = await generateOnce(buildPrompt({ ...opts, feedback }), opts.order, genOpts);
  } catch (err) {
    // A structurally valid first post is still worth publishing if the SEO retry can't run.
    if (firstCheck.ok) {
      console.warn(`SEO retry failed (${err instanceof Error ? err.message : String(err)}) — keeping the first post.`);
      return { ...firstCheck, writer: first.writer, usedChoice: first.usedChoice };
    }
    throw err;
  }
  const secondCheck = check(second.data);
  if (secondCheck.ok && (!firstCheck.ok || secondCheck.seoIssues.length <= firstCheck.seoIssues.length)) {
    return { ...secondCheck, writer: second.writer, usedChoice: second.usedChoice };
  }
  if (firstCheck.ok) return { ...firstCheck, writer: first.writer, usedChoice: first.usedChoice };

  throw new Error(`Output was invalid twice in a row (last from ${second.writer}): ${secondCheck.ok ? '' : secondCheck.reason}`);
}

async function uniqueSlug(base: string) {
  const { data, error } = await supabase.from('posts').select('slug').ilike('slug', `${base}%`);
  if (error) throw new Error(error.message);
  const taken = new Set((data ?? []).map((r) => r.slug as string));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

async function logRun(status: 'success' | 'failed', topic: string, message = '') {
  const { error } = await supabase.from('auto_post_runs').insert({ status, topic, message });
  if (error) console.error(`Could not write run log: ${error.message}`);
}

async function main() {
  const today = todayIST();

  const { data: recentRuns, error: runsError } = await supabase
    .from('auto_post_runs')
    .select('ran_at, status')
    .eq('status', 'success')
    .order('ran_at', { ascending: false })
    .limit(5);
  if (runsError) throw new Error(`Could not read run log: ${runsError.message}`);
  const alreadyRanToday = (recentRuns ?? []).some(
    (r) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(r.ran_at as string)) === today,
  );
  if (alreadyRanToday) {
    console.log('A post was already generated today — skipping to stay at one post per day.');
    return;
  }

  const { data: settingsRow, error: settingsError } = await supabase
    .from('auto_post_settings')
    .select('publish_automatically, last_working_model, last_overloaded_model, blocked_models')
    .eq('id', 1).maybeSingle();
  if (settingsError) throw new Error(`Could not read auto-post settings: ${settingsError.message}`);
  const publishAutomatically = settingsRow?.publish_automatically ?? false;
  const blockedModels = parseModelChoiceList(settingsRow?.blocked_models as string | null | undefined);

  const { data: topics, error: topicsError } = await supabase
    .from('auto_post_topics').select('id, title, notes, category').eq('status', 'pending').order('position').limit(1);
  if (topicsError) throw new Error(`Could not read the topic queue: ${topicsError.message}`);
  const topic = topics?.[0] as { id: string; title: string; notes: string; category: Category } | undefined;

  // '*' so this keeps working whether or not optional columns exist yet.
  const { data: existingPosts, error: postsError } = await supabase.from('posts').select('*').order('date', { ascending: false });
  if (postsError) throw new Error(`Could not read existing posts: ${postsError.message}`);
  const rows = (existingPosts ?? []) as { title: string; slug: string; category: string; excerpt: string; status: string }[];
  const existingTitles = rows.map((p) => p.title);
  // Only published posts are linkable (a draft's URL isn't public). Same category first.
  const published = rows.filter((p) => p.status === 'published');
  const wanted = topic?.category;
  const linkTargets: LinkTarget[] = [...published]
    .sort((a, b) => Number(b.category === wanted) - Number(a.category === wanted))
    .slice(0, 25)
    .map((p) => ({ title: p.title, slug: p.slug, category: p.category, excerpt: p.excerpt }));

  const order = await pickModelOrder({
    geminiApiKey: GEMINI_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
    geminiOverride: GEMINI_MODELS_OVERRIDE,
    groqOverride: GROQ_MODELS_OVERRIDE,
    exclude: blockedModels,
    preferredFirst: parseModelChoice(settingsRow?.last_working_model as string | null | undefined),
    deprioritize: parseModelChoice(settingsRow?.last_overloaded_model as string | null | undefined),
    interleaveTop: 3,
  });

  const attemptLabel = topic?.title ?? '(auto-picked topic)';

  // Tracks the first model (if any) that returns 503 this run, so it can be deprioritized next
  // run instead of being tried first again while it's still overloaded.
  let overloadedChoice: ModelChoice | undefined;
  // Tracks every model that returned 404/"no longer available" this run, so it can be excluded
  // permanently instead of being rediscovered (and failing again) on future runs.
  const newlyBlocked = new Set<string>();

  try {
    const { post: generated, writer, usedChoice, seoIssues, fixes } = await generateValidPost({
      topicTitle: topic?.title,
      topicNotes: topic?.notes,
      topicCategory: topic?.category,
      existingTitles,
      linkTargets,
      order,
      onOverloaded: (choice) => { overloadedChoice ??= choice; },
      onPermanentlyUnavailable: (choice) => { newlyBlocked.add(`${choice.provider}:${choice.model}`); },
    });

    const slug = await uniqueSlug(generated.slug);
    const status = publishAutomatically ? 'published' : 'draft';
    const skipped = await writeWithOptionalColumns(
      {
        slug,
        title: generated.title,
        excerpt: generated.excerpt,
        category: generated.category,
        date: today,
        status,
        blocks: generated.blocks,
        cover: '',
        seo_title: generated.seoTitle,
        meta_description: generated.metaDescription,
        focus_keyword: generated.focusKeyword,
        faqs: generated.faqs,
        cover_alt: generated.coverAlt,
      },
      OPTIONAL_POST_COLUMNS,
      (row) => supabase.from('posts').insert(row),
    ).catch((err: unknown) => {
      throw new Error(`Could not save the post: ${err instanceof Error ? err.message : String(err)}`);
    });

    if (topic) {
      const { error: markUsedError } = await supabase.from('auto_post_topics').update({ status: 'used' }).eq('id', topic.id);
      if (markUsedError) console.error(`Post was saved, but could not mark the topic as used: ${markUsedError.message}`);
    }

    const { error: rememberError } = await supabase
      .from('auto_post_settings').update({ last_working_model: `${usedChoice.provider}:${usedChoice.model}` }).eq('id', 1);
    if (rememberError) console.error(`Post was saved, but could not remember the working model: ${rememberError.message}`);

    const linkCount = generated.blocks
      .flatMap((b) => (b.type === 'list' ? b.items : b.type === 'p' || b.type === 'quote' ? [b.text] : []))
      .join(' ')
      .match(/\]\(\//g)?.length ?? 0;
    const seoSummary = [
      `keyword "${generated.focusKeyword}"`,
      `title ${generated.seoTitle.length}/60`,
      `meta ${generated.metaDescription.length} chars`,
      `${linkCount} internal links`,
      `${generated.faqs.length} FAQs`,
    ].join(', ');
    console.log(`SEO: ${seoSummary}.`);
    if (fixes.length) console.log(`SEO auto-fixes: ${fixes.join('; ')}.`);
    if (seoIssues.length) console.warn(`SEO notes (kept after retry): ${seoIssues.join('; ')}.`);
    if (skipped.length) console.warn(`Saved without ${skipped.join(', ')} — run supabase/add-seo.sql in the Supabase SQL editor.`);

    await logRun(
      'success',
      generated.title,
      `Written by ${writer}. SEO: ${seoSummary}.${skipped.length ? ` Not saved (run add-seo.sql): ${skipped.join(', ')}.` : ''}`,
    );
    console.log(`Created ${publishAutomatically ? 'and published' : 'draft'} post: "${generated.title}" (/blog/${slug}) — written by ${writer}`);

    // Only a published post changes the public site; a draft gets rebuilt when it's published
    // from the admin panel.
    if (status === 'published') await triggerDeployHook(`new post /blog/${slug}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun('failed', attemptLabel, message);
    throw err;
  } finally {
    // Reflects this run only: cleared to null when nothing was overloaded this time, so a model
    // that recovered isn't avoided forever.
    const { error: overloadedError } = await supabase
      .from('auto_post_settings')
      .update({ last_overloaded_model: overloadedChoice ? `${overloadedChoice.provider}:${overloadedChoice.model}` : null })
      .eq('id', 1);
    if (overloadedError) console.error(`Could not update overloaded-model memory: ${overloadedError.message}`);

    // Unlike last_overloaded_model, this accumulates forever (a genuinely retired model doesn't
    // come back), so it's a union with whatever was already blocked, not a replacement.
    if (newlyBlocked.size) {
      const merged = new Set([...blockedModels.map((c) => `${c.provider}:${c.model}`), ...newlyBlocked]);
      const { error: blockedError } = await supabase
        .from('auto_post_settings').update({ blocked_models: [...merged].join(',') }).eq('id', 1);
      if (blockedError) console.error(`Could not update blocked-models memory: ${blockedError.message}`);
      console.warn(`Blocking for future runs (404/no longer available): ${[...newlyBlocked].join(', ')}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
