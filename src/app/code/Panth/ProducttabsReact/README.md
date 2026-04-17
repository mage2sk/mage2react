# Panth_ProducttabsReact

React/Astro storefront companion for `Panth_Producttabs` (`mage2kishan/module-producttabs`). Renders merchant-authored PDP tabs (Description, Specs, Shipping, etc.) plus a reserved slot for the existing Reviews component.

## Storefront integration

- `frontend/src/lib/queries-producttabs.ts` — `PANTH_TABS_PRODUCT_FRAGMENT` (fragment) + `extractPanthTabs(product)` returning a sorted list of `{ id, title, content, sortOrder }`.
- `frontend/src/components/panth/producttabs/ProductTabs.astro` — server-rendered. Renders `<details>` accordions on mobile (zero-JS) and a tablist on desktop (CSS `:target` + `role="tablist"`). Each tab content is sanitized via `sanitizeHtml()`.
- `frontend/src/components/panth/producttabs/TabsKeyboardNav.tsx` — tiny `client:idle` island adding arrow-key navigation between tab buttons (↑ / ↓ / ← / →, Home, End).

## How to wire into the PDP

Do NOT edit the PDP route or existing components from this module. The storefront maintainer should splice `...PanthTabsProductFragment` into the PDP product query and mount:

```astro
---
import ProductTabs from "~/components/panth/producttabs/ProductTabs.astro";
import Reviews from "~/components/product/Reviews.astro";
import { extractPanthTabs } from "~/lib/queries-producttabs";

const tabs = extractPanthTabs(productView.p);
---
<ProductTabs tabs={tabs}>
  <Reviews slot="reviews" sku={productView.p.sku} />
</ProductTabs>
```

When the `reviews` slot is supplied, a pre-declared "Reviews" tab renders its content in place. When `tabs` is empty and no slot is supplied, the component renders nothing.
