import { useEffect, useRef } from "react";

// Decorative dot + trailing ring that follows a fine pointer. Purely cosmetic, so it is loaded and
// wired only after the first interactive moment / browser idle (see SiteChrome in App.tsx).
export function CustomCursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    const root = rootRef.current!;
    const dot = dotRef.current!;
    const ring = ringRef.current!;

    const target = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let visible = false;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        visible = true;
        ringPos.x = target.x;
        ringPos.y = target.y;
        dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
        ring.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
        root.classList.add("is-visible");
        return;
      }
      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
    };

    const tick = () => {
      ringPos.x += (target.x - ringPos.x) * 0.15;
      ringPos.y += (target.y - ringPos.y) * 0.15;
      ring.style.transform = `translate3d(${Math.round(ringPos.x * 10) / 10}px, ${Math.round(ringPos.y * 10) / 10}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    const asHover = (el: Element | null) =>
      el?.closest("a, button, .cursor-hover");

    const asPromoBtn = (el: Element | null) =>
      (el as HTMLElement | null)?.classList.contains("btn-primary") ||
      (el as HTMLElement | null)?.classList.contains("btn-secondary") ||
      !!el?.closest(".btn-primary, .btn-secondary");

    const onOver = (e: MouseEvent) => {
      if (!asHover(e.target as Element | null)) return;
      root.classList.add("cursor-hovered");
      if (asPromoBtn(e.target as Element | null))
        root.classList.add("cursor-hovered-btn");
    };

    const onOut = (e: MouseEvent) => {
      if (!asHover(e.target as Element | null)) return;
      root.classList.remove("cursor-hovered");
      root.classList.remove("cursor-hovered-btn");
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="cursor" ref={rootRef} aria-hidden="true">
      <div className="cursor-dot" ref={dotRef}>
        <span className="cursor-dot-core" />
      </div>
      <div className="cursor-ring" ref={ringRef}>
        <span className="cursor-ring-core" />
      </div>
    </div>
  );
}
