# Panth_CorewebvitalsReact

React/Astro storefront companion for `Panth_Corewebvitals`. Adds a lightweight client-side reporter that collects the four field-measured Core Web Vitals (LCP, INP, CLS, TTFB) and ships them to a same-origin API endpoint, which forwards to the parent module's `storeCoreWebVital` GraphQL mutation if available.

## Storefront integration

- `frontend/src/components/panth/cwv/CwvReporter.tsx` — React 19 island. Mount once per layout with `client:idle` (e.g. inside `Base.astro`'s `<body>` trailing region, next to `<Toaster />`). Uses the native `PerformanceObserver` API (no library dependency) and only fires on `visibilitychange: hidden` or `pagehide` so every pageview sends exactly one beacon via `navigator.sendBeacon()`.
- `frontend/src/pages/api/panth/cwv.ts` — Astro server endpoint that accepts POSTed JSON beacons, Zod-validates, and best-effort forwards to Magento's GraphQL. Returns `204 No Content` on success or when the mutation does not exist, so the client never retries on schema mismatch.

No npm packages added. All beacons are size-capped and field-validated server-side.
