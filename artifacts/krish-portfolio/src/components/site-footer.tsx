import { Link } from "wouter";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Krish / AI developer</span>
      <span className="footer-links">
        <Link href="/blog" className="footer-link">
          Blog
        </Link>
        <Link
          href="/projects"
          className="footer-link"
          aria-label="All projects"
        >
          Projects
        </Link>
        <a
          href="/rss.xml"
          className="footer-link"
          aria-label="Krish's blog RSS feed"
        >
          RSS
        </a>
      </span>
      <span>Pundri, Haryana / made with momentum</span>
    </footer>
  );
}
