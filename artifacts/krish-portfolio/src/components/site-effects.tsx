import { useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

const MAGNETIC = '.btn-primary, .btn-secondary, .vision-cta, .contact-send, .back-to-top, .blog-back';
const TILT = '[data-tilt]';

type Spring = { kind: 'mag' | 'tilt'; x: number; y: number; tx: number; ty: number };

// Site-wide motion: scroll progress bar, hero parallax, magnetic buttons, 3D card tilt, back-to-top.
export function SiteEffects() {
  const barRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const bar = barRef.current!;
    const topBtn = topRef.current!;
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    let scrollRaf = 0;
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        const y = window.scrollY;
        const max = root.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
        topBtn.classList.toggle('visible', y > 600);
        if (!reduce) root.style.setProperty('--hero-py', `${Math.min(y, 900) * 0.25}px`);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    const springs = new Map<HTMLElement, Spring>();
    let raf = 0;

    const apply = (el: HTMLElement, s: Spring) => {
      if (s.kind === 'mag') {
        el.style.translate = `${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
      } else {
        el.style.transform = `perspective(900px) rotateX(${s.y.toFixed(2)}deg) rotateY(${s.x.toFixed(2)}deg) scale(1.01)`;
      }
    };
    const clear = (el: HTMLElement, s: Spring) => {
      if (s.kind === 'mag') {
        el.style.translate = '';
      } else {
        el.style.transform = '';
      }
    };

    const step = () => {
      let busy = false;
      springs.forEach((s, el) => {
        s.x += (s.tx - s.x) * 0.16;
        s.y += (s.ty - s.y) * 0.16;
        const settled = Math.abs(s.tx - s.x) < 0.01 && Math.abs(s.ty - s.y) < 0.01;
        if (settled && s.tx === 0 && s.ty === 0) {
          clear(el, s);
          springs.delete(el);
        } else {
          apply(el, s);
          busy = true;
        }
      });
      raf = busy ? requestAnimationFrame(step) : 0;
    };

    const aim = (el: HTMLElement, kind: Spring['kind'], tx: number, ty: number) => {
      const s = springs.get(el) ?? { kind, x: 0, y: 0, tx: 0, ty: 0 };
      s.tx = tx;
      s.ty = ty;
      springs.set(el, s);
      if (!raf) raf = requestAnimationFrame(step);
    };
    const release = (el: HTMLElement | null) => {
      const s = el && springs.get(el);
      if (el && s) aim(el, s.kind, 0, 0);
    };

    let lastMag: HTMLElement | null = null;
    let lastTilt: HTMLElement | null = null;

    const onMove = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const mag = t?.closest<HTMLElement>(MAGNETIC) ?? null;
      const tilt = t?.closest<HTMLElement>(TILT) ?? null;

      if (lastMag && lastMag !== mag) release(lastMag);
      if (lastTilt && lastTilt !== tilt) release(lastTilt);
      lastMag = mag;
      lastTilt = tilt;

      if (mag) {
        const r = mag.getBoundingClientRect();
        aim(mag, 'mag', (e.clientX - (r.left + r.width / 2)) * 0.25, (e.clientY - (r.top + r.height / 2)) * 0.35);
      }
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        aim(tilt, 'tilt', px * 8, -py * 8);
      }
    };
    const onLeaveWindow = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      release(lastMag);
      release(lastTilt);
      lastMag = lastTilt = null;
    };

    if (finePointer && !reduce) {
      document.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('mouseout', onLeaveWindow);
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onLeaveWindow);
      cancelAnimationFrame(scrollRaf);
      cancelAnimationFrame(raf);
      springs.forEach((s, el) => clear(el, s));
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" ref={barRef} aria-hidden="true" />
      <button
        type="button"
        className="back-to-top"
        ref={topRef}
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp size={18} />
      </button>
    </>
  );
}
