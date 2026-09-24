import { Link } from 'wouter';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Krish / aspiring software developer</span>
      <Link href="/blog" className="footer-link">Blog</Link>
      <span>Pundri, Haryana / made with momentum</span>
    </footer>
  );
}
