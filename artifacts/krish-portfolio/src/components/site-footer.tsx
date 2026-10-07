import { Instagram, Linkedin } from "lucide-react";
import { Link } from "wouter";
import { INSTAGRAM_PROFILE, LINKEDIN_PROFILE } from "@/data/social";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Krish Khati / AI developer</span>
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
          aria-label="Krish Khati's blog RSS feed"
        >
          RSS
        </a>
        <span className="footer-socials">
          <a
            href={INSTAGRAM_PROFILE}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social"
            aria-label="Krish Khati on Instagram"
          >
            <Instagram size={14} aria-hidden="true" />
          </a>
          <a
            href={LINKEDIN_PROFILE}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social"
            aria-label="Krish Khati on LinkedIn"
          >
            <Linkedin size={14} aria-hidden="true" />
          </a>
        </span>
      </span>
      <span>Pundri, Haryana / made with momentum</span>
    </footer>
  );
}
