import type { APIContext, AstroGlobal } from "astro";

/**
 * HttpOnly cookie that stores the Magento customer token.
 *
 * Magento returns a 1-hour token from `generateCustomerToken`; we mirror the
 * TTL in the cookie so the cookie cannot outlive server-side validity.
 *
 * Flags:
 *   - `HttpOnly` — no browser-JS access. Customer API calls go via Astro
 *     server code (page frontmatter or `/api/customer/*` endpoints).
 *   - `Secure`  — cookie only sent over HTTPS.
 *   - `SameSite=Lax` — carry the cookie on top-level GETs but not
 *     cross-site POSTs; pairs with `checkOrigin: true` in astro.config.
 *   - `Path=/`, `Max-Age=3600s`.
 */
export const CUSTOMER_TOKEN_COOKIE = "m2r_customer_token";
export const CUSTOMER_TOKEN_MAX_AGE = 60 * 60; // 1 hour

/**
 * Narrow `AstroGlobal | APIContext` to the cookie/redirect surface we use.
 * This keeps the helpers callable from both `.astro` pages and API routes.
 */
type CookieCtx = Pick<AstroGlobal, "cookies" | "redirect" | "url"> | APIContext;

export function getCustomerToken(ctx: CookieCtx): string | null {
  const value = ctx.cookies.get(CUSTOMER_TOKEN_COOKIE)?.value;
  return value && value.length > 0 ? value : null;
}

export function setCustomerToken(
  ctx: CookieCtx,
  token: string,
  maxAgeSeconds: number = CUSTOMER_TOKEN_MAX_AGE,
): void {
  ctx.cookies.set(CUSTOMER_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearCustomerToken(ctx: CookieCtx): void {
  ctx.cookies.delete(CUSTOMER_TOKEN_COOKIE, { path: "/" });
}

/**
 * Guard for `.astro` pages that require a signed-in customer.
 *
 * Usage in frontmatter:
 * ```ts
 * const auth = requireAuth(Astro);
 * if (auth instanceof Response) return auth;
 * const token = auth;
 * ```
 *
 * Preserves the original URL as `?return=<path>` so the login page can
 * bounce the customer back after they authenticate.
 */
export function requireAuth(ctx: CookieCtx): string | Response {
  const token = getCustomerToken(ctx);
  if (token) return token;
  const currentPath =
    "url" in ctx && ctx.url ? ctx.url.pathname + ctx.url.search : "/customer/account";
  const safePath = sanitizeReturnPath(currentPath);
  const to = `/customer/account/login?return=${encodeURIComponent(safePath)}`;
  return ctx.redirect(to, 303);
}

/**
 * Accept only relative paths starting with `/` (and not `//` which browsers
 * interpret as protocol-relative). Anything else collapses to
 * `/customer/account`.
 */
export function sanitizeReturnPath(value: string | null | undefined): string {
  if (!value) return "/customer/account";
  if (!value.startsWith("/")) return "/customer/account";
  if (value.startsWith("//")) return "/customer/account";
  if (value.startsWith("/\\")) return "/customer/account";
  return value;
}
