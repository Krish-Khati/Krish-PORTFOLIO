import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTicker } from "@/data/live";
import type { TickerItem } from "@/data/ticker";

const SPEED = 32; // px per second

/*
 * One seamless marquee row. The track holds two identical groups and slides from 0 to -50%, which
 * is exactly one group — so the end of the loop lines up pixel-for-pixel with the start. Each
 * group repeats the item list until it's at least as wide as the row, so there's never an empty
 * gap on wide screens. Every item carries its own trailing separator, so the spacing at the join
 * is the same as everywhere else. Duration = group width ÷ speed, so the speed stays constant.
 */
function MarqueeRow({ items }: { items: TickerItem[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const [reps, setReps] = useState(1);
  const [duration, setDuration] = useState(60);
  const [delay, setDelay] = useState(0);

  useEffect(() => {
    const row = rowRef.current;
    const set = setRef.current;
    if (!row || !set) return;
    const measure = () => {
      const setWidth = set.getBoundingClientRect().width;
      if (!setWidth) return;
      const next = Math.max(1, Math.ceil(row.clientWidth / setWidth));
      const groupWidth = setWidth * next;
      // Start the loop part-way through so the first item sits just inside the faded edge
      // instead of beginning half-hidden under it.
      const fade =
        ((parseFloat(getComputedStyle(row).getPropertyValue("--ticker-fade")) ||
          0) /
          100) *
        row.clientWidth;
      setReps(next);
      setDuration(groupWidth / SPEED);
      setDelay(-(groupWidth - fade) / SPEED);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(set);
    // Widths change once the monospace web font finishes loading.
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [items]);

  const group = (g: number) => (
    <div className="ticker-group" key={g}>
      {Array.from({ length: reps }, (_, s) => (
        <div
          className="ticker-set"
          key={s}
          ref={g === 0 && s === 0 ? setRef : undefined}
        >
          {items.map((item, i) => (
            <span className="ticker-item" key={i}>
              {item.label}
              <svg
                className="ticker-sep"
                viewBox="0 0 10 10"
                aria-hidden="true"
              >
                <path d="M5 0 6.1 3.9 10 5 6.1 6.1 5 10 3.9 6.1 0 5 3.9 3.9Z" />
              </svg>
            </span>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="ticker-row" ref={rowRef} aria-hidden="true">
      <div
        className="ticker-track"
        style={
          {
            "--ticker-duration": `${duration.toFixed(2)}s`,
            animationDelay: `${delay.toFixed(2)}s`,
          } as CSSProperties
        }
      >
        {group(0)}
        {group(1)}
      </div>
    </div>
  );
}

export function HeroTicker() {
  const { data, isPlaceholderData } = useTicker();
  if (!data) return null;

  return (
    <div
      className={`ticker${isPlaceholderData ? " is-loading" : ""}`}
      role="region"
      aria-label="Krish focus areas"
    >
      <ul className="visually-hidden">
        {data.items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
      {/* Remount once the real items arrive, so the loop starts fresh as the band fades in. */}
      <MarqueeRow
        key={isPlaceholderData ? "loading" : "ready"}
        items={data.items}
      />
    </div>
  );
}
