# Panth_OrderAttachmentsReact

React/Astro storefront companion for `Panth_OrderAttachments`. A thin glue layer: it depends on the parent module via `<sequence>` so the storefront can safely consume the `panth_order_attachments { ... }` GraphQL extension on `CustomerOrder`. Ships no PHP logic of its own.

## Storefront integration

- `frontend/src/lib/queries-order-attachments.ts` — typed `safeParse` helpers wrapping the extended order query. Uses the existing `authQuery` pattern from `~/lib/queries-customer`. Every field is `.nullable().optional()` because we cannot verify the parent schema at build time; a missing field never crashes the order-view page.
- `frontend/src/components/panth/order-attachments/OrderAttachmentsList.astro` — SSR list of downloadable attachments (filename, size, uploaded date). Links open in a new tab with `rel="noopener noreferrer" target="_blank" data-astro-reload`. Filenames are sanitised before rendering.
- `frontend/src/components/panth/order-attachments/UploadAttachment.tsx` — `client:visible` React island that POSTs a selected file to `/api/panth/order-attachments/upload`. The browser never sees the Magento bearer token; the Astro endpoint reads `m2r_customer_token` (HttpOnly) and forwards the multipart body with an `Authorization: Bearer <token>` header.
- `frontend/src/pages/api/panth/order-attachments/upload.ts` — Astro API route that forwards multipart uploads to Magento. Enforces a 10 MB size cap and a MIME allowlist (`pdf, png, jpg, jpeg, webp, txt, zip`); rejects executables.

### Wiring into the order-view page

Do not edit the shipped `frontend/src/pages/sales/order/view/[number].astro` from this module. A doc-comment in that file describes how to drop in `<OrderAttachmentsList />` and `<UploadAttachment client:visible />` below the existing order-totals block.

## Constraints

- TypeScript strict; Zod `.safeParse` everywhere with `.nullable().optional()` guards.
- Tailwind v4 tokens (`bg-[var(--color-brand)]`).
- No new npm deps; no `any`.
- Any Magento-authored HTML passes through `sanitizeHtml()` (`frontend/src/lib/sanitize.ts`).
- `<img>` tags include `width`, `height`, `alt`, `loading`.
- Uploads: ≤ 10 MB, MIME allowlist (`pdf, png, jpg, jpeg, webp, txt, zip`), executables rejected.
