import { createClient } from '@supabase/supabase-js';
import { ApiError, GoogleGenAI, Type } from '@google/genai';

/*
 * Runs on a schedule (see .github/workflows/auto-blog-post.yml) to write one blog post for the
 * Krish portfolio and insert it into Supabase. Writers are tried in order until one works:
 * Gemini Flash, then Gemini Flash-Lite (separate capacity pool, so it can succeed when Flash is
 * overloaded), then Groq as a free backup (same prompt, same JSON shape, same validation).
 * Also runnable by hand via the "Run workflow" button on the GitHub Actions tab, or locally with
 * GEMINI_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set (GROQ_API_KEY is optional).
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

// Aliased to Google's current default Flash / Flash-Lite models, so these never need a model
// name bumped by hand. They're separate capacity pools, so Flash being overloaded doesn't mean
// Flash-Lite is too.
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_MODEL_LITE = 'gemini-flash-lite-latest';

// GitHub Models (the original free backup) was retired in July 2026, so Groq is the backup instead.
// Groq's free-tier catalog changes often (models get deprecated with a few weeks' notice), so the
// model isn't hardcoded — callGroq() asks Groq which models actually exist right before writing.
// Ordered largest/best-for-writing first; whichever of these is actually live gets used.
const GROQ_PREFERRED_MODELS = [
  'openai/gpt-oss-120b',
  'moonshotai/kimi-k2-instruct',
  'qwen/qwen3-32b',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
];
// Groq's catalog also lists audio transcription/TTS and moderation models under /models — those
// can't write a blog post, so never pick one even as a last resort.
const GROQ_EXCLUDE_RE = /whisper|tts|guard|moderation|audio/i;

// ~15s, 30s — how long to wait before retrying one writer option. Kept short because the run has
// up to three writer options and, on an invalid response, tries the whole chain a second time —
// all within the GitHub Actions job's 15-minute timeout.
const RETRY_DELAYS_MS = [15_000, 30_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError || err instanceof HttpError) return err.status === 503 || err.status === 429;
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
    '',
    'Return ONLY a single JSON object, no markdown fences, no extra text, in exactly this shape:',
    '{ "title": string, "excerpt": string, "category": one of "Journey" | "Learning" | "Projects" | "AI" | "Marketing", ' +
    '"blocks": Block[] }',
    'Where each Block is one of:',
    '{ "type": "h2" | "p" | "quote", "text": string }',
    '{ "type": "list", "items": string[] }',
    '{ "type": "code", "lang": string, "text": string }',
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

// Retries one provider call on 503/429/network errors with increasing waits. Any other error
// (bad API key, invalid request, etc.) is not retried and is thrown straight away.
async function withRetry<T>(label: string, call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (!isRetryableError(err) || attempt >= RETRY_DELAYS_MS.length) {
        console.error(`[${label}] attempt ${attempt + 1} failed, giving up: ${reason}`);
        throw err;
      }
      const wait = RETRY_DELAYS_MS[attempt];
      console.warn(`[${label}] attempt ${attempt + 1} failed (${reason}) — retrying in ${wait / 1000}s…`);
      await sleep(wait);
    }
  }
}

type ProviderResult = { text: string; model: string };

function callGemini(model: string) {
  return async (prompt: string): Promise<ProviderResult> => {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema },
    });
    const text = response.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return { text, model };
  };
}

// Picks the best available Groq chat model: the first of GROQ_PREFERRED_MODELS that's actually
// live, or (if none of those are) any other non-excluded model Groq currently offers.
function selectGroqModel(available: string[]): string {
  const usable = available.filter((id) => !GROQ_EXCLUDE_RE.test(id));
  const preferred = GROQ_PREFERRED_MODELS.find((id) => usable.includes(id));
  if (preferred) return preferred;
  if (usable.length) return usable[0];
  throw new Error('Groq has no usable chat models available.');
}

async function callGroq(prompt: string): Promise<ProviderResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set.');

  const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!modelsRes.ok) {
    const body = await modelsRes.text().catch(() => '');
    throw new HttpError(modelsRes.status, `Groq models list error ${modelsRes.status}: ${body.slice(0, 300)}`);
  }
  const modelsData = (await modelsRes.json()) as { data?: { id: string }[] };
  const model = selectGroqModel((modelsData.data ?? []).map((m) => m.id));
  console.log(`[Groq] chosen model: ${model}`);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // A model that disappeared from the catalog between the list call and here shouldn't be
    // retried — withRetry would just hit the same 404 again — so this still throws normally and
    // generateOnce() moves straight on to the next writer option.
    throw new HttpError(res.status, `Groq API error ${res.status} (model "${model}"): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned an empty response.');
  return { text, model };
}

// One entry per writer option, tried in order. To add another free provider later, just add a
// `call` function above and one more entry here — nothing else changes.
const providers: { name: string; label: string; call: (prompt: string) => Promise<ProviderResult> }[] = [
  { name: 'Gemini', label: `Gemini (${GEMINI_MODEL})`, call: callGemini(GEMINI_MODEL) },
  { name: 'Gemini', label: `Gemini (${GEMINI_MODEL_LITE})`, call: callGemini(GEMINI_MODEL_LITE) },
  { name: 'Groq', label: 'Groq', call: callGroq },
];

async function generateOnce(prompt: string): Promise<{ data: unknown; writer: string }> {
  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const { text, model } = await withRetry(provider.label, () => provider.call(prompt));
      return { data: JSON.parse(text) as unknown, writer: `${provider.name} (${model})` };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push(`${provider.label}: ${reason}`);
      console.warn(`${provider.label} could not write the post — trying the next option…`);
    }
  }
  throw new Error(`Every provider failed. ${failures.join(' | ')}`);
}

async function generateValidPost(opts: {
  topicTitle?: string; topicNotes?: string; topicCategory?: Category; existingTitles: string[];
}): Promise<{ post: GeneratedPost; writer: string }> {
  const first = await generateOnce(buildPrompt(opts));
  const firstCheck = validate(first.data, opts.existingTitles);
  if (firstCheck.ok) return { post: firstCheck.post, writer: first.writer };

  console.warn(`First attempt (${first.writer}) was invalid (${firstCheck.reason}), retrying once…`);
  const second = await generateOnce(buildPrompt({ ...opts, feedback: firstCheck.reason }));
  const secondCheck = validate(second.data, opts.existingTitles);
  if (secondCheck.ok) return { post: secondCheck.post, writer: second.writer };

  throw new Error(`Output was invalid twice in a row (last from ${second.writer}): ${secondCheck.reason}`);
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
    const { post: generated, writer } = await generateValidPost({
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

    await logRun('success', generated.title, `Written by ${writer}.`);
    console.log(`Created ${publishAutomatically ? 'and published' : 'draft'} post: "${generated.title}" (/blog/${slug}) — written by ${writer}`);
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
