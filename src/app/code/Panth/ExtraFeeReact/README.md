# Panth_ExtraFeeReact

React/Astro storefront companion for `Panth_ExtraFee`. Thin glue layer — depends on the parent module via `<sequence>` so its configurable surcharges (gift wrap, handling fee, small-order fee, etc.) are usable by the headless storefront. Ships no PHP logic.

## Storefront integration

- `frontend/src/lib/queries-extra-fee.ts` — typed `safeParse` helpers for the extended `cart.panth_extra_fees { code label price selected required }` envelope and related `storeConfig` flags. All fields `.nullable().optional()`.
- `frontend/src/components/panth/extra-fee/ExtraFeeSelector.tsx` — `client:idle` React island that lists optional fees with accessible checkboxes, posts selections via the extended `updateExtraFeesOnCart` mutation, and refreshes the shared `cart-store` totals.

### Wiring into the cart page

Do not edit `frontend/src/pages/checkout/cart.astro` from this module. Either:

1. Fork the cart page and mount `<ExtraFeeSelector client:idle cartId={cartId} />` above `<CartSummary />`; or
2. Compose this island into a bespoke cart template.

Magento-authored fee labels/descriptions MUST pass through `sanitizeHtml()` before rendering. All price values are safe-parsed and coerced to `0` on mismatch so a malformed fee never blocks checkout.
