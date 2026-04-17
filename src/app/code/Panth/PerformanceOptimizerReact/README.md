# Panth_PerformanceOptimizerReact

React/Astro storefront adapter for `Panth_PerformanceOptimizer`.

Admin-only Magento performance tweaks. Complements storefront perf work in `Panth_React` (System Font stack, strict CSP, Astro SSR, Tailwind v4 Oxide, zero-JS by default). No storefront UI integration.

## Sequence

- `Panth_React`
- `Panth_PerformanceOptimizer`

## Scope

- Admin/backend-facing only
- No storefront Astro components
- Ships a tiny optional frontend helper for admin-managed resource hints:
  - `frontend/src/lib/panth-perf-hints.ts` — reads `storeConfig.panth_perf_hints { preconnect[], dns_prefetch[], preload[] }` and returns `<link>` attribute objects. Include in `Base.astro` `<head>` if you want admin-managed resource hints.

## Safety

- Hostnames are safe-listed to `http(s)` only
- Entries containing `javascript:`, `data:`, or whitespace are rejected
