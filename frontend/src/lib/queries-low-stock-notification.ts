import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-low-stock-notification.ts
 *
 * Typed helper for `Panth_LowStockNotification`. The parent module is
 * expected to expose `panthLowStockSubscribe(input: { sku, email })` —
 * records a back-in-stock email subscription and returns a `{ ok, message }`
 * envelope. Authenticated subscribers can optionally pass the customer
 * token so the subscription is linked to their account.
 */

const Envelope = z.object({
  panthLowStockSubscribe: z
    .object({
      ok: z.boolean().nullable().optional(),
      message: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export interface SubscribeResult {
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
      "[panth-low-stock] panthLowStockSubscribe missing — install/enable Panth_LowStockNotification.",
    );
  } else {
    console.warn("[panth-low-stock] mutation failed:", msg);
  }
}

/**
 * Subscribe an email to back-in-stock notifications for a product. Never
 * throws. Returns a uniform `{ ok, message }` with a friendly fallback copy
 * on schema miss / network error.
 *
 * `token` (optional) — if the customer is signed in, pass the server-held
 * Magento token so the subscription can be attached to their account.
 */
export async function subscribeLowStock(
  sku: string,
  email: string,
  token?: string,
): Promise<SubscribeResult> {
  if (!sku || typeof sku !== "string") {
    return { ok: false, message: "Missing product." };
  }
  if (!email || typeof email !== "string") {
    return { ok: false, message: "Enter a valid email." };
  }

  const doc = /* GraphQL */ `
    mutation PanthLowStockSubscribe($input: PanthLowStockSubscribeInput!) {
      panthLowStockSubscribe(input: $input) {
        ok
        message
      }
    }
  `;

  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const raw = await query<unknown>(doc, { input: { sku, email } });
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "We could not save that subscription." };
    }
    const env = parsed.data.panthLowStockSubscribe;
    return {
      ok: env?.ok === true,
      message: env?.message?.trim() || "We will email you when this is back in stock.",
    };
  } catch (err) {
    logSchemaMiss(err);
    return {
      ok: false,
      message: "We could not save that subscription right now. Please try again later.",
    };
  }
}
