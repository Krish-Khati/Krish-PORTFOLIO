// The scrolling ticker under the hero (edited in the admin panel's Settings page, stored in the
// ticker_items table from supabase/add-ticker.sql).
// Kept free of browser-only imports so the build-time prerender script can use it too.

export type TickerItem = { id: string; label: string };
export type Ticker = { items: TickerItem[] };

// Static fallback — used when Supabase isn't configured, and whenever the ticker table can't be
// read (e.g. add-ticker.sql hasn't been run yet), so the band is never empty.
export const defaultTicker: Ticker = {
  items: [
    { id: 'always-building', label: 'ALWAYS BUILDING' },
    { id: 'python', label: 'PYTHON' },
    { id: 'c-cpp', label: 'C / C++' },
    { id: 'ai-tools', label: 'AI TOOLS' },
    { id: 'claude-code', label: 'CLAUDE CODE' },
    { id: 'supabase', label: 'SUPABASE' },
    { id: 'web-experiments', label: 'WEB EXPERIMENTS' },
    { id: 'video-editing', label: 'VIDEO EDITING' },
    { id: 'content-creation', label: 'CONTENT CREATION' },
    { id: 'git-github', label: 'GIT & GITHUB' },
    { id: 'logic-first', label: 'LOGIC FIRST' },
  ],
};

type ItemRow = { id: string; label: string | null };

/** Builds the ticker from database rows, falling back to the defaults when there are none. */
export function tickerFromRows(items: ItemRow[]): Ticker {
  const list = items.map((r) => ({ id: String(r.id), label: (r.label ?? '').trim() })).filter((i) => i.label);
  return { items: list.length ? list : defaultTicker.items };
}
