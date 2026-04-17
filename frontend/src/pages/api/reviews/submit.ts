import type { APIRoute } from "astro";
import { z } from "zod";
import { getCustomerToken } from "~/lib/auth";
import { submitProductReview } from "~/lib/queries-reviews";

/**
 * POST /api/reviews/submit
 *
 * Accepts a JSON body describing a product review, validates it with Zod,
 * reads the HttpOnly `m2r_customer_token` cookie if present (so the token
 * never crosses the browser boundary), and forwards the submission to
 * Magento via `submitProductReview`.
 *
 * Response shape (always JSON):
 *   { ok: true, message?: string }
 *   { ok: false, message?: string, userErrors?: { code, message }[] }
 *
 * Magento honors the "Allow Guests to Write Reviews" store config — when no
 * token is present the mutation runs anonymously and the store decides
 * whether to accept the review.
 */
const BodySchema = z.object({
  sku: z.string().min(1),
  nickname: z.string().trim().min(2).max(128),
  summary: z.string().trim().min(3).max(255),
  text: z.string().trim().min(25).max(2000),
  ratings: z
    .array(z.object({ id: z.string().min(1), value_id: z.string().min(1) }))
    .min(1),
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

export const POST: APIRoute = async (ctx) => {
  let raw: unknown;
  try {
    raw = await ctx.request.json();
  } catch {
    return jsonResponse(
      { ok: false, message: "Invalid JSON body." },
      400,
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        message: "Please check the form and try again.",
        userErrors: parsed.error.issues.map((i) => ({
          code: null,
          message: i.message,
        })),
      },
      400,
    );
  }

  const token = getCustomerToken(ctx) ?? undefined;

  try {
    const result = await submitProductReview(parsed.data, token);
    if (result.userErrors.length > 0) {
      return jsonResponse(
        {
          ok: false,
          message: "Magento rejected the review.",
          userErrors: result.userErrors,
        },
        400,
      );
    }
    return jsonResponse({
      ok: true,
      message: "Thanks — your review is pending moderation.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return jsonResponse(
      { ok: false, message, userErrors: [{ code: null, message }] },
      500,
    );
  }
};
