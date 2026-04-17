# Panth_NotFoundPageReact

React/Astro storefront companion for `Panth_NotFoundPage`. Renders the admin-authored 404 content (title, body, featured products) on the headless storefront with a safe fallback if the parent module is disabled.

## Storefront integration

- `frontend/src/components/panth/not-found/NotFoundContent.astro` — drop-in Astro fragment. Queries `panthNotFoundPage { title content featured_products { ... } }` via GraphQL and renders a sanitized title/body block plus a grid of featured products. Falls back to a plain "Page not found" message when the parent module returns `null` or the GraphQL field is missing.

**Wiring:** replace the body of `src/pages/404.astro` with

```astro
---
import Base from "~/layouts/Base.astro";
import NotFoundContent from "~/components/panth/not-found/NotFoundContent.astro";
---
<Base title="Page not found">
  <NotFoundContent />
</Base>
```

and apply the same swap wherever `[...slug].astro` or any fallthrough handler renders an inline 404 block. This module intentionally does not edit those pages — they are out of scope here and the page owner performs the swap.
