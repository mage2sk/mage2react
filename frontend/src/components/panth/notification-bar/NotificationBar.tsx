import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterActiveBars,
  getNotificationBars,
  validateBarColor,
  type NotificationBarT,
} from "~/lib/queries-notification-bar";
import { sanitizeHtml } from "~/lib/sanitize";

/**
 * <NotificationBar /> — React island for `Panth_NotificationBar`.
 *
 * INTEGRATION (leave as comments; never auto-wire):
 *   At the top of the `<body>` in Base.astro (below `<NotificationBarSSR />`
 *   if you are using both):
 *
 *     import NotificationBar from
 *       "~/components/panth/notification-bar/NotificationBar";
 *     <NotificationBar client:idle />
 *
 * FEATURES:
 *   - Cycles through active bars (highest priority first) — rotates every
 *     8s unless reduced motion is on, in which case rotation is disabled.
 *   - Dismissed ids persist in `localStorage` under `panth:dismissed-bars`.
 *   - Expired bars are filtered out on each render against the client clock.
 *   - Admin-supplied `bg_color` / `text_color` are passed through
 *     `validateBarColor` — anything outside the allowlist is ignored.
 *   - Message HTML passes through `sanitizeHtml()` before being rendered.
 *
 * Renders nothing when there are no active, non-dismissed bars.
 */

const STORAGE_KEY = "panth:dismissed-bars";
const ROTATE_MS = 8000;

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const out = new Set<string>();
    for (const v of parsed) {
      if (typeof v === "string") out.add(v);
    }
    return out;
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    /* storage unavailable */
  }
}

function isSafeHref(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s.length) return null;
  if (s.startsWith("/") || s.startsWith("#")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (): void => setReduced(mq.matches);
    setReduced(mq.matches);
    try {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    } catch {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, []);
  return reduced;
}

export default function NotificationBar(): JSX.Element | null {
  const [bars, setBars] = useState<NotificationBarT[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const [now, setNow] = useState<Date>(() => new Date());
  const [index, setIndex] = useState(0);
  const reduced = usePrefersReducedMotion();

  // Fetch on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getNotificationBars();
      if (cancelled) return;
      setBars(res);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh "now" once a minute so expired bars drop off without a reload.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const visible = useMemo(() => {
    if (!bars) return [];
    return filterActiveBars(bars, now).filter((b) => !dismissed.has(b.id));
  }, [bars, now, dismissed]);

  // Rotate through visible bars.
  useEffect(() => {
    if (visible.length <= 1) return;
    if (reduced) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % visible.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [visible.length, reduced]);

  // Keep index in range when `visible` shrinks.
  useEffect(() => {
    if (index >= visible.length && visible.length > 0) {
      setIndex(0);
    }
  }, [index, visible.length]);

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(id);
        writeDismissed(next);
        return next;
      });
    },
    [],
  );

  if (!bars) return null;
  if (visible.length === 0) return null;

  const current = visible[index] ?? visible[0];
  if (!current) return null;

  const bg = validateBarColor(current.bg_color);
  const fg = validateBarColor(current.text_color);
  const href = isSafeHref(current.link);
  const msgHtml = sanitizeHtml(current.message);

  const styleParts: Record<string, string> = {};
  if (bg) styleParts.backgroundColor = bg;
  if (fg) styleParts.color = fg;

  return (
    <div
      role="region"
      aria-label="Site announcement"
      aria-live="polite"
      className={
        "relative w-full text-sm " +
        (bg ? "" : "bg-[var(--color-brand)] ") +
        (fg ? "" : "text-white")
      }
      style={styleParts}
      data-panth-notification-bar={current.id}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-center">
        {href ? (
          <a
            href={href}
            className="underline-offset-2 hover:underline"
            dangerouslySetInnerHTML={{ __html: msgHtml }}
          />
        ) : (
          <span dangerouslySetInnerHTML={{ __html: msgHtml }} />
        )}
        {visible.length > 1 && (
          <span className="text-xs opacity-75" aria-hidden="true">
            {index + 1}/{visible.length}
          </span>
        )}
      </div>
      {current.dismissible && (
        <button
          type="button"
          onClick={() => dismiss(current.id)}
          aria-label="Dismiss notification"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-white/70"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
