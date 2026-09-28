import { useEffect } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { useProjects, useSiteSettings } from '@/data/live';
import { projectsMeta } from '@/seo/meta';
import { useSeo } from '@/seo/use-seo';

// Standalone, indexable version of the home page's "Things built to learn." section.
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
          <div className="project-list" data-testid="list-projects-page">
            {(projectList ?? []).map((project) => (
              <article className="project-row" key={project.number}>
                {project.image && <img className="project-thumb" src={project.image} alt={`${project.name} screenshot`} loading="lazy" decoding="async" />}
                <div className="project-number">{project.number}</div>
                <h2 className="project-name">{project.name}</h2>
                <div className="project-description">{project.description}</div>
                {project.url ? (
                  <a className="project-link" href={project.url} target="_blank" rel="noreferrer">
                    View on GitHub <ArrowUpRight size={14} />
                  </a>
                ) : (
                  <span className="project-link">Personal project</span>
                )}
              </article>
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
