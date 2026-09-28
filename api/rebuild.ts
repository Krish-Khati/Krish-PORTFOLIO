/*
 * POST /api/rebuild — called by the admin panel after a post is published, updated, unpublished
 * or deleted. It triggers the Vercel Deploy Hook so the prerendered pages, sitemap.xml and
 * rss.xml are rebuilt with the change (the build also pings IndexNow for changed URLs).
 *
 * The Deploy Hook URL lives only in the server-side env var VERCEL_DEPLOY_HOOK — it's never sent
 * to the browser. Only a signed-in admin can call this: the request must carry the admin's
 * Supabase access token, which is checked against Supabase Auth before anything happens.
 */

type Env = Record<string, string | undefined>;
const env: Env = (globalThis as unknown as { process: { env: Env } }).process.env;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function isAdmin(token: string) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  const res = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}

export async function POST(request: Request): Promise<Response> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Not signed in.' });

  try {
    if (!(await isAdmin(token))) return json(401, { error: 'Your admin session has expired. Sign in again.' });
  } catch {
    return json(502, { error: 'Could not verify the admin session with Supabase.' });
  }

  const hook = env.VERCEL_DEPLOY_HOOK;
  if (!hook) {
    return json(501, { error: 'VERCEL_DEPLOY_HOOK is not set in Vercel, so the site was not rebuilt.' });
  }

  try {
    const res = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return json(502, { error: `The Vercel Deploy Hook returned HTTP ${res.status}.` });
  } catch {
    return json(502, { error: 'Could not reach the Vercel Deploy Hook.' });
  }
  return json(202, { ok: true, message: 'Site rebuild started — live in about 1–2 minutes.' });
}

export function GET(): Response {
  return json(405, { error: 'Use POST.' });
}
