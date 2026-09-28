import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { blogPosts, type BlogBlock, type BlogPost, formatPostDate, postFromRow, readingMinutes, withCover } from '../src/data/blog';
import { projects as staticProjects, type Project } from '../src/data/projects';
import { defaultPublicSettings, type PublicSettings } from '../src/data/settings';
import { escapeHtml, inlineToHtml } from '../src/seo/inline';
import {
  blogListMeta, headHtml, homeMeta, type PageMeta, postMeta, postMetaDescription, projectsMeta,
} from '../src/seo/meta';
import { relatedPosts } from '../src/seo/related';
import { absoluteUrl, INDEXNOW_KEY, postPath, SITE_URL } from '../src/seo/site';

/*
 * Runs right after `vite build` (see package.json). The site is a single-page app, so without this
 * every URL would serve the same empty index.html. This script loads the published posts, projects
 * and settings from Supabase and writes real HTML for every public page, so search engines and
 * social previews see the title, meta tags, JSON-LD and article text without running JavaScript:
 *
 *   dist/public/index.html              home
 *   dist/public/blog/index.html         blog list
 *   dist/public/blog/<slug>/index.html  each published post
 *   dist/public/projects/index.html     projects
 *   dist/public/spa.html                plain app shell for every other URL (admin, new posts)
 *   dist/public/sitemap.xml, rss.xml, robots.txt
 *
 * The React app then loads on top and takes over as usual. A Vercel redeploy (triggered by the
 * Deploy Hook when a post is published) re-runs this, so new posts get their pages + sitemap entry.
 * On production deploys it also pings IndexNow with just the URLs that are new or changed.
 */

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'dist', 'public');
const env = loadEnv('production', root, '');

type SiteData = { posts: BlogPost[]; projects: Project[]; settings: PublicSettings };

async function loadData(): Promise<SiteData> {
  const fallback: SiteData = {
    posts: [...blogPosts].sort((a, b) => b.date.localeCompare(a.date)).map(withCover),
    projects: staticProjects,
    settings: defaultPublicSettings,
  };
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[prerender] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — using the static starter content.');
    return fallback;
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Posts are the whole point of this step: if they can't be loaded, fail the build so Vercel
  // keeps serving the previous (correct) deployment instead of publishing an empty blog.
  // '*' keeps this working whether or not optional columns (cover, SEO fields) exist yet.
  const postsRes = await sb.from('posts').select('*').eq('status', 'published').order('date', { ascending: false });
  if (postsRes.error) throw new Error(`[prerender] Could not load posts from Supabase: ${postsRes.error.message}`);
  const posts = (postsRes.data as Record<string, unknown>[]).map((r) => withCover(postFromRow(r)));

  let projects = fallback.projects;
  const projectsRes = await sb.from('projects').select('*').order('position');
  if (projectsRes.error) console.warn(`[prerender] Could not load projects (${projectsRes.error.message}) — using the static list.`);
  else {
    projects = (projectsRes.data as { name: string; description: string; url: string; image?: string | null }[]).map((p, i) => ({
      number: String(i + 1).padStart(2, '0'), name: p.name, description: p.description, url: p.url, image: p.image ?? '',
    }));
  }

  let settings = fallback.settings;
  const settingsRes = await sb.from('site_settings').select('data').eq('id', 1).maybeSingle();
  if (settingsRes.error) console.warn(`[prerender] Could not load site settings (${settingsRes.error.message}) — using defaults.`);
  else settings = { ...defaultPublicSettings, ...((settingsRes.data?.data as Partial<PublicSettings>) ?? {}) };

  return { posts, projects, settings };
}

/* ---------- HTML ---------- */

const e = escapeHtml;

const nav = `<nav class="seo-static-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/blog">Blog</a><a href="/projects">Projects</a><a href="/#contact">Contact</a></nav>`;

function blocksHtml(blocks: BlogBlock[]) {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'h2': return `<h2>${e(b.text)}</h2>`;
        case 'quote': return `<blockquote>${inlineToHtml(b.text)}</blockquote>`;
        case 'list': return `<ul>${b.items.map((i) => `<li>${inlineToHtml(i)}</li>`).join('')}</ul>`;
        case 'code': return `<pre><code>${e(b.text)}</code></pre>`;
        default: return `<p>${inlineToHtml(b.text)}</p>`;
      }
    })
    .join('\n');
}

