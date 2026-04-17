import { useCallback, useEffect, useMemo, useState } from "react";

export interface CarouselProduct {
  uid: string;
  name: string;
  href: string;
  image: string | null;
  imageAlt: string;
  finalPrice: string;
  regularPrice: string | null;
  onSale: boolean;
}

interface Props {
  products: CarouselProduct[];
  heading?: string;
  subheading?: string;
  autoplay?: boolean;
  autoplayMs?: number;
  columnsDesktop?: number;
}

export default function ProductCarousel({
  products,
  heading,
  subheading,
  autoplay = false,
  autoplayMs = 4000,
  columnsDesktop = 4,
}: Props): JSX.Element | null {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [perView, setPerView] = useState(1);

  useEffect(() => {
    function measure(): void {
      const w = window.innerWidth;
      if (w >= 1024) setPerView(Math.min(columnsDesktop, 6));
      else if (w >= 768) setPerView(Math.min(3, columnsDesktop));
      else if (w >= 520) setPerView(2);
      else setPerView(1);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [columnsDesktop]);

  const count = products.length;
  const pages = Math.max(1, count - perView + 1);

  useEffect(() => {
    if (active > pages - 1) setActive(pages - 1);
  }, [pages, active]);

  const go = useCallback(
    (n: number) => {
      const w = ((n % pages) + pages) % pages;
      setActive(w);
    },
    [pages],
  );

  useEffect(() => {
    if (!autoplay || paused || pages < 2) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % pages), autoplayMs);
    return () => window.clearInterval(t);
  }, [autoplay, pages, paused, autoplayMs]);

  const slideWidth = useMemo(() => 100 / perView, [perView]);

  if (count === 0) return null;

  return (
    <section
      className="mx-auto max-w-6xl py-8"
      aria-label={heading || "Products"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {heading && <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{heading}</h2>}
          {subheading && <p className="mt-1 text-sm text-zinc-600">{subheading}</p>}
        </div>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="Previous products"
              className="grid size-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="Next products"
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
          {products.map((p) => (
            <article
              key={p.uid}
              className="flex-none px-2"
              style={{ width: `${slideWidth}%` }}
            >
              <a
                href={p.href}
                className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="relative aspect-square overflow-hidden bg-zinc-100">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.imageAlt}
                      width={400}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-zinc-400">No image</span>
                  )}
                  {p.onSale && (
                    <span className="absolute left-2 top-2 rounded-full bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                      SALE
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-medium text-zinc-900">{p.name}</h3>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-zinc-900">{p.finalPrice}</span>
                    {p.onSale && p.regularPrice && (
                      <span className="text-xs text-zinc-500 line-through">{p.regularPrice}</span>
                    )}
                  </div>
                </div>
              </a>
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
              aria-label={`Go to page ${i + 1}`}
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
