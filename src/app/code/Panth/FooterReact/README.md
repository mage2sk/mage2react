# Panth_FooterReact

React/Astro storefront companion for `Panth_Footer`. Exposes the admin-configured footer columns, social links, copyright HTML, and payment-method icons as a drop-in Astro component.

## Storefront integration

- `frontend/src/lib/queries-footer.ts` — typed `getFooterConfig()` helper. Returns `{ columns: [{ title, links: [{ label, url }] }], social_links, copyright_html, payment_methods }`. All fields `.nullable().optional()`, `safeParse`, empty fallback.
- `frontend/src/components/panth/footer/PanthFooter.astro` — a Luma-aligned four-column footer rendered from admin data. Supplements or replaces the existing `Footer.astro`.

**Wiring:** in `src/layouts/Base.astro`, swap
```astro
import Footer from "~/components/Footer.astro";
```
for
```astro
import Footer from "~/components/panth/footer/PanthFooter.astro";
```
when you want the Panth_Footer-managed footer to take over. The component is API-compatible with the existing `Footer.astro` (it accepts the same `copyrightHtml` prop as a fallback). This module does not touch `Base.astro` itself — the owning layout agent makes the swap.
