# Panth_ProductSliderReact

React/Astro storefront companion for `Panth_ProductSlider` (`mage2kishan/module-product-slider`). Exposes the merchant-defined product carousels (related / upsell / cross-sell / featured / bestsellers / etc.) to the headless frontend.

## Storefront integration

- `frontend/src/lib/queries-product-slider.ts` — `getProductSlider(slug)` returns `{ title, subtitle, items }`. Multiple sliders per page supported; each call is cache-friendly.
- `frontend/src/components/panth/product-slider/ProductSlider.astro` — CSS scroll-snap slider with zero JS by default. Inline SVG prev/next arrows drive `.scrollBy()` via a tiny `client:idle` island (`SliderArrows.tsx`). Keyboard accessible (arrow keys when the track is focused).

## Drop-in usage

```astro
---
import ProductSlider from "~/components/panth/product-slider/ProductSlider.astro";
---
<ProductSlider slug="bestsellers" />
<ProductSlider slug="home-featured" heading="Hand-picked for you" />
```

Renders nothing when the backend returns an empty slider or the parent module is not installed — safe to ship before the backend lands.
