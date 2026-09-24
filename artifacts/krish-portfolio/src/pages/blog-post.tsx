import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'wouter';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import NotFound from '@/pages/not-found';
import { formatPostDate, readingMinutes } from '@/data/blog';
import { usePublishedPosts } from '@/data/live';

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const { data: posts, isLoading } = usePublishedPosts();
  const post = posts?.find((p) => p.slug === params.slug);

  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} — Krish`;
    window.scrollTo(0, 0);
    return () => {
      document.title = 'Krish — Aspiring Software Developer';
    };
  }, [post?.slug, post?.title]);

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
            <span>{formatPostDate(post.date)}</span>
            <span className="blog-read"><Clock size={12} />{readingMinutes(post)} min read</span>
          </div>
          <h1 className="post-title blog-anim" style={{ animationDelay: '.25s' }} data-testid="text-post-title">{post.title}</h1>
          <p className="post-lede blog-anim" style={{ animationDelay: '.35s' }}>{post.excerpt}</p>

          <div className="post-body">
            {post.blocks.map((block, i) => {
              const style = { animationDelay: `${0.45 + i * 0.07}s` };
              switch (block.type) {
                case 'h2':
                  return <h2 key={i} className="post-h2 blog-anim" style={style}>{block.text}</h2>;
                case 'quote':
                  return <blockquote key={i} className="post-quote blog-anim" style={style}>{block.text}</blockquote>;
                case 'list':
                  return (
                    <ul key={i} className="post-list blog-anim" style={style}>
                      {block.items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  );
                case 'code':
                  return (
                    <pre key={i} className="post-code blog-anim" style={style} data-lang={block.lang}>
                      <code>{block.text}</code>
                    </pre>
                  );
                default:
                  return <p key={i} className="post-p blog-anim" style={style}>{block.text}</p>;
              }
            })}
          </div>

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
