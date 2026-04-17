// PDP integration (inside src/pages/[...slug].astro PRODUCT branch near AddToCartButton):
//   import WishlistButton from "~/components/product/WishlistButton.tsx";
//   <WishlistButton client:visible sku={productView.p.sku} />
//
// Header badge (inside src/layouts/Base.astro next to cart):
//   import WishlistBadge from "~/components/product/WishlistBadge.tsx";
//   <WishlistBadge client:idle />

import { useEffect, useRef, useState } from "react";

type Props = {
  sku: string;
};

type SignInState = "unknown" | "guest" | "member";
type Phase = "idle" | "saving" | "flash-added" | "flash-removed" | "error";

type StatusResponse = { signedIn: boolean; skus: string[] };
type AddResponse = { ok: true; wishlistItemId: string } | { ok: false; error: string };
type RemoveResponse = { ok: true } | { ok: false; error: string };

function HeartIcon({ filled }: { filled: boolean }) {
  // Outlined heart when empty, solid when active. Stroke is currentColor so
  // the parent button's text-color drives both states uniformly.
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.65-9.5 9-9.5 9Z" />
    </svg>
  );
}

export default function WishlistButton({ sku }: Props) {
  const [signIn, setSignIn] = useState<SignInState>("unknown");
  const [wishlisted, setWishlisted] = useState(false);
  // `itemId` is only known after the user adds via this session; if the page
  // hydration reported the sku as already-wishlisted we need to look it up on
  // the server at remove time — the /api/wishlist/remove endpoint handles
  // that (it re-reads the wishlist server-side to find the id). We still hold
  // the freshly-returned id locally for a fast remove without a round-trip.
  const itemIdRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Hydrate initial state from /api/wishlist/status.
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
        setSignIn(data.signedIn ? "member" : "guest");
        if (data.signedIn && data.skus.includes(sku)) {
          setWishlisted(true);
        }
      } catch {
        // Network hiccup — leave state at "unknown" so the click handler can
        // re-try. We don't render an error on hydrate failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sku]);

  function redirectToLogin(): void {
    const returnTo =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";
    const to = `/customer/account/login?return=${encodeURIComponent(returnTo)}`;
    window.location.assign(to);
  }

  async function handleAdd(): Promise<void> {
    // Optimistic: flip to filled immediately, rollback on failure.
    setWishlisted(true);
    setPhase("saving");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/wishlist/add", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      if (res.status === 401) {
        setWishlisted(false);
        setSignIn("guest");
        setPhase("idle");
        redirectToLogin();
        return;
      }
      const data = (await res.json()) as AddResponse;
      if (!res.ok || !data.ok) {
        setWishlisted(false);
        setPhase("error");
        setErrorMsg(!data.ok ? data.error : "Couldn't reach server");
        window.setTimeout(() => {
          setPhase("idle");
          setErrorMsg(null);
        }, 3000);
        return;
      }
      itemIdRef.current = data.wishlistItemId;
      setPhase("flash-added");
      window.setTimeout(() => setPhase("idle"), 1500);
    } catch {
      setWishlisted(false);
      setPhase("error");
      setErrorMsg("Couldn't reach server");
      window.setTimeout(() => {
        setPhase("idle");
        setErrorMsg(null);
      }, 3000);
    }
  }

  async function handleRemove(): Promise<void> {
    // We may not have a local itemId (e.g. the product was already on the
    // wishlist at page-load). In that case we send the sku and let the
    // server resolve the item id from the customer's wishlist.
    const itemId = itemIdRef.current;
    const body = itemId
      ? JSON.stringify({ wishlistItemId: itemId })
      : JSON.stringify({ sku });

    // Optimistic: flip to empty immediately.
    setWishlisted(false);
    setPhase("saving");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/wishlist/remove", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.status === 401) {
        setWishlisted(true);
        setSignIn("guest");
        setPhase("idle");
        redirectToLogin();
        return;
      }
      const data = (await res.json()) as RemoveResponse;
      if (!res.ok || !data.ok) {
        setWishlisted(true);
        setPhase("error");
        setErrorMsg(!data.ok ? data.error : "Couldn't reach server");
        window.setTimeout(() => {
          setPhase("idle");
          setErrorMsg(null);
        }, 3000);
        return;
      }
      itemIdRef.current = null;
      setPhase("flash-removed");
      window.setTimeout(() => setPhase("idle"), 1500);
    } catch {
      setWishlisted(true);
      setPhase("error");
      setErrorMsg("Couldn't reach server");
      window.setTimeout(() => {
        setPhase("idle");
        setErrorMsg(null);
      }, 3000);
    }
  }

  async function onClick(): Promise<void> {
    if (inFlight.current) return;
    if (signIn === "guest") {
      redirectToLogin();
      return;
    }
    // `signIn === "unknown"` means the status fetch hasn't settled yet — be
    // forgiving and treat the click as a member action; the server will 401
    // if we're wrong.
    inFlight.current = true;
    try {
      if (wishlisted) {
        await handleRemove();
      } else {
        await handleAdd();
      }
    } finally {
      inFlight.current = false;
    }
  }

  const disabled = phase === "saving";
  const ariaLabel =
    phase === "saving"
      ? "Saving\u2026"
      : wishlisted
        ? "Remove from wishlist"
        : "Add to wishlist";

  const flash =
    phase === "flash-added"
      ? "Added to wishlist \u2713"
      : phase === "flash-removed"
        ? "Removed"
        : null;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={wishlisted}
        aria-live="polite"
        className={[
          "inline-flex items-center justify-center rounded-full border h-11 w-11 transition disabled:opacity-60",
          wishlisted
            ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)]"
            : "border-gray-300 bg-white text-gray-700 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
        ].join(" ")}
      >
        <HeartIcon filled={wishlisted} />
      </button>
      {flash && (
        <span
          className="text-xs text-emerald-700"
          role="status"
        >
          {flash}
        </span>
      )}
      {errorMsg && (
        <span className="text-xs text-red-600" role="alert">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
