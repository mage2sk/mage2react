# Panth_PagebuilderAiReact

Admin-only module — no storefront integration needed.

`Panth_PagebuilderAi` provides AI-driven content generation inside the Magento admin Page Builder. All of its features live behind the admin UI: merchants generate page-builder content in the CMS editor, then Magento stores the produced HTML in the standard `cms_page` / `cms_block` content columns, which the Astro storefront already consumes via existing `queries.ts` helpers (`getCmsPage`, `getCmsBlock`).

Because the storefront only ever sees the final HTML (sanitized through `~/lib/sanitize.ts`), there is no React/Astro component to build here. This companion module exists purely to:

1. Sit alongside the parent module with a `<sequence>` dependency so composer updates stay atomic between the admin-side generator and the headless storefront's React baseline.
2. Provide a discoverable hook-point if, in the future, Panth decides to surface an AI-generation toolbar or preview widget on the storefront side.

No further files are required.
