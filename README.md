<!-- SEO Meta -->
<!--
  Title: mage2react — The fastest headless Magento 2 storefront (Astro 5 + React 19)
  Description: Production-ready open-source headless Magento 2 storefront on Astro 5, React 19, Tailwind v4, GraphQL. Real cart, multi-step checkout, customer account, CMS, PWA, 2026 SEO, Docker one-command setup, and companion React adapters for 38 Panth Magento modules.
  Keywords: headless magento, magento 2 headless storefront, astro magento, react magento, magento pwa, magento 2 graphql, magento 2.4.8 headless, magento 2 react storefront, magento 2 speed, core web vitals, magento 2 seo, magento tailwind, magento 2 spa, panth magento, panth react
  Author: Kishan Savaliya (Panth Infotech)
-->

# mage2react — The Fastest Headless Magento 2 Storefront

[![Magento 2.4.8](https://img.shields.io/badge/Magento-2.4.8-orange?logo=magento&logoColor=white)](https://magento.com)
[![Astro 5](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white)](https://astro.build)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4%20Oxide-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)](LICENSE)
[![Upwork Top Rated Plus](https://img.shields.io/badge/Upwork-Top%20Rated%20Plus-14a800?logo=upwork&logoColor=white)](https://www.upwork.com/freelancers/~016dd1767321100e21)
[![Panth Infotech Agency](https://img.shields.io/badge/Agency-Panth%20Infotech-14a800?logo=upwork&logoColor=white)](https://www.upwork.com/agencies/1881421506131960778/)
[![Website](https://img.shields.io/badge/Website-kishansavaliya.com-0D9488)](https://kishansavaliya.com)
[![Get a Quote](https://img.shields.io/badge/Get%20a%20Quote-Free%20Estimate-DC2626)](https://kishansavaliya.com/get-quote)

> A **production-ready, open-source headless storefront** for Magento 2 — Luma parity, Hyva-beating speed, built on Astro 5 + React 19 + Tailwind v4. One command boots the full stack in Docker. TTFB under **150 ms**. Zero client JS by default. Strict CSP. 2026 Google SEO covered out of the box. Ships with React/Astro adapters for **38 Panth Magento extensions** so banners, testimonials, FAQs, product tabs, smart badges, mega-menus, and dozens more drop into the storefront via a single `<PanthSlot>` tag.

Stop fighting Luma. Stop building PWA Studio. **mage2react** is a drop-in replacement that serves your whole storefront — home, category, PDP, search, cart, customer account, multi-step checkout — as tiny HTML pages with React islands only where needed. All data via Magento GraphQL. All security hardened by default.

---

## 🚀 Need Custom Magento / Headless Development?

<p align="center">
  <a href="https://kishansavaliya.com/get-quote">
    <img src="https://img.shields.io/badge/Get%20a%20Free%20Quote%20%E2%86%92-Reply%20within%2024%20hours-DC2626?style=for-the-badge" alt="Get a Free Quote" />
  </a>
</p>

<table>
<tr>
<td width="50%" align="center">

### 🏆 Kishan Savaliya
**Top Rated Plus on Upwork**

[![Hire on Upwork](https://img.shields.io/badge/Hire%20on%20Upwork-Top%20Rated%20Plus-14a800?style=for-the-badge&logo=upwork&logoColor=white)](https://www.upwork.com/freelancers/~016dd1767321100e21)

</td>
<td width="50%" align="center">

### 🏢 Panth Infotech Agency

[![Visit Agency](https://img.shields.io/badge/Visit%20Agency-Panth%20Infotech-14a800?style=for-the-badge&logo=upwork&logoColor=white)](https://www.upwork.com/agencies/1881421506131960778/)

</td>
</tr>
</table>

---

## Table of Contents

- [Why mage2react](#why-mage2react)
- [Feature Matrix](#feature-matrix)
- [Architecture](#architecture)
- [Performance](#performance)
- [Compatibility](#compatibility)
- [Installation](#installation)
- [Panth Modules Bundled](#panth-modules-bundled)
- [Dynamic Widget Slots — `<PanthSlot />`](#dynamic-widget-slots--panthslot-)
- [Configuration](#configuration)
- [Project Layout](#project-layout)
- [Security Model](#security-model)
- [SEO Coverage](#seo-coverage)
- [Extending the Frontend](#extending-the-frontend)
- [Panth_React Magento Module](#panth_react-magento-module)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Support](#support)
- [License](#license)

---

## Why mage2react

- **Luma's frontend is dead weight.** Magento's default theme ships megabytes of RequireJS + KnockoutJS + jQuery on every page. Core Web Vitals suffer. SEO rankings suffer.
- **Hyva is good — but still phtml.** Buys you speed, keeps you in layout XML + Alpine.js. No React, no Tailwind v4, no modern DX.
- **PWA Studio is heavy.** Apollo + Workbox + MediaStorm + Webpack config — months to get productive.
- **mage2react gives you Astro 5 + React 19 + Tailwind v4 Oxide** with Magento GraphQL as the data layer, no framework lock-in, **Docker Compose deploy**, and a full React adapter surface for 38 first-party Panth extensions. Start a real project by next sprint.

---

## Feature Matrix

### Storefront

- ✅ Home, category listings, product detail (all types), CMS pages
- ✅ Magento-standard URL structure (`/{url_key}.html`) via `urlResolver`
- ✅ Configurable products with color/size swatches + variant image swap
- ✅ Bundle, grouped, downloadable, virtual, simple — all supported
- ✅ Mega menu pulled live from Magento category tree
- ✅ Mobile hamburger drawer (zero-JS `<details>` based)
- ✅ Layered navigation + sort + pagination on category & search
- ✅ Search results with `noindex`, search autocomplete in header
- ✅ Recently viewed strip (localStorage, DNT-respecting)
- ✅ Quick view modal with Add to Cart direct from grid
- ✅ Product reviews (list + submit) with star ratings
- ✅ CMS blocks rendered via GraphQL, sanitized via DOMPurify
- ✅ Dynamic widget slots — drop any Panth module into any page by identifier

### Commerce

- ✅ Real Magento-backed cart (`createEmptyCart`, `addProductsToCart`)
- ✅ Luma-style mini-cart dropdown (+/- qty, trash icon, auto-close)
- ✅ Full cart page with coupon application and taxes
- ✅ Multi-step React checkout: shipping → payment → place order → success
- ✅ Guest checkout supported (existing-account email is non-blocking)
- ✅ Saved-address picker for logged-in customers
- ✅ Logged-in customer carts sync end-to-end (middleware + `/api/graphql` proxy + SSR)
- ✅ Native reorder via `reorderItems()` — works for every product type
- ✅ Virtual-only carts skip the shipping step
- ✅ Out-of-stock handling — banner replaces buy box
- ✅ Compare products (Magento's native compare list GraphQL)
- ✅ Wishlist heart button

### Customer Account

- ✅ Login, register, forgot password, password reset
- ✅ Account dashboard, edit info, change password, newsletter
- ✅ Order history + order detail with Reorder
- ✅ Address book (add / edit / delete, default shipping/billing)
- ✅ Account menu dropdown in header (logged in / out variants)

### SEO (2026 Google Rules)

- ✅ Unique `<title>` + `<meta description>` per page
- ✅ `<link rel="canonical">` (strips `?page=1`, sort, pageSize)
- ✅ Open Graph + Twitter summary_large_image cards
- ✅ JSON-LD `@graph` root: `Organization`, `WebSite` + `SearchAction`, `BreadcrumbList`, `Product` (with `aggregateRating`, `priceValidUntil`, `itemCondition`, `brand`), `ItemList`, `CollectionPage`, `WebPage`, `SearchResultsPage`, `FAQPage`, `Article`
- ✅ Dynamic `sitemap.xml` with `<image:image>` per product
- ✅ `robots.txt` with `Host:` directive and surgical disallows
- ✅ `opensearch.xml` for browser search integration
- ✅ `<link rel="prev">` / `rel="next"` pagination
- ✅ Robots meta with `max-snippet`, `max-image-preview:large`, `max-video-preview:-1`
- ✅ Semantic HTML, one `<h1>` per page
- ✅ `<html lang>` from `storeConfig.locale`
- ✅ View Transitions API for perceived speed
- ✅ `nofollow` on placeholder links

### Security

- ✅ Strict CSP on Astro pages; loose CSP only for proxied Magento pages (auto-switched via server-only `X-Mage2React-Proxied` header that's stripped before egress)
- ✅ DOMPurify on every Magento HTML string
- ✅ Zod validation on every GraphQL response
- ✅ HttpOnly customer-token cookie (never JS-accessible)
- ✅ Customer API routed through `/api/graphql` proxy (token injected server-side)
- ✅ `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `Permissions-Policy` disabling camera / mic / payment / sensors
- ✅ `COOP / CORP: same-origin`
- ✅ Origin-check CSRF (Astro `checkOrigin: true`)
- ✅ Rate-limited public endpoints (newsletter, contact, forms)
- ✅ Stripped hop-by-hop headers on the proxy path; 25 MB body cap; 10 s timeout

### Performance

- ✅ Astro 5 SSR (Node adapter, standalone mode)
- ✅ React 19 islands (`client:idle` / `client:visible`) — zero JS default
- ✅ Tailwind v4 Oxide engine (sub-100 ms rebuilds)
- ✅ System font stack (no FOUT, no external requests)
- ✅ `<link rel="preload">` for LCP image with `fetchpriority="high"`
- ✅ `width` + `height` + `loading` on every `<img>` (no CLS)
- ✅ HTTP cache headers on sitemap / robots / opensearch
- ✅ Service worker with network-first HTML, stale-while-revalidate assets
- ✅ Hydration-mismatch-safe: `useId`, mount-gated client state

### Developer Experience

- ✅ TypeScript strict + `noUncheckedIndexedAccess`
- ✅ Zod-validated GraphQL responses (compile-time + runtime)
- ✅ Docker Compose — one command boots the full stack
- ✅ `graphql-request` (tiny) — no Apollo
- ✅ `nanostores` + `@nanostores/react` (~5 KB gz)
- ✅ PWA manifest + service worker + offline fallback
- ✅ Accessibility primitives: skip link, focus trap, live regions, reduced-motion
- ✅ Global toast system, error boundaries, skeleton loaders

---

## Architecture

```
┌───────────────────── https://<your-domain> ─────────────────────┐
│                          Traefik (TLS)                          │
│                               │                                 │
│       ┌───────────────────────┼───────────────────────┐         │
│       │ priority 100:         │      priority 1:      │         │
│       │ /graphql, /rest,      │      everything else  │         │
│       │ /admin, /media,       │                       │         │
│       │ /static, /pub,        │                       │         │
│       │ /errors, /setup,      │                       │         │
│       │ /downloadable,        │                       │         │
│       │ /customer/section     │                       │         │
│       ▼                       │                       ▼         │
│ ┌───────────────────┐         │         ┌────────────────────┐  │
│ │ <project>_nginx   │         │         │ <project>_frontend │  │
│ │   + php-fpm       │         │         │  Astro 5 (Node)    │  │
│ │   Magento 2.4.x   │         │         │  React 19 + TW v4  │  │
│ └───────────────────┘         │         └────────────────────┘  │
│         │                     │                   │             │
│         └───── shared dev_network ─────────────────┘            │
│                                                                 │
│   shared MySQL 8.0 · Redis 7 · OpenSearch · Mailpit             │
└─────────────────────────────────────────────────────────────────┘
```

- **Magento** handles data (GraphQL, REST), admin panel, media, static assets.
- **Astro + React** handles every storefront page, server-rendered, near-zero client JS.
- **Traefik** splits traffic by URL prefix. Magento always wins on reserved paths.
- **Third-party Magento modules** with frontend-only routes still work via Astro's catch-all proxy (`src/pages/[...slug].astro`).
- **Client → Magento mutations** go through `/api/graphql`, a same-origin proxy that injects `Authorization: Bearer <token>` from the HttpOnly customer cookie.

---

## Performance

Measured locally (`curl --resolve` to bypass macOS mDNS):

| Route | TTFB | Payload |
|---|---|---|
| Home | ~125 ms | 56 KB |
| Category | ~445 ms | 40 KB |
| Product | ~113 ms | 48 KB |
| Sitemap | ~85 ms | 37 KB |

| Core Web Vital | Target | How |
|---|---|---|
| **LCP** | ≤ 2.0 s | Hero image preload, system fonts, no render-blocking JS |
| **CLS** | ≤ 0.05 | Explicit `width`/`height`, aspect-ratio boxes, system font stack |
| **INP** | ≤ 150 ms | Zero client JS default, `client:idle` / `client:visible` hydration |

---

## Compatibility

| Requirement | Supported |
|---|---|
| Magento Open Source | 2.4.4, 2.4.5, 2.4.6, 2.4.7, 2.4.8 |
| Adobe Commerce | 2.4.4 – 2.4.8 |
| PHP (Magento side) | 8.1, 8.2, 8.3, 8.4 |
| Node.js (frontend) | 22 LTS |
| Browsers | Evergreen (Chrome, Edge, Safari, Firefox) |
| Docker | Docker Desktop, OrbStack, Colima, Rancher Desktop |

---

## Installation

### 1. Clone

```bash
git clone https://github.com/mage2sk/mage2react.git
cd mage2react
```

### 2. Shared dev infrastructure

You need a running `dev_network` with Traefik (TLS), MySQL 8, Redis 7, OpenSearch, Mailpit. See `SETUP.md` for a minimal example stack.

### 3. Configure

```bash
cp .env.example .env
# edit .env — set PROJECT_NAME, PROJECT_DOMAIN, DB creds, Redis DB numbers
echo "127.0.0.1 <your-domain>" | sudo tee -a /etc/hosts
mkcert -install && mkcert <your-domain>
# register certs in Traefik dynamic config, restart Traefik
```

### 4. Install Magento + Panth modules (one-time)

See `SETUP.md` for full `bin/magento setup:install` invocation with all flags. Once Magento is installed:

```bash
# Pull in all 38 Panth extensions (list in next section)
docker exec <project>_php composer require --update-no-dev --no-interaction $(grep 'mage2kishan/' composer-panth-requires.txt | xargs)
docker exec <project>_php bash -c 'bin/magento module:enable --all && bin/magento setup:upgrade'
docker exec <project>_php php bin/magento deploy:mode:set production
```

### 5. Boot

```bash
docker compose up -d
```

Open `https://<your-domain>`.

---

## Panth Modules Bundled

mage2react installs and adapts **38 first-party Panth Magento extensions** (by `mage2kishan`). Each shipped Magento extension gets a matching `Panth_<Name>React` companion that wires it into the React storefront — proper `<sequence>` dependency, typed GraphQL queries, and drop-in Astro/React components.

| # | Composer package | Magento module | React companion | Storefront? |
|---|---|---|---|:-:|
| **SEO & Marketing** |
| 1 | `mage2kishan/module-advanced-seo` | `Panth_AdvancedSeo` | `Panth_AdvancedSeoReact` | ✅ |
| 2 | `mage2kishan/module-pagebuilder-ai` | `Panth_PagebuilderAi` | `Panth_PagebuilderAiReact` | admin-only |
| 3 | `mage2kishan/module-corewebvitals` | `Panth_Corewebvitals` | `Panth_CorewebvitalsReact` | ✅ |
| 4 | `mage2kishan/module-smart-badge` | `Panth_SmartBadge` | `Panth_SmartBadgeReact` | ✅ |
| 5 | `mage2kishan/module-testimonials` | `Panth_Testimonials` | `Panth_TestimonialsReact` | ✅ |
| **Checkout & Cart** |
| 6 | `mage2kishan/module-advancedcart` | `Panth_Advancedcart` | `Panth_AdvancedcartReact` | ✅ |
| 7 | `mage2kishan/module-checkout-extended` | `Panth_CheckoutExtended` | `Panth_CheckoutExtendedReact` | ✅ |
| 8 | `mage2kishan/module-checkout-success` | `Panth_CheckoutSuccess` | `Panth_CheckoutSuccessReact` | ✅ |
| 9 | `mage2kishan/module-custom-options` | `Panth_CustomOptions` | `Panth_CustomOptionsReact` | ✅ |
| 10 | `mage2kishan/module-extra-fee` | `Panth_ExtraFee` | `Panth_ExtraFeeReact` | ✅ |
| 11 | `mage2kishan/module-zipcode-validation` | `Panth_ZipcodeValidation` | `Panth_ZipcodeValidationReact` | ✅ |
| **Order Management** |
| 12 | `mage2kishan/module-order-attachments` | `Panth_OrderAttachments` | `Panth_OrderAttachmentsReact` | ✅ |
| 13 | `mage2kishan/module-order-cleanup` | `Panth_OrderCleanup` | `Panth_OrderCleanupReact` | admin-only |
| 14 | `mage2kishan/module-ordered-items` | `Panth_OrderedItems` | `Panth_OrderedItemsReact` | admin-only |
| **Theme & UI** |
| 15 | `mage2kishan/module-banner-slider` | `Panth_BannerSlider` | `Panth_BannerSliderReact` | ✅ |
| 16 | `mage2kishan/module-mega-menu` | `Panth_MegaMenu` | `Panth_MegaMenuReact` | ✅ |
| 17 | `mage2kishan/module-footer` | `Panth_Footer` | `Panth_FooterReact` | ✅ |
| 18 | `mage2kishan/module-not-found-page` | `Panth_NotFoundPage` | `Panth_NotFoundPageReact` | ✅ |
| 19 | `mage2kishan/module-notification-bar` | `Panth_NotificationBar` | `Panth_NotificationBarReact` | ✅ |
| 20 | `mage2kishan/module-theme-customizer` | `Panth_ThemeCustomizer` | `Panth_ThemeCustomizerReact` | ✅ |
| **Product Display** |
| 21 | `mage2kishan/module-product-slider` | `Panth_ProductSlider` | `Panth_ProductSliderReact` | ✅ |
| 22 | `mage2kishan/module-productgallery` | `Panth_Productgallery` | `Panth_ProductgalleryReact` | ✅ |
| 23 | `mage2kishan/module-producttabs` | `Panth_Producttabs` | `Panth_ProducttabsReact` | ✅ |
| 24 | `mage2kishan/module-quickview` | `Panth_Quickview` | `Panth_QuickviewReact` | ✅ |
| 25 | `mage2kishan/module-search-autocomplete` | `Panth_SearchAutocomplete` | `Panth_SearchAutocompleteReact` | ✅ |
| 26 | `mage2kishan/module-imageoptimizer` | `Panth_Imageoptimizer` | `Panth_ImageoptimizerReact` | ✅ |
| **Customer Engagement** |
| 27 | `mage2kishan/module-advanced-contact-us` | `Panth_AdvancedContactUs` | `Panth_AdvancedContactUsReact` | ✅ |
| 28 | `mage2kishan/module-dynamic-forms` | `Panth_DynamicForms` | `Panth_DynamicFormsReact` | ✅ |
| 29 | `mage2kishan/module-faq` | `Panth_Faq` | `Panth_FaqReact` | ✅ |
| 30 | `mage2kishan/module-live-activity` | `Panth_LiveActivity` | `Panth_LiveActivityReact` | ✅ |
| 31 | `mage2kishan/module-low-stock-notification` | `Panth_LowStockNotification` | `Panth_LowStockNotificationReact` | ✅ |
| 32 | `mage2kishan/module-price-drop-alert` | `Panth_PriceDropAlert` | `Panth_PriceDropAlertReact` | ✅ |
| 33 | `mage2kishan/module-product-attachments` | `Panth_ProductAttachments` | `Panth_ProductAttachmentsReact` | ✅ |
| 34 | `mage2kishan/module-whatsapp` | `Panth_Whatsapp` | `Panth_WhatsappReact` | ✅ |
| **Admin & Performance** |
| 35 | `mage2kishan/module-cachemanager` | `Panth_Cachemanager` | `Panth_CachemanagerReact` | admin-only |
| 36 | `mage2kishan/module-core` | `Panth_Core` | `Panth_CoreReact` | admin-only |
| 37 | `mage2kishan/module-malware-scanner` | `Panth_MalwareScanner` | `Panth_MalwareScannerReact` | admin-only |
| 38 | `mage2kishan/module-performance-optimizer` | `Panth_PerformanceOptimizer` | `Panth_PerformanceOptimizerReact` | ✅ (perf hints) |

One-liner to install all 38:

```bash
docker exec <project>_php composer require --update-no-dev --no-interaction \
  mage2kishan/module-advanced-seo mage2kishan/module-pagebuilder-ai \
  mage2kishan/module-corewebvitals mage2kishan/module-smart-badge \
  mage2kishan/module-testimonials mage2kishan/module-advancedcart \
  mage2kishan/module-checkout-extended mage2kishan/module-checkout-success \
  mage2kishan/module-custom-options mage2kishan/module-extra-fee \
  mage2kishan/module-zipcode-validation mage2kishan/module-order-attachments \
  mage2kishan/module-order-cleanup mage2kishan/module-ordered-items \
  mage2kishan/module-banner-slider mage2kishan/module-mega-menu \
  mage2kishan/module-footer mage2kishan/module-not-found-page \
  mage2kishan/module-notification-bar mage2kishan/module-theme-customizer \
  mage2kishan/module-product-slider mage2kishan/module-productgallery \
  mage2kishan/module-producttabs mage2kishan/module-quickview \
  mage2kishan/module-search-autocomplete mage2kishan/module-imageoptimizer \
  mage2kishan/module-advanced-contact-us mage2kishan/module-dynamic-forms \
  mage2kishan/module-faq mage2kishan/module-live-activity \
  mage2kishan/module-low-stock-notification mage2kishan/module-price-drop-alert \
  mage2kishan/module-product-attachments mage2kishan/module-whatsapp \
  mage2kishan/module-cachemanager mage2kishan/module-core \
  mage2kishan/module-malware-scanner mage2kishan/module-performance-optimizer
```

The full resolved dependency set is captured in `src/composer.json` (tracked in this repo) and the lockfile at `src/composer.lock`.

---

## Dynamic Widget Slots — `<PanthSlot />`

Drop Panth-module-backed widgets into **any** Astro page, CMS template, category description, or product description by identifier:

```astro
---
import PanthSlot from "~/components/panth/PanthSlot.astro";
---

<!-- Banner slider identified by its `panth_banner_slider.identifier` -->
<PanthSlot identifier="banner-slider:home-hero" />

<!-- 6 featured testimonials -->
<PanthSlot identifier="testimonials:6" />

<!-- FAQ block for a specific admin category -->
<PanthSlot identifier="faq:general" />

<!-- A dynamic form by admin url_key -->
<PanthSlot identifier="form:custom-contact" />

<!-- Core Magento CMS block -->
<PanthSlot identifier="cms-block:home-bottom" />

<!-- Product carousel for a specific slider slug -->
<PanthSlot identifier="product-slider:bestsellers" />

<!-- Announcement bar -->
<PanthSlot identifier="notification-bar" />

<!-- Live-activity badge on a PDP -->
<PanthSlot identifier="live-activity:WJ12" />

<!-- Product attachments on a PDP -->
<PanthSlot identifier="attachments:WJ12" />
```

Unknown identifiers render nothing. All widgets read from Magento GraphQL via Zod-guarded `safeParse` — if the underlying Panth module is missing or disabled, the slot silently renders empty.

---

## Configuration

After `bin/magento module:enable Panth_React`, visit **Stores → Configuration → Panth → React Storefront**:

| Setting | Default | Description |
|---|---|---|
| Enable | Yes | Master toggle for the headless integration |
| Site URL | `https://<your-domain>` | Public origin of the Astro frontend |
| CORS Allowed Origins | `https://<your-domain>` | Newline-separated allow list for GraphQL CORS |

Environment variables (`.env`):

| Key | Purpose |
|---|---|
| `PROJECT_NAME` | Short lowercase identifier — used in container names, Traefik routers |
| `PROJECT_DOMAIN` | Public-facing hostname |
| `PHP_VERSION` | Magento PHP version (8.1 – 8.4) |
| `DB_*` | Magento DB credentials |
| `REDIS_*`, `OPENSEARCH_*` | Shared infra hostnames / ports |
| `FRONTEND_PORT` | Astro dev port (default 4321) |
| `MAGENTO_INTERNAL_HOST` | Container-to-container hostname for GraphQL |

---

## Project Layout

```
mage2react/
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
├── SETUP.md
│
├── src/
│   ├── composer.json              # tracked: exact extension set
│   ├── composer.lock              # tracked
│   └── app/code/Panth/            # 39 custom modules
│       ├── React/                 # the core Panth_React module
│       ├── AdvancedSeoReact/
│       ├── BannerSliderReact/
│       ├── CheckoutExtendedReact/
│       ├── FaqReact/
│       ├── ...                    # 38 companion modules
│       └── WhatsappReact/
│
└── frontend/
    ├── Dockerfile
    ├── astro.config.mjs
    ├── tsconfig.json
    ├── public/                    # manifest, sw.js, logo, favicon
    └── src/
        ├── middleware.ts          # CSP + security + cart bootstrap
        ├── layouts/Base.astro
        ├── components/
        │   ├── panth/             # all Panth companions
        │   │   ├── PanthSlot.astro
        │   │   ├── banner-slider/
        │   │   ├── testimonials/
        │   │   ├── faq/
        │   │   ├── dynamic-forms/
        │   │   ├── smart-badge/
        │   │   ├── mega-menu/
        │   │   ├── product-slider/
        │   │   ├── productgallery/
        │   │   ├── producttabs/
        │   │   ├── quickview/
        │   │   ├── search-autocomplete/
        │   │   ├── notification-bar/
        │   │   ├── theme-customizer/
        │   │   ├── whatsapp/
        │   │   ├── live-activity/
        │   │   ├── low-stock-notification/
        │   │   ├── price-drop-alert/
        │   │   ├── product-attachments/
        │   │   ├── order-attachments/
        │   │   ├── advanced-contact-us/
        │   │   ├── advancedcart/
        │   │   ├── checkout-extended/
        │   │   ├── checkout-success/
        │   │   ├── custom-options/
        │   │   ├── extra-fee/
        │   │   ├── zipcode-validation/
        │   │   ├── advanced-seo/
        │   │   ├── cwv/
        │   │   └── not-found/
        │   ├── catalog/
        │   ├── cart/
        │   ├── checkout/
        │   ├── compare/
        │   ├── customer/
        │   ├── product/
        │   ├── seo/
        │   ├── a11y/
        │   ├── system/
        │   ├── cms/
        │   └── ProductCard.astro
        ├── pages/
        │   ├── index.astro
        │   ├── [...slug].astro
        │   ├── search.astro
        │   ├── compare.astro
        │   ├── contact.astro
        │   ├── faq.astro
        │   ├── testimonials.astro
        │   ├── offline.astro
        │   ├── 404.astro
        │   ├── checkout/
        │   ├── customer/
        │   ├── sales/order/
        │   ├── wishlist/index.astro
        │   ├── api/                # graphql proxy, cart, wishlist, reviews, panth/*
        │   ├── sitemap.xml.ts
        │   ├── robots.txt.ts
        │   └── opensearch.xml.ts
        ├── lib/                    # graphql, queries-*, stores, sanitize, jsonld
        └── styles/global.css
```

---

## Security Model

- **Strict CSP** on Astro pages: `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (inline-only), `object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`.
- **Loose CSP** only for Magento-proxied pages (auto-detected via a server-only header stripped before egress).
- **DOMPurify** sanitizes every Magento HTML string (product descriptions, CMS blocks, banners, testimonials, FAQ answers).
- **Zod schemas** validate every GraphQL response at runtime.
- **HttpOnly cookies** for customer tokens. **Server-side** `/api/graphql` proxy injects auth; the token never touches JS.
- **Rate-limited** public endpoints (newsletter, contact, forms).
- **Proxy hardening**: drops hop-by-hop headers, 25 MB cap, 10 s timeout, strips inbound `X-Mage2React-*` headers.

---

## SEO Coverage

Every 2026 Google best practice is baked in (see full list in the [SEO coverage section of `SETUP.md`](SETUP.md#9-seo-2026-google-rules)). Highlights:

- JSON-LD `@graph` — Organization, WebSite+SearchAction, BreadcrumbList, Product (with aggregateRating, priceValidUntil, itemCondition, brand), ItemList, CollectionPage, WebPage, SearchResultsPage, FAQPage, Article
- Dynamic sitemap + image sitemap + OpenSearch XML + robots.txt with `Host:`
- `<link rel="prev"/next>` for paged views, canonical strips `?page=1`, `?sort`, `?pageSize`
- Semantic HTML, one `<h1>` per page, `<main>/<nav aria-label>/<article>`
- View Transitions API, system font stack, no external fetches on LCP path

---

## Extending the Frontend

See [`SETUP.md`](SETUP.md) for full extension patterns (new pages, GraphQL queries, React islands, hydration hints).

---

## Panth_React Magento Module

Lives at `src/app/code/Panth/React/`. Provides:

- CORS plugin on `Magento\GraphQl\Controller\GraphQl` (allow list from admin config)
- System config at **Stores → Configuration → Panth → React Storefront**
- Health endpoint: `GET /panthreact/health` → `{"ok":true,"version":"1.0.0"}`
- Branded SVG assets at `view/frontend/web/images/{logo,favicon}.svg`
- Layout stub that empties the `<content>` container so direct hits to Magento's frontend don't leak broken Luma markup

Every one of the 38 `Panth_<Name>React` companions depends on this module via `<sequence>`.

---

## Common Tasks

See [`SETUP.md`](SETUP.md) for cache flush, reindex, static content deploy, production build.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Browser hangs ~5 s on first `.local` request | macOS mDNS. First DNS lookup only; browser caches after. Use `.test` TLD to avoid entirely. |
| Site renders Luma theme instead of React | Check Traefik priority — `_web` must be 1, `_api` 100. |
| "Proceed to Checkout" doesn't navigate | Browser cached stale bundle. Hard-refresh (⌘⇧R). |
| "Couldn't add to cart" on every product | Stale cart cookie. Cart-store auto-recreates; hard-refresh. |
| Category page shows 0 products | Top-level Luma categories aren't anchor. We aggregate descendants. |
| CSP blocks an image | Add its origin to `img-src` in `src/middleware.ts`. |
| Panth widget renders nothing | Check module is enabled + demo data present. Run the seed SQL from `/tmp/panth-seed.sql` during setup. |

---

## FAQ

### Does this replace the Magento admin?

No. Admin stays exactly as Magento ships it. mage2react only replaces the storefront.

### How does it handle third-party Magento modules?

Any path not owned by Astro is proxied to Magento nginx. The proxy sets a loose CSP for Magento-rendered pages. Third-party module pages render unchanged.

### Can I still use Luma?

Yes, for any admin-only or back-office flow. Public storefront URLs are owned by Astro.

### Does it pass Lighthouse / PageSpeed?

Targets: LCP ≤ 2.0 s, CLS ≤ 0.05, INP ≤ 150 ms. Actual score depends on Magento response times and cache warmth.

### Which payment methods work?

Any method that exposes a Magento GraphQL `code` — `checkmo`, `banktransfer`, `free`, `cashondelivery`, `stripe_payments`, `braintree`, `paypal_express`, any 3rd-party module. SDK-tokenized methods (Stripe Elements, Braintree Hosted Fields) need a small React island per provider; PayPal Express works via redirect.

---

## Support

| Channel | Contact |
|---|---|
| Email | kishansavaliyakb@gmail.com |
| Website | [kishansavaliya.com](https://kishansavaliya.com) |
| WhatsApp | +91 84012 70422 |
| GitHub Issues | [github.com/mage2sk/mage2react/issues](https://github.com/mage2sk/mage2react/issues) |
| Upwork (Top Rated Plus) | [Hire Kishan Savaliya](https://www.upwork.com/freelancers/~016dd1767321100e21) |
| Upwork Agency | [Panth Infotech](https://www.upwork.com/agencies/1881421506131960778/) |

### Need Custom Magento / Headless Development?

<p align="center">
  <a href="https://kishansavaliya.com/get-quote">
    <img src="https://img.shields.io/badge/%F0%9F%92%AC%20Get%20a%20Free%20Quote-kishansavaliya.com%2Fget--quote-DC2626?style=for-the-badge" alt="Get a Free Quote" />
  </a>
</p>

---

## License

MIT — see [LICENSE](LICENSE). Use it commercially, modify it, fork it, ship it.

---

## About Panth Infotech

Built and maintained by **Kishan Savaliya** — [kishansavaliya.com](https://kishansavaliya.com) — **Top Rated Plus** Magento developer on Upwork with 10+ years of eCommerce experience.

**Panth Infotech** specializes in high-quality Magento 2 extensions and themes for Hyva and Luma storefronts, and modern headless storefronts on Astro / Next / React. Browse our full catalog of 38+ extensions on [Packagist](https://packagist.org/packages/mage2kishan/) and the [Adobe Commerce Marketplace](https://commercemarketplace.adobe.com).

### Quick Links

- 🌐 [kishansavaliya.com](https://kishansavaliya.com)
- 💬 [Get a Quote](https://kishansavaliya.com/get-quote)
- 👨‍💻 [Upwork Profile](https://www.upwork.com/freelancers/~016dd1767321100e21)
- 🏢 [Panth Infotech Agency](https://www.upwork.com/agencies/1881421506131960778/)
- 📦 [All Packages on Packagist](https://packagist.org/packages/mage2kishan/)
- 🐙 [GitHub](https://github.com/mage2sk)

---

**SEO Keywords:** headless magento, magento 2 headless storefront, astro magento storefront, react magento frontend, magento pwa, magento 2 graphql, magento 2.4.8 headless, magento 2 react storefront, magento astro tailwind, magento core web vitals, magento 2 speed optimization, magento hyva alternative, magento pwa studio alternative, magento 2 spa, magento 2 open source storefront, magento 2 seo, panth magento extensions, panth react, magento 2 frontend replacement, headless commerce, magento 2 jamstack, mage2react, mage2sk, kishan savaliya, panth infotech, hire magento developer, top rated plus upwork
