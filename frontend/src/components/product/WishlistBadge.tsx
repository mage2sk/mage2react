import { useEffect, useState } from "react";

type StatusResponse = { signedIn: boolean; skus: string[] };

/**
 * Header wishlist pill. Hidden for guest users so the header layout doesn't
 * shift for them; signed-in members see "\u2665 N" linking to /wishlist.
 *
 * Hydrates on idle via `client:idle` so it never competes with critical-path
 * work (cart drawer, search box) for the main thread.
 */
export default function WishlistBadge() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wishlist/status", {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;
        setSignedIn(data.signedIn);
        setCount(data.skus.length);
      } catch {
        // Silent: if the endpoint is unreachable we simply don't render.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Don't flash an empty pill during hydration.
  if (!ready) return null;
  if (!signedIn) return null;

  return (
    <a
      href="/wishlist"
      aria-label={`Wishlist, ${count} item${count === 1 ? "" : "s"}`}
      className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.65-9.5 9-9.5 9Z" />
      </svg>
      <span className="tabular-nums">{count}</span>
    </a>
  );
}
