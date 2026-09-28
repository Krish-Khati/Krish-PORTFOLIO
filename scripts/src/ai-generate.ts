import { ApiError, GoogleGenAI, type Schema } from '@google/genai';
import type { ModelChoice } from './ai-model-picker';

/*
 * Shared "ask a model for JSON" machinery for the scripts in this folder (auto-blog-post.ts,
 * seo-backfill.ts). Which models to try, and in what order, always comes from ai-model-picker.ts
 * (live model lists, nothing hardcoded); this module just walks that order: per-request timeout,
 * one retry on 503/429, a per-provider circuit breaker, Groq JSON-mode recovery, and an overall
 * time budget.
 */

// One retry, 10s wait, on a retryable error (503/429) — never for 404/403/400. Kept short because
// a run may try several models, and on an invalid response, tries the whole chain a second time —
// all within the caller's overall time budget and the GitHub Actions job's timeout.
const RETRY_DELAYS_MS = [10_000];

// A single request to a model (Gemini or Groq) is aborted if it hasn't responded by this point,
// so a stalled connection can never hang the whole run — it just becomes a normal failure and
// generateOnce() moves on to the next model. Every AI request goes through withTimeout() below.
const MODEL_TIMEOUT_MS = 90_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`request timed out after ${ms / 1000}s`);
    this.name = 'TimeoutError';
  }
}

// Runs `fn` with an AbortController that's aborted after MODEL_TIMEOUT_MS, and passes the
// resulting signal through so both the Gemini SDK's abortSignal option and plain fetch() can use
// the same mechanism.
async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError(MODEL_TIMEOUT_MS)), MODEL_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError || err instanceof HttpError) return err.status === 503 || err.status === 429;
  const message = err instanceof Error ? err.message : String(err);
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|fetch failed|network|socket hang up/i.test(message);
}

// Timeouts are never retried on the same model (a timeout counts as a failure and generateOnce()
// moves straight to the next model), so this deliberately doesn't feed into isRetryableError.
function isOverloadedError(err: unknown): boolean {
  return (err instanceof ApiError || err instanceof HttpError) && err.status === 503;
}

// A model that's actually gone from the catalog (retired, decommissioned) rather than just
// temporarily busy — worth remembering permanently (auto_post_settings.blocked_models) instead of
// re-discovering it every run.
function isPermanentlyUnavailable(err: unknown): boolean {
  if ((err instanceof ApiError || err instanceof HttpError) && err.status === 404) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /no longer available|model_not_found|model_decommissioned|has been deprecated|has been removed/i.test(message);
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

export type ProviderKeys = { geminiApiKey?: string; groqApiKey?: string };

let gemini: GoogleGenAI | undefined;

function callGemini(apiKey: string, model: string, prompt: string, responseSchema?: Schema): Promise<ProviderResult> {
  gemini ??= new GoogleGenAI({ apiKey });
  const ai = gemini;
  return withTimeout(async (signal) => {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        ...(responseSchema ? { responseSchema } : {}),
        abortSignal: signal,
        httpOptions: { timeout: MODEL_TIMEOUT_MS },
      },
    });
    const text = response.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return { text, model };
  });
}

// Extracts the JSON object from a model's text output. Fast path: the whole trimmed text is
// already valid JSON (the normal case). Fallback: some reasoning models (e.g. Groq's gpt-oss)
// emit reasoning/commentary before or around the final answer, so this scans for a balanced
// {...} span and parses just that — the "final answer only" part of the JSON.
function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // fall through to brace extraction below
  }
  const start = trimmed.indexOf('{');
  if (start === -1) return trimmed;
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === '{') depth++;
    else if (trimmed[i] === '}') {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return trimmed;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

const fixTrailingCommas = (text: string) => text.replace(/,\s*([}\]])/g, '$1');

