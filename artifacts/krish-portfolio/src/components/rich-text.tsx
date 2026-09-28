import { Link } from 'wouter';
import { isInternalHref, parseInline } from '@/seo/inline';

/** Renders post text with its [label](href) links. Internal pages use client-side navigation. */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((s, i) => {
        if (s.kind === 'text') return s.text;
        if (!isInternalHref(s.href)) {
          return <a key={i} href={s.href} target="_blank" rel="noopener noreferrer">{s.text}</a>;
        }
        // Hash links (e.g. /#contact) need a real navigation so the home page can scroll to the section.
        return s.href.includes('#')
          ? <a key={i} href={s.href}>{s.text}</a>
          : <Link key={i} href={s.href}>{s.text}</Link>;
      })}
    </>
  );
}
