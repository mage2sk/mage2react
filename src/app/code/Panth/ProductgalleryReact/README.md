# Panth_ProductgalleryReact

React/Astro storefront companion for `Panth_Productgallery` (`mage2kishan/module-productgallery`). Replaces the stock PDP gallery with a richer experience (hover zoom on desktop, pinch-zoom modal on mobile, video support) driven by the parent module's extended media field.

## Storefront integration

- `frontend/src/lib/queries-productgallery.ts` — exports `PANTH_GALLERY_PRODUCT_FRAGMENT` (spread into your PDP product query) and `extractPanthGallery(product)` which Zod-safe-parses a `panth_gallery.images` list (`url`, `label`, `zoom_url`, `video_url`, `poster`).
- `frontend/src/components/panth/productgallery/EnhancedGallery.tsx` — React island, `client:visible`. Thumbnail strip, hover zoom on desktop (via `background-image` pan), pinch-zoom modal on mobile (native touch scaling), HTML5 `<video>` playback for gallery videos, lazy-loaded thumbnails with `width`/`height`.

## How to wire into the PDP

Do NOT edit `src/pages/[...slug].astro` or `Gallery.astro` from this module. The storefront maintainer should add — inside the PRODUCT branch of the route — a single line after resolving the product:

```astro
---
import EnhancedGallery from "~/components/panth/productgallery/EnhancedGallery.tsx";
import { extractPanthGallery, PANTH_GALLERY_PRODUCT_FRAGMENT } from "~/lib/queries-productgallery";
---
<EnhancedGallery
  client:visible
  images={extractPanthGallery(productView.p)}
  fallback={productView.gallery}
  productName={productView.p.name}
/>
```

…and splice `...PanthGalleryProductFragment` into the PDP product GraphQL query.

The component falls back to the regular image list when `panth_gallery` is empty / the parent module isn't installed, so this swap is safe to ship before the backend lands.