// Tries to recover a valid JSON object out of raw model text that failed strict validation:
// strips markdown code fences, extracts a balanced {...} span, and removes trailing commas — the
// handful of small issues that make an otherwise-complete post fail JSON parsing. Returns
// undefined (rather than throwing) if nothing here produces valid JSON.
function tryRecoverJson(raw: string): string | undefined {
  for (const candidate of [raw, stripCodeFences(raw)]) {
    const extracted = extractJsonObject(candidate);
    for (const attempt of [extracted, fixTrailingCommas(extracted)]) {
      try {
        JSON.parse(attempt);
        return attempt;
      } catch {
        // try the next variant
      }
    }
  }
  return undefined;
}

// A 1200-word post plus JSON structure (block wrappers, escaped quotes, SEO fields and FAQs) can
// run well past Groq's default max output tokens, which truncates the JSON mid-object — this is
// generous headroom.
const GROQ_MAX_COMPLETION_TOKENS = 8000;

class GroqApiError extends HttpError {
  code?: string;
  failedGeneration?: string;
  constructor(status: number, model: string, rawBody: string, info?: { message?: string; code?: string; failed_generation?: string }) {
    super(status, `Groq API error ${status} (model "${model}")${info?.code ? ` [${info.code}]` : ''}: ${(info?.message ?? rawBody).slice(0, 300)}`);
    this.name = 'GroqApiError';
    this.code = info?.code;
    this.failedGeneration = info?.failed_generation;
  }
}

async function callGroqModel(apiKey: string | undefined, model: string, prompt: string): Promise<ProviderResult> {
  if (!apiKey) throw new Error('GROQ_API_KEY is not set.');

  const request = (withJsonMode: boolean) => withTimeout(async (signal) => {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: GROQ_MAX_COMPLETION_TOKENS,
    };
    if (withJsonMode) body.response_format = { type: 'json_object' };
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      let errorInfo: { message?: string; code?: string; failed_generation?: string } | undefined;
      try {
        errorInfo = (JSON.parse(errBody) as { error?: typeof errorInfo }).error;
      } catch {
        // body wasn't JSON — errorInfo stays undefined, GroqApiError falls back to the raw text
      }
      // A model that disappeared from the catalog or doesn't support this request shouldn't be
      // retried — withRetry would just hit the same error again — so this still throws normally
      // and generateOnce() moves straight on to the next model.
      throw new GroqApiError(res.status, model, errBody, errorInfo);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq returned an empty response.');
    return text;
  });

  let text: string;
  try {
    text = await request(true);
  } catch (err) {
    const isJsonValidateFailure = err instanceof GroqApiError && err.code === 'json_validate_failed';

    if (isJsonValidateFailure && (err as GroqApiError).failedGeneration) {
      // Groq's own JSON-mode validator rejected the output, but the model usually still produced
      // a complete, recoverable post in `failed_generation` — try to salvage it before falling
      // back to a plain request.
      const recovered = tryRecoverJson((err as GroqApiError).failedGeneration!);
      if (recovered) return { text: recovered, model };
      console.warn(`[Groq] (${model}) json_validate_failed and failed_generation wasn't recoverable — retrying without JSON mode…`);
    }

    // A json_validate_failed error, or any other 400 that means this model rejects
    // response_format entirely (reasoning models in particular), falls back to a plain request
    // and pulls the JSON out of the final answer text instead. Any other error is not retried
    // here — it's thrown straight through to generateOnce(), which moves on to the next model.
    const rejectsJsonMode = err instanceof HttpError && err.status === 400 &&
      (isJsonValidateFailure || /response_format|json_object|json_schema|unsupported/i.test(err.message));
    if (!rejectsJsonMode) throw err;
    text = await request(false);
  }

  return { text: extractJsonObject(text), model };
}

function callProvider(keys: ProviderKeys, choice: ModelChoice, prompt: string, geminiSchema?: Schema): Promise<ProviderResult> {
  if (choice.provider === 'gemini') {
    if (!keys.geminiApiKey) return Promise.reject(new Error('GEMINI_API_KEY is not set.'));
    return callGemini(keys.geminiApiKey, choice.model, prompt, geminiSchema);
  }
  return callGroqModel(keys.groqApiKey, choice.model, prompt);
}

export function providerLabel(choice: ModelChoice) {
  return `${choice.provider === 'gemini' ? 'Gemini' : 'Groq'} (${choice.model})`;
}

