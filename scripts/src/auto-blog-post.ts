import { createClient } from '@supabase/supabase-js';
import { ApiError, GoogleGenAI, Type } from '@google/genai';

/*
 * Runs on a schedule (see .github/workflows/auto-blog-post.yml) to write one blog post for
 * the Krish portfolio using Gemini and insert it into Supabase. Also runnable by hand via the
 * "Run workflow" button on the GitHub Actions tab, or locally with the three env vars set.
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

type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang: string; text: string };

type GeneratedPost = { title: string; excerpt: string; category: Category; blocks: Block[] };

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Both aliased to Google's current default for their model family, so this script never needs
// a model name bumped by hand. The fallback is a different family (Flash-Lite, not Flash), so
// it has its own capacity pool — useful when the primary is overloaded (503) rather than broken.
const PRIMARY_MODEL = 'gemini-flash-latest';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

// ~20s, 40s, 80s, 120s — matches Gemini's own guidance to back off hard on 503/429s.
const RETRY_DELAYS_MS = [20_000, 40_000, 80_000, 120_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 503 || err.status === 429;
  const message = err instanceof Error ? err.message : String(err);
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|fetch failed|network|socket hang up/i.test(message);
}

const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function wordCount(blocks: Block[]) {
  return blocks
    .map((b) => (b.type === 'list' ? b.items.join(' ') : b.text))
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

const PERSONA = `You are ghostwriting a blog post as Krish, an aspiring software developer from a small town \
(Pundri, Kaithal) in Haryana, India. He is self-taught, builds projects with AI tools (Claude Code, VS Code, \
Supabase, Gemini), and also does video editing and content creation. He writes in first person, in friendly, \
simple, practical English — honest about what he does and doesn't know yet, never boastful. He never invents \
statistics, quotes, credentials, jobs, or experiences that weren't given to him as notes.`;

const responseSchema = {
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
  },
  required: ['title', 'excerpt', 'category', 'blocks'],
};

function buildPrompt(opts: {
  topicTitle?: string;
  topicNotes?: string;
  topicCategory?: Category;
  existingTitles: string[];
  feedback?: string;
}) {
  const parts = [PERSONA, ''];

  if (opts.topicTitle) {
    parts.push(`Write today's post about this topic idea: "${opts.topicTitle}".`);
    if (opts.topicNotes) {
      parts.push(`Krish's own notes/experience to build the post around (use these, don't ignore them):\n${opts.topicNotes}`);
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
    '- Return ONLY the JSON described by the response schema.',
  );

  if (opts.feedback) parts.push('', `Your previous attempt was invalid: ${opts.feedback}. Fix this and try again.`);

  return parts.join('\n');
}

function validate(data: unknown, existingTitles: string[]): { ok: true; post: GeneratedPost } | { ok: false; reason: string } {
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

  return { ok: true, post: { title: d.title.trim(), excerpt: d.excerpt.trim(), category: d.category as Category, blocks } };
}

// Calls one model, retrying on 503/429/network errors with increasing waits. Any other error
// (bad API key, invalid request, etc.) is not retried and is thrown straight away.
async function callModel(model: string, prompt: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema },
      });
      const text = response.text;
      if (!text) throw new Error('Gemini returned an empty response.');
      return JSON.parse(text) as unknown;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (!isRetryableError(err) || attempt >= RETRY_DELAYS_MS.length) {
        console.error(`[${model}] attempt ${attempt + 1} failed, giving up: ${reason}`);
        throw err;
      }
      const wait = RETRY_DELAYS_MS[attempt];
      console.warn(`[${model}] attempt ${attempt + 1} failed (${reason}) — retrying in ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
}

async function generateOnce(prompt: string): Promise<unknown> {
  try {
    return await callModel(PRIMARY_MODEL, prompt);
  } catch (primaryErr) {
    if (!isRetryableError(primaryErr)) throw primaryErr;
    const primaryReason = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn(`"${PRIMARY_MODEL}" failed after every retry (${primaryReason}) — falling back to "${FALLBACK_MODEL}"…`);
    try {
      return await callModel(FALLBACK_MODEL, prompt);
    } catch (fallbackErr) {
      const fallbackReason = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(
        `Gemini was unavailable on both "${PRIMARY_MODEL}" and "${FALLBACK_MODEL}" after retries. ` +
        `Primary: ${primaryReason}. Fallback: ${fallbackReason}.`,
      );
    }
  }
}

async function generateValidPost(opts: {
  topicTitle?: string; topicNotes?: string; topicCategory?: Category; existingTitles: string[];
}): Promise<GeneratedPost> {
  const first = await generateOnce(buildPrompt(opts));
  const firstCheck = validate(first, opts.existingTitles);
  if (firstCheck.ok) return firstCheck.post;

  console.warn(`First attempt was invalid (${firstCheck.reason}), retrying once…`);
  const second = await generateOnce(buildPrompt({ ...opts, feedback: firstCheck.reason }));
  const secondCheck = validate(second, opts.existingTitles);
  if (secondCheck.ok) return secondCheck.post;

  throw new Error(`Gemini's output was invalid twice in a row: ${secondCheck.reason}`);
}

async function uniqueSlug(title: string) {
  const base = slugify(title) || 'post';
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
    .from('auto_post_settings').select('publish_automatically').eq('id', 1).maybeSingle();
  if (settingsError) throw new Error(`Could not read auto-post settings: ${settingsError.message}`);
  const publishAutomatically = settingsRow?.publish_automatically ?? false;

  const { data: topics, error: topicsError } = await supabase
    .from('auto_post_topics').select('id, title, notes, category').eq('status', 'pending').order('position').limit(1);
  if (topicsError) throw new Error(`Could not read the topic queue: ${topicsError.message}`);
  const topic = topics?.[0] as { id: string; title: string; notes: string; category: Category } | undefined;

  const { data: existingPosts, error: postsError } = await supabase.from('posts').select('title');
  if (postsError) throw new Error(`Could not read existing posts: ${postsError.message}`);
  const existingTitles = (existingPosts ?? []).map((p) => p.title as string);

  const attemptLabel = topic?.title ?? '(auto-picked topic)';

  try {
    const generated = await generateValidPost({
      topicTitle: topic?.title,
      topicNotes: topic?.notes,
      topicCategory: topic?.category,
      existingTitles,
    });

    const slug = await uniqueSlug(generated.title);
    const { error: insertError } = await supabase.from('posts').insert({
      slug,
      title: generated.title,
      excerpt: generated.excerpt,
      category: generated.category,
      date: today,
      status: publishAutomatically ? 'published' : 'draft',
      blocks: generated.blocks,
      cover: '',
    });
    if (insertError) throw new Error(`Could not save the post: ${insertError.message}`);

    if (topic) {
      const { error: markUsedError } = await supabase.from('auto_post_topics').update({ status: 'used' }).eq('id', topic.id);
      if (markUsedError) console.error(`Post was saved, but could not mark the topic as used: ${markUsedError.message}`);
    }

    await logRun('success', generated.title);
    console.log(`Created ${publishAutomatically ? 'and published' : 'draft'} post: "${generated.title}" (/blog/${slug})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun('failed', attemptLabel, message);
    throw err;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
