/**
 * /robots.txt — crawler directives.
 *
 * SEO rules satisfied:
 *   - Explicit `Allow: /` then targeted `Disallow:` directives so crawlers
 *     know they're welcome by default.
 *   - Block post-authentication customer pages only (not login/create/forgot-
 *     password — we want Google to index those for brand-term searches).
 *   - Block parameter-driven duplicate-content vectors:
 *         /*?sort=*              — sort variants duplicate the base listing
 *         /*?page=*&*            — paginated + filtered combos (keep
 *                                  plain ?page=N canonical; drop the filtered
 *                                  permutations)
 *   - Block /api/ (server endpoints) and /offline (PWA fallback).
 *   - Host: directive + absolute Sitemap: URL so bots can resolve origin
 *     unambiguously.
 *   - Crawl-delay: 0 — some crawlers respect it, signals we can handle
 *     full-speed crawling.
 */

import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () => {
  const siteUrlRaw = import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321";
  const siteUrl = siteUrlRaw.replace(/\/+$/, "");

  const body = [
    "User-agent: *",
    "Allow: /",
    // Explicitly allow the login surfaces (brand-term SEO).
    "Allow: /customer/account/login",
    "Allow: /customer/account/create",
    "Allow: /customer/account/forgotpassword",
    // Admin + checkout + post-auth customer pages.
    "Disallow: /admin",
    "Disallow: /checkout",
    "Disallow: /customer/account/index",
    "Disallow: /customer/address",
    "Disallow: /wishlist",
    "Disallow: /compare",
    "Disallow: /sales/order",
    // Server endpoints + PWA offline stub.
    "Disallow: /api/",
    "Disallow: /offline",
    // Parameter-driven duplicate content.
    "Disallow: /*?sort=*",
    "Disallow: /*?page=*&*",
    "",
    "Crawl-delay: 0",
    `Host: ${siteUrl}`,
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
