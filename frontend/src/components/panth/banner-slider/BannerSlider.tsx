import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBannerSlider,
  type BannerSlideT,
} from "~/lib/queries-banner-slider";
import { sanitizeHtml } from "~/lib/sanitize";

/**
 * <BannerSlider /> — React island for `Panth_BannerSlider`.
 *
 * INTEGRATION (leave as comments; never auto-wire):
 *   In your homepage Astro template:
 *
 *     import BannerSlider from
 *       "~/components/panth/banner-slider/BannerSlider";
 *     <BannerSlider client:idle identifier="home" />
 *
 * FEATURES:
 *   - Auto-advances every 6s. Paused on hover/focus and when the OS reports
 *     `prefers-reduced-motion: reduce`.
 *   - Arrow-button nav + dot indicators.
 *   - Keyboard: Left/Right arrow keys navigate when the carousel has focus.
 *   - Accessible: `role="region"` + `aria-roledescription="carousel"`, live
 *     region announces the current slide index politely on change.
 *   - Images: width + height + alt + loading.
 *   - All admin strings pass through `sanitizeHtml()` then text-only render.
 *
 * If the parent module is not installed or returns zero slides the island
 * renders nothing after mount, leaving the SSR fallback (if any) in place
 * or simply an empty region.
 */

interface Props {
  identifier?: string;
  autoplayMs?: number;
}

type SafeSlide = {
  title: string;
  subtitle: string;
  image: string | null;
  alt: string;
  cta_label: string;
  cta_url: string | null;
};

function cleanPlain(v: string | null | undefined): string {
  if (!v) return "";
  return sanitizeHtml(v).replace(/<[^>]*>/g, "").trim();
}

function isSafeHref(v: string | null | undefined): v is string {
  if (!v) return false;
  const s = v.trim();
  if (!s.length) return false;
  if (s.startsWith("/") || s.startsWith("#")) return true;
  return /^https?:\/\//i.test(s);
}

function toSafe(slide: BannerSlideT): SafeSlide {
  return {
    title: cleanPlain(slide.title),
    subtitle: cleanPlain(slide.subtitle),
    image:
      typeof slide.image === "string" && slide.image.trim().length
        ? slide.image
        : null,
    alt: cleanPlain(slide.alt) || cleanPlain(slide.title),
    cta_label: cleanPlain(slide.cta_label),
    cta_url: isSafeHref(slide.cta_url) ? slide.cta_url!.trim() : null,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function BannerSlider(props: Props): JSX.Element | null {
  const identifier = props.identifier ?? "home";
  const autoplayMs = props.autoplayMs ?? 6000;

  const [slides, setSlides] = useState<SafeSlide[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  const regionRef = useRef<HTMLDivElement | null>(null);

  // Fetch slides on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { items } = await getBannerSlider(identifier);
      if (cancelled) return;
      setSlides(items.map(toSafe).filter((s) => s.image || s.title));
    })();
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  // Track reduced-motion preference.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (): void => setReduced(mq.matches);
    setReduced(mq.matches);
    try {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    } catch {
      // Safari <14 fallback.
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, []);

  const count = slides?.length ?? 0;

  const goTo = useCallback(
    (i: number) => {
      if (count === 0) return;
      // Wrap.
      const next = ((i % count) + count) % count;
      setIndex(next);
    },
    [count],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Autoplay.
  useEffect(() => {
    if (!count) return;
    if (paused) return;
    if (reduced) return;
    if (prefersReducedMotion()) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, Math.max(2000, autoplayMs));
    return () => window.clearInterval(t);
  }, [count, paused, reduced, autoplayMs]);

  // Keyboard: Left/Right when region has focus.
  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    region.addEventListener("keydown", onKey);
    return () => region.removeEventListener("keydown", onKey);
  }, [next, prev]);

  if (slides === null) return null; // still loading
  if (count === 0) return null;

  const current = slides[index];
  if (!current) return null;

  return (
    <div
      ref={regionRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Promotional banners"
      className="relative mx-auto max-w-6xl outline-none"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((s, i) => (
            <div
              key={i}
              className="relative w-full flex-none"
              aria-roledescription="slide"
              aria-label={`Slide ${i + 1} of ${count}`}
              aria-hidden={i !== index}
            >
              {s.image ? (
                <img
                  src={s.image}
                  alt={s.alt || `Banner ${i + 1}`}
                  width={1200}
                  height={500}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="block aspect-[12/5] w-full object-cover"
                />
              ) : (
                <div
                  className="flex aspect-[12/5] w-full items-center justify-center bg-zinc-100"
                  aria-hidden="true"
                />
              )}
              {(s.title || s.subtitle || (s.cta_label && s.cta_url)) && (
                <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 bg-gradient-to-t from-black/50 via-black/10 to-transparent p-6 text-white sm:p-10">
                  {s.title && (
                    <h3 className="max-w-xl text-xl font-bold tracking-tight sm:text-3xl">
                      {s.title}
                    </h3>
                  )}
                  {s.subtitle && (
                    <p className="max-w-xl text-sm sm:text-base">
                      {s.subtitle}
                    </p>
                  )}
                  {s.cta_label && s.cta_url && (
                    <a
                      href={s.cta_url}
                      className="mt-2 inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      tabIndex={i === index ? 0 : -1}
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
              aria-label="Previous slide"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-zinc-900 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width={20}
                height={20}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-zinc-900 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width={20}
                height={20}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <ul
          className="mt-3 flex items-center justify-center gap-2"
          aria-label="Slide indicators"
        >
          {slides.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => goTo(i)}
                className={
                  (i === index
                    ? "bg-[var(--color-brand)]"
                    : "bg-zinc-300 hover:bg-zinc-400") +
                  " block size-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                }
              />
            </li>
          ))}
        </ul>
      )}

      {/* Live region for screen readers — polite, off-screen. */}
      <p className="sr-only" aria-live="polite">
        {`Slide ${index + 1} of ${count}${current.title ? `: ${current.title}` : ""}`}
      </p>
    </div>
  );
}
