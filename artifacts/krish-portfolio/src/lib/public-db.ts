/*
 * Read-only access to the public Supabase tables for the visitor-facing site.
 *
 * This talks to PostgREST with plain fetch() so supabase-js (auth, realtime, storage, …) stays out of
 * the bundle every visitor downloads — it is only loaded by the admin panel (src/lib/supabase.ts).
 * Row Level Security is what protects the data, exactly as with the supabase-js client.
 */

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false = Supabase isn't configured → the site uses its static data. */
export const publicDbConfigured = Boolean(url && anonKey);

const headers = (extra: Record<string, string> = {}): HeadersInit => ({
  apikey: anonKey ?? '',
  Authorization: `Bearer ${anonKey ?? ''}`,
  ...extra,
});

async function fail(res: Response): Promise<never> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    /* keep the status text */
  }
  throw new Error(message);
}

/** GET /rest/v1/<table>?select=…&<filters>&order=… — returns the matching rows. */
export async function selectRows<T = Record<string, unknown>>(
  table: string,
  { select = '*', filters = {}, order }: { select?: string; filters?: Record<string, string>; order?: string } = {},
): Promise<T[]> {
  const params = new URLSearchParams({ select, ...filters });
  if (order) params.set('order', order);
  const res = await fetch(`${url}/rest/v1/${table}?${params}`, { headers: headers() });
  if (!res.ok) await fail(res);
  return (await res.json()) as T[];
}

/** POST a single row. Resolves when the database accepted it. */
export async function insertRow(table: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!res.ok) await fail(res);
}
