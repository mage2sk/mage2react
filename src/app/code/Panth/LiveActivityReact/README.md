# Panth_LiveActivityReact

React/Astro storefront companion for `Panth_LiveActivity`. Surfaces the parent module's near-real-time "N people viewing now / M purchased in last 24h" counters on the headless storefront as a non-intrusive PDP badge.

## Storefront integration

- `frontend/src/lib/queries-live-activity.ts` — typed `getLiveActivity(productSku)` helper. Returns `{ viewers, purchased_last_24h }`. Both values are `.nullable().optional()`; `safeParse` + `{ viewers: 0, purchased_last_24h: 0 }` fallback.
- `frontend/src/components/panth/live-activity/LiveActivityBadge.tsx` — React island mounted with `client:idle`. Polls every 30 seconds via the proxied `/api/graphql` route. Renders nothing when both counters are zero. Honors `prefers-reduced-motion` (pulse animation suppressed) and `navigator.doNotTrack === "1"` (skips polling entirely).

**PDP wiring (not done by this module):** on your product detail page, near the Add-to-Cart button, insert:

```astro
<LiveActivityBadge sku={product.sku} client:idle />
```

This module never edits the existing PDP template.
