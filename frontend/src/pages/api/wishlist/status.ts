import type { APIRoute } from "astro";
import { getCustomerToken } from "~/lib/auth";
import { getWishlistIds } from "~/lib/queries-wishlist";

/**
 * GET /api/wishlist/status
 *
 * Lightweight poll for client islands — returns whether the caller is signed
 * in and the list of SKUs currently on their wishlist. Islands use this to
 * hydrate the heart-toggle state on PDPs and the header badge count.
 *
 * We intentionally don't send the wishlist id or item ids here — the client
 * doesn't need them for the SKU-based add. Remove operations get the item id
 * from the prior add response (or from `getWishlistIds` on the server side).
 *
 * Response:
 *   { signedIn: boolean, skus: string[] }
 *
 * Always 200 (authentication absence is just `signedIn: false`) so the
 * browser fetch never throws and callers can treat a network failure as
 * distinct from a guest user.
 */
export const prerender = false;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};

export const GET: APIRoute = async (ctx) => {
  const token = getCustomerToken(ctx);
  if (!token) {
    return new Response(
      JSON.stringify({ signedIn: false, skus: [] }),
      { status: 200, headers: JSON_HEADERS },
    );
  }

  try {
    const hydration = await getWishlistIds(token);
    return new Response(
      JSON.stringify({ signedIn: true, skus: hydration.skus }),
      { status: 200, headers: JSON_HEADERS },
    );
  } catch {
    // Token present but upstream failed. Treat as signed-in-but-empty so the
    // button doesn't redirect the user to sign in again.
    return new Response(
      JSON.stringify({ signedIn: true, skus: [] }),
      { status: 200, headers: JSON_HEADERS },
    );
  }
};
