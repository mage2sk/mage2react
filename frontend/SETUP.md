# SETUP

## SEO coverage

Every rule below is implemented and validated in the codebase. This list is the
single source of truth when auditing the storefront's SEO posture.

### Head-tag essentials
- **Unique `<title>`** per page, composed from Magento admin prefix/suffix/separator — `src/layouts/Base.astro`.
- **Meta description** from Magento `meta_description` or a page-derived excerpt (160-char cap) — `src/layouts/Base.astro`, `src/pages/[...slug].astro`.
- **Canonical URL** always absolute, per-route — `src/components/seo/Seo.astro`.
  - Category canonical strips `?page=1`, keeps `?page=N` for N>1, excludes `sort` / `pageSize` / `dir` / `view`, and collapses layered-nav filters back to the base URL.
  - Search canonical is always the query-only URL.
- **Robots** defaults to `max-snippet:-1, max-image-preview:large, max-video-preview:-1, index, follow`; `noindex, nofollow` when `noindex` prop set; caller-overridable via `robots` prop — `src/components/seo/Seo.astro`.
- **Theme color** for mobile Chrome — `src/components/seo/Seo.astro`.

### Open Graph / Twitter
- `og:title`, `og:description`, `og:url`, `og:type`, `og:site_name`, `og:locale` on every page.
- `og:image`, `og:image:alt`, `og:image:width`, `og:image:height` when supplied; omitted entirely when the product has no image.
- `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`, optional `twitter:site` / `twitter:creator`.
- `article:published_time` / `article:modified_time` when supplied.
- `pinterest-rich-pin` opt-in — `src/components/seo/Seo.astro`.

### Pagination & multi-locale
- `<link rel="prev">` / `<link rel="next">` on paged category listings — `src/pages/[...slug].astro`.
- `<link rel="alternate" hreflang>` infrastructure ready for i18n via `alternates` prop — `src/components/seo/Seo.astro`.

### Structured data (JSON-LD)
- Organization + WebSite (with SearchAction) on the home page — `src/pages/index.astro`.
- Product + BreadcrumbList on PDPs, including `aggregateRating` (when `review_count > 0`), `priceValidUntil` (today + 365d), `itemCondition=NewCondition`, optional `brand`, and AggregateOffer for variant price ranges — `src/pages/[...slug].astro`, `src/lib/jsonld.ts`.
- CollectionPage + BreadcrumbList + ItemList on category listings.
- WebPage + BreadcrumbList on CMS pages.
- SearchResultsPage on /search (emitted even though noindex'd).
- All multi-entity pages use a single `@graph` root with stable `@id` per entity — `graphLd()` in `src/lib/jsonld.ts`.
- `safeStringify()` escapes `</script>` sequences so JSON-LD cannot terminate the tag early — `src/components/seo/Seo.astro`.

### Sitemap
- Dynamic `/sitemap.xml` built from live Magento GraphQL — `src/pages/sitemap.xml.ts`.
- Home priority 1.0, daily; categories 0.8 daily; products 0.6 weekly; CMS 0.5 monthly.
- `image:image` children per product URL (`xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`) with caption = product name.
- All URLs use canonical `https://mage2react.local` origin.
- Automatic `<sitemapindex>` fallback when entry count exceeds 50,000.

### Robots
- `/robots.txt` allows `/`, blocks `/admin`, `/checkout`, post-auth customer pages, `/wishlist`, `/compare`, `/sales/order`, `/api/`, `/offline`.
- Explicitly allows `/customer/account/login|create|forgotpassword` for brand-term SEO.
- Blocks `?sort=*` and combined `?page=*&*` to prevent duplicate-content indexing.
- `Host:` directive + absolute `Sitemap:` URL + `Crawl-delay: 0` — `src/pages/robots.txt.ts`.

### OpenSearch
- `/opensearch.xml` for browser "Add search engine" support; `<link rel="search">` emitted on every page — `src/pages/opensearch.xml.ts`, `src/components/seo/Seo.astro`.

### Image SEO
- Every `<img>` has `alt`, `width`, `height`, `loading`, `decoding="async"`.
- LCP image eager + `fetchpriority="high"`; all others lazy — `src/components/ProductCard.astro`, `src/components/product/Gallery.astro`, `src/components/product/GalleryPlaceholder.astro`, `src/layouts/Base.astro`.
- `<link rel="preload" as="image" fetchpriority="high">` for hero/PDP main image — `src/layouts/Base.astro` via `heroImage` prop (passed from home page + PDPs + paginated category first tiles).

### Performance signals
- `<link rel="preconnect">` for the Magento media origin.
- Tailwind v4 CSS inlined by Astro; no render-blocking external stylesheets.
- View Transitions via `<ClientRouter/>` — no full-page reloads between internal navigations.

### Internal linking hygiene
- Every functional `<a href>` is a real URL.
- Placeholder `#` hrefs (currently: Careers, social media icons) carry `rel="nofollow"` so PageRank isn't leaked — `src/components/Footer.astro`.
