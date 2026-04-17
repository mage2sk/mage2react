# Panth_FaqReact

React/Astro storefront companion for `Panth_Faq`. Surfaces the parent module's FAQ categories and items on the headless storefront as a dedicated `/faq` page (with category filter + zero-JS accordion) plus a reusable accordion block for landing pages.

## Storefront integration

- `frontend/src/lib/queries-faq.ts` — typed `getFaqCategories()` + `getFaqItems(categoryId, page)` helpers. Returns `{ items, page_info }`. Every field is `.nullable().optional()`; `safeParse` + empty fallback.
- `frontend/src/pages/faq.astro` — SSR `/faq` page. Category filter via `?category=<id>`, pagination via `?page=<n>`. Each question renders as a native `<details><summary>` accordion (zero-JS). Emits `FAQPage` JSON-LD using the shared `faqPageLd` helper from `~/lib/jsonld.ts`.
- `frontend/src/components/panth/faq/FaqAccordion.astro` — drop-in reusable accordion block (Astro only, no hydration). Accepts an array of `{ question, answer }` pairs and renders a `<details>` list. All answers pipe through `sanitizeHtml()`.

FAQPage JSON-LD is emitted only when the page actually has FAQ items. Question text is stripped to plain text for the schema payload (no HTML), answers use the sanitized-but-still-rich body.
