import type { APIContext, APIRoute } from "astro";
import { z } from "zod";
import { query } from "~/lib/graphql";
import {
  buildFieldValidator,
  getContactConfig,
  type ContactConfig,
} from "~/lib/queries-advanced-contact-us";

/**
 * POST /api/panth/contact
 *
 * Re-validates a contact-form submission against the admin-defined schema
 * from `panthContactConfig`, then forwards the payload to Magento's
 * `panthContactSubmit` GraphQL mutation.
 *
 * Responses:
 *   200 { ok: true,  message }
 *   400 { ok: false, message, errors? }  — validation failure
 *   429 { ok: false, message }            — rate limited
 *   502 { ok: false, message }            — Magento rejected / missing mutation
 */
export const prerender = false;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};

const MAX_BODY_BYTES = 16_384;

/* ------------------------------------------------------------------------- */
/* Rate limiter — sliding window, in-memory, keyed by client IP              */
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
  if (buckets.size > 5_000) {
    for (const [key, stamps] of buckets) {
      const trimmed = stamps.filter((t) => now - t < WINDOW_MS);
      if (trimmed.length === 0) buckets.delete(key);
      else buckets.set(key, trimmed);
    }
  }
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
/* Upstream forward                                                           */
/* ------------------------------------------------------------------------- */

interface ForwardResult {
  ok: boolean;
  message: string;
}

let warnedMissing = false;
async function forward(
  subject: string | null,
  payload: Record<string, unknown>,
): Promise<ForwardResult> {
  const doc = /* GraphQL */ `
    mutation PanthContactSubmit($input: PanthContactSubmitInput!) {
      panthContactSubmit(input: $input) {
        ok
        message
      }
    }
  `;
  try {
    const result = await query<{
      panthContactSubmit?: { ok?: boolean | null; message?: string | null } | null;
    }>(doc, {
      input: {
        subject,
        fields: Object.entries(payload).map(([k, v]) => ({
          id: k.replace(/^f_/, ""),
          value: typeof v === "string" ? v : v === true ? "true" : String(v ?? ""),
        })),
      },
    });
    const res = result.panthContactSubmit;
    return {
      ok: res?.ok === true,
      message: res?.message?.trim() || "Thanks — we will be in touch.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Cannot query field|Unknown type|not exist|panthContactSubmit/i.test(msg)) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.warn(
          "[panth-contact] panthContactSubmit missing — install/enable Panth_AdvancedContactUs.",
        );
      }
      return { ok: false, message: "Contact form is not available right now." };
    }
    console.warn("[panth-contact] forward failed:", msg);
    return { ok: false, message: "We could not send the message. Please try again." };
  }
}

/* ------------------------------------------------------------------------- */
/* Handler                                                                    */
/* ------------------------------------------------------------------------- */

function buildFullValidator(cfg: ContactConfig): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of cfg.fields) {
    shape[`f_${f.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`] = buildFieldValidator(f);
  }
  if (cfg.subject_options.length > 0) {
    shape["subject"] = z.enum(cfg.subject_options as [string, ...string[]]);
  } else {
    shape["subject"] = z.string().trim().max(200).nullable().optional();
  }
  return z.object(shape).strip();
}

export const POST: APIRoute = async (ctx) => {
  const ip = resolveClientIp(ctx);
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ ok: false, message: "Too many requests. Please try again in a minute." }),
      { status: 429, headers: JSON_HEADERS },
    );
  }

  let text: string;
  try {
    text = await ctx.request.text();
  } catch {
    return new Response(JSON.stringify({ ok: false, message: "Invalid body." }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
  if (text.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ ok: false, message: "Body too large." }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return new Response(JSON.stringify({ ok: false, message: "Invalid JSON body." }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const cfg = await getContactConfig();
  if (cfg.fields.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, message: "Contact form is not available right now." }),
      { status: 502, headers: JSON_HEADERS },
    );
  }

  const validator = buildFullValidator(cfg);
  const parsed = validator.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.length > 0 ? String(issue.path[0]) : "_";
      if (!errors[key]) errors[key] = issue.message;
    }
    return new Response(
      JSON.stringify({ ok: false, message: "Please check the highlighted fields.", errors }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const data = parsed.data as Record<string, unknown>;
  const subject = typeof data["subject"] === "string" ? (data["subject"] as string) : null;
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "subject") continue;
    rest[k] = v;
  }

  const result = await forward(subject, rest);
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
