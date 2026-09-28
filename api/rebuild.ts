/*
 * POST /api/rebuild — called by the admin panel after a post or project is published, updated,
 * unpublished or deleted. It triggers the Vercel Deploy Hook so the prerendered pages, sitemap.xml
 * and rss.xml are rebuilt with the change (the build also pings IndexNow for changed URLs).
 *
 * The Deploy Hook URL lives only in the server-side env var VERCEL_DEPLOY_HOOK — it's never sent
 * to the browser. Only a signed-in admin can call this: the request must carry the admin's
 * Supabase access token, which is checked against Supabase Auth before anything happens.
 */

import { env, json, requireAdmin } from './_admin';

export async function POST(request: Request): Promise<Response> {
  const denied = await requireAdmin(request);
  if (denied) return denied;

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
