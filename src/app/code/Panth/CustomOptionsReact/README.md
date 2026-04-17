# Panth_CustomOptionsReact

React/Astro storefront companion for `Panth_CustomOptions`. Thin glue layer — depends on the parent module via `<sequence>` so its advanced product-option types (color swatch picker, rich textarea, single/multi file upload, dependent options) are usable from the headless storefront. Ships no PHP logic.

## Storefront integration

- `frontend/src/lib/queries-custom-options.ts` — typed `safeParse` helpers for the extended `product.custom_options` fields (type, values with swatch hex / image, file-upload allowed extensions, etc.). Every field `.nullable().optional()`.
- `frontend/src/components/panth/custom-options/AdvancedProductOptions.tsx` — `client:visible` React island that renders every supported option type, collects values into a Magento-compatible `selected_options` / `entered_options` input, and hands them to the existing `addToCart` flow.

### Wiring into a product page

Do not edit existing PDP templates from this module. Either:

1. Fork a product page template and mount `<AdvancedProductOptions product={product} client:visible />` alongside the default add-to-cart button; the island emits a `panth:options-changed` CustomEvent that PDP code listens for; or
2. Compose this island into a bespoke product detail layout.

All option labels/descriptions returned by Magento MUST pass through `sanitizeHtml()`. File uploads in this island are placeholder-only — actual upload wiring is out of scope and must be added by the consuming page.
