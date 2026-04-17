import type { APIRoute } from "astro";
import { getCustomerToken } from "~/lib/auth";

/**
 * Client-side GraphQL proxy.
 *
 * The browser-side GraphQL client posts here instead of `/graphql` directly.
 * This server reads the HttpOnly `m2r_customer_token` cookie and attaches an
 * `Authorization: Bearer <token>` header when present, then forwards to
 * Magento — which lets authenticated mutations (add to customer cart,
 * wishlist, etc.) succeed without ever exposing the token to JavaScript.
 *
 * Guests pass through unauthenticated; mutations on guest carts don't need
 * an auth header.
 */
export const prerender = false;

const INTERNAL_HOST =
  (import.meta.env.MAGENTO_INTERNAL_HOST as string | undefined) ?? "mage2react.local";
const UPSTREAM = `http://${INTERNAL_HOST}/graphql`;
const TIMEOUT_MS = 15_000;

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.text();
  const token = getCustomerToken(ctx);

  const upstreamHeaders = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
    Store: "default",
    Host: "mage2react.local",
    "X-Forwarded-Host": "mage2react.local",
    "X-Forwarded-Proto": "https",
  });
  if (token) upstreamHeaders.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: upstreamHeaders,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : "upstream unreachable";
    return new Response(
      JSON.stringify({ errors: [{ message: `GraphQL proxy error: ${msg}` }] }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
  clearTimeout(timer);

  const outHeaders = new Headers();
  outHeaders.set("Content-Type", upstream.headers.get("content-type") ?? "application/json");
  const cc = upstream.headers.get("cache-control");
  if (cc) outHeaders.set("Cache-Control", cc);
  // Forward any Magento-set cookies (session, guest cart context). Multi-value
  // via getSetCookie() when available.
  const anyHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = anyHeaders.getSetCookie?.() ?? [];
  for (const c of cookies) outHeaders.append("Set-Cookie", c);

  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: outHeaders });
};

export const GET: APIRoute = async () =>
  new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "text/plain" },
  });
