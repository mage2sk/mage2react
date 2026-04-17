import type { APIRoute } from "astro";
import { getCustomerToken } from "~/lib/auth";
import { getCustomer, friendlyAuthError } from "~/lib/queries-customer";

/**
 * GET /api/customer/me
 *
 * Server-side proxy for client islands that need to render something based
 * on the signed-in customer (e.g. a header greeting). The HttpOnly token
 * cookie never leaves the server; the browser only sees a minimal JSON
 * payload.
 */
export const GET: APIRoute = async (ctx) => {
  const token = getCustomerToken(ctx);
  if (!token) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  }
  try {
    const c = await getCustomer(token);
    const payload = {
      authenticated: true,
      firstname: c.firstname,
      lastname: c.lastname,
      email: c.email,
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ authenticated: false, error: friendlyAuthError(err) }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } },
    );
  }
};
