# Panth_DynamicFormsReact

React/Astro storefront companion for `Panth_DynamicForms`. Renders any admin-defined custom form (text, textarea, select, checkbox, radio, file) on the headless storefront as an SSR form, with per-field type/required validation and a rate-limited submit endpoint.

## Storefront integration

- `frontend/src/lib/queries-dynamic-forms.ts` — typed `getDynamicForm(slug)` helper plus `submitDynamicForm(slug, values)`. Returns `{ slug, title, description, fields: [...] }`. Every field is `.nullable().optional()`; `safeParse` + empty fallback so a missing form slug produces a safe empty state rather than a crash.
- `frontend/src/components/panth/dynamic-forms/DynamicForm.astro` — renders the admin-defined form. Each supported field type (text, email, tel, number, date, textarea, select, checkbox, radio, file) is emitted with the correct native input and `required`/`min`/`max`/`pattern` attributes honored. Labels and help text pass through `sanitizeHtml()`.
- `frontend/src/pages/api/panth/dynamic-forms/submit.ts` — Astro endpoint that re-validates every value against the form's declared field schema, enforces a MIME/size/extension allowlist for file uploads, rate-limits to 5 requests per minute per client IP, then forwards to Magento's `panthDynamicFormSubmit` mutation.

Labels, help text, and confirmation copy all pass through `sanitizeHtml()`. File uploads enforce the same MIME/size/ext allowlist as `Panth_OrderAttachments` to keep the hardening surface consistent.
