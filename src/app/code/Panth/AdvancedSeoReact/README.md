# Panth_AdvancedSeoReact

React/Astro storefront companion for `Panth_AdvancedSeo`. This module is a thin glue layer: it depends on the parent SEO module via `<sequence>` so its GraphQL schema and store-config fields (AI meta descriptions, canonical overrides, redirect resolution, sitemap flags) can be consumed by the headless storefront. It ships no PHP logic of its own.

## Storefront integration

- `frontend/src/lib/queries-advanced-seo.ts` — typed GraphQL helpers with Zod safe-parsing. Every field is `.nullable().optional()` because we cannot verify the parent schema at build time, and we must never crash when fields are missing.
- `frontend/src/components/panth/advanced-seo/MetaInjector.astro` — a pure Astro fragment that fetches AI-generated meta overrides (description, canonical, robots) for the current URL and merges them into the `<Seo />` component. It emits zero markup on error or when the parent module is not installed.

### Wiring into `Base.astro`

Do not edit `Base.astro` directly from this module. Either:

1. Fork `Base.astro` in `frontend/src/layouts/` and render `<MetaInjector path={Astro.url.pathname} />` inside `<head>` above the existing `<Seo />` call — its props will override Seo defaults; or
2. Wrap individual page templates with `<MetaInjector ... />` before they call `<Layout>`.

Never import admin-only GraphQL fields on the storefront.
