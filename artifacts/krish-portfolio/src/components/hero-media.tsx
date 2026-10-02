import { useEffect, useRef } from "react";
import { imageSrcSet, resizedImage } from "@/lib/image";

/**
 * The hero background: a single preloaded still (AVIF/WebP/JPEG poster — the LCP element, painted before
 * JS via index.html and the prerendered `seo-hero` markup). No video. The image is brought to life with
 * transform/opacity only so it stays on the compositor: a quick entrance, a slow Ken Burns zoom, a pulsing
 * green glow, a diagonal sweep and a left-edge vignette (all CSS), plus a mouse-parallax depth rig that
 * moves the image, the particle canvas and the text at different depths. `image` is an optional replacement
 * photo set in the admin.
 */
export function HeroMedia({ image }: { image?: string }) {
  const fxRef = useRef<HTMLDivElement>(null);

  // Fine-pointer desktops only: the image, particle canvas and text drift at different depths opposite the
  // cursor. Targets are lerped in a rAF loop and written as CSS vars on `.hero`, so the layers animate
  // transform alone. Skipped on touch and under prefers-reduced-motion.
  useEffect(() => {
    const fx = fxRef.current;
    if (!fx) return;
    const hero = fx.closest<HTMLElement>(".hero");
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;

    hero.classList.add("has-depth");
    let raf = 0;
    let cur = { x: 0, y: 0 };
    const tgt = { x: 0, y: 0 };
    let active = false;

    const loop = () => {
      cur.x += (tgt.x - cur.x) * 0.08;
      cur.y += (tgt.y - cur.y) * 0.08;
      // Move opposite the cursor; deeper layers shift further.
      hero.style.setProperty("--dep-img-x", `${(-cur.x * 15).toFixed(2)}px`);
      hero.style.setProperty("--dep-img-y", `${(-cur.y * 15).toFixed(2)}px`);
      hero.style.setProperty("--dep-par-x", `${(-cur.x * 25).toFixed(2)}px`);
      hero.style.setProperty("--dep-par-y", `${(-cur.y * 25).toFixed(2)}px`);
      hero.style.setProperty("--dep-txt-x", `${(-cur.x * 5).toFixed(2)}px`);
      hero.style.setProperty("--dep-txt-y", `${(-cur.y * 5).toFixed(2)}px`);
      if (
        !active &&
        Math.abs(tgt.x - cur.x) < 0.05 &&
        Math.abs(tgt.y - cur.y) < 0.05
      ) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: MouseEvent) => {
      // The hero is scrolled out of view (already relocating its layers); nothing to aim for.
      const r = hero.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      tgt.x = (e.clientX / window.innerWidth) * 2 - 1;
      tgt.y = (e.clientY / window.innerHeight) * 2 - 1;
      active = true;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onLeave = () => {
      active = false;
      tgt.x = tgt.y = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) onLeave();
    };
    // The tab went away; freeze the loop so the hero stops drifting (rAF halts on its own while hidden).
    const onVis = () => hero.classList.toggle("anim-hidden", document.hidden);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onOut);
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onOut);
      document.removeEventListener("visibilitychange", onVis);
      hero.classList.remove("has-depth", "anim-hidden");
    };
  }, []);

  const sizes = "100vw";
  return (
    <div className="hero-fx" ref={fxRef} aria-hidden="true">
      <div className="hero-fx-kenburns">
        {image ? (
          <img
            className="hero-video"
            src={resizedImage(image, 1200)}
            srcSet={imageSrcSet(image, [480, 768, 1200, 1600])}
            sizes={sizes}
            alt=""
            fetchPriority="high"
            decoding="async"
            loading="eager"
          />
        ) : (
          <picture>
            <source
              type="image/avif"
              srcSet="/media/krish-hero-poster-480.avif 480w, /media/krish-hero-poster-768.avif 768w, /media/krish-hero-poster-1200.avif 1200w, /media/krish-hero-poster-1600.avif 1600w"
              sizes={sizes}
            />
            <source
              type="image/webp"
              srcSet="/media/krish-hero-poster-480.webp 480w, /media/krish-hero-poster-768.webp 768w, /media/krish-hero-poster-1200.webp 1200w, /media/krish-hero-poster-1600.webp 1600w"
              sizes={sizes}
            />
            <img
              className="hero-video"
              src="/media/krish-hero-poster-768.jpg"
              srcSet="/media/krish-hero-poster-480.jpg 480w, /media/krish-hero-poster-768.jpg 768w, /media/krish-hero-poster-1200.jpg 1200w, /media/krish-hero-poster-1600.jpg 1600w"
              sizes={sizes}
              width={1600}
              height={900}
              alt=""
              fetchPriority="high"
              decoding="async"
              loading="eager"
            />
          </picture>
        )}
      </div>
      <div className="hero-glow" />
      <div className="hero-sweep" />
      <div className="hero-vignette" />
    </div>
  );
}
