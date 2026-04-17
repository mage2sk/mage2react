// Bridge component that turns a selected ConfigurableOptions variant into a
// gallery-swap event consumed by ZoomableGallery.
//
// Coordination caveat: ConfigurableOptions.tsx is owned by another agent and
// must not be edited here. This component therefore uses a two-tier strategy:
//
//   1. Global bridge:      exposes `window.__m2rVariantImage(url)` so the
//                          integration agent can call it from inside
//                          ConfigurableOptions (preferred path).
//   2. DOM fallback:       polls `document.querySelector('[data-variant-image]')`
//                          every 250 ms for up to 30 s. When that attribute
//                          changes, it forwards the value as a gallery-swap
//                          event.
//
// TODO(integration): add `data-variant-image={matchedVariant?.product.image?.url}`
//                    to the outer <div> of ConfigurableOptions in a future pass.
//                    That lets this component drop the polling and react
//                    synchronously via MutationObserver.

import { useEffect } from "react";

type GlobalBridge = {
  __m2rVariantImage?: (url: string | null) => void;
};

const POLL_INTERVAL_MS = 250;
const POLL_DURATION_MS = 30_000;

function dispatchSwap(url: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("m2r:gallery-swap", { detail: { url } }),
  );
}

export default function VariantImageSync(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // ---- 1. Global bridge ----------------------------------------------
    const bridgeWindow = window as Window & GlobalBridge;
    const previous = bridgeWindow.__m2rVariantImage;
    bridgeWindow.__m2rVariantImage = (url: string | null) => {
      if (typeof url === "string" && url.length > 0) dispatchSwap(url);
    };

    // ---- 2. DOM fallback: attribute polling ---------------------------
    let lastSeen: string | null = null;
    const started = Date.now();

    function readAttr(): string | null {
      const el = document.querySelector<HTMLElement>("[data-variant-image]");
      if (!el) return null;
      const raw = el.getAttribute("data-variant-image");
      return raw && raw.length > 0 ? raw : null;
    }

    // Seed `lastSeen` with whatever is in the DOM on mount so we don't
    // fire a spurious swap for the initial value.
    lastSeen = readAttr();

    const intervalId = window.setInterval(() => {
      if (Date.now() - started > POLL_DURATION_MS) {
        window.clearInterval(intervalId);
        return;
      }
      const current = readAttr();
      if (current !== lastSeen) {
        lastSeen = current;
        if (current) dispatchSwap(current);
      }
    }, POLL_INTERVAL_MS);

    // ---- 3. MutationObserver shortcut (also attribute-based) ----------
    // If the integration agent does eventually add [data-variant-image], the
    // observer catches changes immediately without waiting for the next poll.
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          m.type === "attributes" &&
          m.attributeName === "data-variant-image"
        ) {
          const current = readAttr();
          if (current !== lastSeen) {
            lastSeen = current;
            if (current) dispatchSwap(current);
          }
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-variant-image"],
    });

    return () => {
      window.clearInterval(intervalId);
      observer.disconnect();
      if (previous) {
        bridgeWindow.__m2rVariantImage = previous;
      } else {
        delete bridgeWindow.__m2rVariantImage;
      }
    };
  }, []);

  return null;
}
