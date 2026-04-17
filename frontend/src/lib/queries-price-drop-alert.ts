import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-price-drop-alert.ts
 *
 * Typed helper for `Panth_PriceDropAlert`. The parent module is expected to
 * expose `panthPriceDropSubscribe(input: { sku, email, target_price? })` —
 * records a price-drop email subscription. Target price is optional:
 * customers can subscribe to any drop, or only when the price reaches a
 * specific threshold.
 */

const Envelope = z.object({
  panthPriceDropSubscribe: z
    .object({
      ok: z.boolean().nullable().optional(),
      message: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export interface PriceDropSubscribeResult {
  ok: boolean;
  message: string;
}

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-price-drop] panthPriceDropSubscribe missing — install/enable Panth_PriceDropAlert.",
    );
  } else {
    console.warn("[panth-price-drop] mutation failed:", msg);
  }
}

/**
 * Subscribe an email to price-drop notifications for a product. Never
 * throws. `target_price`, if provided, must be a positive finite number.
 */
export async function subscribePriceDrop(
  sku: string,
  email: string,
  target_price?: number | null,
): Promise<PriceDropSubscribeResult> {
  if (!sku || typeof sku !== "string") {
    return { ok: false, message: "Missing product." };
  }
  if (!email || typeof email !== "string") {
    return { ok: false, message: "Enter a valid email." };
  }

  const safeTarget =
    typeof target_price === "number" &&
    Number.isFinite(target_price) &&
    target_price > 0
      ? target_price
      : null;

  const doc = /* GraphQL */ `
    mutation PanthPriceDropSubscribe($input: PanthPriceDropSubscribeInput!) {
      panthPriceDropSubscribe(input: $input) {
        ok
        message
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, {
      input: { sku, email, target_price: safeTarget },
    });
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "We could not save that subscription." };
    }
    const env = parsed.data.panthPriceDropSubscribe;
    return {
      ok: env?.ok === true,
      message: env?.message?.trim() || "We will email you when the price drops.",
    };
  } catch (err) {
    logSchemaMiss(err);
    return {
      ok: false,
      message: "We could not save that subscription right now. Please try again later.",
    };
  }
}
