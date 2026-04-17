import { useEffect } from "react";

/**
 * <CwvReporter /> — client-only React 19 island (mount with `client:idle`).
 *
 * Observes the four field-measured Core Web Vitals:
 *   - LCP (Largest Contentful Paint)
 *   - INP (Interaction to Next Paint) — derived from `event` entries with
 *     duration >= 40ms; we keep the max across the page lifetime.
 *   - CLS (Cumulative Layout Shift) — sums layout-shift entries that are
 *     not triggered by recent user input, in the standard "session window"
 *     reset fashion (5s gap or 1s span).
 *   - TTFB (Time to First Byte) — from `PerformanceNavigationTiming`.
 *
 * Beacons fire exactly once per page visit on `visibilitychange: hidden` or
 * `pagehide` via `navigator.sendBeacon()`, which is the only API that is
 * guaranteed to complete during an unload. We POST JSON to
 * `/api/panth/cwv`; that endpoint forwards to Magento.
 *
 * No npm deps. Uses the native PerformanceObserver API.
 */

type Vitals = {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  ttfb: number | null;
  url: string;
  connection: string | null;
  viewportW: number;
  viewportH: number;
};

type PerformanceEventTimingLike = PerformanceEntry & {
  duration: number;
  processingStart: number;
  processingEnd: number;
};

type LayoutShiftLike = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
};

function safeObserve(
  type: string,
  buffered: boolean,
  cb: (entries: PerformanceEntry[]) => void,
): PerformanceObserver | null {
  try {
    const po = new PerformanceObserver((list) => cb(list.getEntries()));
    po.observe({ type, buffered });
    return po;
  } catch {
    return null;
  }
}

export default function CwvReporter(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof PerformanceObserver === "undefined") return;

    const vitals: Vitals = {
      lcp: null,
      inp: null,
      cls: null,
      ttfb: null,
      url: window.location.pathname + window.location.search,
      connection: null,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
    };

    // TTFB — one-shot read from navigation entry.
    try {
      const nav = performance.getEntriesByType("navigation")[0] as
        | (PerformanceEntry & { responseStart: number })
        | undefined;
      if (nav && typeof nav.responseStart === "number") {
        vitals.ttfb = Math.max(0, Math.round(nav.responseStart));
      }
    } catch {
      /* ignore */
    }

    // Connection hint (optional).
    try {
      const nav = navigator as Navigator & {
        connection?: { effectiveType?: string };
      };
      vitals.connection = nav.connection?.effectiveType ?? null;
    } catch {
      /* ignore */
    }

    // LCP — keep largest across the page.
    const poLcp = safeObserve("largest-contentful-paint", true, (entries) => {
      const last = entries[entries.length - 1];
      if (last) vitals.lcp = Math.round(last.startTime);
    });

    // INP — keep max interaction duration >= 40ms.
    const poInp = safeObserve("event", true, (entries) => {
      for (const e of entries as PerformanceEventTimingLike[]) {
        if (e.duration >= 40) {
          if (vitals.inp === null || e.duration > vitals.inp) {
            vitals.inp = Math.round(e.duration);
          }
        }
      }
    });

    // CLS — session-window algorithm.
    let clsSession = 0;
    let clsSessionStart = 0;
    let clsSessionPrev = 0;
    let clsMax = 0;
    const poCls = safeObserve("layout-shift", true, (entries) => {
      for (const raw of entries as LayoutShiftLike[]) {
        if (raw.hadRecentInput) continue;
        const now = raw.startTime;
        if (
          clsSession > 0 &&
          (now - clsSessionPrev > 1000 || now - clsSessionStart > 5000)
        ) {
          // Session closed — finalise.
          if (clsSession > clsMax) clsMax = clsSession;
          clsSession = 0;
          clsSessionStart = now;
        }
        if (clsSession === 0) clsSessionStart = now;
        clsSessionPrev = now;
        clsSession += raw.value;
      }
      if (clsSession > clsMax) clsMax = clsSession;
      vitals.cls = Math.round(clsMax * 1000) / 1000;
    });

    let sent = false;
    function flush(): void {
      if (sent) return;
      sent = true;
      try {
        poLcp?.disconnect();
        poInp?.disconnect();
        poCls?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        const body = JSON.stringify(vitals);
        const blob = new Blob([body], { type: "application/json" });
        // sendBeacon is fire-and-forget and survives page unload. If it
        // fails (Safari blocks beacons in some cases) we fall back to fetch
        // with keepalive.
        const ok = navigator.sendBeacon?.("/api/panth/cwv", blob) ?? false;
        if (!ok) {
          void fetch("/api/panth/cwv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => undefined);
        }
      } catch {
        /* swallow */
      }
    }

    function onHidden(): void {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onHidden, { capture: true });
    window.addEventListener("pagehide", flush, { capture: true });

    return () => {
      document.removeEventListener("visibilitychange", onHidden, { capture: true });
      window.removeEventListener("pagehide", flush, { capture: true });
      try {
        poLcp?.disconnect();
        poInp?.disconnect();
        poCls?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}
