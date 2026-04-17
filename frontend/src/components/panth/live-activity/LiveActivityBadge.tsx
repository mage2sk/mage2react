import { useEffect, useRef, useState } from "react";

/**
 * LiveActivityBadge.tsx — `client:idle` React 19 island.
 *
 * Polls the proxied same-origin GraphQL endpoint for `panthLiveActivity(sku)`
 * every 30 seconds and shows a small "N people viewing now / M bought in last
 * 24h" badge. Designed to drop on the PDP near the Add-to-Cart button without
 * shifting layout:
 *   - Renders `null` on mount until the first response arrives.
 *   - Renders `null` if both counters are zero — no "0 viewers" clutter.
 *   - Respects `navigator.doNotTrack === "1"` and `"globalPrivacyControl"`:
 *     polling is skipped entirely.
 *   - Respects `prefers-reduced-motion`: the pulsing dot becomes static.
 *
 * No new npm deps. Strict TS. No `any`.
 */

interface Props {
  sku: string;
  intervalMs?: number;
}

interface Activity {
  viewers: number;
  purchased_last_24h: number;
}

function clampCount(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  return Math.floor(Math.min(v, 99_999));
}

function isDoNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  type NavWithGpc = Navigator & { globalPrivacyControl?: boolean };
  const nav = navigator as NavWithGpc;
  if (nav.globalPrivacyControl === true) return true;
  const dnt = navigator.doNotTrack;
  return dnt === "1" || dnt === "yes";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const QUERY = /* GraphQL */ `
  query PanthLiveActivity($sku: String!) {
    panthLiveActivity(sku: $sku) {
      viewers
      purchased_last_24h
    }
  }
`;

async function fetchActivity(sku: string, signal: AbortSignal): Promise<Activity | null> {
  try {
    const res = await fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { sku } }),
      signal,
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { panthLiveActivity?: { viewers?: unknown; purchased_last_24h?: unknown } | null };
      errors?: unknown;
    };
    const node = body.data?.panthLiveActivity ?? null;
    if (!node) return null;
    return {
      viewers: clampCount(node.viewers),
      purchased_last_24h: clampCount(node.purchased_last_24h),
    };
  } catch {
    return null;
  }
}

export default function LiveActivityBadge({ sku, intervalMs = 30_000 }: Props): JSX.Element | null {
  const [activity, setActivity] = useState<Activity | null>(null);
  const stopped = useRef<boolean>(false);

  useEffect(() => {
    if (!sku) return;
    if (isDoNotTrack()) return;

    const controller = new AbortController();
    stopped.current = false;

    async function tick(): Promise<void> {
      if (stopped.current) return;
      const next = await fetchActivity(sku, controller.signal);
      if (stopped.current) return;
      if (next) setActivity(next);
    }

    void tick();
    const iv = window.setInterval(tick, Math.max(5_000, intervalMs));
    const onVis = (): void => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stopped.current = true;
      controller.abort();
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sku, intervalMs]);

  if (!activity) return null;
  const { viewers, purchased_last_24h } = activity;
  if (viewers <= 0 && purchased_last_24h <= 0) return null;

  const reducedMotion = prefersReducedMotion();

  return (
    <div
      className="inline-flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-fg)]"
      role="status"
      aria-live="polite"
    >
      {viewers > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={
              reducedMotion
                ? "inline-block h-2 w-2 rounded-full bg-[var(--color-brand)]"
                : "relative inline-flex h-2 w-2"
            }
          >
            {!reducedMotion && (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-brand)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-brand)]" />
              </>
            )}
          </span>
          <span>
            <strong className="font-semibold">{viewers.toLocaleString()}</strong> viewing now
          </span>
        </span>
      )}
      {purchased_last_24h > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L23 6H6" />
          </svg>
          <span>
            <strong className="font-semibold">{purchased_last_24h.toLocaleString()}</strong> bought in last 24h
          </span>
        </span>
      )}
    </div>
  );
}
