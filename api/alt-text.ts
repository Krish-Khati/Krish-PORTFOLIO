/*
 * POST /api/alt-text — writes SEO alt text for a project screenshot. Called by the admin panel's
 * gallery manager after each upload and by its "Regenerate alt text" button.
 *
 * Body: { image?: "data:image/...;base64,...", imageUrl?: string, projectName: string,
 *         projectDescription?: string }
 * Reply: 200 { alt, model } or an error status with { error }. The browser falls back to
 * "<Project name> screenshot <n>" on any error, so an upload never fails because of this.
 *
 * Models come from scripts/src/ai-model-picker.ts (each provider's live models list, ranked), so
 * nothing here names a specific model. Every Gemini text model accepts images; on Groq only the
 * vision families do, so Groq's ranked list is narrowed to those. API keys (GEMINI_API_KEY,
 * GROQ_API_KEY) stay server-side. Only the signed-in admin can call this (same check as rebuild).
 */

import type { ModelChoice } from '../scripts/src/ai-model-picker.js';
import { env, json, requireAdmin, supabaseUrl } from './_admin';

// The picker lives under scripts/ ("type": "module"), so it compiles to an ES module. This file is
// CommonJS, and Vercel's launcher does not allow require() of an ES module (ERR_REQUIRE_ESM) —
// a dynamic import() is the one way in that works everywhere.
const loadPicker = () => import('../scripts/src/ai-model-picker.js');

const MAX_ALT = 120;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PER_MODEL_TIMEOUT_MS = 15_000;
const TOTAL_BUDGET_MS = 40_000;
const MAX_ATTEMPTS = 5;

// Groq serves text-only and vision models from one list; only these families accept images.
const GROQ_VISION_RE = /llama-4|vision|scout|maverick|(^|[-_/])vl([-_]|$)/i;

type Img = { mime: string; data: string }; // data = base64

function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function readImage(body: { image?: unknown; imageUrl?: unknown }): Promise<Img | string> {
  if (typeof body.image === 'string' && body.image) {
    const m = body.image.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return 'The image must be a PNG, JPEG, WebP or GIF data URL.';
    if (m[2].length * 0.75 > MAX_IMAGE_BYTES) return 'That image is over 5 MB.';
    return { mime: m[1], data: m[2] };
  }
  if (typeof body.imageUrl === 'string' && body.imageUrl) {
    // Only images in this site's own Supabase storage — never an arbitrary URL.
    const allowed = `${supabaseUrl()}/storage/v1/object/public/`;
    if (!supabaseUrl() || !body.imageUrl.startsWith(allowed)) return 'Only images uploaded through the admin panel can be described.';
    const res = await fetch(body.imageUrl, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) return `Could not download the image (HTTP ${res?.status ?? 'error'}).`;
    const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) return `Unsupported image type "${mime || 'unknown'}".`;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) return 'That image is over 5 MB.';
    return { mime, data: toBase64(bytes) };
  }
  return 'Send the image as "image" (data URL) or "imageUrl".';
}

function prompt(name: string, description: string) {
  return [
    `Write the alt text for this screenshot of the project "${name}".`,
    description ? `About the project: ${description}` : '',
    'Rules:',
    `- One short phrase or sentence, at most ${MAX_ALT} characters.`,
    `- Mention "${name}".`,
    '- Be specific about what is visible: which screen or page, the key UI elements, headings or content.',
    '- Never start with "Image of", "Picture of", "Photo of" or "Screenshot of". No quotes, emojis or hashtags.',
    'Reply with only the alt text.',
  ].filter(Boolean).join('\n');
}

/** Cleans the model's reply into usable alt text, or '' if nothing usable came back. */
function cleanAlt(raw: string, name: string) {
  let alt = raw.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  alt = alt
    .replace(/^(alt(?: text)?|answer)\s*:\s*/i, '')
    .replace(/^["'“”‘’`*_]+|["'“”‘’`*_]+$/g, '')
    .replace(/^(an?\s+)?(image|picture|photo|screenshot|screen ?shot)\s+(of|showing)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!alt) return '';
  if (!alt.toLowerCase().includes(name.toLowerCase())) alt = `${name}: ${alt.charAt(0).toLowerCase()}${alt.slice(1)}`;
  if (alt.length > MAX_ALT) {
    const cut = alt.slice(0, MAX_ALT);
    const space = cut.lastIndexOf(' ');
    alt = space > MAX_ALT * 0.6 ? cut.slice(0, space) : cut;
  }
  return alt.replace(/[\s,;:.–—-]+$/, '');
}

async function callGemini(model: string, key: string, text: string, img: Img, signal: AbortSignal) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text }, { inline_data: { mime_type: img.mime, data: img.data } }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  return (data.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
}

async function callGroq(model: string, key: string, text: string, img: Img, signal: AbortSignal) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_completion_tokens: 200,
      messages: [{ role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.data}` } }] }],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json(400, { error: 'Send a JSON body.' });
  const name = typeof body.projectName === 'string' ? body.projectName.trim().slice(0, 120) : '';
  const description = typeof body.projectDescription === 'string' ? body.projectDescription.trim().slice(0, 600) : '';
  if (!name) return json(400, { error: 'projectName is required.' });

  const geminiApiKey = env.GEMINI_API_KEY || undefined;
  const groqApiKey = env.GROQ_API_KEY || undefined;
  if (!geminiApiKey && !groqApiKey) {
    return json(501, { error: 'No AI key is set in Vercel (add GEMINI_API_KEY and/or GROQ_API_KEY), so alt text was not generated.' });
  }

  const img = await readImage(body);
  if (typeof img === 'string') return json(400, { error: img });

  const started = Date.now();
  let order: ModelChoice[];
  try {
    const { pickModelOrder } = await loadPicker();
    order = await pickModelOrder({ geminiApiKey, groqApiKey, interleaveTop: 2 });
  } catch (err) {
    return json(502, { error: `Could not list AI models: ${err instanceof Error ? err.message : String(err)}` });
  }
  order = order.filter((c) => c.provider === 'gemini' || GROQ_VISION_RE.test(c.model)).slice(0, MAX_ATTEMPTS);
  if (!order.length) return json(502, { error: 'None of the available AI models can read images right now.' });

  const text = prompt(name, description);
  const failures: string[] = [];
  for (const choice of order) {
    const left = TOTAL_BUDGET_MS - (Date.now() - started);
    if (left < 3_000) break;
    try {
      const signal = AbortSignal.timeout(Math.min(PER_MODEL_TIMEOUT_MS, left));
      const raw = choice.provider === 'gemini'
        ? await callGemini(choice.model, geminiApiKey!, text, img, signal)
        : await callGroq(choice.model, groqApiKey!, text, img, signal);
      const alt = cleanAlt(raw, name);
      if (alt) {
        console.log(`[alt-text] ${choice.provider}:${choice.model} -> "${alt}"`);
        return json(200, { alt, model: `${choice.provider}:${choice.model}` });
      }
      failures.push(`${choice.model}: empty reply`);
    } catch (err) {
      failures.push(`${choice.model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.warn(`[alt-text] All models failed — ${failures.join(' | ')}`);
  return json(502, { error: `The AI models could not describe this image (${failures[0] ?? 'out of time'}).` });
}

export function GET(): Response {
  return json(405, { error: 'Use POST.' });
}
