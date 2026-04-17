import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-live-activity.ts
 *
 * Typed helper for `Panth_LiveActivity`. The parent module is expected to
 * expose `panthLiveActivity(sku: String!)` returning two integer counters:
 *   - viewers: concurrent viewers of the product
 *   - purchased_last_24h: qty sold in the rolling 24h window
 *
 * `.nullable().optional()` everywhere, `safeParse` + zeroed fallback so the
 * island renders nothing rather than a "0 viewers" placeholder when counts
 * are unavailable.
 */

const Envelope = z.object({
  panthLiveActivity: z
    .object({
      viewers: z.number().nullable().optional(),
      purchased_last_24h: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export interface LiveActivity {
  viewers: number;
  purchased_last_24h: number;
}

export const EMPTY_ACTIVITY: LiveActivity = {
  viewers: 0,
  purchased_last_24h: 0,
};

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-live-activity] panthLiveActivity missing — install/enable Panth_LiveActivity.",
    );
  } else {
    console.warn("[panth-live-activity] query failed:", msg);
  }
}

function clampCount(v: number | null | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  return Math.floor(Math.min(v, 99_999));
}

export async function getLiveActivity(productSku: string): Promise<LiveActivity> {
  if (!productSku || typeof productSku !== "string") return EMPTY_ACTIVITY;

  const doc = /* GraphQL */ `
    query PanthLiveActivity($sku: String!) {
      panthLiveActivity(sku: $sku) {
        viewers
        purchased_last_24h
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, { sku: productSku });
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return EMPTY_ACTIVITY;
    const env = parsed.data.panthLiveActivity;
    if (!env) return EMPTY_ACTIVITY;
    return {
      viewers: clampCount(env.viewers),
      purchased_last_24h: clampCount(env.purchased_last_24h),
    };
  } catch (err) {
    logSchemaMiss(err);
    return EMPTY_ACTIVITY;
  }
}
