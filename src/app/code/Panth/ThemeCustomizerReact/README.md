# Panth_ThemeCustomizerReact

React/Astro storefront companion for `Panth_ThemeCustomizer`. Pulls admin-configured design tokens (brand colors, accent, fonts, radius) from GraphQL and emits them as CSS custom properties on `:root` for Tailwind v4's `bg-[var(--color-brand)]` pattern to consume.

## Storefront integration

- `frontend/src/lib/queries-theme-customizer.ts` — typed `getThemeTokens()` helper. Returns `{ colors: { brand, accent, fg, bg, muted, border }, fonts: { body, heading }, radius }` with all entries `.nullable().optional()`. Every color is validated against a safe allowlist (hex, `rgb()`, `rgba()`, `oklch()`, named CSS colors); fonts are stripped of any character that could escape into CSS (`{`, `}`, `;`). Unsafe values are dropped, never passed through.
- `frontend/src/components/panth/theme-customizer/ThemeStyle.astro` — SSR-only Astro component. Emits a single `<style>:root { --color-brand: ...; ... }</style>` block based on the validated tokens. Zero JS, zero client bundle.

**Wiring:** include `<ThemeStyle />` inside `<head>` in `src/layouts/Base.astro` — after the base stylesheet and before anything else that references custom properties. This module does not edit `Base.astro`; the layout owner adds the import.
