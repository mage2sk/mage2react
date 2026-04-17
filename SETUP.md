# mage2react — Setup & Operations Guide

A headless Magento 2 + Astro 5 storefront, tuned for 2026 Google Core Web Vitals, hardened against injection, and ready to run with one command.

---

## 1. What this project is

```
┌───────────────────── https://<your-domain> ─────────────────────┐
│                                                                 │
│                          Traefik (TLS)                          │
│                               │                                 │
│       ┌───────────────────────┼───────────────────────┐         │
│       │ priority 100:         │     priority 1:       │         │
│       │ /graphql, /rest,      │     everything else   │         │
│       │ /admin, /media,       │                       │         │
│       │ /static, /pub,        │                       │         │
│       │ /errors, /setup       │                       │         │
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

- **Magento** handles: data (GraphQL/REST), admin panel, media, static assets — nothing else.
- **Astro** handles: every storefront page (home, category, PDP, search, cart, static pages), server-rendered, near-zero client JS.
- **Traefik** splits traffic by URL prefix — Magento paths always beat Astro (priority 100 vs 1).
- **Third-party Magento modules with frontend-only routes** still work via the Astro catch-all proxy.

---

## 2. Prerequisites

1. **Docker** (Docker Desktop, OrbStack, or equivalent).
2. **mkcert** installed and trusted by your browser: `brew install mkcert && mkcert -install`.
3. A **shared dev infrastructure** network (Traefik + MySQL + Redis + OpenSearch + Mailpit) reachable as `dev_network`. If you don't already run one, you can scaffold it from the project's `docker-compose` file once you provide real credentials in `.env`.
4. A **hosts entry** pointing your chosen domain at `127.0.0.1`:
   ```
   127.0.0.1 <your-domain>
   ```
5. A **TLS cert** for `<your-domain>` trusted by your local CA (mkcert works great), registered with your Traefik dynamic config.

---

## 3. Configure

Copy the example env and fill in your own values:

```bash
cp .env.example .env
```

Set the following (see `.env.example` for defaults):

```
PROJECT_NAME=<short-lowercase-name>
PROJECT_DOMAIN=<your-domain>
PHP_VERSION=8.3

DB_HOST=mysql
DB_NAME=<your-db>
DB_USER=<your-user>
DB_PASSWORD=<your-password>

OPENSEARCH_HOST=opensearch
OPENSEARCH_PORT=9200

REDIS_HOST=redis
REDIS_PORT=6379

BASE_URL=https://<your-domain>/
FRONTEND_PORT=4321
MAGENTO_INTERNAL_HOST=${PROJECT_DOMAIN}
```

**Never commit the real `.env` file.** It's in `.gitignore`.

---

## 4. Start / stop

```bash
# first-time setup (after Magento is installed, see §5)
docker compose up -d

# stop everything
docker compose down

# rebuild just the frontend image
docker compose build frontend && docker compose up -d frontend

# tail logs
docker compose logs -f frontend
docker compose logs -f nginx
```

Then open `https://<your-domain>`.

- **Admin panel**: `https://<your-domain>/admin` — set your own admin credentials at install time.
- **GraphQL**: POST `https://<your-domain>/graphql`.

---

## 5. One-time Magento install

Inside the PHP container, run `bin/magento setup:install` with your chosen DB / Redis / OpenSearch / admin values. Replace every placeholder below with your own:

```bash
docker exec <project>_php php /var/www/html/bin/magento setup:install \
  --base-url=https://<your-domain>/ \
  --base-url-secure=https://<your-domain>/ \
  --use-secure=1 \
  --use-secure-admin=1 \
  --db-host=mysql \
  --db-name=<your-db> \
  --db-user=<your-user> \
  --db-password=<your-password> \
  --admin-firstname=<First> \
  --admin-lastname=<Last> \
  --admin-email=<your@email> \
  --admin-user=<admin-user> \
  --admin-password='<strong-admin-password>' \
  --language=en_US --currency=USD --timezone=UTC --use-rewrites=1 \
  --search-engine=opensearch \
  --opensearch-host=opensearch --opensearch-port=9200 \
  --opensearch-index-prefix=<your-db> \
  --session-save=redis --session-save-redis-host=redis \
  --session-save-redis-port=6379 --session-save-redis-db=<unique-int> \
  --cache-backend=redis --cache-backend-redis-server=redis \
  --cache-backend-redis-db=<unique-int> \
  --page-cache=redis --page-cache-redis-server=redis \
  --page-cache-redis-db=<unique-int> \
  --backend-frontname=admin
```

Then switch to production mode:

```bash
docker exec <project>_php php /var/www/html/bin/magento deploy:mode:set production
```

