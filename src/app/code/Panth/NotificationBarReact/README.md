# Panth_NotificationBarReact

React/Astro storefront companion for `Panth_NotificationBar`. Renders the admin-configured top-of-page announcement bars on the headless storefront with a zero-JS SSR fallback and a React island that adds dismissal + expiry.

## Storefront integration

- `frontend/src/lib/queries-notification-bar.ts` — typed `getNotificationBars()` helper. Returns `[{ id, message, link, bg_color, text_color, dismissible, priority, start_at, end_at }]`. `.nullable().optional()` everywhere, `safeParse`, empty fallback.
- `frontend/src/components/panth/notification-bar/NotificationBarSSR.astro` — zero-JS fallback. Renders the highest-priority currently-active bar from SSR data; no hydration needed.
- `frontend/src/components/panth/notification-bar/NotificationBar.tsx` — React island mounted with `client:idle`. Shows all active bars stacked (paginated client-side one at a time), persists dismissed ids in `localStorage`, drops expired bars against the client clock, and validates `bg_color` / `text_color` against a strict allowlist (hex + named CSS colors). Message HTML is piped through `sanitizeHtml()`.

**Wiring:** place `<NotificationBarSSR />` at the very top of the `Base.astro` `<body>` (above `<Header />`) for guaranteed SSR rendering, and mount `<NotificationBar client:idle />` right after it if you want the dismissable client experience. This module does not edit `Base.astro`.
