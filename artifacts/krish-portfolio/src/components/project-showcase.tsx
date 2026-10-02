import { ArrowRight, ArrowUpRight, Github, Play } from "lucide-react";
import { Link } from "wouter";
import { ProjectGallery } from "@/components/project-gallery";
import { type Project, projectPath } from "@/data/projects";

/**
 * One project block: gallery card on one side, details on the other (the side alternates with
 * `flip` on desktop; on phones the gallery always sits on top). Used by the home page section,
 * /projects and /projects/<slug> (there with `level={1}` and no "read more" link).
 */
export function ProjectShowcase({
  project: p,
  flip = false,
  level = 3,
  showMore = true,
  reveal = false,
  priority = false,
}: {
  project: Project;
  flip?: boolean;
  level?: 1 | 2 | 3;
  showMore?: boolean;
  reveal?: boolean;
  priority?: boolean;
}) {
  const Title = `h${level}` as "h1" | "h2" | "h3";
  const Sub = `h${level + 1}` as "h2" | "h3" | "h4";
  const href = projectPath(p.slug);

  return (
    <article
      className={`pj${flip ? " pj-flip" : ""}${reveal ? " reveal" : ""}`}
      id={`project-${p.slug}`}
      data-testid={`card-project-${p.slug}`}
    >
      <div className="pj-gallery">
        <ProjectGallery project={p} priority={priority} />
      </div>

      <div className="pj-details">
        <div className="pj-title-row">
          <Title className="pj-name">
            {showMore ? <Link href={href}>{p.name}</Link> : p.name}
          </Title>
          {p.badge && <span className="pj-badge">{p.badge}</span>}
        </div>
        {p.description && <p className="pj-desc">{p.description}</p>}

        {p.features.length > 0 && (
          <>
            <Sub className="pj-sub">Key Features</Sub>
            <ul className="pj-features">
              {p.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </>
        )}

        {p.techStack.length > 0 && (
          <>
            <Sub className="pj-sub">Technology Stack</Sub>
            <ul className="pj-tech" aria-label="Technology stack">
              {p.techStack.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </>
        )}

        {(p.liveUrl || p.githubUrl || p.playStoreUrl || showMore) && (
          <div className="pj-actions">
            {p.liveUrl && (
              <a
                className="pj-btn pj-btn-primary"
                href={p.liveUrl}
                target="_blank"
                rel="noreferrer"
                data-testid={`link-live-${p.slug}`}
                aria-label={`${p.name} live demo`}
              >
                Live demo <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            )}
            {p.githubUrl && (
              <a
                className="pj-btn"
                href={p.githubUrl}
                target="_blank"
                rel="noreferrer"
                data-testid={`link-github-${p.slug}`}
                aria-label={`${p.name} source code on GitHub`}
              >
                <Github size={15} aria-hidden="true" /> GitHub
              </a>
            )}
            {p.playStoreUrl && (
              <a
                className="pj-btn"
                href={p.playStoreUrl}
                target="_blank"
                rel="noreferrer"
                data-testid={`link-play-${p.slug}`}
                aria-label={`${p.name} on the Play Store`}
              >
                <Play size={15} aria-hidden="true" /> Play Store
              </a>
            )}
            {showMore && (
              <Link className="pj-more" href={href}>
                Read more
                <span className="visually-hidden"> about {p.name}</span>{" "}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
