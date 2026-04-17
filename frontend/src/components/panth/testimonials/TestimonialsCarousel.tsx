import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface CarouselTestimonial {
  id: number;
  name: string;
  title: string;
  rating: number;
  body: string;
  photo: string | null;
}

interface Props {
  items: CarouselTestimonial[];
  autoplayMs?: number;
  heading?: string;
}

function Stars({ rating }: { rating: number }): JSX.Element {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill={i < rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className={i < rating ? "text-amber-500" : "text-zinc-300"}
          aria-hidden="true"
        >
          <path d="M12 2.5l2.92 5.92 6.54.95-4.73 4.61 1.12 6.52L12 17.77l-5.85 3.07 1.12-6.52L2.54 9.37l6.54-.95L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}

export default function TestimonialsCarousel({
  items,
  autoplayMs = 5000,
  heading = "What customers are saying",
}: Props): JSX.Element | null {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [perView, setPerView] = useState(1);

  useEffect(() => {
    function measure(): void {
      const w = window.innerWidth;
      if (w >= 1024) setPerView(3);
      else if (w >= 640) setPerView(2);
      else setPerView(1);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const count = items.length;
  const pages = Math.max(1, count - perView + 1);

  useEffect(() => {
    if (active > pages - 1) setActive(pages - 1);
  }, [pages, active]);

  const go = useCallback(
    (n: number) => {
      if (pages <= 0) return;
      const wrapped = ((n % pages) + pages) % pages;
      setActive(wrapped);
    },
    [pages],
  );

  useEffect(() => {
    if (paused || pages < 2) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % pages), autoplayMs);
    return () => window.clearInterval(t);
  }, [pages, paused, autoplayMs]);

  const slideWidth = useMemo(() => 100 / perView, [perView]);

  if (count === 0) return null;

  return (
    <section
      className="mx-auto max-w-6xl py-8"
      aria-label={heading}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{heading}</h2>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="Previous testimonials"
              className="grid size-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="Next testimonials"
              className="grid size-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${active * slideWidth}%)` }}
        >
          {items.map((t) => (
            <article
              key={t.id}
              className="flex-none px-2"
              style={{ width: `${slideWidth}%` }}
            >
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  {t.photo ? (
                    <img
                      src={t.photo}
                      alt={`${t.name} profile photo`}
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-500" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21a8 8 0 0 0-16 0" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                    {t.title && <p className="text-xs text-zinc-500">{t.title}</p>}
                  </div>
                </div>
                <Stars rating={t.rating} />
                {t.body && (
                  <blockquote className="line-clamp-5 text-sm leading-6 text-zinc-700">
                    "{t.body}"
                  </blockquote>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to testimonials page ${i + 1}`}
              aria-current={i === active ? "true" : undefined}
              className={
                "h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] " +
                (i === active ? "w-6 bg-[var(--color-brand)]" : "w-2 bg-zinc-300 hover:bg-zinc-400")
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
