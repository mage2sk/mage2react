# Panth_CheckoutSuccessReact

React/Astro storefront companion for `Panth_CheckoutSuccess`. Thin glue layer — depends on the parent module via `<sequence>` so its enhanced thank-you page data (ordered items thumbnails, tracking scripts, CMS block slot, social share config) can be rendered headlessly. Ships no PHP logic.

## Storefront integration

- `frontend/src/lib/queries-checkout-success.ts` — typed `safeParse` helpers for the extended `orderByNumber` / `customer { orders }` envelopes exposing `panth_checkout_success { ... }` plus store-config flags. All fields `.nullable().optional()`.
- `frontend/src/components/panth/checkout-success/ThankYouExtras.astro` — SSR-rendered social share buttons, tracking-pixel placeholder, suggested-products slot, and a sanitised CMS block pass-through.

### Wiring into `/checkout/success.astro`

Do not edit `/checkout/success.astro` from this module. Either:

1. Fork the success page and render `<ThankYouExtras order={order} />` below the order summary; or
2. Compose `<ThankYouExtras />` into a project-level success template.

Magento-authored HTML (CMS block, custom tracking scripts) is NEVER injected raw — all passes through `sanitizeHtml()` and inert `<template>` markers. Tracking pixel firing is intentionally left as a no-op placeholder; wire your own GA4/Meta Pixel integration through the `window.dataLayer` comment hook in the component.
