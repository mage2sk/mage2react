# Panth_ProductAttachmentsReact

React/Astro storefront companion for `Panth_ProductAttachments`. Surfaces the parent module's per-product downloadable files (spec sheets, manuals, warranty PDFs) on the headless storefront as a zero-JS download list.

## Storefront integration

- `frontend/src/lib/queries-product-attachments.ts` — exposes the `ProductInterface.panth_attachments` GraphQL fragment plus the typed `PanthAttachmentT` shape and an extractor. `.nullable().optional()` everywhere; `safeParse` + `[]` fallback so a missing field doesn't crash the PDP.
- `frontend/src/components/panth/product-attachments/AttachmentsList.astro` — drop-in reusable list of download links. Each link opens in a new tab with `rel="noopener noreferrer"` and `data-astro-reload` so a click escapes any SPA swap. Icon picked by file type (pdf/doc/zip/txt/generic), size formatted in human-readable units. All labels pass through `sanitizeHtml()`, URLs are validated against an http(s) allowlist.

**PDP wiring (not done by this module):** on your product detail page, under the description, spread the query fragment into the product request and insert:

```astro
<AttachmentsList items={product.panth_attachments ?? []} />
```

This module never edits the existing PDP template.