function homeBody({ posts, projects, settings }: SiteData) {
  return `<main class="seo-static">${nav}
<h1>${e(settings.name)} — aspiring software developer</h1>
<p>${e(settings.tagline)}</p>
<h2>Small town. Big intent.</h2>
<p>Motivated Class 12 student. Strong foundations in Python, C, and C++, with hands-on practice building functional web and desktop applications.</p>
<h2>My story</h2>
<p>I'm a Class 12 student from Pundri, Kaithal - no formal tech background, no coding classes. Just curiosity and a laptop.</p>
<p>I started teaching myself Python, C, and C++, then moved into web development and exploring AI tools. Every project I've built has come from figuring things out on my own.</p>
<p>Right now, I'm looking for an entry-level role or internship where I can turn that problem-solving mindset into real software.</p>
<h2>Projects</h2>
<ul>${projects.map((p) => `<li>${p.url ? `<a href="${e(p.url)}">${e(p.name)}</a>` : e(p.name)} — ${e(p.description)}</li>`).join('')}</ul>
<p><a href="/projects">See all projects</a></p>
<h2>Latest from the blog</h2>
<ul>${posts.slice(0, 5).map((p) => `<li><a href="${postPath(p.slug)}">${e(p.title)}</a> — ${e(p.excerpt)}</li>`).join('')}</ul>
<h2>Contact</h2>
<p>${e(settings.location)} · <a href="mailto:${e(settings.email)}">${e(settings.email)}</a> · <a href="${e(settings.github)}">GitHub</a></p>
</main>`;
}

function blogBody({ posts }: SiteData) {
  return `<main class="seo-static">${nav}
<h1>Thoughts on building &amp; learning.</h1>
<p>What I'm learning, what I'm building, and the mistakes that taught me the most.</p>
${posts.map((p) => `<article>
<h2><a href="${postPath(p.slug)}">${e(p.title)}</a></h2>
<p><time datetime="${p.date}">${formatPostDate(p.date)}</time> · ${e(p.category)} · ${readingMinutes(p)} min read</p>
<p>${e(p.excerpt)}</p>
</article>`).join('\n')}
</main>`;
}

function postBody(post: BlogPost, data: SiteData) {
  const faqs = post.faqs ?? [];
  const related = relatedPosts(post, data.posts, 3);
  return `<main class="seo-static">${nav}
<nav aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/blog">Blog</a> › <span>${e(post.title)}</span></nav>
<article>
<p><span>${e(post.category)}</span> · <time datetime="${post.date}">${formatPostDate(post.date)}</time> · ${readingMinutes(post)} min read</p>
<h1>${e(post.title)}</h1>
<p>${e(post.excerpt)}</p>
${post.cover ? `<img src="${e(post.cover)}" alt="${e(post.coverAlt || post.title)}" width="1200" height="675" />` : ''}
${blocksHtml(post.blocks)}
${faqs.length ? `<section><h2>Frequently asked questions</h2>\n${faqs.map((f) => `<h3>${e(f.question)}</h3>\n<p>${inlineToHtml(f.answer)}</p>`).join('\n')}</section>` : ''}
</article>
${related.length ? `<section><h2>Related posts</h2><ul>${related.map((r) => `<li><a href="${postPath(r.slug)}">${e(r.title)}</a></li>`).join('')}</ul></section>` : ''}
</main>`;
}

function projectsBody({ projects }: SiteData) {
  return `<main class="seo-static">${nav}
<h1>Things built to learn.</h1>
<p>${projects.length} projects. Each one a sharper question, a new constraint, and another reason to keep going.</p>
${projects.map((p) => `<article>
<h2>${e(p.name)}</h2>
<p>${e(p.description)}</p>
${p.url ? `<p><a href="${e(p.url)}">View on GitHub</a></p>` : ''}
</article>`).join('\n')}
<p><a href="/blog">Read the blog</a> · <a href="/#contact">Get in touch</a></p>
</main>`;
}

/* ---------- Feeds ---------- */

type SitemapEntry = { loc: string; lastmod?: string };

const day = (iso?: string) => (iso ? iso.slice(0, 10) : undefined);
const postLastmod = (p: BlogPost) => day(p.updatedAt) || p.date;

