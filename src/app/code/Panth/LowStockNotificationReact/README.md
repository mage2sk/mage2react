# Panth_LowStockNotificationReact

React/Astro storefront companion for `Panth_LowStockNotification`. Surfaces the parent module's back-in-stock email-subscription flow on the headless storefront as a PDP island that only mounts when the product is out of stock.

## Storefront integration

- `frontend/src/lib/queries-low-stock-notification.ts` — typed `subscribeLowStock(sku, email, token?)` helper. Forwards to Magento's `panthLowStockSubscribe` GraphQL mutation. Returns `{ ok, message }` with a friendly fallback copy on schema miss.
- `frontend/src/components/panth/low-stock-notification/BackInStockForm.tsx` — React island mounted with `client:idle` when `stock_status !== 'IN_STOCK'`. Renders an email field + submit button. Pre-fills with the signed-in customer's email via a fetch to `/api/customer/me` (never touches the HttpOnly token cookie directly).

**PDP wiring (not done by this module):** on your product detail page, only when the product is out of stock, insert:

```astro
{product.stock_status !== "IN_STOCK" && <BackInStockForm sku={product.sku} client:idle />}
```

This module never edits the existing PDP template.
