import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, Search } from 'lucide-react';
import { Link } from 'wouter';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { formatPostDate, readingMinutes } from '@/data/blog';
import { usePublishedPosts } from '@/data/live';

export default function BlogPage() {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const { data: allPosts, isLoading, isError } = usePublishedPosts();
  const categories = useMemo(() => ['All', ...Array.from(new Set((allPosts ?? []).map((p) => p.category)))], [allPosts]);

  useEffect(() => {
    document.title = 'Blog — Krish';
    window.scrollTo(0, 0);
    return () => {
      document.title = 'Krish — Aspiring Software Developer';
    };
  }, []);

  const posts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (allPosts ?? [])
      .filter((p) => category === 'All' || p.category === category)
      .filter((p) => !q || `${p.title} ${p.excerpt} ${p.category}`.toLowerCase().includes(q));
  }, [allPosts, category, query]);

  return (
    <main className="site-shell blog-shell">
      <SiteNav onBlog />

      <header className="blog-hero">
        <span className="blog-orb blog-orb-1" aria-hidden="true" />
        <span className="blog-orb blog-orb-2" aria-hidden="true" />
        <div className="section-inner">
          <div className="about-label blog-anim" style={{ animationDelay: '.05s' }}>The blog / notes from the journey</div>
          <h1 className="blog-title">
            <span className="blog-title-line blog-anim" style={{ animationDelay: '.15s' }}>Thoughts on</span>
            <span className="blog-title-line blog-anim" style={{ animationDelay: '.3s' }}><em>building &amp; learning.</em></span>
          </h1>
          <p className="blog-intro blog-anim" style={{ animationDelay: '.45s' }}>
            What I'm learning, what I'm building, and the mistakes that taught me the most.
          </p>

          <div className="blog-controls blog-anim" style={{ animationDelay: '.6s' }}>
            <label className="blog-search">
              <Search size={16} aria-hidden="true" />
              <span className="visually-hidden">Search posts</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts"
                data-testid="input-blog-search"
              />
            </label>
            <div className="blog-chips" role="group" aria-label="Filter by category">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`blog-chip${c === category ? ' is-active' : ''}`}
                  aria-pressed={c === category}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="blog-list-section">
        <div className="section-inner">
          {isLoading ? (
            <div className="blog-grid" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="blog-card blog-card-skeleton" />)}
            </div>
          ) : isError ? (
            <p className="blog-empty">Couldn't load posts right now. Please try again in a moment.</p>
          ) : posts.length === 0 ? (
            <p className="blog-empty">{allPosts?.length ? 'No posts match that search yet.' : 'No posts published yet.'}</p>
          ) : (
            <div className="blog-grid" data-testid="list-blog">
              {posts.map((post, i) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className={`blog-card${i === 0 && category === 'All' && !query ? ' blog-card-featured' : ''}`}
                  style={{ animationDelay: `${0.08 * i}s` }}
                  data-tilt
                  data-testid={`card-blog-${post.slug}`}
                >
                  <div className="blog-card-meta">
                    <span className="blog-tag">{post.category}</span>
                    <span>{formatPostDate(post.date)}</span>
                    <span className="blog-read"><Clock size={12} />{readingMinutes(post)} min read</span>
                  </div>
                  <h2 className="blog-card-title">{post.title}</h2>
                  <p className="blog-card-excerpt">{post.excerpt}</p>
                  <span className="blog-card-cta">Read post <ArrowRight size={15} /></span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
