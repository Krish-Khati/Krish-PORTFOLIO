import { useEffect, useRef, useState } from 'react';
import { Github, Instagram, Linkedin, Menu, X, Youtube } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useSiteSettings } from '@/data/live';

const sections = [
  { id: 'top', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'skills', label: 'Skills' },
  { id: 'work', label: 'Projects' },
  { id: 'contact', label: 'Contact' },
];

export function SiteNav({ onBlog = false }: { onBlog?: boolean }) {
  const navRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState('top');
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const settings = useSiteSettings();

  // Hash links stay in-page on Home; from other pages they go back to Home first.
  const prefix = location === '/' ? '' : import.meta.env.BASE_URL;

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-spy: highlight the link of the section currently in view (Home only).
  useEffect(() => {
    if (location !== '/') return;
    const nodes = sections.map((s) => document.getElementById(s.id)).filter((n): n is HTMLElement => !!n);
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setActive(entry.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [location]);

  useEffect(() => setOpen(false), [location]);

  return (
    <nav className={`navbar${open ? ' menu-open' : ''}`} ref={navRef} aria-label="Main navigation">
      <ul className="nav-links">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`${prefix}#${s.id}`}
              className={!onBlog && active === s.id ? 'active' : undefined}
              onClick={() => setOpen(false)}
            >
              {s.label}
            </a>
          </li>
        ))}
        <li>
          <Link href="/blog" className={onBlog ? 'active' : undefined} data-testid="link-blog" onClick={() => setOpen(false)}>Blog</Link>
        </li>
      </ul>
      <div className="socials">
        <a href={settings.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={16} /></a>
        <a href={settings.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={16} /></a>
        <a href={settings.youtube} target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube size={16} /></a>
        <a href={settings.github} target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={16} /></a>
        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}
