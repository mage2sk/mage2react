import type { APIContext, APIRoute } from "astro";
import { z } from "zod";
import { subscribePriceDrop } from "~/lib/queries-price-drop-alert";

/**
 * POST /api/panth/price-drop
 * Body: { sku: string, email: string, target_price?: number | null }
 *
 * Server-side proxy for `PriceDropForm.tsx`. Validates, rate-limits by
 * client IP, then forwards to Magento's `panthPriceDropSubscribe` mutation
 * via the shared helper in `queries-price-drop-alert.ts`.
 */
export const prerender = false;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};

const Body = z.object({
  sku: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  target_price: z
    .union([z.number().finite().positive(), z.null()])
    .optional(),
});

/* ------------------------------------------------------------------------- */
/* Rate limiter                                                               */
/* ------------------------------------------------------------------------- */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const buckets = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? [];
  const fresh = bucket.filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= MAX_PER_WINDOW) {
    buckets.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(ip, fresh);
  return true;
}

function resolveClientIp(ctx: APIContext): string {
  try {
    if (ctx.clientAddress) return ctx.clientAddress;
  } catch {
    /* adapter may throw */
  }
  const xff = ctx.request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

/* ------------------------------------------------------------------------- */
/* Handler                                                                    */
/* ------------------------------------------------------------------------- */

export const POST: APIRoute = async (ctx) => {
  const ip = resolveClientIp(ctx);
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ ok: false, message: "Too many requests. Please try again in a minute." }),
      { status: 429, headers: JSON_HEADERS },
    );
  }

  let raw: unknown;
  try {
    raw = await ctx.request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, message: "Invalid JSON body." }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ ok: false, message: "Please check your email and target price." }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const { sku, email, target_price } = parsed.data;
  const result = await subscribePriceDrop(sku, email, target_price ?? null);
  if (!result.ok) {
    return new Response(JSON.stringify({ ok: false, message: result.message }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }
  return new Response(JSON.stringify({ ok: true, message: result.message }), {
    status: 200,
    headers: JSON_HEADERS,
  });
};

export const GET: APIRoute = async () =>
  new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "text/plain" },
  });
