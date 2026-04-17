import { atom } from "nanostores";

/**
 * Recently-viewed product tracking — Luma-style.
 *
 * Persists the last 10 unique SKUs the visitor viewed to `localStorage`
 * (key `m2r_recent_v1`), newest first. Fully client-side: no server-side
 * tracking, no analytics, and no recording if the browser sends the
 * Do-Not-Track signal (`navigator.doNotTrack === "1"`).
 *
 * Cross-tab sync is handled via the `storage` event (simple, no
 * BroadcastChannel needed for this read-mostly use-case).
 */

const STORAGE_KEY = "m2r_recent_v1";
const MAX_ITEMS = 10;

export const recentlyViewed = atom<string[]>([]);

let hydrated = false;

/* -------------------------------------------------------------------------- */
/* Storage helpers                                                            */
/* -------------------------------------------------------------------------- */

function safeRead(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Only keep string values, dedupe while preserving order, cap length.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of parsed) {
      if (typeof v !== "string") continue;
      if (v.length === 0) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  } catch {
    return [];
  }
}

function safeWrite(list: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota exceeded / disabled storage — ignore silently */
  }
}

function doNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  // Spec values: "1" = tracking not allowed. Some engines expose "yes".
  const v = navigator.doNotTrack;
  return v === "1" || v === "yes";
}

/* -------------------------------------------------------------------------- */
/* Hydration + cross-tab sync                                                 */
/* -------------------------------------------------------------------------- */

export function hydrateRecentlyViewed(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  recentlyViewed.set(safeRead());

  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    recentlyViewed.set(safeRead());
  });
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Record a product view. No-op when:
 *   - `sku` is empty / whitespace
 *   - The visitor has Do-Not-Track enabled
 *   - Called on the server
 *
 * Pushes the SKU to the front of the list, dedupes, and caps the result at
 * 10 items. Writes synchronously to localStorage.
 */
export function recordView(sku: string): void {
  if (typeof window === "undefined") return;
  const trimmed = sku.trim();
  if (trimmed.length === 0) return;
  if (doNotTrack()) return;

  hydrateRecentlyViewed();

  const current = recentlyViewed.get();
  // Skip the write if it's already at the head.
  if (current[0] === trimmed) return;

  const next = [trimmed, ...current.filter((s) => s !== trimmed)].slice(
    0,
    MAX_ITEMS,
  );
  recentlyViewed.set(next);
  safeWrite(next);
}

/** Clear the list (e.g. on logout). Exported for symmetry; no callers today. */
export function clearRecentlyViewed(): void {
  recentlyViewed.set([]);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/* Auto-hydrate in the browser                                                */
/* -------------------------------------------------------------------------- */

if (typeof window !== "undefined") {
  queueMicrotask(hydrateRecentlyViewed);
}
