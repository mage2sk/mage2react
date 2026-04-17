import { z } from "zod";
import { query } from "./graphql";
import { panthQuery } from "./panth-db";

/**
 * queries-product-slider.ts
 *
 * Hybrid resolver for `Panth_ProductSlider`:
 *   1. Read slider config (identifier, title, filters, display options) from
 *      the `panth_product_slider` MySQL table.
 *   2. Expand the configured product SKUs via Magento's native
 *      `products(filter: {sku: {in: [...]}})` GraphQL so the card has
 *      current price, stock, and media.
 *
 * Never throws. Returns `null` when the slider doesn't exist or every
 * configured SKU fails to resolve to a product.
 */

const Money = z.object({
  value: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

const PriceRange = z.object({
  minimum_price: z
    .object({
      regular_price: Money.nullable().optional(),
      final_price: Money.nullable().optional(),
    })
    .nullable()
    .optional(),
});

const MediaImage = z.object({
  url: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
});

const ProductCardLike = z.object({
  uid: z.string().nullable().optional(),
  __typename: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  url_key: z.string().nullable().optional(),
  url_suffix: z.string().nullable().optional(),
  small_image: MediaImage.nullable().optional(),
  price_range: PriceRange.nullable().optional(),
});
export type ProductCardLike = z.infer<typeof ProductCardLike>;

const ProductsEnvelope = z.object({
  products: z
    .object({
      items: z.array(ProductCardLike).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type ProductSliderResult = {
  slug: string;
  title: string;
  subtitle: string;
  items: ProductCardLike[];
  autoplay: boolean;
  autoplayMs: number;
  columnsDesktop: number;
};

interface SliderConfigRow {
  identifier: string;
  title: string;
  description: string | null;
  product_skus: string | null;
  category_ids: string | null;
  page_size: number;
  columns_desktop: number;
  enable_autoplay: number;
  autoplay_interval: number;
  sort_by: string;
  sort_direction: string;
}

export async function getProductSlider(
  slug: string,
): Promise<ProductSliderResult | null> {
  if (!slug || typeof slug !== "string") return null;

  const rows = await panthQuery<SliderConfigRow>(
    `SELECT identifier, title, description, product_skus, category_ids,
            page_size, columns_desktop, enable_autoplay, autoplay_interval,
            sort_by, sort_direction
       FROM panth_product_slider
      WHERE identifier = ? AND is_active = 1
      LIMIT 1`,
    [slug],
  );
  const cfg = rows[0];
  if (!cfg) return null;

  const skus = (cfg.product_skus ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, cfg.page_size || 8);

  if (skus.length === 0) return null;

  const doc = /* GraphQL */ `
    query PanthProductsBySku($skus: [String]!) {
      products(filter: { sku: { in: $skus } }, pageSize: 50) {
        items {
          uid
          __typename
          name
          sku
          url_key
          url_suffix
          small_image { url label }
          price_range {
            minimum_price {
              regular_price { value currency }
              final_price { value currency }
            }
          }
        }
      }
    }
  `;

  let items: ProductCardLike[] = [];
  try {
    const raw = await query<unknown>(doc, { skus });
    const parsed = ProductsEnvelope.safeParse(raw);
    if (parsed.success) {
      const fetched = (parsed.data.products?.items ?? []).filter(
        (p): p is ProductCardLike => p !== null && p !== undefined,
      );
      // Preserve the admin-configured order of SKUs (GraphQL returns by
      // entity_id, not by input order).
      const bySku = new Map<string, ProductCardLike>();
      for (const p of fetched) {
        if (p.sku) bySku.set(p.sku, p);
      }
      items = skus
        .map((s) => bySku.get(s))
        .filter((p): p is ProductCardLike => p !== undefined);
    }
  } catch {
    /* non-fatal — fall through to empty */
  }

  if (items.length === 0) return null;

  return {
    slug: cfg.identifier,
    title: cfg.title,
    subtitle: (cfg.description ?? "").trim(),
    items,
    autoplay: cfg.enable_autoplay === 1,
    autoplayMs: Math.max(1500, cfg.autoplay_interval || 4000),
    columnsDesktop: Math.max(1, Math.min(6, cfg.columns_desktop || 4)),
  };
}
