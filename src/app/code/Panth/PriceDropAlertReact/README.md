# Panth_PriceDropAlertReact

React/Astro storefront companion for `Panth_PriceDropAlert`. Surfaces the parent module's price-drop email subscription flow on the headless storefront as a PDP island with an optional target-price input.

## Storefront integration

- `frontend/src/lib/queries-price-drop-alert.ts` — typed `subscribePriceDrop(sku, email, target_price?)` helper. Forwards to Magento's `panthPriceDropSubscribe` GraphQL mutation. Returns `{ ok, message }`; friendly fallback copy on schema miss.
- `frontend/src/components/panth/price-drop-alert/PriceDropForm.tsx` — React island mounted with `client:idle`. Renders an email input + optional "notify me when price drops to" target-price input. POSTs to the server endpoint `/api/panth/price-drop` which re-validates, rate-limits, and forwards to Magento.
- `frontend/src/pages/api/panth/price-drop.ts` — Astro endpoint that re-validates and rate-limits (5 requests per minute per client IP).

**PDP wiring (not done by this module):** on your product detail page, under the price block, insert:

```astro
<PriceDropForm sku={product.sku} currency={currency} currentPrice={currentPrice} client:idle />
```

This module never edits the existing PDP template.
