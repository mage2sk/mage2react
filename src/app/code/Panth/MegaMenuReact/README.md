# Panth_MegaMenuReact

React/Astro storefront companion for `Panth_MegaMenu`. Surfaces the admin-configured mega menu (nested categories with featured products, custom HTML blocks, and promo images) on the headless storefront as a pure-Astro component — no JS island, no client bundle.

## Storefront integration

- `frontend/src/lib/queries-mega-menu.ts` — typed `getMegaMenu()` helper. Returns the full tree `{ items: [{ label, url, columns: [...], featured_product, promo_image, html_block }] }` with Zod `safeParse` and fallback to an empty array on any failure.
- `frontend/src/components/panth/mega-menu/MegaMenu.astro` — full-width dropdown panels revealed on hover/focus via Tailwind `group:hover` / `group:focus-within` — no JavaScript required. Each panel renders subcategory link columns, an optional featured product card, and an optional promo image. Safe, sanitized HTML blocks render inside the panel as an editorial slot.

**Wiring:** import `<MegaMenu />` into `src/layouts/Base.astro`'s primary-nav slot (adjacent to or in place of the current top-nav markup). This module intentionally ships the component only — `Base.astro` is out of scope and must be edited by the layout owner.
