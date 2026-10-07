import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight, BookOpen, Bot, CalendarDays, Clock, Code2, Compass, FileText, GraduationCap,
  LayoutGrid, Megaphone, Search, Send, Sparkles, Tag, X, type LucideIcon,
} from 'lucide-react';
import { Link } from 'wouter';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { formatPostDate, readingMinutes, type BlogPost } from '@/data/blog';
import { usePublishedPosts, useSiteSettings } from '@/data/live';
import { GITHUB_PROFILE } from '@/data/social';
import { imageSrcSet, resizedImage } from '@/lib/image';
import { blogListMeta } from '@/seo/meta';
import { useSeo } from '@/seo/use-seo';

// Optional flag a post may carry (e.g. from Supabase); without it the newest posts are featured.
const isFeatured = (p: BlogPost) => !!(p as BlogPost & { featured?: boolean | null }).featured;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  All: LayoutGrid,
  Journey: Compass,
  Learning: GraduationCap,
  Projects: Code2,
  AI: Bot,
  Marketing: Megaphone,
};
const categoryIcon = (c: string) => CATEGORY_ICONS[c] ?? Tag;

const SLIDE_MS = 5000;

function PostCover({ post, className }: { post: BlogPost; className: string }) {
  const { cover } = post;
  const Icon = categoryIcon(post.category);
  return (
    <div className={className}>
      {cover ? (
        <img src={resizedImage(cover, 640)} srcSet={imageSrcSet(cover, [400, 640, 960])} sizes="(max-width: 720px) 92vw, 480px" alt={post.coverAlt || post.title} loading="lazy" decoding="async" />
      ) : (
        <div className="bx-cover-fallback" aria-hidden="true">
          <Icon size={46} strokeWidth={1.4} />
        </div>
      )}
    </div>
  );
}

