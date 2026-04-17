import { z } from "zod";
import { authQuery } from "./queries-customer";

/**
 * queries-order-attachments.ts
 *
 * Typed fetch helpers for `Panth_OrderAttachments`'s storefront-facing GraphQL
 * extensions. Extends the authenticated `customer.orders` query with the
 * `panth_order_attachments { ... }` collection per order.
 *
 * Contract (inferred from the parent module):
 *   type CustomerOrder {
 *     panth_order_attachments: [PanthOrderAttachment!]
 *   }
 *   type PanthOrderAttachment {
 *     id: ID
 *     filename: String
 *     size: Int         # bytes
 *     url: String       # signed download URL
 *     uploaded_at: String
 *   }
 *
 * Every field is `.nullable().optional()` because we cannot verify the parent
 * schema at build time. We always `safeParse()` — never `parse()` — and fall
 * back to `[]` on mismatch so a missing field never breaks the order-view
 * page.
 */

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const OrderAttachment = z.object({
  id: z.union([z.string(), z.number()]).nullable().optional(),
  filename: z.string().nullable().optional(),
  size: z.number().nullable().optional(),
  url: z.string().nullable().optional(),
  uploaded_at: z.string().nullable().optional(),
});
export type OrderAttachmentT = z.infer<typeof OrderAttachment>;

const OrderWithAttachments = z.object({
  number: z.string().nullable().optional(),
  panth_order_attachments: z.array(OrderAttachment).nullable().optional(),
});

const OrderAttachmentsQuery = z.object({
  customer: z
    .object({
      orders: z
        .object({
          items: z.array(OrderWithAttachments).nullable().optional(),
        })
        .nullable()
        .optional(),
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
      `[panth-order-attachments] ${scope}: schema field missing — ` +
        `install/enable Panth_OrderAttachments on the Magento side.`,
    );
  } else {
    console.warn(`[panth-order-attachments] ${scope} failed:`, msg);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Returns the attachments list for the authenticated customer's order. Uses
 * the existing `authQuery` pattern so the HttpOnly customer token never
 * leaves the server.
 *
 * Returns `[]` on any of:
 *   - parent module not installed (schema field missing);
 *   - order not found for this customer (customer.orders.items empty);
 *   - safeParse mismatch.
 *
 * Never throws for missing-schema errors — callers render the order page
 * without the attachments block.
 */
export async function getOrderAttachments(
  orderNumber: string,
  token: string,
): Promise<OrderAttachmentT[]> {
  const doc = /* GraphQL */ `
    query CustomerOrderAttachments($number: String!) {
      customer {
        orders(filter: { number: { eq: $number } }) {
          items {
            number
            panth_order_attachments {
              id
              filename
              size
              url
              uploaded_at
            }
          }
        }
      }
    }
  `;
  try {
    const raw = await authQuery<unknown>(doc, { number: orderNumber }, token);
    const parsed = OrderAttachmentsQuery.safeParse(raw);
    if (!parsed.success) return [];
    const items = parsed.data.customer?.orders?.items ?? [];
    const first = items[0];
    return first?.panth_order_attachments ?? [];
  } catch (err) {
    logSchemaMiss("getOrderAttachments", err);
    return [];
  }
}

/**
 * Formats a byte count into a short human-readable string. Kept local so
 * callers don't need another dependency and the component stays
 * import-cycle-free.
 */
export function formatAttachmentSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib < 10 ? 1 : 0)} KB`;
  const mib = kib / 1024;
  return `${mib.toFixed(mib < 10 ? 1 : 0)} MB`;
}

/**
 * Strips path separators and control chars so a hostile filename cannot
 * break layout or look like a directory. We keep unicode letters/digits
 * and a small punctuation set; anything else collapses to `_`.
 */
export function sanitizeFilename(name: string | null | undefined): string {
  if (!name) return "attachment";
  const trimmed = name.replace(/[\\/\x00-\x1f\x7f]+/g, "_").trim();
  const collapsed = trimmed.replace(/\s+/g, " ");
  return collapsed.length > 0 ? collapsed.slice(0, 200) : "attachment";
}
