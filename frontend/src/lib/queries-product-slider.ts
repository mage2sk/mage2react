import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-product-slider.ts
 *
 * Typed helper for `Panth_ProductSlider` (`mage2kishan/module-product-slider`).
 * The parent module is expected to expose a `panthProductSlider(slug)` query
 * returning `{ title, subtitle, items: [...ProductCardLike] }`. Every field is
 * `.nullable().optional()` — we cannot verify the upstream schema, so the
 * function always `safeParse`s and returns `null` on any mismatch.
 *
 * Callers:
 *   const slider = await getProductSlider("bestsellers");
 *   if (!slider) return null; // parent module missing or empty slider
 */

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

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

const SliderEnvelope = z.object({
  panthProductSlider: z
    .object({
      slug: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
      subtitle: z.string().nullable().optional(),
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
};

/* -------------------------------------------------------------------------- */
/* One-shot warning                                                           */
/* -------------------------------------------------------------------------- */

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-product-slider] panthProductSlider field missing — install/enable Panth_ProductSlider.",
    );
  } else {
    console.warn("[panth-product-slider] query failed:", msg);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fetch a named product slider. Returns `null` when the backend module is not
 * installed or the slider is empty / undefined. Never throws.
 *
 * @param slug   The admin-defined slug (e.g. "bestsellers", "home-featured").
 */
export async function getProductSlider(
  slug: string,
): Promise<ProductSliderResult | null> {
  if (!slug || typeof slug !== "string") return null;

  const doc = /* GraphQL */ `
    query PanthProductSlider($slug: String!) {
      panthProductSlider(slug: $slug) {
        slug
        title
        subtitle
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

  try {
    const raw = await query<unknown>(doc, { slug });
    const parsed = SliderEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    const env = parsed.data.panthProductSlider;
    if (!env) return null;
    const items = (env.items ?? []).filter(
      (p): p is ProductCardLike => p !== null && p !== undefined,
    );
    if (items.length === 0) return null;
    return {
      slug: env.slug ?? slug,
      title: (env.title ?? "").trim(),
      subtitle: (env.subtitle ?? "").trim(),
      items,
    };
  } catch (err) {
    logSchemaMiss(err);
    return null;
  }
}
