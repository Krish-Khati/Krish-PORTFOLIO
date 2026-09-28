import { useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { PostBlocks } from '@/components/post-blocks';
import { ProjectShowcase } from '@/components/project-showcase';
import NotFound from '@/pages/not-found';
import { usePublishedPosts, useProjects, useSiteSettings } from '@/data/live';
import { projectPath } from '@/data/projects';
import { textToBlocks } from '@/lib/text-blocks';
import { projectMeta } from '@/seo/meta';
import { postsMentioningProject } from '@/seo/related';
import { useSeo } from '@/seo/use-seo';

// /projects/<slug>: the same gallery + details layout as the section, plus the long write-up,
// blog posts that mention the project, and links to the neighbouring projects.
export default function ProjectPage({ params }: { params: { slug: string } }) {
  const { data: projects, isLoading } = useProjects();
  const { data: posts } = usePublishedPosts();
  const settings = useSiteSettings();
  const index = projects?.findIndex((p) => p.slug === params.slug) ?? -1;
  const project = index >= 0 ? projects![index] : undefined;
  const blocks = useMemo(() => textToBlocks(project?.writeup ?? ''), [project?.writeup]);

  useSeo(project ? projectMeta(project, settings) : null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params.slug]);

  if (isLoading) {
    return (
      <main className="site-shell blog-shell">
        <SiteNav />
        <div className="post pj-page"><div className="pj-page-inner"><div className="blog-card blog-card-skeleton" style={{ height: 420 }} /></div></div>
      </main>
    );
  }
  if (!project) return <NotFound />;

  const related = postsMentioningProject(project, posts ?? [], 3);
  const prev = index > 0 ? projects![index - 1] : undefined;
  const next = index < projects!.length - 1 ? projects![index + 1] : undefined;

  return (
    <main className="site-shell blog-shell">
      <SiteNav />

      <div className="post pj-page">
        <span className="blog-orb blog-orb-1" aria-hidden="true" />
        <div className="pj-page-inner">
          <nav className="pj-crumbs blog-anim" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/projects">Projects</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{project.name}</span>
          </nav>

          <div className="blog-anim" style={{ animationDelay: '.1s' }}>
            <ProjectShowcase project={project} level={1} showMore={false} priority />
          </div>

          {blocks.length > 0 && (
            <section className="pj-writeup post-body blog-anim" style={{ animationDelay: '.2s' }} aria-labelledby="pj-writeup-title">
              <h2 id="pj-writeup-title" className="post-h2">About this project</h2>
              <PostBlocks blocks={blocks} />
            </section>
          )}

          {related.length > 0 && (
            <section className="post-related pj-related" aria-labelledby="pj-related-title">
              <h2 id="pj-related-title" className="post-related-title">From the blog</h2>
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

          <nav className="post-pager pj-pager" aria-label="More projects">
            {prev ? (
              <Link href={projectPath(prev.slug)} className="post-pager-link" data-tilt>
                <span className="post-pager-label"><ArrowLeft size={13} /> Previous project</span>
                <span className="post-pager-title">{prev.name}</span>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={projectPath(next.slug)} className="post-pager-link post-pager-next" data-tilt>
                <span className="post-pager-label">Next project <ArrowRight size={13} /></span>
                <span className="post-pager-title">{next.name}</span>
              </Link>
            ) : <span />}
          </nav>

          <div className="projects-page-cta">
            <Link href="/projects" className="btn-secondary"><ArrowLeft size={15} /> All projects</Link>
            <a href="/#contact" className="btn-primary">Get in touch <ArrowRight size={15} /></a>
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
