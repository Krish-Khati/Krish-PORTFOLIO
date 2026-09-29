import { type CSSProperties, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Code2, Database, Film, Sparkles, type LucideIcon } from 'lucide-react';
import { useTicker } from '@/data/live';
import type { TickerIcon } from '@/data/ticker';

const icons: Record<Exclude<TickerIcon, ''>, LucideIcon> = {
  code: Code2,
  sparkle: Sparkles,
  film: Film,
  database: Database,
};

type RowItem = { label: string; icon?: TickerIcon };

/*
 * One seamless marquee row. The track holds two identical groups and slides from 0 to -50%, which
 * is exactly one group — so the end of the loop lines up pixel-for-pixel with the start. Each
 * group repeats the item list until it's at least as wide as the row, so there's never an empty
 * gap on wide screens. Every item carries its own trailing dot, so the spacing at the join is the
 * same as everywhere else. Duration = group width ÷ speed, so the speed stays constant.
 */
function MarqueeRow({ items, speed, reverse, className }: { items: RowItem[]; speed: number; reverse?: boolean; className: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const [reps, setReps] = useState(1);
  const [duration, setDuration] = useState(40);
  const [delay, setDelay] = useState(0);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const set = setRef.current;
    if (!row || !set) return;
    const measure = () => {
      const setWidth = set.getBoundingClientRect().width;
      if (!setWidth) return; // hidden (e.g. the second row on mobile)
      const next = Math.max(1, Math.ceil(row.clientWidth / setWidth));
      const groupWidth = setWidth * next;
      // Start the loop part-way through so the first item sits just inside the faded edge
      // instead of beginning half-hidden under it.
      const fade = ((parseFloat(getComputedStyle(row).getPropertyValue('--ticker-fade')) || 0) / 100) * row.clientWidth;
      setReps(next);
      setDuration(groupWidth / speed);
      setDelay(-(reverse ? fade : groupWidth - fade) / speed);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(set);
    // Widths change once the monospace web font finishes loading.
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [items, speed, reverse]);

  const group = (g: number) => (
    <div className="ticker-group" key={g}>
      {Array.from({ length: reps }, (_, s) => (
        <div className="ticker-set" key={s} ref={g === 0 && s === 0 ? setRef : undefined}>
          {items.map((item, i) => {
            const Icon = item.icon ? icons[item.icon] : undefined;
            return (
              <span className="ticker-item" key={i}>
                {Icon && <Icon className="ticker-icon" size={13} strokeWidth={1.75} />}
                <span>{item.label}</span>
                <span className="ticker-dot">•</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`ticker-row ${className}`} ref={rowRef} aria-hidden="true">
      <div
        className={`ticker-track${reverse ? ' is-reverse' : ''}`}
        style={{ '--ticker-duration': `${duration.toFixed(2)}s`, animationDelay: `${delay.toFixed(2)}s` } as CSSProperties}
      >
        {group(0)}
        {group(1)}
      </div>
    </div>
  );
}

export function HeroTicker() {
  const { data, isPlaceholderData } = useTicker();
  const secondRow = data?.secondRow;
  const words = useMemo(() => (secondRow ?? []).map((label) => ({ label })), [secondRow]);
  if (!data) return null;
  // Remount the rows once the real items arrive, so the loop starts fresh as the band fades in.
  const phase = isPlaceholderData ? 'loading' : 'ready';

  return (
    <div className={`ticker${isPlaceholderData ? ' is-loading' : ''}`} role="region" aria-label="Krish focus areas">
      <ul className="visually-hidden">
        {data.items.map((item) => <li key={item.id}>{item.label}</li>)}
      </ul>
      <MarqueeRow key={`main-${phase}`} items={data.items} speed={50} className="ticker-row-main" />
      {data.showSecondRow && words.length > 0 && (
        <MarqueeRow key={`sub-${phase}`} items={words} speed={40} reverse className="ticker-row-sub" />
      )}
    </div>
  );
}
