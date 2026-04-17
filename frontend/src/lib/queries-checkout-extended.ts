import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-checkout-extended.ts
 *
 * Typed fetch helpers for `Panth_CheckoutExtended`'s storefront-facing
 * GraphQL extensions (order comment, gift message, newsletter opt-in,
 * sidebar/layout flags).
 *
 * Contract (inferred from the parent module's admin config — see
 * `mage2kishan/module-checkout-extended/etc/config.xml`):
 *   - `cart(cart_id).panth_checkout_extended { ... }` extended envelope
 *   - `storeConfig { panth_checkout_extended_* }` feature flags
 *   - mutations:
 *       setOrderCommentOnCart(input: { cart_id, comment })
 *       setGiftMessageOnCart(input: { cart_id, from, to, message })
 *       setNewsletterOptInOnCart(input: { cart_id, opt_in })
 *
 * Every field is `.nullable().optional()` because we cannot verify the parent
 * schema at build time. We always `safeParse()` and fall back to `null` on
 * mismatch so missing fields never break the checkout.
 */

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const GiftMessage = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
});
export type GiftMessageT = z.infer<typeof GiftMessage>;

const CheckoutExtendedEnvelope = z.object({
  order_comment: z.string().nullable().optional(),
  order_comment_max_length: z.number().nullable().optional(),
  gift_message: GiftMessage.nullable().optional(),
  gift_message_enabled: z.boolean().nullable().optional(),
  gift_message_fee: z
    .object({
      value: z.number().nullable().optional(),
      currency: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  newsletter_opt_in_available: z.boolean().nullable().optional(),
  newsletter_opt_in_selected: z.boolean().nullable().optional(),
  newsletter_field_label: z.string().nullable().optional(),
});
export type CheckoutExtendedT = z.infer<typeof CheckoutExtendedEnvelope>;

const CheckoutExtendedQuery = z.object({
  cart: z
    .object({
      id: z.string().nullable().optional(),
      panth_checkout_extended: CheckoutExtendedEnvelope.nullable().optional(),
    })
    .nullable()
    .optional(),
});

const CheckoutExtendedConfig = z.object({
  panth_checkout_extended_enabled: z.boolean().nullable().optional(),
  panth_checkout_extended_newsletter_enabled: z.boolean().nullable().optional(),
  panth_checkout_extended_gift_message_enabled: z.boolean().nullable().optional(),
  panth_checkout_extended_order_comment_enabled: z.boolean().nullable().optional(),
});
export type CheckoutExtendedConfigT = z.infer<typeof CheckoutExtendedConfig>;

const CheckoutExtendedConfigEnvelope = z.object({
  storeConfig: CheckoutExtendedConfig.nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Mutation-result envelopes                                                  */
/* -------------------------------------------------------------------------- */

const MutationUserError = z.object({
  code: z.string().nullable().optional(),
  message: z.string(),
});

const SetOrderCommentEnvelope = z.object({
  setOrderCommentOnCart: z
    .object({
      cart: z
        .object({
          panth_checkout_extended: CheckoutExtendedEnvelope.nullable().optional(),
        })
        .nullable()
        .optional(),
      user_errors: z.array(MutationUserError).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const SetGiftMessageEnvelope = z.object({
  setGiftMessageOnCart: z
    .object({
      cart: z
        .object({
          panth_checkout_extended: CheckoutExtendedEnvelope.nullable().optional(),
        })
        .nullable()
        .optional(),
      user_errors: z.array(MutationUserError).nullable().optional(),
    })
    .nullable()
    .optional(),
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
      `[panth-checkout-extended] ${scope}: schema field missing — ` +
        `install/enable Panth_CheckoutExtended on the Magento side.`,
    );
  } else {
    console.warn(`[panth-checkout-extended] ${scope} failed:`, msg);
  }
}

/** Cap a user-entered comment before POSTing. Non-breaking guard. */
export function clampComment(value: string, max: number | null | undefined): string {
  const limit = typeof max === "number" && max > 0 ? Math.floor(max) : 500;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export async function getCheckoutExtended(
  cartId: string,
): Promise<CheckoutExtendedT | null> {
  const doc = /* GraphQL */ `
    query PanthCheckoutExtended($id: String!) {
      cart(cart_id: $id) {
        id
        panth_checkout_extended {
          order_comment
          order_comment_max_length
          gift_message { from to message }
          gift_message_enabled
          gift_message_fee { value currency }
          newsletter_opt_in_available
          newsletter_opt_in_selected
          newsletter_field_label
        }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { id: cartId });
    const parsed = CheckoutExtendedQuery.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.cart?.panth_checkout_extended ?? null;
  } catch (err) {
    logSchemaMiss("getCheckoutExtended", err);
    return null;
  }
}

export async function getCheckoutExtendedConfig(): Promise<CheckoutExtendedConfigT | null> {
  const doc = /* GraphQL */ `
    query PanthCheckoutExtendedConfig {
      storeConfig {
        panth_checkout_extended_enabled
        panth_checkout_extended_newsletter_enabled
        panth_checkout_extended_gift_message_enabled
        panth_checkout_extended_order_comment_enabled
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const parsed = CheckoutExtendedConfigEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.storeConfig ?? null;
  } catch (err) {
    logSchemaMiss("getCheckoutExtendedConfig", err);
    return null;
  }
}

export async function setOrderCommentOnCart(
  cartId: string,
  comment: string,
): Promise<CheckoutExtendedT | null> {
  const doc = /* GraphQL */ `
    mutation SetOrderCommentOnCart($input: SetOrderCommentOnCartInput!) {
      setOrderCommentOnCart(input: $input) {
        cart {
          panth_checkout_extended {
            order_comment
            order_comment_max_length
          }
        }
        user_errors { code message }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, {
      input: { cart_id: cartId, comment: clampComment(comment, 500) },
    });
    const parsed = SetOrderCommentEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.setOrderCommentOnCart?.cart?.panth_checkout_extended ?? null;
  } catch (err) {
    logSchemaMiss("setOrderCommentOnCart", err);
    return null;
  }
}

export async function setGiftMessageOnCart(
  cartId: string,
  gift: GiftMessageT,
): Promise<CheckoutExtendedT | null> {
  const doc = /* GraphQL */ `
    mutation SetGiftMessageOnCart($input: SetGiftMessageOnCartInput!) {
      setGiftMessageOnCart(input: $input) {
        cart {
          panth_checkout_extended {
            gift_message { from to message }
            gift_message_fee { value currency }
          }
        }
        user_errors { code message }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, {
      input: {
        cart_id: cartId,
        from: clampComment(gift.from ?? "", 120),
        to: clampComment(gift.to ?? "", 120),
        message: clampComment(gift.message ?? "", 500),
      },
    });
    const parsed = SetGiftMessageEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.setGiftMessageOnCart?.cart?.panth_checkout_extended ?? null;
  } catch (err) {
    logSchemaMiss("setGiftMessageOnCart", err);
    return null;
  }
}
