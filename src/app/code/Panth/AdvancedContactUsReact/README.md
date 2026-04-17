# Panth_AdvancedContactUsReact

React/Astro storefront companion for `Panth_AdvancedContactUs`. Surfaces the parent module's admin-configured contact form (custom fields, subject allowlist, office hours, embedded map) on the headless storefront as a drop-in SSR form plus a contact-info sidebar.

## Storefront integration

- `frontend/src/lib/queries-advanced-contact-us.ts` — typed `getContactConfig()` helper. Returns `{ fields: [{ id, label, type, required, placeholder, options }], subject_options, phone, email, hours, map_embed_url }`. Every property is `.nullable().optional()`; `safeParse` + safe empty fallback.
- `frontend/src/components/panth/advanced-contact-us/PanthContactForm.astro` — server-rendered form whose fields are driven by the admin config. POSTs to `/api/panth/contact`. Each field type (text, email, tel, textarea, select, checkbox, radio) is Zod-validated on submit before it is forwarded to Magento.
- `frontend/src/components/panth/advanced-contact-us/ContactInfoSidebar.astro` — phone, email, office-hours, and an embedded map iframe. The `map_embed_url` is validated against a strict allowlist (Google Maps / OpenStreetMap embed origins only) before it is rendered.
- `frontend/src/pages/api/panth/contact.ts` — Astro endpoint that forwards the validated submission to Magento's `panthContactSubmit` GraphQL mutation. Rate-limited to 5 requests per minute per client IP.

All labels, placeholders, and help text pass through `sanitizeHtml()` before they reach the DOM. Map iframes are rendered with `referrerpolicy="no-referrer-when-downgrade"` and a fixed `sandbox` attribute. The parent `/contact.astro` page is NOT modified by this module — to opt in, drop `<PanthContactForm />` / `<ContactInfoSidebar />` into a custom page template.
