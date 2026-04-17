import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-checkout-success.ts
 *
 * Typed fetch helpers for `Panth_CheckoutSuccess`'s storefront-facing GraphQL
 * extensions. Enhances the thank-you page with ordered-items thumbnails, a
 * CMS block slot, tracking-pixel metadata, social share config, and
 * suggested-products feed.
 *
 * Contract (inferred from the parent module's admin config — see
 * `mage2kishan/module-checkout-success/etc/config.xml`):
 *   - `panthCheckoutSuccess(order_number: String!)` top-level query
 *   - `storeConfig { panth_checkout_success_* }` feature flags
 *
 * We never ship raw HTML from Magento to React. CMS block HTML MUST be run
 * through `sanitizeHtml()` before rendering. Every field is
 * `.nullable().optional()`.
 */

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const Money = z.object({
  value: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

const MediaImage = z.object({
  url: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
});

const SuccessOrderItem = z.object({
  sku: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  row_total: Money.nullable().optional(),
  thumbnail: MediaImage.nullable().optional(),
  product_url: z.string().nullable().optional(),
});
export type SuccessOrderItemT = z.infer<typeof SuccessOrderItem>;

const SocialShare = z.object({
  enabled: z.boolean().nullable().optional(),
  title: z.string().nullable().optional(),
  facebook: z.boolean().nullable().optional(),
  twitter: z.boolean().nullable().optional(),
  whatsapp: z.boolean().nullable().optional(),
  email: z.boolean().nullable().optional(),
});
export type SocialShareT = z.infer<typeof SocialShare>;

const TrackingScript = z.object({
  code: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
});
export type TrackingScriptT = z.infer<typeof TrackingScript>;

const SuggestedProduct = z.object({
  sku: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  url_key: z.string().nullable().optional(),
  image: MediaImage.nullable().optional(),
  price: Money.nullable().optional(),
});
export type SuggestedProductT = z.infer<typeof SuggestedProduct>;

const CheckoutSuccessEnvelope = z.object({
  thank_you_title: z.string().nullable().optional(),
  thank_you_message: z.string().nullable().optional(),
  layout: z.string().nullable().optional(),
  items: z.array(SuccessOrderItem).nullable().optional(),
  social_share: SocialShare.nullable().optional(),
  cms_block_html: z.string().nullable().optional(),
  tracking_scripts: z.array(TrackingScript).nullable().optional(),
  suggested_products: z.array(SuggestedProduct).nullable().optional(),
});
export type CheckoutSuccessT = z.infer<typeof CheckoutSuccessEnvelope>;

const CheckoutSuccessQuery = z.object({
  panthCheckoutSuccess: CheckoutSuccessEnvelope.nullable().optional(),
});

const CheckoutSuccessConfig = z.object({
  panth_checkout_success_enabled: z.boolean().nullable().optional(),
  panth_checkout_success_show_items: z.boolean().nullable().optional(),
  panth_checkout_success_show_social: z.boolean().nullable().optional(),
  panth_checkout_success_show_suggested: z.boolean().nullable().optional(),
});
export type CheckoutSuccessConfigT = z.infer<typeof CheckoutSuccessConfig>;

const CheckoutSuccessConfigEnvelope = z.object({
  storeConfig: CheckoutSuccessConfig.nullable().optional(),
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
      `[panth-checkout-success] ${scope}: schema field missing — ` +
        `install/enable Panth_CheckoutSuccess on the Magento side.`,
    );
  } else {
    console.warn(`[panth-checkout-success] ${scope} failed:`, msg);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export async function getCheckoutSuccess(
  orderNumber: string,
): Promise<CheckoutSuccessT | null> {
  const doc = /* GraphQL */ `
    query PanthCheckoutSuccess($orderNumber: String!) {
      panthCheckoutSuccess(order_number: $orderNumber) {
        thank_you_title
        thank_you_message
        layout
        items {
          sku
          name
          quantity
          row_total { value currency }
          thumbnail { url label }
          product_url
        }
        social_share { enabled title facebook twitter whatsapp email }
        cms_block_html
        tracking_scripts { code label html }
        suggested_products {
          sku
          name
          url_key
          image { url label }
          price { value currency }
        }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { orderNumber });
    const parsed = CheckoutSuccessQuery.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.panthCheckoutSuccess ?? null;
  } catch (err) {
    logSchemaMiss("getCheckoutSuccess", err);
    return null;
  }
}

export async function getCheckoutSuccessConfig(): Promise<CheckoutSuccessConfigT | null> {
  const doc = /* GraphQL */ `
    query PanthCheckoutSuccessConfig {
      storeConfig {
        panth_checkout_success_enabled
        panth_checkout_success_show_items
        panth_checkout_success_show_social
        panth_checkout_success_show_suggested
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const parsed = CheckoutSuccessConfigEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.storeConfig ?? null;
  } catch (err) {
    logSchemaMiss("getCheckoutSuccessConfig", err);
    return null;
  }
}

/** Builds a safe product URL from a `url_key` with fallback suffix. */
export function suggestedProductUrl(p: SuggestedProductT): string | null {
  if (!p.url_key) return null;
  return `/${p.url_key}.html`;
}
