import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-extra-fee.ts
 *
 * Typed fetch helpers for `Panth_ExtraFee`'s storefront-facing GraphQL
 * extensions: configurable surcharges (gift wrap, handling, small-order
 * fees, etc.).
 *
 * Contract (inferred from the parent module's admin config — see
 * `mage2kishan/module-extra-fee/etc/config.xml`):
 *   - `cart(cart_id).panth_extra_fees { code label description price selected required }`
 *   - mutation `updateExtraFeesOnCart(input: { cart_id, fees: [{ code, selected }] })`
 *   - `storeConfig { panth_extra_fee_* }` flags
 *
 * Every field is `.nullable().optional()` and parsed with `safeParse`.
 */

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const Money = z.object({
  value: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

const ExtraFee = z.object({
  code: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: Money.nullable().optional(),
  selected: z.boolean().nullable().optional(),
  required: z.boolean().nullable().optional(),
  sort_order: z.number().nullable().optional(),
});
export type ExtraFeeT = z.infer<typeof ExtraFee>;

const ExtraFeesQuery = z.object({
  cart: z
    .object({
      id: z.string().nullable().optional(),
      panth_extra_fees: z.array(ExtraFee).nullable().optional(),
      panth_extra_fees_total: Money.nullable().optional(),
      panth_extra_fees_title: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const MutationUserError = z.object({
  code: z.string().nullable().optional(),
  message: z.string(),
});

const UpdateExtraFeesEnvelope = z.object({
  updateExtraFeesOnCart: z
    .object({
      cart: z
        .object({
          panth_extra_fees: z.array(ExtraFee).nullable().optional(),
          panth_extra_fees_total: Money.nullable().optional(),
        })
        .nullable()
        .optional(),
      user_errors: z.array(MutationUserError).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const ExtraFeeConfig = z.object({
  panth_extra_fee_enabled: z.boolean().nullable().optional(),
  panth_extra_fee_show_in_cart: z.boolean().nullable().optional(),
  panth_extra_fee_show_in_checkout: z.boolean().nullable().optional(),
  panth_extra_fee_display_title: z.string().nullable().optional(),
  panth_extra_fee_show_breakdown: z.boolean().nullable().optional(),
});
export type ExtraFeeConfigT = z.infer<typeof ExtraFeeConfig>;

const ExtraFeeConfigEnvelope = z.object({
  storeConfig: ExtraFeeConfig.nullable().optional(),
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
      `[panth-extra-fee] ${scope}: schema field missing — ` +
        `install/enable Panth_ExtraFee on the Magento side.`,
    );
  } else {
    console.warn(`[panth-extra-fee] ${scope} failed:`, msg);
  }
}

/** Safe price coercion — any malformed value becomes 0 so a broken fee never blocks checkout. */
export function safeFeePrice(fee: ExtraFeeT): { value: number; currency: string } {
  const v = fee.price?.value;
  const c = fee.price?.currency;
  return {
    value: typeof v === "number" && Number.isFinite(v) ? v : 0,
    currency: typeof c === "string" && c.length > 0 ? c : "USD",
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export async function getExtraFees(
  cartId: string,
): Promise<{ fees: ExtraFeeT[]; title: string; total: { value: number; currency: string } } | null> {
  const doc = /* GraphQL */ `
    query PanthExtraFees($id: String!) {
      cart(cart_id: $id) {
        id
        panth_extra_fees {
          code
          label
          description
          price { value currency }
          selected
          required
          sort_order
        }
        panth_extra_fees_total { value currency }
        panth_extra_fees_title
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { id: cartId });
    const parsed = ExtraFeesQuery.safeParse(raw);
    if (!parsed.success) return null;
    const fees = parsed.data.cart?.panth_extra_fees ?? [];
    const totalRaw = parsed.data.cart?.panth_extra_fees_total;
    const total = {
      value:
        typeof totalRaw?.value === "number" && Number.isFinite(totalRaw.value)
          ? totalRaw.value
          : 0,
      currency:
        typeof totalRaw?.currency === "string" && totalRaw.currency.length > 0
          ? totalRaw.currency
          : "USD",
    };
    return {
      fees,
      title: parsed.data.cart?.panth_extra_fees_title ?? "Additional Fees",
      total,
    };
  } catch (err) {
    logSchemaMiss("getExtraFees", err);
    return null;
  }
}

export async function updateExtraFeesOnCart(
  cartId: string,
  selections: { code: string; selected: boolean }[],
): Promise<ExtraFeeT[] | null> {
  const doc = /* GraphQL */ `
    mutation PanthUpdateExtraFeesOnCart($input: UpdateExtraFeesOnCartInput!) {
      updateExtraFeesOnCart(input: $input) {
        cart {
          panth_extra_fees {
            code
            label
            description
            price { value currency }
            selected
            required
            sort_order
          }
          panth_extra_fees_total { value currency }
        }
        user_errors { code message }
      }
    }
  `;
  try {
    const safeSelections = selections
      .filter((s) => typeof s.code === "string" && s.code.length > 0)
      .map((s) => ({ code: s.code, selected: Boolean(s.selected) }));
    const raw = await query<unknown>(doc, {
      input: { cart_id: cartId, fees: safeSelections },
    });
    const parsed = UpdateExtraFeesEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.updateExtraFeesOnCart?.cart?.panth_extra_fees ?? null;
  } catch (err) {
    logSchemaMiss("updateExtraFeesOnCart", err);
    return null;
  }
}

export async function getExtraFeeConfig(): Promise<ExtraFeeConfigT | null> {
  const doc = /* GraphQL */ `
    query PanthExtraFeeConfig {
      storeConfig {
        panth_extra_fee_enabled
        panth_extra_fee_show_in_cart
        panth_extra_fee_show_in_checkout
        panth_extra_fee_display_title
        panth_extra_fee_show_breakdown
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const parsed = ExtraFeeConfigEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.storeConfig ?? null;
  } catch (err) {
    logSchemaMiss("getExtraFeeConfig", err);
    return null;
  }
}
