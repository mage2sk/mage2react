import type { APIRoute } from "astro";
import { z } from "zod";
import { getCustomerToken } from "~/lib/auth";
import {
  getWishlistIds,
  removeFromWishlistById,
} from "~/lib/queries-wishlist";

/**
 * POST /api/wishlist/remove
 * Body: { wishlistItemId: string } OR { sku: string }
 *
 * The wishlist id is looked up server-side from the customer token so the
 * client only needs the item id it was given on add. The `sku` variant
 * exists for islands that hydrated from `/api/wishlist/status` (which only
 * returns SKUs, not item ids) and want to remove without a round-trip.
 *
 * Responses:
 *   200 { ok: true }
 *   400 { ok: false, error }   — invalid body
 *   401 { ok: false, error }   — no / expired customer token
 *   404 { ok: false, error }   — no wishlist on account / sku not in it
 *   502 { ok: false, error }   — Magento rejected the mutation
 */
export const prerender = false;

const Body = z.union([
  z.object({ wishlistItemId: z.string().min(1).max(64) }),
  z.object({ sku: z.string().min(1).max(255) }),
]);

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};

export const POST: APIRoute = async (ctx) => {
  const token = getCustomerToken(ctx);
  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, error: "Sign in required." }),
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
      JSON.stringify({ ok: false, error: "Missing or invalid `wishlistItemId`." }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  // Resolve the wishlist id (and item id if we were given a sku) server-side.
  // We don't trust the client to send the wishlist id directly.
  const hydration = await getWishlistIds(token);
  if (!hydration.wishlistId) {
    return new Response(
      JSON.stringify({ ok: false, error: "No wishlist on this account." }),
      { status: 404, headers: JSON_HEADERS },
    );
  }

  let itemId: string;
  if ("wishlistItemId" in parsed.data) {
    itemId = parsed.data.wishlistItemId;
  } else {
    const resolved = hydration.bySku[parsed.data.sku];
    if (!resolved) {
      return new Response(
        JSON.stringify({ ok: false, error: "That item is not on your wishlist." }),
        { status: 404, headers: JSON_HEADERS },
      );
    }
    itemId = resolved;
  }

  const result = await removeFromWishlistById(
    token,
    hydration.wishlistId,
    itemId,
  );
  if (!result.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: result.error }),
      { status: 502, headers: JSON_HEADERS },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: JSON_HEADERS,
  });
};
