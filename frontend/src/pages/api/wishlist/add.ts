import type { APIRoute } from "astro";
import { z } from "zod";
import { getCustomerToken } from "~/lib/auth";
import { addToWishlistBySku } from "~/lib/queries-wishlist";

/**
 * POST /api/wishlist/add
 * Body: { sku: string }
 *
 * Server-side proxy so the browser never needs to see the HttpOnly
 * `m2r_customer_token` cookie. Any client-visible React island calls this
 * endpoint; the endpoint reads the cookie, dispatches the GraphQL mutation,
 * and returns a minimal JSON result.
 *
 * Responses:
 *   200 { ok: true, wishlistItemId, wishlistId }
 *   400 { ok: false, error }   — invalid body
 *   401 { ok: false, error }   — no / expired customer token
 *   502 { ok: false, error }   — Magento rejected the mutation
 */
export const prerender = false;

const Body = z.object({
  sku: z.string().min(1).max(255),
});

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};

export const POST: APIRoute = async (ctx) => {
  const token = getCustomerToken(ctx);
  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, error: "Sign in to save to wishlist." }),
      { status: 401, headers: JSON_HEADERS },
    );
  }

  let json: unknown;
  try {
    json = await ctx.request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body." }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing or invalid `sku`." }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const result = await addToWishlistBySku(token, parsed.data.sku);
  if (!result.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: result.error }),
      { status: 502, headers: JSON_HEADERS },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      wishlistId: result.wishlistId,
      wishlistItemId: result.wishlistItemId,
    }),
    { status: 200, headers: JSON_HEADERS },
  );
};
