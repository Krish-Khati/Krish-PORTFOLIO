/*
 * Shared helpers for the admin-only Vercel functions in this folder. The leading underscore keeps
 * Vercel from turning this file into a route of its own.
 */

type Env = Record<string, string | undefined>;
export const env: Env = (globalThis as unknown as { process: { env: Env } }).process.env;

export const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const supabaseUrl = () => (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');

async function isAdmin(token: string) {
  const url = supabaseUrl();
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}

/**
 * Checks that the request carries a signed-in admin's Supabase access token. Returns an error
 * Response to send back, or null when the caller is the admin.
 */
export async function requireAdmin(request: Request): Promise<Response | null> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Not signed in.' });
  try {
    if (!(await isAdmin(token))) return json(401, { error: 'Your admin session has expired. Sign in again.' });
  } catch {
    return json(502, { error: 'Could not verify the admin session with Supabase.' });
  }
  return null;
}
