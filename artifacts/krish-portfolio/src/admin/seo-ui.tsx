import { Check, X } from 'lucide-react';
import { formatPostDate } from '@/data/blog';
import { clip } from '@/seo/meta';
import type { SeoResult } from '@/seo/score';
import { SITE_URL } from '@/seo/site';

const levelLabel = { good: 'Good', ok: 'OK', poor: 'Needs work' } as const;

export function SeoBadge({ result, compact = false }: { result: SeoResult; compact?: boolean }) {
  return (
    <span
      className={`adm-seo-badge adm-seo-${result.level}`}
      title={`SEO score ${result.score}/100 — ${levelLabel[result.level]}`}
      aria-label={`SEO score ${result.score} out of 100, ${levelLabel[result.level]}`}
    >
      {result.score}{!compact && <small>{levelLabel[result.level]}</small>}
    </span>
  );
}

/** "42 / 60" — green inside the range, amber when too short, red when too long. */
export function CharCounter({ value, min = 0, max }: { value: string; min?: number; max: number }) {
  const n = value.trim().length;
  const state = n === 0 ? 'empty' : n > max ? 'over' : n < min ? 'under' : 'ok';
  return (
    <small className={`adm-counter adm-counter-${state}`} aria-live="polite">
      {n}{min ? ` / ${min}–${max}` : ` / ${max}`}
    </small>
  );
}

export function GooglePreview({ title, description, slug, date, section = 'blog' }: {
  title: string; description: string; slug: string; date?: string; section?: 'blog' | 'projects';
}) {
  const host = new URL(SITE_URL).host;
  return (
    <div className="adm-serp" aria-label="Google result preview">
      <div className="adm-serp-site">
        <span className="adm-serp-icon" aria-hidden="true">K</span>
        <span>
          <strong>Krish Khati</strong>
          <small>{host} › {section} › {slug || (section === 'blog' ? 'your-post' : 'your-project')}</small>
        </span>
      </div>
      <div className="adm-serp-title">{clip(title || (section === 'blog' ? 'Your post title' : 'Your project'), 60)}</div>
      <div className="adm-serp-desc">
        {date && <span>{formatPostDate(date)} — </span>}
        {description ? clip(description, 160) : 'Add a meta description so Google shows your own summary here.'}
      </div>
    </div>
  );
}

export function SeoChecklist({ result }: { result: SeoResult }) {
  const passed = result.checks.filter((c) => c.ok).length;
  return (
    <details className="adm-seo-checks">
      <summary>Checklist · {passed}/{result.checks.length} done</summary>
      <ul>
        {result.checks.map((c) => (
          <li key={c.id} className={c.ok ? 'is-ok' : ''}>
            {c.ok ? <Check size={14} /> : <X size={14} />}
            <span>{c.label}</span>
            <em>+{c.points}</em>
          </li>
        ))}
      </ul>
    </details>
  );
}