---

## 6. Project layout

```
<project>/
├── .env                   # PROJECT_NAME, DB creds, Redis, ports (gitignored)
├── .env.example           # template
├── docker-compose.yml     # nginx + php-fpm + frontend
├── Dockerfile             # Magento PHP-FPM image
├── nginx.conf             # Magento nginx vhost
├── SETUP.md               # this file
│
├── src/                   # Magento 2.x root (gitignored except Panth module)
│   └── app/code/Panth/React/    # our Magento module — CORS + storefront config
│
└── frontend/              # Astro 5 storefront
    ├── Dockerfile
    ├── package.json
    ├── astro.config.mjs
    ├── tsconfig.json
    └── src/
        ├── middleware.ts          # CSP + security headers
        ├── layouts/Base.astro
        ├── components/
        │   ├── ProductCard.astro
        │   ├── CartDrawer.tsx     # Mini cart React island
        │   ├── AddToCartButton.tsx
        │   ├── Toaster.tsx
        │   ├── Footer.astro
        │   ├── Newsletter.tsx
        │   ├── SearchBox.tsx
        │   ├── seo/
        │   ├── product/           # gallery, options, reviews, recently viewed
        │   ├── cart/              # cart page
        │   ├── checkout/          # shipping/payment/summary
        │   ├── catalog/           # layered nav, toolbar, pagination
        │   ├── customer/          # forms, side nav, account menu
        │   ├── compare/
        │   ├── cms/
        │   ├── a11y/              # skip link, focus trap, live region
        │   └── system/            # error boundary, skeletons, PWA register
        ├── pages/
        │   ├── index.astro              # home
        │   ├── [...slug].astro          # Magento URL resolver
        │   ├── search.astro
        │   ├── compare.astro
        │   ├── contact.astro
        │   ├── offline.astro
        │   ├── 404.astro
        │   ├── checkout/                # cart, shipping, payment, success
        │   ├── customer/                # login, create, account, address, etc.
        │   ├── sales/order/             # history, detail
        │   ├── wishlist/index.astro
        │   ├── api/                     # server routes (customer, wishlist, etc.)
        │   ├── sitemap.xml.ts
        │   ├── robots.txt.ts
        │   └── opensearch.xml.ts
        ├── lib/                         # graphql, queries-*, stores, sanitize
        └── styles/global.css
```

---

## 7. How the stack delivers "super fast"

| Concern            | How we solved it                                                              |
| ------------------ | ----------------------------------------------------------------------------- |
| **LCP**            | Hero/PDP image preloaded with `fetchpriority="high"`; no external font fetch  |
| **CLS**            | `width`+`height` on every `<img>`; system-font stack (no FOUT)                |
| **INP**            | Zero client JS by default; `client:idle`/`client:visible` hydration only      |
| **TTFB**           | Astro SSR; container-to-container GraphQL; Magento full-page + query caches   |
| **Small bundle**   | Only React 19 + nanostores (~5 KB gz); no Apollo/framer/lodash/moment         |
| **Tailwind speed** | Tailwind v4 Oxide engine, JIT via `@tailwindcss/vite`                         |
| **View transit.**  | Astro's `<ClientRouter />` for SPA-style transitions with no router library   |

---

## 8. Security model

- **Strict CSP for Astro pages**: `default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`.
- **Loose CSP for Magento-proxied pages**: activated only when the fallback proxy sets `X-Mage2React-Proxied: 1` (header stripped before leaving). Needed because Luma uses inline RequireJS.
- **XSS hardening**: all Magento HTML (product descriptions, CMS blocks) runs through `sanitizeHtml()` (DOMPurify). Strips `<script>`, `<iframe>`, `style`, `on*` attrs.
- **Zod validation** on every GraphQL response.
- **Fallback proxy** drops hop-by-hop headers, rejects non-GET/POST/HEAD, caps body at 25 MB, 10 s timeout, strips any incoming `X-Mage2React-*` headers.
- **CORS** on `/graphql` is admin-configurable (Stores → Configuration → Panth → React Storefront), never `*`.
- **Other headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive, `COOP/CORP: same-origin`.

Audit live: `curl -skI https://<your-domain>/ | grep -i -E "content-security|x-|referrer|permissions"`.

---

## 9. SEO (2026 Google rules)

Each page ships:

