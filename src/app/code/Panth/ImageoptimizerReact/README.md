# Panth_ImageoptimizerReact

React/Astro storefront companion for `Panth_Imageoptimizer` (`mage2kishan/module-imageoptimizer`). Wraps Magento media URLs in optimizer-served renditions (AVIF / WebP / JPEG) with correct `srcset` / `sizes` and a safe fallback to the raw URL when the optimizer isn't installed.

## Storefront integration

- `frontend/src/lib/panth-image.ts` — `panthImageUrl(path, { width, height, format })` builds a `/panth-media/{w}x{h}/{format}/<path>` URL. When the optimizer route isn't configured it emits a best-effort `?w=X&h=Y&fm=webp` query-string form. `panthResponsiveSrcset(url, widths, opts)` returns a matching `srcset` string.
- `frontend/src/components/panth/imageoptimizer/OptimizedImage.astro` — drop-in replacement for `<img>`. Emits a `<picture>` with AVIF / WebP / JPEG `<source>` tags + `srcset` and `sizes`, enforces `width` / `height` / `alt` / `loading`, and gracefully falls back to the raw URL on absolute or non-Magento hosts.

## Drop-in usage

```astro
---
import OptimizedImage from "~/components/panth/imageoptimizer/OptimizedImage.astro";
---
<OptimizedImage
  src="/m/b/mb01-black-0.jpg"
  alt="MB01 backpack, black"
  width={800}
  height={800}
  sizes="(max-width: 768px) 100vw, 50vw"
  loading="lazy"
/>
```

Detects off-site URLs (`https://...`) and returns a plain `<img>` without `<picture>` wrapping so third-party CDNs don't 404. Safe to ship before `Panth_Imageoptimizer` is enabled — the component emits absolute paths only.
