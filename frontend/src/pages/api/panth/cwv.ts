import type { APIRoute } from "astro";
import { z } from "zod";
import { query } from "~/lib/graphql";

/**
 * POST /api/panth/cwv
 *
 * Receives a single Core Web Vitals beacon from `CwvReporter.tsx` and
 * best-effort forwards to Magento's `storeCoreWebVital` GraphQL mutation
 * (contributed by `Panth_Corewebvitals`). If the mutation isn't available
 * on the live schema, or the request otherwise fails, we log and return
 * 204 — browsers must not retry on unload-path beacons.
 *
 * Responses:
 *   204 — accepted (always, unless the body is invalid)
 *   400 — body failed Zod validation
 *
 * Body size is capped before parsing; any single field value beyond ~20KB
 * is dropped.
 */
export const prerender = false;

const MAX_BODY_BYTES = 4_096;

const BeaconSchema = z.object({
  lcp: z.number().finite().min(0).max(120_000).nullable(),
  inp: z.number().finite().min(0).max(120_000).nullable(),
  cls: z.number().finite().min(0).max(1_000).nullable(),
  ttfb: z.number().finite().min(0).max(120_000).nullable(),
  url: z.string().max(2_048),
  connection: z.string().max(32).nullable(),
  viewportW: z.number().int().min(0).max(16_384),
  viewportH: z.number().int().min(0).max(16_384),
});

const NO_CONTENT = new Response(null, { status: 204 });

let warnedMissing = false;
function warnOnce(message: string): void {
  if (warnedMissing) return;
  warnedMissing = true;
  console.warn(`[panth-cwv] ${message}`);
}

async function forward(payload: z.infer<typeof BeaconSchema>): Promise<void> {
  const doc = /* GraphQL */ `
    mutation StoreCoreWebVital($input: PanthCoreWebVitalInput!) {
      storeCoreWebVital(input: $input) {
        ok
      }
    }
  `;
  try {
    await query<unknown>(doc, {
      input: {
        lcp: payload.lcp,
        inp: payload.inp,
        cls: payload.cls,
        ttfb: payload.ttfb,
        url: payload.url,
        connection: payload.connection,
        viewport_width: payload.viewportW,
        viewport_height: payload.viewportH,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Cannot query field|Unknown type|not exist|storeCoreWebVital/i.test(msg)) {
      warnOnce(
        "storeCoreWebVital mutation not found — install/enable Panth_Corewebvitals.",
      );
      return;
    }
    console.warn("[panth-cwv] forward failed:", msg);
  }
}

export const POST: APIRoute = async (ctx) => {
  let text: string;
  try {
    text = await ctx.request.text();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (text.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = BeaconSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(null, { status: 400 });
  }

  // Fire-and-forget: don't block the 204 on the upstream round-trip.
  void forward(parsed.data);
  return NO_CONTENT;
};

export const GET: APIRoute = async () =>
  new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "text/plain" },
  });