function sitemapEntries({ posts }: SiteData): SitemapEntry[] {
  const latest = posts.map(postLastmod).sort().at(-1);
  return [
    { loc: absoluteUrl('/'), lastmod: latest },
    { loc: absoluteUrl('/blog'), lastmod: latest },
    { loc: absoluteUrl('/projects') },
    ...posts.map((p) => ({ loc: absoluteUrl(postPath(p.slug)), lastmod: postLastmod(p) })),
  ];
}

function sitemapXml(entries: SitemapEntry[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((u) => `  <url><loc>${e(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

const rfc822 = (isoDate: string) => new Date(`${isoDate.slice(0, 10)}T09:00:00+05:30`).toUTCString();
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

function rssXml({ posts }: SiteData) {
  const items = posts.map((p) => {
    const url = absoluteUrl(postPath(p.slug));
    return `    <item>
      <title>${e(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <category>${e(p.category)}</category>
      <description>${e(postMetaDescription(p))}</description>
      <content:encoded>${cdata(blocksHtml(p.blocks))}</content:encoded>
    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Krish — Blog</title>
    <link>${absoluteUrl('/blog')}</link>
    <description>Notes from a self-taught developer: learning to code, building projects, AI tools and digital marketing.</description>
    <language>en</language>
    <atom:link href="${absoluteUrl('/rss.xml')}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>
`;
}

const robotsTxt = () => `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${absoluteUrl('/sitemap.xml')}
`;

/* ---------- IndexNow ---------- */

// Compares the new sitemap with the one that's live right now and pings IndexNow (Bing, Yandex,
// Seznam, …) with only the URLs that are new or whose lastmod changed. Never fails the build.
async function pingIndexNow(entries: SitemapEntry[]) {
  try {
    const live = new Map<string, string>();
    const res = await fetch(absoluteUrl('/sitemap.xml'), { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    const body = res?.ok ? await res.text() : '';
    if (body.includes('<urlset')) {
      for (const m of body.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)) live.set(m[1], m[2] ?? '');
    }
    const changed = entries.filter((u) => !live.has(e(u.loc)) || (u.lastmod ?? '') !== live.get(e(u.loc))).map((u) => u.loc);
    if (!changed.length) {
      console.log('[prerender] IndexNow: nothing new or changed since the live sitemap — no ping needed.');
      return;
    }
    const ping = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key: INDEXNOW_KEY,
        keyLocation: absoluteUrl(`/${INDEXNOW_KEY}.txt`),
        urlList: changed,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    console.log(`[prerender] IndexNow: pinged ${changed.length} URL(s) → HTTP ${ping.status}. ${changed.join(', ')}`);
  } catch (err) {
    console.warn(`[prerender] IndexNow ping skipped: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/* ---------- Main ---------- */

function writeFile(rel: string, content: string) {
  const file = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

async function main() {
  const templatePath = path.join(outDir, 'index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const headRe = /<!--seo-head-->[\s\S]*?<!--\/seo-head-->/;
  if (!headRe.test(template) || !template.includes('<!--app-html-->')) {
    throw new Error('[prerender] index.html is missing the <!--seo-head--> / <!--app-html--> markers.');
  }

  const data = await loadData();
  const render = (meta: PageMeta, body: string) =>
    template.replace(headRe, () => headHtml(meta)).replace('<!--app-html-->', () => body);

  // The untouched shell, served (via vercel.json) for every URL that has no prerendered page.
  writeFile('spa.html', template);
  writeFile('index.html', render(homeMeta(data.settings), homeBody(data)));
  writeFile('blog/index.html', render(blogListMeta(data.posts, data.settings), blogBody(data)));
  writeFile('projects/index.html', render(projectsMeta(data.projects, data.settings), projectsBody(data)));
  for (const post of data.posts) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(post.slug)) {
      console.warn(`[prerender] Skipping post with an unusual slug: "${post.slug}"`);
      continue;
    }
    writeFile(`blog/${post.slug}/index.html`, render(postMeta(post, data.settings), postBody(post, data)));
  }

  const entries = sitemapEntries(data);
  writeFile('sitemap.xml', sitemapXml(entries));
  writeFile('rss.xml', rssXml(data));
  writeFile('robots.txt', robotsTxt());

  console.log(`[prerender] Wrote home, blog, projects, ${data.posts.length} post page(s), sitemap.xml (${entries.length} URLs), rss.xml, robots.txt.`);

  if (env.VERCEL_ENV === 'production') await pingIndexNow(entries);
  else console.log('[prerender] Not a production deploy — IndexNow ping skipped.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
