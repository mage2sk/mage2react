import { useCallback, useEffect, useRef, useState } from "react";

/**
 * BannerCarousel.tsx — React 19 island rendered with `client:visible`.
 *
 * Receives pre-sanitized slides from SSR and handles only the interactive
 * bits: autoplay, prev/next arrows, dot indicators, hover-pause, keyboard
 * nav, and swipe. No data fetching happens here — slides are injected as
 * a prop so first paint matches SSR.
 */

export interface CarouselSlide {
  id: number;
  title: string;
  subtitle: string;
  image: string | null;
  alt: string;
  cta_label: string | null;
  cta_url: string | null;
}

interface Props {
  slides: CarouselSlide[];
  autoplayMs?: number;
  heading?: string;
}

export default function BannerCarousel({
  slides,
  autoplayMs = 6000,
  heading,
}: Props): JSX.Element | null {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const count = slides.length;

  const go = useCallback(
    (n: number) => {
      if (count === 0) return;
      setActive(((n % count) + count) % count);
    },
    [count],
  );

  // Autoplay, paused on hover/focus and when the user prefers reduced motion.
  useEffect(() => {
    if (count < 2 || paused) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % count), autoplayMs);
    return () => window.clearInterval(t);
  }, [count, paused, autoplayMs]);

  // Swipe support (threshold 40px).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let startX = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0]?.clientX ?? 0;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = (e.changedTouches[0]?.clientX ?? 0) - startX;
      if (Math.abs(dx) < 40) return;
      go(active + (dx < 0 ? 1 : -1));
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [active, go]);

  if (count === 0) return null;

  const label = heading ?? "Promotional banners";

  return (
    <section
      ref={rootRef}
      aria-roledescription="carousel"
      aria-label={label}
      className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-zinc-100"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(active - 1);
        else if (e.key === "ArrowRight") go(active + 1);
      }}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${active * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            className="relative w-full flex-none"
            aria-roledescription="slide"
            aria-hidden={i === active ? undefined : true}
            aria-label={`Slide ${i + 1} of ${count}`}
          >
            {s.image ? (
              <img
                src={s.image}
                alt={s.alt}
                width={1200}
                height={500}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="block aspect-[12/5] w-full object-cover"
              />
            ) : (
              <div className="aspect-[12/5] w-full bg-zinc-200" aria-hidden="true" />
            )}
            {(s.title || s.subtitle || (s.cta_label && s.cta_url)) && (
              <div className="absolute inset-0 flex flex-col items-start justify-end gap-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6 sm:p-10">
                {s.title && (
                  <h3 className="max-w-xl text-2xl font-bold tracking-tight text-white drop-shadow-lg sm:text-4xl">
                    {s.title}
                  </h3>
                )}
                {s.subtitle && (
                  <p className="max-w-xl text-sm text-white drop-shadow-md sm:text-base">{s.subtitle}</p>
                )}
                {s.cta_label && s.cta_url && (
                  <a
                    href={s.cta_url}
                    className="inline-block rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-100"
                  >
                    {s.cta_label}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(active - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-900 shadow hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] sm:left-5 sm:size-11"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(active + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-900 shadow hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] sm:right-5 sm:size-11"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                className={
                  "h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white " +
                  (i === active ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80")
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
