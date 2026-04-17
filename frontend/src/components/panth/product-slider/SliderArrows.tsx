/**
 * SliderArrows.tsx — tiny client:idle island for `ProductSlider.astro`.
 *
 * Finds the sibling `[data-slider-track]` by id (looked up once via the host
 * element's `ownerDocument` — no direct `document.querySelector` in render)
 * and scrolls it left/right by roughly one card width. Keyboard-accessible
 * arrow buttons with `aria-label`, and the `disabled` state reflects whether
 * the track is already pinned to the start / end.
 *
 * We intentionally keep this tiny so the zero-JS CSS scroll-snap experience
 * stays the default and the arrows only enhance it.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  trackId: string;
  labelPrev?: string;
  labelNext?: string;
}

export default function SliderArrows({
  trackId,
  labelPrev = "Scroll left",
  labelNext = "Scroll right",
}: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback((): void => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= max - 2);
  }, []);

  const scrollByStep = useCallback((dir: -1 | 1): void => {
    const el = trackRef.current;
    if (!el) return;
    // ~1 card width; measure the first child for precision.
    const firstCard = el.firstElementChild as HTMLElement | null;
    const step = firstCard
      ? firstCard.getBoundingClientRect().width + 16
      : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  useEffect(() => {
    setMounted(true);
    const host = hostRef.current;
    if (!host) return;
    const doc = host.ownerDocument;
    const el = doc.getElementById(trackId);
    if (el instanceof HTMLElement) {
      trackRef.current = el;
      updateEdges();
      el.addEventListener("scroll", updateEdges, { passive: true });
      window.addEventListener("resize", updateEdges);
    }
    return () => {
      const t = trackRef.current;
      if (t) t.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [trackId, updateEdges]);

  if (!mounted) {
    // Stable placeholder on first paint to avoid hydration drift.
    return <div ref={hostRef} aria-hidden="true" className="contents" />;
  }

  return (
    <div ref={hostRef} className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => scrollByStep(-1)}
        disabled={atStart}
        aria-label={labelPrev}
        className="grid size-10 place-items-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => scrollByStep(1)}
        disabled={atEnd}
        aria-label={labelNext}
        className="grid size-10 place-items-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
