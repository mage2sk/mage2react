import type { APIContext, APIRoute } from "astro";
import { z } from "zod";
import { subscribeEmailToNewsletter } from "~/lib/queries-customer";

/**
 * POST /api/newsletter/subscribe
 * Body: { email: string }
 *
 * Server-side proxy for the `Newsletter` footer widget. Validates the body,
 * rate-limits by client IP, and forwards the address to Magento's
 * `subscribeEmailToNewsletter` mutation (helper already exists in
 * `~/lib/queries-customer`).
 *
 * Magento's response carries a `status` field — `SUBSCRIBED` when the address
 * is immediately confirmed (rare), `NOT_ACTIVE` when a double-opt-in email
 * has just been dispatched, etc. We surface a friendly copy to the user.
 *
 * Responses:
 *   200 { ok: true,  message: string }
 *   400 { ok: false, message: string }  — invalid body
 *   429 { ok: false, message: string }  — rate-limited
 *   502 { ok: false, message: string }  — Magento rejected the mutation
 */
export const prerender = false;

const Body = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};

/* ------------------------------------------------------------------------- */
/* Rate limiter — best-effort in-memory token bucket keyed by client IP      */
/* ------------------------------------------------------------------------- */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const rateLimitBuckets = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip) ?? [];
  // Drop timestamps outside the sliding window.
  const fresh = bucket.filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= MAX_PER_WINDOW) {
    rateLimitBuckets.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  rateLimitBuckets.set(ip, fresh);
  // Light GC so the Map doesn't grow unbounded on long-running servers.
  if (rateLimitBuckets.size > 5_000) {
    for (const [key, stamps] of rateLimitBuckets) {
      const trimmed = stamps.filter((t) => now - t < WINDOW_MS);
      if (trimmed.length === 0) rateLimitBuckets.delete(key);
      else rateLimitBuckets.set(key, trimmed);
    }
  }
  return true;
}

function resolveClientIp(ctx: APIContext): string {
  // Prefer Astro's adapter-aware value; fall back to the proxy header the
  // Traefik edge adds upstream. Final fallback is a stable sentinel so the
  // limiter still partitions unknown callers as one logical bucket.
  try {
    if (ctx.clientAddress) return ctx.clientAddress;
  } catch {
    /* adapter may throw if request lacks a remote address */
  }
  const xff = ctx.request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

/* ------------------------------------------------------------------------- */
/* Handler                                                                    */
/* ------------------------------------------------------------------------- */

function friendlyMessage(status: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "SUBSCRIBED":
      return "Thanks for subscribing!";
    case "NOT_ACTIVE":
      return "Almost done — check your inbox to confirm your subscription.";
    case "UNSUBSCRIBED":
      return "You were unsubscribed. Submit again to re-subscribe.";
    case "UNCONFIRMED":
      return "Almost done — check your inbox to confirm your subscription.";
    default:
      return "Thanks for subscribing!";
  }
}

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
      JSON.stringify({ ok: false, message: "Please provide a valid email address." }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const status = await subscribeEmailToNewsletter(parsed.data.email);
  if (status === null) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "We couldn't process that subscription right now. Please try again later.",
      }),
      { status: 502, headers: JSON_HEADERS },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, message: friendlyMessage(status) }),
    { status: 200, headers: JSON_HEADERS },
  );
};
