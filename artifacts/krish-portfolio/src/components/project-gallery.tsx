import { type KeyboardEvent, type TouchEvent, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Play } from 'lucide-react';
import { type GalleryImage, imageAlt, type Project } from '@/data/projects';

type Slide =
  | ({ kind: 'image'; index: number } & GalleryImage)
  | { kind: 'video'; url: string; youtubeId?: string; file?: boolean };

/** The YouTube video id in a watch / youtu.be / shorts / embed link, if it is one. */
export function youtubeId(url: string) {
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  return m?.[1];
}

function slidesFor(p: Project): Slide[] {
  const slides: Slide[] = p.gallery.map((g, index) => ({ kind: 'image', index, ...g }));
  if (p.videoUrl) {
    slides.push({ kind: 'video', url: p.videoUrl, youtubeId: youtubeId(p.videoUrl), file: /\.(mp4|webm|ogg)(\?|#|$)/i.test(p.videoUrl) });
  }
  return slides;
}

/** Shown instead of a gallery until the project has screenshots, so the layout never breaks. */
function Placeholder({ name }: { name: string }) {
  return (
    <div className="pjg-placeholder" role="img" aria-label={`${name} — screenshots coming soon`}>
      <span className="pjg-placeholder-name">{name}</span>
      <span className="pjg-placeholder-note">Screenshots coming soon</span>
    </div>
  );
}

/**
 * Image gallery card: main image with prev/next arrows, "1 / 4" counter, dots and a clickable
 * thumbnail row. Swipe on touch screens, arrow keys when focused. Images keep their own aspect
 * ratio (object-fit: contain), so portrait phone screenshots and wide desktop ones both fit.
 * Only the current slide and its neighbours are loaded.
 */
export function ProjectGallery({ project, priority = false }: { project: Project; priority?: boolean }) {
  const slides = useMemo(() => slidesFor(project), [project]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seen, setSeen] = useState(() => new Set([0, 1, slides.length - 1]));
  const touch = useRef<{ x: number; y: number } | null>(null);
  const count = slides.length;

  if (!count) {
    return <div className="pjg"><div className="pjg-stage"><Placeholder name={project.name} /></div></div>;
  }

  const go = (to: number) => {
    const i = (to + count) % count;
    setCurrent(i);
    setPlaying(false);
    setSeen((prev) => {
      const next = new Set(prev);
      [i - 1, i, i + 1].forEach((n) => next.add((n + count) % count));
      return next;
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
  };
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || count < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(t.clientY - start.y)) go(current + (dx < 0 ? 1 : -1));
  };

  const active = slides[current];
  const caption = active.kind === 'image' ? active.caption.trim() : '';

  return (
    <div
      className="pjg"
      role="region"
      aria-roledescription="carousel"
      aria-label={`${project.name} screenshots`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="pjg-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {slides.map((s, i) => {
          const isActive = i === current;
          return (
            <div
              key={i}
              className={`pjg-slide${isActive ? ' is-active' : ''}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!isActive}
            >
              {s.kind === 'image' ? (
                seen.has(i) && (
                  <img
                    src={s.url}
                    alt={imageAlt(project, s, s.index)}
                    width={s.width}
                    height={s.height}
                    loading={i === 0 && priority ? 'eager' : 'lazy'}
                    decoding="async"
                    {...(i === 0 && priority ? { fetchPriority: 'high' as const } : {})}
                  />
                )
              ) : s.youtubeId ? (
                isActive && playing ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${s.youtubeId}?autoplay=1&rel=0`}
                    title={`${project.name} video`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <button type="button" className="pjg-video-cover" onClick={() => setPlaying(true)} tabIndex={isActive ? 0 : -1} aria-label={`Play the ${project.name} video`}>
                    {seen.has(i) && <img src={`https://i.ytimg.com/vi/${s.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" />}
                    <span className="pjg-play"><Play size={26} fill="currentColor" /></span>
                  </button>
                )
              ) : s.file ? (
                isActive && <video src={s.url} controls preload="metadata" playsInline aria-label={`${project.name} video`} />
              ) : (
                <a className="pjg-video-link" href={s.url} target="_blank" rel="noreferrer" tabIndex={isActive ? 0 : -1}>
                  <span className="pjg-play"><Play size={26} fill="currentColor" /></span>
                  Watch the {project.name} video <ExternalLink size={14} />
                </a>
              )}
            </div>
          );
        })}

        {count > 1 && (
          <>
            <button type="button" className="pjg-arrow pjg-prev" onClick={() => go(current - 1)} aria-label="Previous screenshot">
              <ChevronLeft size={20} />
            </button>
            <button type="button" className="pjg-arrow pjg-next" onClick={() => go(current + 1)} aria-label="Next screenshot">
              <ChevronRight size={20} />
            </button>
            <span className="pjg-counter" aria-live="polite">{current + 1} / {count}</span>
            <div className="pjg-dots" aria-hidden="true">
              {slides.map((_, i) => <span key={i} className={i === current ? 'is-active' : undefined} />)}
            </div>
          </>
        )}
      </div>

      {caption && <p className="pjg-caption">{caption}</p>}

      {count > 1 && (
        <div className="pjg-thumbs" role="tablist" aria-label="Choose a screenshot">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={s.kind === 'image' ? `Show screenshot ${i + 1}` : 'Show the video'}
              className={`pjg-thumb${i === current ? ' is-active' : ''}${s.kind === 'video' ? ' is-video' : ''}`}
              onClick={() => go(i)}
            >
              {s.kind === 'image' ? (
                <img src={s.thumb || s.url} alt="" loading="lazy" decoding="async" />
              ) : s.youtubeId ? (
                <img src={`https://i.ytimg.com/vi/${s.youtubeId}/default.jpg`} alt="" loading="lazy" decoding="async" />
              ) : null}
              {s.kind === 'video' && <Play size={16} fill="currentColor" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
