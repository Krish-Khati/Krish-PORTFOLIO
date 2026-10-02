import { useEffect, useRef, useState } from "react";
import { imageSrcSet, resizedImage } from "@/lib/image";

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/** Whether the background video should be loaded at all: not on data saver, slow links or reduced motion. */
function videoAllowed() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformation })
    .connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /^(slow-2g|2g|3g)$/.test(conn.effectiveType))
    return false;
  return true;
}

/**
 * The hero background. A tiny poster (AVIF/WebP/JPEG, preloaded in index.html) is what paints first and is
 * the LCP element. The video is only added once the page has loaded and the browser is idle, then fades in
 * over the poster; it is skipped entirely on slow connections / data saver / reduced motion, and pauses
 * while the hero is scrolled out of view. `image` is an optional replacement photo set in the admin.
 */
export function HeroMedia({ image }: { image?: string }) {
  const [mountVideo, setMountVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (image || !videoAllowed()) return;
    let cancelled = false;
    let timer = 0;
    const start = () => {
      if (cancelled) return;
      // Don't spend data on a tab nobody is looking at.
      if (document.hidden)
        document.addEventListener("visibilitychange", start, { once: true });
      else setMountVideo(true);
    };
    const schedule = () => {
      timer = window.setTimeout(
        () =>
          "requestIdleCallback" in window
            ? window.requestIdleCallback(start, { timeout: 3000 })
            : start(),
        1200,
      );
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("load", schedule);
      document.removeEventListener("visibilitychange", start);
    };
  }, [image]);

  // Pause off-screen: the video is a decorative background, so it only needs to run while visible.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void el.play().catch(() => undefined);
      else el.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [mountVideo]);

  if (image) {
    return (
      <img
        className="hero-video"
        src={resizedImage(image, 1280)}
        srcSet={imageSrcSet(image, [768, 1280, 1920])}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
      />
    );
  }

  const small = window.matchMedia("(max-width: 768px)").matches;
  const sizes = "100vw";
  return (
    <>
      <picture>
        <source
          type="image/avif"
          srcSet="/media/krish-hero-poster-1280.avif 1280w, /media/krish-hero-poster-1920.avif 1920w"
          sizes={sizes}
        />
        <source
          type="image/webp"
          srcSet="/media/krish-hero-poster-1280.webp 1280w, /media/krish-hero-poster-1920.webp 1920w"
          sizes={sizes}
        />
        <img
          className="hero-video"
          src="/media/krish-hero-poster-1280.jpg"
          srcSet="/media/krish-hero-poster-1280.jpg 1280w, /media/krish-hero-poster-1920.jpg 1920w"
          sizes={sizes}
          width={1280}
          height={720}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      {mountVideo && (
        <video
          ref={videoRef}
          className={`hero-video hero-video-clip${playing ? " is-playing" : ""}`}
          poster={
            small
              ? "/media/krish-hero-poster-1280.webp"
              : "/media/krish-hero-poster-1920.webp"
          }
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          onPlaying={() => setPlaying(true)}
        >
          <source
            src={small ? "/media/krish-hero-sm.webm" : "/media/krish-hero.webm"}
            type="video/webm"
          />
          <source
            src={small ? "/media/krish-hero-sm.mp4" : "/media/krish-hero.mp4"}
            type="video/mp4"
          />
        </video>
      )}
    </>
  );
}
