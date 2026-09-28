/*
 * Inline links inside post text: [label](/blog/some-post), [label](/projects), [label](/#contact)
 * or [label](https://...). Everything else stays plain text. Shared by the React renderer
 * (components/rich-text.tsx), the build-time prerender and the SEO score.
 */

export type InlineSegment = { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

const LINK_RE = /\[([^\]\n]+)\]\(((?:\/|https?:\/\/)[^\s)]*)\)/g;

export function parseInline(text: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: 'text', text: text.slice(last, i) });
    out.push({ kind: 'link', text: m[1], href: m[2] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** The text with link syntax removed — for meta descriptions, word counts, RSS summaries. */
export const stripInline = (text: string) => text.replace(LINK_RE, '$1');

export const linksIn = (text: string) => parseInline(text).filter((s) => s.kind === 'link') as { kind: 'link'; text: string; href: string }[];

export const isInternalHref = (href: string) => href.startsWith('/');

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function inlineToHtml(text: string) {
  return parseInline(text)
    .map((s) => {
      if (s.kind === 'text') return escapeHtml(s.text);
      const external = !isInternalHref(s.href);
      return `<a href="${escapeHtml(s.href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(s.text)}</a>`;
    })
    .join('');
}
