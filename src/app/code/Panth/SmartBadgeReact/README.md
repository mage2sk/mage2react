# Panth_SmartBadgeReact

React/Astro storefront companion for `Panth_SmartBadge`. Renders the dynamic `New`, `Sale`, `Bestseller`, `Out-of-stock`, and custom merchant-defined badges that the parent module attaches to each product via a `smart_badges` GraphQL field.

## Storefront integration

- `frontend/src/lib/queries-smart-badge.ts` — exports a GraphQL fragment `SMART_BADGE_PRODUCT_FRAGMENT` that callers can splice into their existing product queries, plus `extractSmartBadges(product)` which Zod safe-parses the `smart_badges` field off any product-shaped object and returns the badge array (sorted by `priority`) or an empty array on mismatch.
- `frontend/src/components/panth/smart-badge/SmartBadge.astro` — drop-in pill renderer. Accepts `{ product }` (any object that may carry a `smart_badges` field) and renders nothing when there are no badges. Each label is passed through `sanitizeHtml()`.

## How to wire into `ProductCard.astro`

Do NOT edit `ProductCard.astro` from this module. Instead, the storefront maintainer should add — inside the card's image container, next to the existing `SALE` pill — a single line:

```astro
---
import SmartBadge from "~/components/panth/smart-badge/SmartBadge.astro";
---
<SmartBadge product={product} />
```

...and extend the product GraphQL query (in `~/lib/queries.ts` or the caller's specialised query) with `...SmartBadgeProductFragment` and the accompanying fragment definition from `queries-smart-badge.ts`.

The badge component gracefully renders nothing when the parent module is not installed, so this addition is safe to ship before the backend lands.
