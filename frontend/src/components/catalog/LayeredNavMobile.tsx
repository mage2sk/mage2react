/**
 * <LayeredNavMobile/> — thin drawer wrapper for the filter rail on mobile.
 *
 * This component *only* manages open/close state for the drawer. The filter
 * UI itself is the same server-rendered `<LayeredNav/>` markup, cloned from a
 * hidden container the Astro page emits under `[data-filter-source]`.
 *
 * Usage:
 *   <LayeredNavMobile client:idle />
 *   <div data-filter-source hidden>
 *     <LayeredNav … />   <!-- will be cloned into the drawer -->
 *   </div>
 *
 * We avoid re-implementing the filter links in React so there's a single
 * source of truth (and zero JS for desktop).
 */

import { useEffect, useState } from "react";

export default function LayeredNavMobile() {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    const src = document.querySelector<HTMLElement>("[data-filter-source]");
    if (src) setHtml(src.innerHTML);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] lg:hidden"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M0 2h16v2H0V2zm3 5h10v2H3V7zm3 5h4v2H6v-2z" />
        </svg>
        Filters
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Product filters"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex h-full w-[85%] max-w-sm flex-col bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-base font-semibold">Filters</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-zinc-600 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
                aria-label="Close filters"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <div
              className="flex-1 overflow-y-auto p-4"
              // Server-rendered markup — safe because it's a clone of our own
              // `<LayeredNav/>` output elsewhere on the page.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      )}
    </>
  );
}
