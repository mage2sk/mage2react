# Panth_QuickviewReact

React/Astro storefront companion for `Panth_Quickview` (`mage2kishan/module-quickview`). Improves the existing quick-view modal (`src/components/product/QuickView.tsx`) with the parent module's richer product payload: badges, stock counter, short-description, featured media, ratings summary.

## Storefront integration

- `frontend/src/lib/queries-quickview.ts` — minimal quick-view query tailored for the modal (not the full PDP query). Uses `products(filter: { url_key: { eq: $urlKey }})` and enriches with `panth_quickview { badges, stock_counter, rating_summary, ... }` fields — all `.nullable().optional()` so the modal degrades gracefully when the backend isn't installed.
- `frontend/src/components/panth/quickview/QuickviewModal.tsx` — React island, `client:idle`. Listens for `window.m2r:quick-view` custom events emitted by `CardActions.tsx` and opens a modal. This is a DROP-IN replacement for the legacy `QuickView.tsx`; the legacy file is NOT removed so the storefront continues to work if this module is disabled.

## How to mount

Do NOT edit `Base.astro` from this module. The storefront maintainer should mount the new island once inside the global layout, replacing the old import:

```astro
---
// Replace:
//   import QuickView from "~/components/product/QuickView.tsx";
import QuickviewModal from "~/components/panth/quickview/QuickviewModal.tsx";
---
<QuickviewModal client:idle />
```

`CardActions` already dispatches `CustomEvent("m2r:quick-view", { detail: { urlKey } })`, so no other changes are needed.
