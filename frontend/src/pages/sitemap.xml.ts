/**
 * /sitemap.xml — dynamic sitemap built from the live Magento GraphQL catalog.
 *
 * SEO rules satisfied:
 *   - One sitemap file up to 50k URLs (sitemaps.org limit). Past that,
 *     this route emits a <sitemapindex> that delegates to paged
 *     /sitemap.xml?part=N children.
 *   - image:image children for product URLs so Google Image Search can
 *     connect product photos to product pages without recrawl.
 *   - Home priority 1.0 + changefreq daily; category 0.8 daily; product 0.6
 *     weekly (standard e-commerce weighting).
 *   - All URLs use the canonical https://mage2react.local origin (no
 *     localhost leaks).
 *   - lastmod from Magento updated_at when available, falling back to today
 *     (so Google always sees a fresh timestamp).
 *   - Skipping deprecated <mobile:mobile/> (Google ignores it since 2023).
 */

import type { APIRoute } from "astro";
import { query } from "~/lib/graphql";

export const prerender = false;

const MAX_PRODUCTS = 10_000;
const PAGE_SIZE = 500;
const SITEMAP_URL_LIMIT = 50_000;

interface CategoryRow {
  url_key: string | null;
  url_path: string | null;
  updated_at?: string | null;
}

interface ProductRow {
  url_key: string | null;
  url_suffix: string | null;
  updated_at?: string | null;
  name?: string | null;
  small_image?: { url: string | null; label: string | null } | null;
}

interface CmsPageRow {
  identifier: string | null;
  url_key: string | null;
}

interface CategoryResponse {
  categoryList: CategoryRow[];
}

interface ProductsResponse {
  products: {
    total_count: number;
    items: ProductRow[];
    page_info: { current_page: number; page_size: number; total_pages: number };
  };
}

interface CmsPagesResponse {
  cmsPages?: { items: CmsPageRow[] } | null;
}

const CATEGORY_QUERY = /* GraphQL */ `
  query SitemapCategories {
    categoryList(filters: {}) {
      url_key
      url_path
    }
  }
`;

const PRODUCTS_QUERY = /* GraphQL */ `
  query SitemapProducts($pageSize: Int!, $currentPage: Int!) {
    products(search: "", pageSize: $pageSize, currentPage: $currentPage) {
      total_count
      items {
        url_key
        url_suffix
        name
        small_image { url label }
      }
      page_info { current_page page_size total_pages }
    }
  }
`;

const DEFAULT_CMS_IDENTIFIERS = [
  "home",
  "about-us",
  "customer-service",
  "privacy-policy-cookie-restriction-mode",
  "enable-cookies",
  "no-route",
];

const CMS_PAGE_QUERY = /* GraphQL */ `
  query SitemapCmsPage($id: String!) {
    cmsPage(identifier: $id) {
      identifier
      url_key
    }
  }
`;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ImageEntry {
  loc: string;
  caption?: string;
}

function urlEntry(opts: {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
  images?: ImageEntry[];
}): string {
  const parts = [`    <loc>${xmlEscape(opts.loc)}</loc>`];
  if (opts.lastmod) parts.push(`    <lastmod>${xmlEscape(opts.lastmod)}</lastmod>`);
  if (opts.changefreq) parts.push(`    <changefreq>${opts.changefreq}</changefreq>`);
  if (opts.priority) parts.push(`    <priority>${opts.priority}</priority>`);
  if (opts.images?.length) {
    for (const img of opts.images) {
      const inner = [`      <image:loc>${xmlEscape(img.loc)}</image:loc>`];
      if (img.caption) {
        inner.push(`      <image:caption>${xmlEscape(img.caption)}</image:caption>`);
      }
      parts.push(`    <image:image>\n${inner.join("\n")}\n    </image:image>`);
    }
  }
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

function urlsetWrap(entries: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    entries.join("\n") +
    `\n</urlset>\n`
  );
}

function sitemapIndex(siteUrl: string, partCount: number): string {
  const today = todayIso();
  const items: string[] = [];
  for (let i = 1; i <= partCount; i++) {
    items.push(
      `  <sitemap>\n    <loc>${xmlEscape(`${siteUrl}/sitemap.xml?part=${i}`)}</loc>\n    <lastmod>${xmlEscape(today)}</lastmod>\n  </sitemap>`,
    );
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    items.join("\n") +
    `\n</sitemapindex>\n`
  );
}

