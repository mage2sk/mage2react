# Panth_BannerSliderReact

React/Astro storefront companion for `Panth_BannerSlider`. Exposes the parent module's admin-configured banner slides on the headless storefront as both a zero-JS SSR fallback and a hydrated React carousel island.

## Storefront integration

- `frontend/src/lib/queries-banner-slider.ts` — typed `getBannerSlider(identifier)` helper. Returns `{ items: [...] }` with every slide shaped as `{ title, subtitle, image, cta_label, cta_url, alt, priority }`. Uses Zod `safeParse` + `.nullable().optional()` everywhere; never throws, returns an empty list on schema mismatch or when the parent module is absent.
- `frontend/src/components/panth/banner-slider/BannerSliderStatic.astro` — zero-JS fallback. Renders the slides in a CSS `scroll-snap-x` strip so the homepage is still usable without JS and indexable by crawlers.
- `frontend/src/components/panth/banner-slider/BannerSlider.tsx` — React island mounted with `client:idle`. Auto-advances every 6s (paused by `prefers-reduced-motion`), supports arrow-button nav, dot indicators, keyboard Left/Right, and `aria-roledescription="carousel"` / `aria-live="polite"` semantics.

Both components take an optional `identifier` prop — pass the same admin-identifier you configured in `Panth_BannerSlider`. Images render with `width`, `height`, `alt`, and `loading` set; `alt` falls back to the slide title when the admin leaves the field blank.
