import { defineMiddleware } from "astro:middleware";
import { CART_COOKIE_NAME, createEmptyCart, getCustomerCartId } from "~/lib/queries-cart";
import { getCustomerToken } from "~/lib/auth";

const MEDIA_ORIGIN = "https://mage2react.local";

/**
 * Paths that should never trigger a `createEmptyCart` round-trip. These are
 * either bot-facing (`/robots.txt`, `/sitemap.xml`), static assets (served by
 * the adapter before this middleware ever fires in most setups, but a cheap
 * prefix guard doesn't hurt), or the Magento proxy catch-all which already
 * hands its own cookies through.
 */
const BOOTSTRAP_SKIP_PREFIXES = [
  "/_astro/",
  "/_image",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
];
const BOOTSTRAP_SKIP_EXT = /\.(?:css|js|mjs|map|png|jpg|jpeg|gif|svg|webp|avif|ico|woff2?|ttf|txt|xml)$/i;

/**
 * Strict CSP for Astro-rendered pages. These are pages we fully control,
 * so we keep `script-src`/`style-src` pinned to `'self'` + `'unsafe-inline'`
 * (Astro emits inline style/script blocks that we can't easily hash yet).
 */
const STRICT_CSP = [
  "default-src 'self'",
  `img-src 'self' data: ${MEDIA_ORIGIN}`,
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `connect-src 'self' ${MEDIA_ORIGIN} wss://mage2react.local`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Loose CSP for proxied Magento pages. Magento's Luma theme (and many
 * third-party modules) emit inline scripts with x-magento-init payloads,
 * RequireJS bootstraps, and inline `style=...` attributes. Rather than
 * whitelisting each, we allow `'unsafe-inline' 'unsafe-eval'` for
 * script/style and widen `img-src` to any `https:` origin (Magento-served
 * CMS content often references external CDNs).
 *
 * We still keep `frame-ancestors`, `object-src`, and `form-action` strict
 * to defend against clickjacking and form-hijack regardless of origin.
 */
const PROXIED_CSP = [
  "default-src 'self' https:",
  `img-src 'self' data: https: ${MEDIA_ORIGIN}`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${MEDIA_ORIGIN}`,
  `style-src 'self' 'unsafe-inline' ${MEDIA_ORIGIN}`,
  "font-src 'self' data: https:",
  `connect-src 'self' https: ${MEDIA_ORIGIN} wss://mage2react.local`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const onRequest = defineMiddleware(async (ctx, next) => {
  // ─── Cart-id bootstrap ──────────────────────────────────────────────
  // Ensure every visitor has an `m2r_cart_id` cookie. We set it before
  // rendering so SSR cart queries on the response path see it. Wrapped in
  // try/catch so a Magento outage never 500s the whole site.
  try {
    const path = ctx.url.pathname;
    const skip =
      BOOTSTRAP_SKIP_PREFIXES.some((p) => path.startsWith(p)) ||
      BOOTSTRAP_SKIP_EXT.test(path);
    if (!skip) {
      const existing = ctx.cookies.get(CART_COOKIE_NAME)?.value;
      const token = getCustomerToken(ctx);

      // Logged-in customers: always sync the cart cookie to their Magento
      // customer cart id. This prevents the "cannot perform operations on
      // cart …" error the browser otherwise gets when trying to mutate a
      // guest cart as an authenticated user.
      if (token) {
        const customerCartId = await getCustomerCartId(token);
        if (customerCartId && customerCartId !== existing) {
          ctx.cookies.set(CART_COOKIE_NAME, customerCartId, {
            httpOnly: false,
            secure: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365,
            path: "/",
          });
        }
      } else if (!existing) {
        const id = await createEmptyCart();
        ctx.cookies.set(CART_COOKIE_NAME, id, {
          httpOnly: false,
          secure: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
          path: "/",
        });
      }
    }
  } catch {
    // Swallow — the storefront must stay up even if Magento is unreachable.
  }

  const res = await next();
  if (!(res instanceof Response)) return res;

  const headers = new Headers(res.headers);

  // The fallback proxy route sets this header on responses it produces
  // from Magento. We read it, pick the right CSP, and then strip it so
  // implementation details don't leak to the client.
  const isProxied = headers.get("X-Mage2React-Proxied") === "1";
  headers.delete("X-Mage2React-Proxied");

  headers.set("Content-Security-Policy", isProxied ? PROXIED_CSP : STRICT_CSP);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  );
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});
