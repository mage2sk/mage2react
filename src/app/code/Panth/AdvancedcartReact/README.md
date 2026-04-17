# Panth_AdvancedcartReact

React/Astro storefront companion for `Panth_AdvancedCart`. A thin glue layer: it depends on the parent cart module via `<sequence>` so its GraphQL extensions (free-shipping threshold, applied promotions, savings total, estimated delivery, trust badges) can be consumed safely by the headless storefront. Ships no PHP logic of its own.

## Storefront integration

- `frontend/src/lib/queries-advancedcart.ts` — typed `safeParse` helpers for the extended `cart.panth_advanced_cart { ... }` envelope plus store-config flags. Every field is `.nullable().optional()` because we cannot verify the parent schema at build time; missing fields never crash the UI.
- `frontend/src/components/panth/advancedcart/CartPromotionsBanner.astro` — SSR-rendered summary of applied promotions/coupons, savings total, and trust-badge line. Emits nothing when the parent module is disabled.
- `frontend/src/components/panth/advancedcart/FreeShippingProgress.tsx` — `client:idle` React island that visualises progress toward the free-shipping threshold and reacts to cart mutations via the shared `cart-store`.

### Wiring into cart/minicart

Do not edit the existing cart, minicart, or checkout Astro/TSX files from this module. Either:

1. Fork the cart page template in `frontend/src/pages/checkout/cart.astro` and render `<CartPromotionsBanner cart={cart} />` above `<CartSummary />`, and mount `<FreeShippingProgress client:idle />` in the summary rail; or
2. Wrap your own cart layout with these components.

Any Magento HTML returned from the extended schema MUST be passed through `sanitizeHtml()` (`frontend/src/lib/sanitize.ts`) before injection.
