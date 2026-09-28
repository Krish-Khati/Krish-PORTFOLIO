/*
 * ai-model-picker.ts — provider-agnostic, always-fresh model picker for Gemini + Groq.
 *
 * The problem this solves: hardcoded model IDs (e.g. "gemini-2.5-flash") go stale as providers
 * retire and replace models, and there's no single place to bump them across many projects. This
 * module instead asks each provider's own models-list endpoint what exists right now, filters
 * out non-text models, and ranks what's left with a small heuristic (stable > preview, better
 * family/tier, higher version, bigger param count). Callers just try the returned list in order.
 *
 * Zero project-specific code — no Supabase, no app types, no env var reads. To reuse it in
 * another project, copy this file as-is into that project's scripts folder and call
 * `pickModelOrder({ geminiApiKey, groqApiKey })`.
 */

export type Provider = 'gemini' | 'groq';
export type ModelChoice = { provider: Provider; model: string };

// Keywords that mark a model as non-text (TTS, image/video generation, embeddings, moderation,
// coding-agent/computer-use variants, etc.) or otherwise unsuitable for writing a blog post
// (Gemma — an open-weight model family, not what this is tuned for), so they're never picked,
// even as a last resort.
const EXCLUDE_NAME_RE = new RegExp(
  [
    'tts', 'image', 'nano-banana', 'live', 'audio', 'embedding', 'transcribe', 'whisper', 'guard',
    'safeguard', 'orpheus', 'robotics', 'computer-use', 'customtools', 'deep-research', 'agent',
    'antigravity', 'omni', 'veo', 'lyria', 'imagen', 'aqa', 'gemma',
  ].join('|'),
  'i',
);

// A "pro"-tier model (e.g. "gemini-2.5-pro", "gemini-3-pro-preview") is usually quota-0 on a free
// tier — matched with boundaries so it doesn't false-positive on an unrelated word containing
// "pro" as a substring.
const PRO_TIER_RE = /(^|[-_/])pro([-_]|$)/i;

