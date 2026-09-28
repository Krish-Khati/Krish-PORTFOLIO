import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { ProjectShowcase } from '@/components/project-showcase';
import { useProjects, useSiteSettings } from '@/data/live';
import { projectsMeta } from '@/seo/meta';
import { useSeo } from '@/seo/use-seo';

// Standalone, indexable version of the home page's "Things built to learn." section — every project.
export default function ProjectsPage() {
  const { data: projectList } = useProjects();
  const settings = useSiteSettings();

  useSeo(projectList ? projectsMeta(projectList, settings) : null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="site-shell">
      <SiteNav />

      <section className="section projects-section projects-page">
        <div className="section-inner">
          <div className="projects-heading">
            <div>
              <div className="section-label">Projects / selected practice</div>
              <h1 className="section-title">Things built<br /><span className="highlight">to learn.</span></h1>
            </div>
            <p>{projectList?.length || 'A few'} projects. Each one a sharper question, a new constraint, and another reason to keep going.</p>
          </div>
          <div className="pj-list" data-testid="list-projects-page">
            {(projectList ?? []).map((project, i) => (
              <ProjectShowcase key={project.slug} project={project} flip={i % 2 === 1} level={2} priority={i === 0} />
            ))}
          </div>
          <div className="projects-page-cta">
            <Link href="/blog" className="btn-secondary">Read what I learned building them <ArrowRight size={15} /></Link>
            <a href="/#contact" className="btn-primary">Get in touch <ArrowRight size={15} /></a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
