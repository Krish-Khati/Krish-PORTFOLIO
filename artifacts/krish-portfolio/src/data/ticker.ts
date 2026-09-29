// The scrolling ticker under the hero (edited in the admin panel's Settings page, stored in the
// ticker_items / ticker_settings tables from supabase/add-ticker.sql).
// Kept free of browser-only imports so the build-time prerender script can use it too.

export type TickerIcon = '' | 'code' | 'sparkle' | 'film' | 'database';
export type TickerItem = { id: string; label: string; icon: TickerIcon };
export type Ticker = { items: TickerItem[]; showSecondRow: boolean; secondRow: string[] };

export const tickerIcons: { value: TickerIcon; label: string }[] = [
  { value: '', label: 'No icon' },
  { value: 'code', label: 'Code' },
  { value: 'sparkle', label: 'Sparkle (AI)' },
  { value: 'film', label: 'Film (video)' },
  { value: 'database', label: 'Database' },
];

const iconValues = new Set<string>(tickerIcons.map((i) => i.value));
export const toTickerIcon = (value: unknown): TickerIcon =>
  typeof value === 'string' && iconValues.has(value) ? (value as TickerIcon) : '';

// Static fallback — used when Supabase isn't configured, and whenever the ticker tables can't be
// read (e.g. add-ticker.sql hasn't been run yet), so the band is never empty.
export const defaultTicker: Ticker = {
  items: [
    { id: 'always-building', label: 'ALWAYS BUILDING', icon: '' },
    { id: 'python', label: 'PYTHON', icon: 'code' },
    { id: 'c-cpp', label: 'C / C++', icon: '' },
    { id: 'ai-tools', label: 'AI TOOLS', icon: 'sparkle' },
    { id: 'claude-code', label: 'CLAUDE CODE', icon: '' },
    { id: 'supabase', label: 'SUPABASE', icon: 'database' },
    { id: 'web-experiments', label: 'WEB EXPERIMENTS', icon: '' },
    { id: 'video-editing', label: 'VIDEO EDITING', icon: 'film' },
    { id: 'content-creation', label: 'CONTENT CREATION', icon: '' },
    { id: 'git-github', label: 'GIT & GITHUB', icon: '' },
    { id: 'logic-first', label: 'LOGIC FIRST', icon: '' },
  ],
  showSecondRow: true,
  secondRow: ['LEARN', 'BUILD', 'SHIP', 'REPEAT'],
};

type ItemRow = { id: string; label: string; icon: string | null };
type SettingsRow = { show_second_row: boolean | null; second_row: string[] | null } | null;

/** Builds the ticker from database rows, filling anything missing or empty from the defaults. */
export function tickerFromRows(items: ItemRow[], settings: SettingsRow): Ticker {
  const list = items
    .map((r) => ({ id: String(r.id), label: (r.label ?? '').trim(), icon: toTickerIcon(r.icon) }))
    .filter((i) => i.label);
  const words = (settings?.second_row ?? []).map((w) => w.trim()).filter(Boolean);
  return {
    items: list.length ? list : defaultTicker.items,
    showSecondRow: settings?.show_second_row ?? defaultTicker.showSecondRow,
    secondRow: words.length ? words : defaultTicker.secondRow,
  };
}
