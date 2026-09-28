import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'wouter';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { InlineText } from '@/components/rich-text';
import NotFound from '@/pages/not-found';
import { formatPostDate, readingMinutes } from '@/data/blog';
import { usePublishedPosts, useSiteSettings } from '@/data/live';
import { postMeta } from '@/seo/meta';
import { relatedPosts } from '@/seo/related';
import { useSeo } from '@/seo/use-seo';

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const { data: posts, isLoading } = usePublishedPosts();
  const settings = useSiteSettings();
  const post = posts?.find((p) => p.slug === params.slug);

  useSeo(post ? postMeta(post, settings) : null);

  useEffect(() => {
    if (post) window.scrollTo(0, 0);
  }, [post?.slug]);

  if (isLoading) {
    return (
      <main className="site-shell blog-shell">
        <SiteNav onBlog />
        <div className="post"><div className="post-inner"><div className="blog-card blog-card-skeleton" style={{ height: 320 }} /></div></div>
      </main>
    );
  }
  if (!post) return <NotFound />;

  const sorted = posts ?? [];
  const index = sorted.findIndex((p) => p.slug === post.slug);
  const newer = sorted[index - 1];
  const older = sorted[index + 1];
  const related = relatedPosts(post, sorted, 3);
  const faqs = post.faqs ?? [];

  return (
    <main className="site-shell blog-shell">
      <SiteNav onBlog />

      <article className="post">
        <span className="blog-orb blog-orb-1" aria-hidden="true" />
        <div className="post-inner">
          <Link href="/blog" className="blog-back blog-anim" style={{ animationDelay: '.05s' }}>
            <ArrowLeft size={15} /> All posts
          </Link>

          <div className="blog-card-meta blog-anim" style={{ animationDelay: '.15s' }}>
            <span className="blog-tag">{post.category}</span>
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            <span className="blog-read"><Clock size={12} />{readingMinutes(post)} min read</span>
          </div>
          <h1 className="post-title blog-anim" style={{ animationDelay: '.25s' }} data-testid="text-post-title">{post.title}</h1>
          <p className="post-lede blog-anim" style={{ animationDelay: '.35s' }}>{post.excerpt}</p>
          {post.cover && (
            <img
              className="post-cover blog-anim"
              style={{ animationDelay: '.4s' }}
              src={post.cover}
              alt={post.coverAlt || post.title}
              fetchPriority="high"
              decoding="async"
            />
          )}

          <div className="post-body">
            {post.blocks.map((block, i) => {
              const style = { animationDelay: `${0.45 + i * 0.07}s` };
              switch (block.type) {
                case 'h2':
                  return <h2 key={i} className="post-h2 blog-anim" style={style}>{block.text}</h2>;
                case 'quote':
                  return <blockquote key={i} className="post-quote blog-anim" style={style}><InlineText text={block.text} /></blockquote>;
                case 'list':
                  return (
                    <ul key={i} className="post-list blog-anim" style={style}>
                      {block.items.map((item, j) => <li key={j}><InlineText text={item} /></li>)}
                    </ul>
                  );
                case 'code':
                  return (
                    <pre key={i} className="post-code blog-anim" style={style} data-lang={block.lang}>
                      <code>{block.text}</code>
                    </pre>
                  );
                default:
                  return <p key={i} className="post-p blog-anim" style={style}><InlineText text={block.text} /></p>;
              }
            })}
          </div>

          {faqs.length > 0 && (
            <section className="post-faq" aria-labelledby="post-faq-title">
              <h2 id="post-faq-title" className="post-h2">Frequently asked questions</h2>
              {faqs.map((f, i) => (
                <div key={i} className="post-faq-item">
                  <h3 className="post-faq-q">{f.question}</h3>
                  <p className="post-p"><InlineText text={f.answer} /></p>
                </div>
              ))}
            </section>
          )}

          {related.length > 0 && (
            <section className="post-related" aria-labelledby="post-related-title">
              <h2 id="post-related-title" className="post-related-title">Related posts</h2>
              <div className="post-related-grid">
                {related.map((r) => (
                  <Link key={r.slug} href={`/blog/${r.slug}`} className="post-related-card" data-testid={`link-related-${r.slug}`}>
                    {r.cover ? (
                      <img src={r.cover} alt={r.coverAlt || r.title} loading="lazy" decoding="async" />
                    ) : (
                      <span className="post-related-fallback" aria-hidden="true" />
                    )}
                    <span className="blog-tag">{r.category}</span>
                    <span className="post-related-name">{r.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <nav className="post-pager" aria-label="More posts">
            {older ? (
              <Link href={`/blog/${older.slug}`} className="post-pager-link" data-tilt>
                <span className="post-pager-label"><ArrowLeft size={13} /> Older</span>
                <span className="post-pager-title">{older.title}</span>
              </Link>
            ) : <span />}
            {newer ? (
              <Link href={`/blog/${newer.slug}`} className="post-pager-link post-pager-next" data-tilt>
                <span className="post-pager-label">Newer <ArrowRight size={13} /></span>
                <span className="post-pager-title">{newer.title}</span>
              </Link>
            ) : <span />}
          </nav>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
