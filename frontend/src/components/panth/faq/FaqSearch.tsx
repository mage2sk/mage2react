import { useEffect, useMemo, useState } from "react";

/**
 * FaqSearch.tsx — client-side search + render for the FAQ page.
 *
 * Takes the server-rendered item list as a prop (so the first paint matches
 * SSR) and replaces it with a filtered render once the user types. Questions
 * are matched by substring, diacritic-insensitive, against the query.
 */

export interface FaqSearchItem {
  id: string;
  question: string;
  answer: string;
}

interface Props {
  items: FaqSearchItem[];
  openFirst?: boolean;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function highlight(source: string, q: string): { __html: string } {
  if (!q) return { __html: escapeHtml(source) };
  const norm = normalize(source);
  const target = normalize(q);
  const idx = norm.indexOf(target);
  if (idx < 0) return { __html: escapeHtml(source) };
  const before = source.slice(0, idx);
  const match = source.slice(idx, idx + q.length);
  const after = source.slice(idx + q.length);
  return {
    __html: `${escapeHtml(before)}<mark class="rounded bg-yellow-200 px-0.5 text-zinc-900">${escapeHtml(match)}</mark>${escapeHtml(after)}`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function FaqSearch({ items, openFirst = false }: Props): JSX.Element {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 120);
    return () => window.clearTimeout(t);
  }, [q]);

  const filtered = useMemo(() => {
    if (!debouncedQ) return items;
    const needle = normalize(debouncedQ);
    return items.filter((it) => {
      const hay = normalize(`${it.question} ${it.answer.replace(/<[^>]+>/g, " ")}`);
      return hay.includes(needle);
    });
  }, [items, debouncedQ]);

  const empty = filtered.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <label className="relative block">
        <span className="sr-only">Search FAQs</span>
        <svg
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search FAQs..."
          aria-label="Search frequently asked questions"
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-9 text-sm text-zinc-900 placeholder-zinc-500 shadow-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </label>

      {debouncedQ && (
        <p className="text-sm text-zinc-600" aria-live="polite">
          {filtered.length} result{filtered.length === 1 ? "" : "s"} for "{debouncedQ}"
        </p>
      )}

      {empty ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-600">
          No FAQs match that search. Try different keywords or{" "}
          <a href="/contact" className="font-semibold text-[var(--color-brand)] hover:underline">
            contact support
          </a>
          .
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {filtered.map((it, idx) => (
            <details
              key={it.id}
              className="group px-4"
              open={debouncedQ.length > 0 || (openFirst && idx === 0)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-left font-medium text-zinc-900 marker:content-['']">
                <h3
                  className="m-0 text-base font-medium"
                  dangerouslySetInnerHTML={highlight(it.question, debouncedQ)}
                />
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div
                className="pb-4 text-sm leading-6 text-zinc-700 [&_a:hover]:underline [&_a]:text-[var(--color-brand)] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: it.answer }}
              />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
