import { Instagram, Linkedin } from "lucide-react";
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
        <span className="footer-socials">
          <a
            href="https://www.instagram.com/krrish_06_"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social"
            aria-label="Krish on Instagram"
          >
            <Instagram size={14} aria-hidden="true" />
          </a>
          <a
            href="https://www.linkedin.com/in/krish-dhiman-09aa14434/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social"
            aria-label="Krish on LinkedIn"
          >
            <Linkedin size={14} aria-hidden="true" />
          </a>
        </span>
      </span>
      <span>Pundri, Haryana / made with momentum</span>
    </footer>
  );
}
