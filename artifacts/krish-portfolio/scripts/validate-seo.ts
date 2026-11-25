import fs from 'node:fs';
import path from 'node:path';

/*
 * Build guard for prerendered SEO. Runs right after scripts/prerender.ts (see package.json
 * "build") and hard-fails the build (exit 1) when a page would ship incomplete:
 *   - missing or over-limit <title> (60 chars) / meta description (160 chars)
 *   - missing canonical link, or a robots meta that is not indexable
 *   - missing or unparseable JSON-LD, or a JSON-LD field that is present but empty
 * Only `index.html` files are checked — spa.html (the plain app shell) and public/*.html
 * (Google site verification) are not prerendered pages. Draft posts/projects are excluded
 * by the prerender itself, which is why every page it writes must be indexable.
 */

const root = path.resolve(import.meta.dirname, '..', 'dist', 'public');
const TITLE_MAX = 60;
const DESC_MAX = 160;

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const tagsOf = (html: string, name: 'meta' | 'link') =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => m[0]);

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const findTag = (list: string[], key: string, value: string) => list.find((t) => attr(t, key) === value);

/** Every string/array leaf that is present but empty, as dotted paths ("a.b[0].c"). */
function emptyPaths(node: unknown, at = ''): string[] {
  if (typeof node === 'string') return node.trim() ? [] : [at || '(root)'];
  if (Array.isArray(node)) {
    if (!node.length) return [at || '(root)'];
    return node.flatMap((v, i) => emptyPaths(v, `${at}[${i}]`));
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => emptyPaths(v, at ? `${at}.${k}` : k));
  }
  return []; // numbers, booleans, null — never "empty"
}

function main() {
  if (!fs.existsSync(root)) {
    console.error(`[validate-seo] ${root} does not exist — run the prerender first.`);
    process.exit(1);
  }

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (d.name === 'index.html') files.push(p);
    }
  };
  walk(root);
  files.sort();

  const errors: string[] = [];
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const html = fs.readFileSync(file, 'utf8');
    const fail = (msg: string) => errors.push(`${rel}: ${msg}`);

    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    if (!title.trim()) fail('missing <title>');
    else if (decodeEntities(title).length > TITLE_MAX) {
      fail(`<title> is ${decodeEntities(title).length} chars (max ${TITLE_MAX}): "${decodeEntities(title)}"`);
    }

    const metas = tagsOf(html, 'meta');
    const desc = attr(findTag(metas, 'name', 'description') ?? '', 'content') ?? '';
    if (!desc.trim()) fail('missing meta description');
    else if (decodeEntities(desc).length > DESC_MAX) {
      fail(`meta description is ${decodeEntities(desc).length} chars (max ${DESC_MAX}): "${decodeEntities(desc)}"`);
    }

    const robots = attr(findTag(metas, 'name', 'robots') ?? '', 'content') ?? '';
    if (!/\bindex\b/.test(robots)) {
      fail(`meta robots is "${robots || '(missing)'}" — every prerendered page must be indexable`);
    }

    const canonical = attr(findTag(tagsOf(html, 'link'), 'rel', 'canonical') ?? '', 'href') ?? '';
    if (!canonical) fail('missing canonical link');
    else if (!/^https:\/\//.test(canonical)) fail(`canonical is not an absolute https URL: ${canonical}`);

    const ld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    if (!ld.length) fail('no JSON-LD block');
    ld.forEach((raw, i) => {
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        fail(`JSON-LD #${i + 1} is not valid JSON: ${err instanceof Error ? err.message : err}`);
        return;
      }
      for (const at of emptyPaths(data)) fail(`JSON-LD #${i + 1} has an empty field: ${at}`);
    });
  }

  if (errors.length) {
    console.error(`[validate-seo] ${errors.length} problem(s) across ${files.length} page(s):`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(
    `[validate-seo] ${files.length} page(s) OK — title ≤ ${TITLE_MAX}, description ≤ ${DESC_MAX}, ` +
      'canonical, indexable robots, valid JSON-LD with no empty fields.',
  );
}

main();
