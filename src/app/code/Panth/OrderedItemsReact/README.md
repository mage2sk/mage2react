# Panth_OrderedItemsReact

React/Astro companion scaffold for `Panth_OrderedItems`. The parent module renders an "Items" column in the admin Sales > Orders grid so operators can see ordered SKUs at-a-glance without drilling into each order.

## Storefront integration

**Admin order-grid column; no storefront integration needed.** The feature is scoped entirely to the Magento admin UI and exists to speed up the back-office workflow. Customer-facing order pages (`/sales/order/view/:number`) already render order items via native GraphQL, so there is nothing to port to the headless storefront.

This companion exists purely so that a project-wide `composer require panth/module-*-react` sweep pulls a matching React adapter for every Panth module without a gap.

## What this module ships

- `registration.php` — registers `Panth_OrderedItemsReact` with the module registrar.
- `etc/module.xml` — declares `<sequence>` on `Panth_React` and `Panth_OrderedItems`.
- `composer.json` — requires `panth/module-ordered-items` and `panth/module-react`.

No PHP logic. No frontend files. No GraphQL extensions.
