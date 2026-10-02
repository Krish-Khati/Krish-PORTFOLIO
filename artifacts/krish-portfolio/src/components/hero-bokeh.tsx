import { type CSSProperties, useMemo } from "react";

const DOTS = 24;

// Soft green specks drifting up over the hero. Pure CSS (transform/opacity only on the compositor), rendered
// once per mount, trimmed to ~8 on small screens via CSS, and disabled entirely under prefers-reduced-motion.
export function HeroBokeh() {
  const dots = useMemo(
    () =>
      Array.from({ length: DOTS }, (_, i) => {
        const size = 2 + Math.random() * 3.5;
        return {
          id: i,
          left: Math.random() * 100,
          bottom: Math.random() * 30,
          size,
          o: 0.25 + Math.random() * 0.45,
          dur: 9 + Math.random() * 9,
          delay: Math.random() * 16,
          drift: (Math.random() - 0.5) * 70,
        };
      }),
    [],
  );

  return (
    <div className="hero-bokeh" aria-hidden="true">
      {dots.map((d) => (
        <span
          key={d.id}
          className="hero-bokeh-dot"
          style={
            {
              left: `${d.left}%`,
              bottom: `${d.bottom}%`,
              width: `${d.size}px`,
              height: `${d.size}px`,
              "--bokeh-o": d.o,
              "--bokeh-drift": `${d.drift}px`,
              animationDuration: `${d.dur}s`,
              animationDelay: `${-d.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
