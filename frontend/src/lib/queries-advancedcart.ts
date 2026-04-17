import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-advancedcart.ts
 *
 * Typed fetch helpers for `Panth_AdvancedCart`'s storefront-facing GraphQL
 * extensions (free-shipping threshold, promotions line, savings total,
 * estimated delivery window, trust badges).
 *
 * Contract (inferred from the parent module's admin config — see
 * `mage2kishan/module-advancedcart/etc/config.xml`):
 *   - `cart(cart_id).panth_advanced_cart { ... }` extended envelope
 *   - `storeConfig { panth_advancedcart_* }` feature flags
 *
 * Every field is `.nullable().optional()` because we cannot verify the parent
 * schema at build time. We always `safeParse()` — never `parse()` — and fall
 * back to `null` / `[]` on mismatch so a missing field never breaks the cart.
 */

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const Money = z.object({
  value: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

const TrustBadge = z.object({
  code: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});
export type TrustBadgeT = z.infer<typeof TrustBadge>;

const AppliedPromotion = z.object({
  code: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  amount: Money.nullable().optional(),
});
export type AppliedPromotionT = z.infer<typeof AppliedPromotion>;

const EstimatedDelivery = z.object({
  min_days: z.number().nullable().optional(),
  max_days: z.number().nullable().optional(),
  label: z.string().nullable().optional(),
  earliest_date: z.string().nullable().optional(),
  latest_date: z.string().nullable().optional(),
});
export type EstimatedDeliveryT = z.infer<typeof EstimatedDelivery>;

const AdvancedCartEnvelope = z.object({
  free_shipping_enabled: z.boolean().nullable().optional(),
  free_shipping_threshold: z.number().nullable().optional(),
  free_shipping_currency: z.string().nullable().optional(),
  free_shipping_remaining: z.number().nullable().optional(),
  free_shipping_achieved: z.boolean().nullable().optional(),
  message_progress: z.string().nullable().optional(),
  message_achieved: z.string().nullable().optional(),
  savings_total: Money.nullable().optional(),
  order_notes: z.string().nullable().optional(),
  trust_badges: z.array(TrustBadge).nullable().optional(),
  applied_promotions: z.array(AppliedPromotion).nullable().optional(),
  estimated_delivery: EstimatedDelivery.nullable().optional(),
});
export type AdvancedCartT = z.infer<typeof AdvancedCartEnvelope>;

const AdvancedCartQuery = z.object({
  cart: z
    .object({
      id: z.string().nullable().optional(),
      panth_advanced_cart: AdvancedCartEnvelope.nullable().optional(),
    })
    .nullable()
    .optional(),
});

const AdvancedCartConfig = z.object({
  panth_advancedcart_enabled: z.boolean().nullable().optional(),
  panth_advancedcart_free_shipping_enabled: z.boolean().nullable().optional(),
  panth_advancedcart_free_shipping_threshold: z.number().nullable().optional(),
  panth_advancedcart_trust_badges_enabled: z.boolean().nullable().optional(),
  panth_advancedcart_order_notes_enabled: z.boolean().nullable().optional(),
});
export type AdvancedCartConfigT = z.infer<typeof AdvancedCartConfig>;

const AdvancedCartConfigEnvelope = z.object({
  storeConfig: AdvancedCartConfig.nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

let warnedMissing = false;
function logSchemaMiss(scope: string, err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      `[panth-advancedcart] ${scope}: schema field missing — ` +
        `install/enable Panth_AdvancedCart on the Magento side.`,
    );
  } else {
    console.warn(`[panth-advancedcart] ${scope} failed:`, msg);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reads the extended `panth_advanced_cart` envelope for a given cart id.
 * Returns `null` on any error or when the field is absent.
 */
export async function getAdvancedCart(cartId: string): Promise<AdvancedCartT | null> {
  const doc = /* GraphQL */ `
    query PanthAdvancedCart($id: String!) {
      cart(cart_id: $id) {
        id
        panth_advanced_cart {
          free_shipping_enabled
          free_shipping_threshold
          free_shipping_currency
          free_shipping_remaining
          free_shipping_achieved
          message_progress
          message_achieved
          savings_total { value currency }
          order_notes
          trust_badges { code label icon }
          applied_promotions {
            code
            label
            amount { value currency }
          }
          estimated_delivery {
            min_days
            max_days
            label
            earliest_date
            latest_date
          }
        }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { id: cartId });
    const parsed = AdvancedCartQuery.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.cart?.panth_advanced_cart ?? null;
  } catch (err) {
    logSchemaMiss("getAdvancedCart", err);
    return null;
  }
}

/**
 * Reads advanced-cart feature flags from `storeConfig`.
 * Returns `null` when the parent module is not installed.
 */
export async function getAdvancedCartConfig(): Promise<AdvancedCartConfigT | null> {
  const doc = /* GraphQL */ `
    query PanthAdvancedCartConfig {
      storeConfig {
        panth_advancedcart_enabled
        panth_advancedcart_free_shipping_enabled
        panth_advancedcart_free_shipping_threshold
        panth_advancedcart_trust_badges_enabled
        panth_advancedcart_order_notes_enabled
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const parsed = AdvancedCartConfigEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.storeConfig ?? null;
  } catch (err) {
    logSchemaMiss("getAdvancedCartConfig", err);
    return null;
  }
}

/**
 * Pure computation: given a current subtotal (major units) and a threshold,
 * returns a clamped 0..1 progress ratio plus the remaining amount. Useful
 * client-side without a round-trip when the extended envelope is absent.
 */
export function computeFreeShippingProgress(
  subtotal: number,
  threshold: number,
): { ratio: number; remaining: number; achieved: boolean } {
  if (!Number.isFinite(subtotal) || !Number.isFinite(threshold) || threshold <= 0) {
    return { ratio: 0, remaining: 0, achieved: false };
  }
  const ratio = Math.max(0, Math.min(1, subtotal / threshold));
  const remaining = Math.max(0, threshold - subtotal);
  return { ratio, remaining, achieved: subtotal >= threshold };
}