// Per-provider circuit breaker state, shared across every generateOnce() pass within one run:
// once a provider returns 503 from 2 different models in a row, the rest of that provider's
// models are skipped for the remainder of the run instead of wasting the time budget retrying a
// provider that's clearly overloaded right now.
export type BreakerState = { consecutiveOverloads: Record<ModelChoice['provider'], number>; broken: Set<ModelChoice['provider']> };
export const newBreakerState = (): BreakerState => ({ consecutiveOverloads: { gemini: 0, groq: 0 }, broken: new Set() });

export type GenerateOptions = {
  keys: ProviderKeys;
  /** Structured-output schema for Gemini (Groq gets JSON mode + the shape described in the prompt). */
  geminiSchema?: Schema;
  /** Epoch ms after which no further models are tried. */
  deadline: number;
  breaker: BreakerState;
  /** Called for every model that fails with a 503 (after retries). */
  onOverloaded?: (choice: ModelChoice) => void;
  /** Called for every model that's actually gone (404 / decommissioned). */
  onPermanentlyUnavailable?: (choice: ModelChoice) => void;
};

// Tries each model in `order`, most-preferred first, until one returns parseable JSON or the
// overall time budget (`deadline`) runs out.
export async function generateOnce(
  prompt: string,
  order: ModelChoice[],
  opts: GenerateOptions,
): Promise<{ data: unknown; writer: string; usedChoice: ModelChoice }> {
  const { breaker } = opts;
  const failures: string[] = [];
  for (const choice of order) {
    if (Date.now() >= opts.deadline) {
      failures.push('stopped — time budget exceeded before trying the remaining models');
      break;
    }
    const providerName = choice.provider === 'gemini' ? 'Gemini' : 'Groq';
    const label = providerLabel(choice);
    if (breaker.broken.has(choice.provider)) {
      console.log(`Skipping ${label} — ${providerName}'s circuit breaker is open this run.`);
      continue;
    }
    console.log(`Trying ${label}…`);
    try {
      const { text, model } = await withRetry(label, () => callProvider(opts.keys, choice, prompt, opts.geminiSchema));
      return { data: JSON.parse(text) as unknown, writer: `${providerName} (${model})`, usedChoice: choice };
    } catch (err) {
      if (isOverloadedError(err)) {
        opts.onOverloaded?.(choice);
        const count = (breaker.consecutiveOverloads[choice.provider] += 1);
        if (count >= 2) {
          breaker.broken.add(choice.provider);
          console.warn(`${providerName}: 2 models in a row returned 503 — skipping the rest of ${providerName} this run.`);
        }
      } else {
        breaker.consecutiveOverloads[choice.provider] = 0;
        if (isPermanentlyUnavailable(err)) opts.onPermanentlyUnavailable?.(choice);
      }
      const reason = err instanceof Error ? err.message : String(err);
      failures.push(`${label}: ${reason}`);
      console.warn(`${label} could not write the response — trying the next option…`);
    }
  }
  const shown = failures.slice(0, 8);
  const more = failures.length > shown.length ? ` … and ${failures.length - shown.length} more` : '';
  throw new Error(`Every model failed. ${shown.join(' | ')}${more}`);
}

// The auto_post_settings model-memory columns are stored as "<provider>:<model>", e.g.
// "gemini:gemini-flash-latest" — parsed back into a ModelChoice for pickModelOrder.
export function parseModelChoice(raw: string | null | undefined): ModelChoice | undefined {
  if (!raw) return undefined;
  const sep = raw.indexOf(':');
  if (sep === -1) return undefined;
  const provider = raw.slice(0, sep);
  const model = raw.slice(sep + 1);
  if ((provider !== 'gemini' && provider !== 'groq') || !model) return undefined;
  return { provider, model };
}

// blocked_models is a comma-separated list of the same "<provider>:<model>" format.
export function parseModelChoiceList(raw: string | null | undefined): ModelChoice[] {
  if (!raw) return [];
  return raw.split(',').map((s) => parseModelChoice(s.trim())).filter((c): c is ModelChoice => !!c);
}
