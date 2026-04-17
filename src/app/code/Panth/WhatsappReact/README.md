# Panth_WhatsappReact

React/Astro storefront companion for `Panth_Whatsapp`. Surfaces the parent module's WhatsApp-chat integration on the headless storefront as a floating corner button.

## Storefront integration

- `frontend/src/lib/queries-whatsapp.ts` — typed `getWhatsappConfig()` helper. Returns `{ enabled, phone, message_template, position, button_color }`. Every field is `.nullable().optional()`; `safeParse` + safe defaults fallback.
- `frontend/src/components/panth/whatsapp/WhatsappButton.tsx` — React island mounted with `client:idle`. Renders a floating button in the configured corner (`bottom-right`, `bottom-left`, `top-right`, `top-left`). Clicking opens `https://wa.me/{phone}?text={encoded message}` in a new tab with `rel="noopener noreferrer"`. Phone numbers are validated (`+` + 7-15 digits), `button_color` is validated against a strict hex/named-color allowlist, and the component renders nothing if the admin has disabled the module or the phone fails validation. Fully labelled for accessibility (`aria-label`, focus ring, keyboard-reachable).

Add `<WhatsappButton client:idle />` to `Base.astro` (or any layout) once — this module never edits `Base.astro`.
