import { z } from "zod";
import { query } from "./graphql";

/**
 * Lightweight product-card fetcher used by the Recently-Viewed strip.
 *
 * Shape is intentionally aligned with `ProductCardT` / `CategoryProductCardT`
 * in `src/lib/queries.ts` so the strip renders with the same data contract
 * as the rest of the site. Configurable-variant data is omitted — the strip
 * never swatch-previews.
 */

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

const Money = z.object({
  value: z.number().nullable(),
  currency: z.string().nullable(),
});

const PriceRange = z.object({
  minimum_price: z.object({
    regular_price: Money,
    final_price: Money,
  }),
});

const MediaImage = z.object({
  url: z.string().nullable(),
  label: z.string().nullable(),
});

const RecentProductCard = z.object({
  uid: z.string(),
  __typename: z.string().optional(),
  name: z.string(),
  sku: z.string(),
  url_key: z.string().nullable(),
  url_suffix: z.string().nullable().optional(),
  small_image: MediaImage.nullable().optional(),
  price_range: PriceRange,
});

export type RecentProductCardT = z.infer<typeof RecentProductCard>;

const RecentProductsSchema = z.object({
  products: z.object({
    items: z.array(RecentProductCard),
  }),
});

/* -------------------------------------------------------------------------- */
/* Fetcher                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fetch lightweight product cards for the given SKUs.
 *
 * Magento's GraphQL `products(filter: { sku: { in: $skus } })` endpoint does
 * not guarantee result order, so we reorder by the caller's input sequence
 * before returning. Missing / unpublished / disabled SKUs are silently
 * dropped. Returns an empty array on network or validation error.
 */
export async function getProductsBySku(
  skus: string[],
): Promise<RecentProductCardT[]> {
  if (skus.length === 0) return [];

  // Dedupe defensively — the store already does this, but treat input as
  // untrusted so a bad caller can't balloon the query.
  const unique = Array.from(new Set(skus.filter((s) => s.length > 0)));
  if (unique.length === 0) return [];

  const doc = /* GraphQL */ `
    query RecentlyViewedProducts($skus: [String!]!, $pageSize: Int!) {
      products(filter: { sku: { in: $skus } }, pageSize: $pageSize) {
        items {
          uid
          __typename
          name
          sku
          url_key
          url_suffix
          small_image {
            url
            label
          }
          price_range {
            minimum_price {
              regular_price {
                value
                currency
              }
              final_price {
                value
                currency
              }
            }
          }
        }
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, {
      skus: unique,
      pageSize: unique.length,
    });
    const parsed = RecentProductsSchema.parse(raw);
    const bySku = new Map<string, RecentProductCardT>();
    for (const item of parsed.products.items) {
      bySku.set(item.sku, item);
    }
    // Reorder to match input, drop missing.
    const ordered: RecentProductCardT[] = [];
    for (const sku of unique) {
      const p = bySku.get(sku);
      if (p) ordered.push(p);
    }
    return ordered;
  } catch {
    return [];
  }
}