// Used only if a provider's live models-list call itself fails (network error, outage, etc.) —
// never preferred over a live list, and callers still get a warning when this is used. Because
// callers skip a model immediately on 404/403/"not found", a stale entry here is harmless.
const EMERGENCY_GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const EMERGENCY_GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Every request this module makes gets a hard timeout, so a stalled connection to a provider
// can never hang the whole run — it just surfaces as a normal rejected promise.
const REQUEST_TIMEOUT_MS = 90_000;

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)),
    REQUEST_TIMEOUT_MS,
  );
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${url.split('?')[0]} -> ${res.status}: ${body.slice(0, 300)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Lists every Gemini model that supports generateContent, handling pagination. */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const names: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await fetchJson(url.toString());
    for (const m of (data.models ?? []) as { name?: string; supportedGenerationMethods?: string[] }[]) {
      const methods = m.supportedGenerationMethods ?? [];
      if (!methods.includes('generateContent')) continue;
      const id = String(m.name ?? '').replace(/^models\//, '');
      if (id) names.push(id);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return names;
}

/** Lists every active Groq model (text/chat and otherwise — callers filter). */
export async function listGroqModels(apiKey: string): Promise<string[]> {
  const data = await fetchJson('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return ((data.data ?? []) as { id: string; active?: boolean }[])
    .filter((m) => m.active !== false)
    .map((m) => m.id);
}

function excludeNonText(names: string[]): string[] {
  return names.filter((n) => !EXCLUDE_NAME_RE.test(n) && !PRO_TIER_RE.test(n));
}

// Finds the first bare version-like token (e.g. "2.5", "1", "3.8") in a hyphen/slash-separated
// model id, so a trailing date suffix like "-09-2025" doesn't get mistaken for the version.
function firstVersionNumber(name: string): number | undefined {
  for (const token of name.split(/[/\-_]/)) {
    if (/^\d+(\.\d+)?$/.test(token)) return Number.parseFloat(token);
  }
  return undefined;
}

/**
 * Ranks Gemini model ids best-first: stable before preview/experimental; "flash" before
 * "flash-lite" before everything else (pro-tier models are excluded entirely — see
 * excludeNonText); higher version number first; versionless "-latest" aliases sort after the
 * specific versions they alias.
 */
export function rankGeminiModels(names: string[]): string[] {
  const usable = excludeNonText(names);
  const tierOf = (n: string) => {
    if (/flash-lite/i.test(n)) return 1;
    if (/flash/i.test(n)) return 0;
    return 2;
  };
  const isPreviewOrExp = (n: string) => /preview|exp(?:erimental)?/i.test(n);

  return [...usable].sort((a, b) => {
    const stableA = isPreviewOrExp(a) ? 1 : 0;
    const stableB = isPreviewOrExp(b) ? 1 : 0;
    if (stableA !== stableB) return stableA - stableB;

    const tierA = tierOf(a);
    const tierB = tierOf(b);
    if (tierA !== tierB) return tierA - tierB;

    // Missing version (e.g. "gemini-flash-latest") sorts after every specifically-versioned model
    // in the same tier, which is exactly the "-latest goes after specific versions" rule.
    const verA = firstVersionNumber(a) ?? -1;
    const verB = firstVersionNumber(b) ?? -1;
    if (verA !== verB) return verB - verA;

    return a.localeCompare(b);
  });
}

// Matches a parameter-count suffix like "120b" or "3.5b", but not part of a longer token.
function paramSizeB(name: string): number | undefined {
  const match = name.match(/(\d+(?:\.\d+)?)b(?![a-z0-9])/i);
  return match ? Number.parseFloat(match[1]) : undefined;
}

/** Ranks Groq model ids best-first: higher parameter size wins; unknown sizes sort last. */
export function rankGroqModels(names: string[]): string[] {
  const usable = excludeNonText(names);
  return [...usable].sort((a, b) => {
    const sizeA = paramSizeB(a) ?? -1;
    const sizeB = paramSizeB(b) ?? -1;
    if (sizeA !== sizeB) return sizeB - sizeA;
    return a.localeCompare(b);
  });
}

export type PickModelOrderOptions = {
  /** Omit (or leave undefined) to skip Gemini entirely. */
  geminiApiKey?: string;
  /** Omit (or leave undefined) to skip Groq entirely. */
  groqApiKey?: string;
  /** Skips the live list + ranking for Gemini and tries exactly these ids, in this order. */
  geminiOverride?: string[];
  /** Skips the live list + ranking for Groq and tries exactly these ids, in this order. */
  groqOverride?: string[];
  /** Models to drop from consideration entirely (e.g. ones a caller has learned are gone/404). */
  exclude?: ModelChoice[];
  /** A model to move to the very front of the final order, if it's still present in it. */
  preferredFirst?: ModelChoice;
  /**
   * A model to move to the back of its own provider's ranked list (e.g. one that returned
   * 503/overloaded last run), so a run doesn't immediately retry the same busy model first.
   * Ignored if it's also `preferredFirst`.
   */
  deprioritize?: ModelChoice;
  /**
   * If set, the first pass alternates the top N models of each provider — Gemini #1, Groq #1,
   * Gemini #2, Groq #2, ... — so one overloaded provider can't burn the whole run before the
   * other provider is even tried. Any models beyond the top N are appended afterward, still
   * ranked, one provider's remainder after the other. Omit for the plain "all of Gemini, then all
   * of Groq" order.
   */
  interleaveTop?: number;
  /** Defaults to console.log; pass your own to redirect/collect the picker's log lines. */
  log?: (line: string) => void;
};

const isSameChoice = (a: ModelChoice, b: ModelChoice) => a.provider === b.provider && a.model === b.model;

// A transient blip on the models-list call itself shouldn't be enough to fall back to the tiny
// emergency list (which would then only offer -latest aliases) — one quick retry first.
async function listWithOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

/**
 * Builds the ordered list of {provider, model} to try, Gemini first then Groq. Each provider is
 * skipped entirely if no API key is given for it.
 */
export async function pickModelOrder(opts: PickModelOrderOptions): Promise<ModelChoice[]> {
  const log = opts.log ?? ((line: string) => console.log(line));

  let geminiRanked: string[] = [];
  if (opts.geminiApiKey) {
    if (opts.geminiOverride?.length) {
      geminiRanked = opts.geminiOverride;
      log(`[ai-model-picker] Gemini: using override list — ${geminiRanked.join(', ')}`);
    } else {
      try {
        const apiKey = opts.geminiApiKey;
        geminiRanked = rankGeminiModels(await listWithOneRetry(() => listGeminiModels(apiKey)));
        log(`[ai-model-picker] Gemini: ranked live models — ${geminiRanked.join(', ') || '(none found)'}`);
      } catch (err) {
        geminiRanked = EMERGENCY_GEMINI_MODELS;
        log(`[ai-model-picker] WARNING: Gemini models list failed (${errMsg(err)}) — using emergency list: ${geminiRanked.join(', ')}`);
      }
    }
  }

  let groqRanked: string[] = [];
  if (opts.groqApiKey) {
    if (opts.groqOverride?.length) {
      groqRanked = opts.groqOverride;
      log(`[ai-model-picker] Groq: using override list — ${groqRanked.join(', ')}`);
    } else {
      try {
        const apiKey = opts.groqApiKey;
        groqRanked = rankGroqModels(await listWithOneRetry(() => listGroqModels(apiKey)));
        log(`[ai-model-picker] Groq: ranked live models — ${groqRanked.join(', ') || '(none found)'}`);
      } catch (err) {
        groqRanked = EMERGENCY_GROQ_MODELS;
        log(`[ai-model-picker] WARNING: Groq models list failed (${errMsg(err)}) — using emergency list: ${groqRanked.join(', ')}`);
      }
    }
  }

  if (opts.exclude?.length) {
    const excludedGemini = new Set(opts.exclude.filter((c) => c.provider === 'gemini').map((c) => c.model));
    const excludedGroq = new Set(opts.exclude.filter((c) => c.provider === 'groq').map((c) => c.model));
    if (excludedGemini.size) geminiRanked = geminiRanked.filter((m) => !excludedGemini.has(m));
    if (excludedGroq.size) groqRanked = groqRanked.filter((m) => !excludedGroq.has(m));
    if (excludedGemini.size || excludedGroq.size) {
      log(`[ai-model-picker] Excluding previously-blocked models: ${[...excludedGemini].map((m) => `gemini:${m}`).concat([...excludedGroq].map((m) => `groq:${m}`)).join(', ')}`);
    }
  }

  // Deprioritizing operates on each provider's own ranked list (not the final combined order),
  // so it still works correctly whether or not interleaveTop is used afterward.
  if (opts.deprioritize && !(opts.preferredFirst && isSameChoice(opts.deprioritize, opts.preferredFirst))) {
    const { provider, model } = opts.deprioritize;
    const list = provider === 'gemini' ? geminiRanked : groqRanked;
    const idx = list.indexOf(model);
    if (idx !== -1 && idx < list.length - 1) {
      list.splice(idx, 1);
      list.push(model);
    }
    if (idx !== -1) log(`[ai-model-picker] Deprioritizing model that was overloaded (503) last run: ${provider} (${model})`);
  }

  const toChoices = (provider: Provider, models: string[]) => models.map((model) => ({ provider, model }));

  let order: ModelChoice[];
  if (opts.interleaveTop && opts.interleaveTop > 0) {
    const n = opts.interleaveTop;
    const gTop = toChoices('gemini', geminiRanked.slice(0, n));
    const qTop = toChoices('groq', groqRanked.slice(0, n));
    const interleaved: ModelChoice[] = [];
    for (let i = 0; i < Math.max(gTop.length, qTop.length); i++) {
      if (gTop[i]) interleaved.push(gTop[i]);
      if (qTop[i]) interleaved.push(qTop[i]);
    }
    order = [...interleaved, ...toChoices('gemini', geminiRanked.slice(n)), ...toChoices('groq', groqRanked.slice(n))];
  } else {
    order = [...toChoices('gemini', geminiRanked), ...toChoices('groq', groqRanked)];
  }

  if (opts.preferredFirst) {
    const { provider, model } = opts.preferredFirst;
    const idx = order.findIndex((c) => c.provider === provider && c.model === model);
    if (idx > 0) {
      const [preferred] = order.splice(idx, 1);
      order = [preferred, ...order];
    }
    if (idx !== -1) log(`[ai-model-picker] Trying last-known-working model first: ${provider} (${model})`);
  }

  log(`[ai-model-picker] Final try order: ${order.map((c) => `${c.provider}:${c.model}`).join(' -> ') || '(empty)'}`);
  return order;
}
