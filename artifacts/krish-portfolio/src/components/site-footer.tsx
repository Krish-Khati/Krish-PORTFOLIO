import { Github, Instagram, Linkedin, Mail, X, Youtube } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { GITHUB_PROFILE, INSTAGRAM_PROFILE, LINKEDIN_PROFILE } from "@/data/social";

const currentYear = new Date().getFullYear();

const navLinks = [
  { label: "Home", href: "/#top" },
  { label: "About", href: "/#about" },
  { label: "Skills", href: "/#skills" },
  { label: "Projects", href: "/#work" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/#contact" },
];

const socialLinks = [
  { icon: Github, href: GITHUB_PROFILE, label: "GitHub" },
  { icon: Linkedin, href: LINKEDIN_PROFILE, label: "LinkedIn" },
  { icon: X, href: "https://x.com/krish_khati", label: "X (Twitter)" },
  { icon: Instagram, href: INSTAGRAM_PROFILE, label: "Instagram" },
  { icon: Youtube, href: "https://www.youtube.com/@krishkhati", label: "YouTube" },
];

export function SiteFooter() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1, rootMargin: "50px" }
    );

    const footer = document.querySelector(".site-footer");
    if (footer) observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <footer className={`site-footer ${visible ? "is-visible" : ""}`} role="contentinfo">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="footer-logo">Krish Khati</div>
          <p className="footer-tagline">
            AI Developer & Digital Marketer building things that make an impact.
          </p>
        </div>

        <nav className="footer-nav" aria-label="Quick links">
          <h3 className="footer-heading">Quick Links</h3>
          <ul className="footer-links">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="footer-link">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="footer-social-nav" aria-label="Connect">
          <h3 className="footer-heading">Connect</h3>
          <ul className="footer-socials">
            {socialLinks.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social"
                  aria-label={`Krish Khati on ${social.label}`}
                >
                  <social.icon size={18} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-cta">
          <h3 className="footer-heading">Let&apos;s Build Together</h3>
          <p className="footer-cta-text">
            Have a project in mind or just want to say hello? I&apos;d love to hear from you.
          </p>
          <a
            href="/#contact"
            className="footer-cta-link"
            data-testid="link-footer-contact"
          >
            Get in touch <Mail size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          &copy; {currentYear} Krish Khati. All rights reserved.
        </p>
        <p className="footer-built">
          Built with React, TypeScript, Vite, Supabase & a lot of coffee.
        </p>
      </div>
    </footer>
  );
}