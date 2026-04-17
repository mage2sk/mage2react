# Panth_CheckoutExtendedReact

React/Astro storefront companion for `Panth_CheckoutExtended`. Thin glue layer — depends on the parent checkout module via `<sequence>` so its extended checkout fields (order comments, gift messages, newsletter opt-in, configurable layout flags) can be consumed by the headless storefront. Ships no PHP logic.

## Storefront integration

- `frontend/src/lib/queries-checkout-extended.ts` — typed `safeParse` helpers for `cart.panth_checkout_extended { ... }` and related `storeConfig` flags. Every field is `.nullable().optional()`.
- `frontend/src/components/panth/checkout-extended/OrderCommentsField.astro` — SSR-rendered textarea that posts to the extended `setOrderCommentOnCart` mutation.
- `frontend/src/components/panth/checkout-extended/GiftMessageForm.tsx` — `client:visible` React island for the optional gift message input with to/from/message fields.

### Wiring into `/checkout/payment.astro`

Do not edit `/checkout/payment.astro` directly from this module. Either:

1. Fork the payment page and render `<OrderCommentsField cartId={cartId} />` above the place-order button, plus mount `<GiftMessageForm client:visible cartId={cartId} />` inside a collapsible trigger; or
2. Create a project-level override that composes these alongside the default payment template.

All user-supplied strings and any Magento HTML MUST pass through `sanitizeHtml()` before rendering.