- Unique `<title>` + `<meta description>`.
- `<link rel="canonical">` (auto-computed from `PUBLIC_SITE_URL` + pathname).
- Open Graph + Twitter summary_large_image cards.
- `<html lang="en">`, `viewport-fit=cover`, `theme-color`.
- **JSON-LD structured data** per page type (Organization, WebSite + SearchAction, BreadcrumbList, Product, ItemList, CollectionPage, WebPage, SearchResultsPage).
- `/sitemap.xml` — dynamically built from GraphQL (capped at 10k URLs).
- `/robots.txt` — disallows `/admin`, `/checkout`, `/customer/account`, `/api`, `/sales/order`.
- `/opensearch.xml` for browser-level search integration.
- Semantic HTML, one `<h1>` per page, landmark `<main>/<nav>/<article>`.
- View Transitions via `<ClientRouter />`.

---

## 10. Extending the frontend

### Add a new page

Create `src/pages/about.astro`:

```astro
---
import Base from "~/layouts/Base.astro";
---
<Base title="About" description="About us.">
  <h1 class="text-3xl font-bold">About</h1>
  <p class="mt-4">Our story…</p>
</Base>
```

### Add a GraphQL query

1. Add to `src/lib/queries.ts` (or a new `queries-<domain>.ts`):

```ts
const Schema = z.object({ /* shape */ });

export async function getCmsBlock(identifier: string) {
  const doc = /* GraphQL */ `
    query CmsBlock($id: String!) {
      cmsBlocks(identifiers: [$id]) { items { identifier content } }
    }
  `;
  const raw = await query<unknown>(doc, { id: identifier });
  return Schema.parse(raw);
}
```

2. Use it in any `.astro` or React component:

```astro
---
import { getCmsBlock } from "~/lib/queries";
const block = await getCmsBlock("home-hero");
---
<section set:html={sanitizeHtml(block.cmsBlocks.items[0]?.content ?? "")} />
```

### Add an interactive React island

- `client:idle` — after main thread idle (default for header widgets).
- `client:visible` — when scrolled into view (default for below-fold).
- Avoid `client:load` unless truly always-critical.

---

## 11. Magento `Panth_React` module

Location: `src/app/code/Panth/React/`. Provides:

- CORS plugin on `Magento\GraphQl\Controller\GraphQl` (allow list from admin config).
- System config at **Stores → Configuration → Panth → React Storefront** (enabled, site_url, cors_allowed_origins).
- Health endpoint: `GET /panthreact/health` → `{"ok":true,"version":"1.0.0"}`.
- Branded logo + favicon SVGs at `view/frontend/web/images/`.
- Layout stub that empties the `<content>` container so direct hits to Magento's frontend don't render broken Luma.

---

## 12. Common tasks

### Clear all caches

```bash
docker exec <project>_php php /var/www/html/bin/magento cache:flush
docker exec dev_redis redis-cli -n <cache-db> FLUSHDB
docker exec dev_redis redis-cli -n <page-cache-db> FLUSHDB
docker exec dev_redis redis-cli -n <session-db> FLUSHDB
```

### Reindex

```bash
docker exec <project>_php php /var/www/html/bin/magento indexer:reindex
```

### Re-deploy Magento static content

```bash
docker exec <project>_php php /var/www/html/bin/magento setup:static-content:deploy -f en_US
```

### Production build of the Astro app

Swap the `frontend` service's `target` in `docker-compose.yml` from `dev` to `runtime`, then:

```bash
docker compose build frontend && docker compose up -d frontend
```

The `runtime` stage serves pre-built HTML and ships ~60 % smaller than the dev container.

---

## 13. Troubleshooting

| Symptom                                           | Fix                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| Browser hangs ~5 s on first `.local` request      | macOS mDNS. Only on first lookup per session; browser caches it after.         |
| `403 Forbidden` on Astro static assets            | `docker compose restart frontend` — Vite sometimes stales after big file moves.|
| GraphQL returns wrong project's data              | `MAGENTO_GRAPHQL_URL` / `MAGENTO_INTERNAL_HOST` must use the container name.   |
| `Could not authenticate against github.com`       | Composer hitting dev-deps. Re-run with `--no-dev`.                             |
| Admin 404 after theme change                      | `bin/magento cache:flush && bin/magento setup:static-content:deploy adminhtml`.|
| CSP blocks an image                               | Add its origin to `img-src` in `src/middleware.ts`.                            |
| Site shows Magento Luma theme instead of React    | Check Traefik priority — `_web` must be 1, `_api` 100.                         |

---

## 14. Upgrading

- **Astro / React / Tailwind**: `docker compose exec frontend pnpm up --latest` → restart the container.
- **Magento**: standard upgrade path. After `bin/magento setup:upgrade`, run `bin/magento setup:di:compile` — our `Panth_React` classes are not `final`, so interceptors regenerate fine.
- **Traefik cert**: renew via mkcert + restart Traefik.

---

That's it. One command (`docker compose up -d`) runs the whole stack once the one-time Magento install is complete.
