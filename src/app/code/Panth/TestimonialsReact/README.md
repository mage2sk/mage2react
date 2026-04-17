# Panth_TestimonialsReact

React/Astro storefront companion for `Panth_Testimonials`. Surfaces the parent module's `panthTestimonials` GraphQL list on the headless storefront as a dedicated page plus a reusable horizontal-scroll slider component.

## Storefront integration

- `frontend/src/lib/queries-testimonials.ts` — typed `getTestimonials(pageSize, currentPage)` helper with Zod safe-parsing. Returns an empty page on any schema mismatch, so callers never crash.
- `frontend/src/pages/testimonials.astro` — SSR grid of cards at `/testimonials`. Reads `?page=` for pagination. Every testimonial renders photo, name, 5-star rating, title, and sanitized body. Customer photos use `width`/`height`/`alt`/`loading` and fall back to an inline SVG avatar when absent.
- `frontend/src/components/panth/testimonials/TestimonialsSlider.astro` — horizontal scroll-snap slider intended for use on the home page or landing sections. Auto-fallback: renders nothing when the parent module returns zero items or is not installed.

All testimonial bodies and titles pass through `sanitizeHtml()` before they hit the DOM. The 5-star rating is rendered with inline SVGs (no icon fonts).
