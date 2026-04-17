import type { APIRoute } from "astro";
import { getCustomerToken } from "~/lib/auth";
import {
  CART_COOKIE_NAME,
  getCart,
  getCustomerCartId,
} from "~/lib/queries-cart";

/**
 * GET /api/cart/current — returns the current cart for the caller.
 *
 * Picks the right Magento query based on auth state:
 *   - Logged-in customer: resolve via `customerCart { id }` then fetch the
 *     cart with the Authorization header, and (re)sync the `m2r_cart_id`
 *     cookie to the canonical customer cart id.
 *   - Guest: fetch via `cart(cart_id: $id)` using the cookie.
 *
 * Browser code that previously hit GraphQL directly for `cart()` would
 * 403 when the cookie held a guest cart id but the visitor was logged in
 * (or vice versa). This endpoint makes that decision server-side so the
 * browser just reads JSON.
 *
 * Never throws. Returns `{ cart: null }` on any failure with a 200 so the
 * client-side cart store can render an empty cart rather than a toast.
 */
export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const token = getCustomerToken(ctx);
  const cookieCartId = ctx.cookies.get(CART_COOKIE_NAME)?.value ?? null;

  let cartId: string | null = cookieCartId;

  if (token) {
    try {
      const customerCartId = await getCustomerCartId(token);
      if (customerCartId) {
        if (customerCartId !== cookieCartId) {
          ctx.cookies.set(CART_COOKIE_NAME, customerCartId, {
            httpOnly: false,
            secure: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365,
            path: "/",
          });
        }
        cartId = customerCartId;
      }
    } catch {
      /* non-fatal — fall through with the cookie value */
    }
  }

  if (!cartId) {
    return new Response(JSON.stringify({ cart: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let cart = null;
  try {
    cart = await getCart(cartId, token);
  } catch {
    /* non-fatal — return `{ cart: null }` below */
  }

  return new Response(JSON.stringify({ cart }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
};
