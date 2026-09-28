import type { BlogBlock } from '@/data/blog';
import { InlineText } from '@/components/rich-text';

/** Renders blog-style blocks (paragraphs, ## headings, quotes, lists, code) with the post styles. */
export function PostBlocks({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2': return <h2 key={i} className="post-h2">{b.text}</h2>;
          case 'quote': return <blockquote key={i} className="post-quote"><InlineText text={b.text} /></blockquote>;
          case 'list': return <ul key={i} className="post-list">{b.items.map((it, j) => <li key={j}><InlineText text={it} /></li>)}</ul>;
          case 'code': return <pre key={i} className="post-code" data-lang={b.lang}><code>{b.text}</code></pre>;
          default: return <p key={i} className="post-p"><InlineText text={b.text} /></p>;
        }
      })}
    </>
  );
}
