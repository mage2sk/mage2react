// Base.astro integration (just before </body>):
//   <link rel="manifest" href="/manifest.webmanifest">
//   <meta name="theme-color" content="#0b5fff">
//   <PWARegister client:idle />
//
// If the integration agent can't edit Base.astro, this island is dormant (harmless).

import { useEffect, useState } from "react";

type UpdateState = "idle" | "available";

export default function PWARegister() {
  const [state, setState] = useState<UpdateState>("idle");
  const [dismissed, setDismissed] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Feature check.
    if (!("serviceWorker" in navigator)) return;

    // Dev-mode guard: skip only on plain `localhost`. Our dev host is
    // `mage2react.local` (HTTPS) where we *do* want the SW active.
    if (window.location.hostname === "localhost") return;

    let cancelled = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (cancelled) return;

        // If there's already a waiting worker on page load, surface it.
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
          setState("available");
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // A new SW is ready; existing page is still controlled by the old one.
              setWaitingWorker(reg.waiting ?? installing);
              setState("available");
            }
          });
        });
      } catch {
        // Registration failed — not fatal, app still works online.
      }
    };

    const onControllerChange = () => {
      // Controller swapped — reload so the new SW's cache rules take effect.
      // Guard against reload loops.
      if ((window as unknown as { __m2rReloading?: boolean }).__m2rReloading) return;
      (window as unknown as { __m2rReloading?: boolean }).__m2rReloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Don't block page load — schedule registration after idle.
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(register, { timeout: 4000 });
    } else {
      setTimeout(register, 0);
    }

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  if (state !== "available" || dismissed) return null;

  const handleRefresh = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderRadius: "0.75rem",
        background: "#0b5fff",
        color: "#fff",
        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        fontSize: "0.875rem",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <span>New version available</span>
      <button
        type="button"
        onClick={handleRefresh}
        style={{
          background: "#fff",
          color: "#0b5fff",
          border: "none",
          borderRadius: "999px",
          padding: "0.375rem 0.875rem",
          fontWeight: 600,
          fontSize: "0.8125rem",
          cursor: "pointer",
        }}
      >
        Refresh
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        style={{
          background: "transparent",
          color: "#fff",
          border: "none",
          fontSize: "1rem",
          cursor: "pointer",
          padding: "0 0.25rem",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