function FeaturedCarousel({ posts }: { posts: BlogPost[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || posts.length < 2) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % posts.length), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, posts.length]);

  useEffect(() => {
    if (index >= posts.length) setIndex(0);
  }, [index, posts.length]);

  const post = posts[index] ?? posts[0];
  if (!post) return null;

  return (
    <div
      className="bx-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured posts"
    >
      <div className="bx-carousel-label">
        <Sparkles size={14} /> Featured posts
      </div>
      <span className="bx-carousel-glow" aria-hidden="true" />
      <div className="bx-carousel-stage" aria-live={paused ? 'polite' : 'off'}>
        <Link
          key={post.slug}
          href={`/blog/${post.slug}`}
          className="bx-slide"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${posts.length}: ${post.title}`}
          data-testid={`slide-featured-${post.slug}`}
        >
          <PostCover post={post} className="bx-slide-cover" />
          <div className="bx-slide-body">
            <span className="blog-tag">{post.category}</span>
            <h3 className="bx-slide-title">{post.title}</h3>
            <p className="bx-slide-excerpt">{post.excerpt}</p>
            <div className="bx-slide-foot">
              <span className="bx-meta">
                <CalendarDays size={13} /> {formatPostDate(post.date)}
                <span className="bx-meta-dot" />
                <Clock size={13} /> {readingMinutes(post)} min
              </span>
              <span className="bx-read">Read article <ArrowRight size={15} /></span>
            </div>
          </div>
          {!paused && posts.length > 1 && <span key={`p-${index}`} className="bx-slide-progress" aria-hidden="true" />}
        </Link>
      </div>
      {posts.length > 1 && (
        <div className="bx-dots">
          {posts.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              className={`bx-dot${i === index ? ' is-active' : ''}`}
              aria-label={`Show featured post ${i + 1}: ${p.title}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Adds .is-visible to .reveal elements inside the page as they scroll into view.
function useReveal(deps: unknown[]) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.15 },
    );
    root.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export default function BlogPage() {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const { data: allPosts, isLoading, isError } = usePublishedPosts();
  const settings = useSiteSettings();
  const all = allPosts ?? [];

  const categories = useMemo(() => ['All', ...Array.from(new Set(all.map((p) => p.category)))], [all]);
  const counts = useMemo(() => {
    const m: Record<string, number> = { All: all.length };
    all.forEach((p) => { m[p.category] = (m[p.category] ?? 0) + 1; });
    return m;
  }, [all]);
  const featured = useMemo(() => {
    const flagged = all.filter(isFeatured);
    return (flagged.length ? flagged : all).slice(0, 4);
  }, [all]);
  const latest = all[0];

  useSeo(allPosts ? blogListMeta(allPosts, settings) : null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const posts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => category === 'All' || p.category === category)
      .filter((p) => !q || `${p.title} ${p.excerpt} ${p.category}`.toLowerCase().includes(q));
  }, [all, category, query]);

  const pageRef = useReveal([isLoading]);

  const scrollToPosts = useCallback(() => {
    document.getElementById('blog-posts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const resetFilters = () => {
    setCategory('All');
    setQuery('');
  };

  const stats = [
    { icon: FileText, value: String(all.length), label: all.length === 1 ? 'Post' : 'Posts' },
    { icon: LayoutGrid, value: String(Math.max(categories.length - 1, 0)), label: 'Categories' },
    { icon: CalendarDays, value: latest ? formatPostDate(latest.date) : '—', label: 'Latest' },
  ];

  return (
    <main className="site-shell blog-shell" ref={pageRef}>
      <SiteNav onBlog />

      {/* Part 1 — Hero */}
      <header className="blog-hero">
        <span className="blog-orb blog-orb-1" aria-hidden="true" />
        <span className="blog-orb blog-orb-2" aria-hidden="true" />
        <div className="section-inner bx-hero-grid">
          <div className="bx-hero-copy">
            <div className="about-label blog-anim" style={{ animationDelay: '.05s' }}>The blog / notes from the journey</div>
            <h1 className="blog-title">
              <span className="blog-title-line blog-anim" style={{ animationDelay: '.15s' }}>Thoughts on</span>
              <span className="blog-title-line blog-anim" style={{ animationDelay: '.3s' }}><em>building &amp; learning.</em></span>
            </h1>
            <p className="blog-intro blog-anim" style={{ animationDelay: '.45s' }}>
              What I'm learning, what I'm building, and the mistakes that taught me the most.
            </p>

            <ul className="bx-stats" aria-label="Blog stats">
              {stats.map(({ icon: Icon, value, label }, i) => (
                <li key={label} className="bx-stat blog-anim" style={{ animationDelay: `${0.55 + i * 0.1}s` }}>
                  <span className="bx-stat-icon"><Icon size={18} /></span>
                  <span className="bx-stat-text">
                    <strong className={isLoading ? 'bx-skel-text' : undefined}>{isLoading ? '00' : value}</strong>
                    <small>{label}</small>
                  </span>
                </li>
              ))}
            </ul>

            <div className="hero-buttons bx-hero-buttons blog-anim" style={{ animationDelay: '.85s' }}>
              <button type="button" className="btn-primary bx-btn-glow" onClick={scrollToPosts} data-testid="button-explore-posts">
                <BookOpen size={17} /> Explore posts
              </button>
              <a className="btn-secondary bx-btn-outline" href="/#contact" data-testid="link-work-with-me">
                Work with me <ArrowRight size={16} />
              </a>
            </div>
          </div>

          <div className="bx-hero-side blog-anim" style={{ animationDelay: '.4s' }}>
            {isLoading ? (
              <div className="bx-carousel"><div className="bx-slide bx-slide-skeleton" /></div>
            ) : featured.length ? (
              <FeaturedCarousel posts={featured} />
            ) : null}
          </div>
        </div>
      </header>

      {/* Part 2 — Category browser */}
      <section className="bx-topics" aria-labelledby="bx-topics-title">
        <div className="section-inner">
          <div className="about-label reveal">Browse by topic</div>
          <h2 id="bx-topics-title" className="bx-section-title reveal reveal-delay-1">Explore the categories</h2>
          <p className="bx-section-sub reveal reveal-delay-2">Pick a topic to filter posts instantly</p>
          <div className="bx-pills reveal" role="group" aria-label="Filter by category">
            {categories.map((c, i) => {
              const Icon = categoryIcon(c);
              const active = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  className={`bx-pill${active ? ' is-active' : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  aria-pressed={active}
                  onClick={() => setCategory(c)}
                  data-testid={`button-category-${c.toLowerCase()}`}
                >
                  <Icon size={16} />
                  <span>{c}</span>
                  <span className="bx-pill-count">{counts[c] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Part 3 — Posts grid */}
      <section className="blog-list-section" id="blog-posts" aria-labelledby="bx-posts-title">
        <div className="section-inner">
          <div className="bx-list-head">
            <div>
              <div className="about-label reveal">{category === 'All' ? 'All writing' : `Topic / ${category}`}</div>
              <h2 id="bx-posts-title" className="bx-section-title bx-left reveal reveal-delay-1">
                {category === 'All' ? 'Latest articles' : `${category} articles`}
                <span className="bx-count">{posts.length}</span>
              </h2>
            </div>
            <label className="blog-search reveal reveal-delay-2">
              <Search size={16} aria-hidden="true" />
              <span className="visually-hidden">Search posts</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts"
                data-testid="input-blog-search"
              />
              {query && (
                <button type="button" className="bx-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
          </div>

          {isLoading ? (
            <div className="blog-grid" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="blog-card blog-card-skeleton" />)}
            </div>
          ) : isError ? (
            <p className="blog-empty">Couldn't load posts right now. Please try again in a moment.</p>
          ) : posts.length === 0 ? (
            <div className="bx-empty">
              <Search size={28} />
              <p>{all.length ? 'No posts match that search yet.' : 'No posts published yet.'}</p>
              {all.length > 0 && (
                <button type="button" className="bx-pill is-active" onClick={resetFilters}>Show all posts</button>
              )}
            </div>
          ) : (
            <div className="blog-grid" key={`${category}|${query}`} data-testid="list-blog">
              {posts.map((post, i) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="blog-card bx-card"
                  style={{ animationDelay: `${0.07 * i}s` }}
                  data-tilt
                  data-testid={`card-blog-${post.slug}`}
                >
                  <PostCover post={post} className="bx-card-cover" />
                  <div className="bx-card-body">
                    <div className="blog-card-meta">
                      <span className="blog-tag">{post.category}</span>
                      <span>{formatPostDate(post.date)}</span>
                      <span className="blog-read"><Clock size={12} />{readingMinutes(post)} min read</span>
                    </div>
                    <h3 className="blog-card-title">{post.title}</h3>
                    <p className="blog-card-excerpt">{post.excerpt}</p>
                    <span className="blog-card-cta">Read article <ArrowRight size={15} /></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Part 4 — Closing call to action */}
      <section className="bx-cta-section">
        <div className="section-inner">
          <div className="bx-cta reveal">
            <span className="bx-cta-orb" aria-hidden="true" />
            <div className="bx-cta-copy">
              <div className="about-label">Let's build something</div>
              <h2 className="bx-section-title bx-left">Got an idea worth <em>writing about?</em></h2>
              <p className="bx-section-sub bx-left">
                I'm always up for a project, a collaboration, or just a good conversation about code, AI and growth.
              </p>
            </div>
            <div className="bx-cta-actions">
              <a className="btn-primary bx-btn-glow" href="/#contact" data-testid="link-cta-contact">
                <Send size={16} /> Get in touch
              </a>
              <a className="btn-secondary bx-btn-outline" href={GITHUB_PROFILE} target="_blank" rel="noopener noreferrer">
                <Code2 size={16} /> See my code
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