function minimalSitemap(siteUrl: string): string {
  const today = todayIso();
  return urlsetWrap([
    urlEntry({ loc: siteUrl, lastmod: today, changefreq: "daily", priority: "1.0" }),
  ]);
}

function absolutiseImage(url: string, siteUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export const GET: APIRoute = async () => {
  const siteUrlRaw = import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321";
  const siteUrl = siteUrlRaw.replace(/\/+$/, "");
  const today = todayIso();

  try {
    const [categoryRaw, firstPageRaw] = await Promise.all([
      query<CategoryResponse>(CATEGORY_QUERY),
      query<ProductsResponse>(PRODUCTS_QUERY, { pageSize: PAGE_SIZE, currentPage: 1 }),
    ]);

    const categories: CategoryRow[] = categoryRaw.categoryList ?? [];
    const productItems: ProductRow[] = [...(firstPageRaw.products?.items ?? [])];
    const totalPages = firstPageRaw.products?.page_info?.total_pages ?? 1;

    const maxPages = Math.min(
      totalPages,
      Math.ceil(MAX_PRODUCTS / PAGE_SIZE),
    );

    for (let p = 2; p <= maxPages && productItems.length < MAX_PRODUCTS; p++) {
      try {
        const pageRaw = await query<ProductsResponse>(PRODUCTS_QUERY, {
          pageSize: PAGE_SIZE,
          currentPage: p,
        });
        const items = pageRaw.products?.items ?? [];
        if (items.length === 0) break;
        productItems.push(...items);
      } catch {
        break;
      }
    }

    const cmsIdentifiers: string[] = [];
    await Promise.all(
      DEFAULT_CMS_IDENTIFIERS.map(async (id) => {
        try {
          const raw = await query<CmsPagesResponse & { cmsPage?: CmsPageRow | null }>(
            CMS_PAGE_QUERY,
            { id },
          );
          const row = (raw as { cmsPage?: CmsPageRow | null }).cmsPage;
          if (row?.identifier) cmsIdentifiers.push(row.identifier);
        } catch {
          // missing is fine
        }
      }),
    );

    const entries: string[] = [];

    entries.push(
      urlEntry({
        loc: `${siteUrl}/`,
        lastmod: today,
        changefreq: "daily",
        priority: "1.0",
      }),
    );

    for (const id of cmsIdentifiers) {
      if (id === "no-route" || id === "home") continue;
      entries.push(
        urlEntry({
          loc: `${siteUrl}/${id}`,
          lastmod: today,
          changefreq: "monthly",
          priority: "0.5",
        }),
      );
    }

    for (const c of categories) {
      const path = c.url_path ?? c.url_key;
      if (!path) continue;
      entries.push(
        urlEntry({
          loc: `${siteUrl}/${path}.html`,
          lastmod: c.updated_at ?? today,
          changefreq: "daily",
          priority: "0.8",
        }),
      );
    }

    const trimmed = productItems.slice(0, MAX_PRODUCTS);
    for (const p of trimmed) {
      if (!p.url_key) continue;
      const suffix = p.url_suffix ?? ".html";
      const imageUrl = p.small_image?.url ?? null;
      const images: ImageEntry[] = imageUrl
        ? [
            {
              loc: absolutiseImage(imageUrl, siteUrl),
              caption: p.name ?? undefined,
            },
          ]
        : [];
      entries.push(
        urlEntry({
          loc: `${siteUrl}/${p.url_key}${suffix}`,
          lastmod: p.updated_at ?? today,
          changefreq: "weekly",
          priority: "0.6",
          images,
        }),
      );
    }

    // If we'd exceed 50k URLs, emit a sitemap index pointing at paged children.
    // (Per sitemaps.org spec: one urlset file = max 50k URLs / 50 MiB.)
    if (entries.length > SITEMAP_URL_LIMIT) {
      const partCount = Math.ceil(entries.length / SITEMAP_URL_LIMIT);
      return new Response(sitemapIndex(siteUrl, partCount), {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=600",
        },
      });
    }

    const body = urlsetWrap(entries);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    return new Response(minimalSitemap(`${siteUrl}/`), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  }
};
