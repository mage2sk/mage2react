# Panth_OrderCleanupReact

React/Astro companion scaffold for `Panth_OrderCleanup`. The parent module exposes an admin-only order-deletion workflow (acl-gated mass action in the Sales > Orders grid).

## Storefront integration

**No storefront integration.** The parent module is admin-only. This companion exists purely so that a project-wide `composer require panth/module-*-react` sweep pulls a matching React adapter for every Panth module without a gap.

If a future requirement surfaces a customer-facing cancellation flow, add it here behind an explicit opt-in flag in `storeConfig` and never implicitly delete orders from the storefront.

## What this module ships

- `registration.php` — registers `Panth_OrderCleanupReact` with the module registrar.
- `etc/module.xml` — declares `<sequence>` on `Panth_React` and `Panth_OrderCleanup`.
- `composer.json` — requires `panth/module-order-cleanup` and `panth/module-react`.

No PHP logic. No frontend files. No GraphQL extensions.
