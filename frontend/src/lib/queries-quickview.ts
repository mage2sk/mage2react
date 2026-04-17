import { z } from "zod";

/**
 * queries-quickview.ts
 *
 * Minimal product-detail query tailored for the quick-view modal
 * (not the full PDP query). When `Panth_Quickview` is installed the modal
 * picks up an extended `panth_quickview` field — badges, stock counter,
 * rating summary, featured media — which degrades gracefully when missing.
 *
 * All fields are `.nullable().optional()`. The caller `safeParse`s and falls
 * back to the core product fields on any mismatch.
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

const QuickBadge = z.object({
  label: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

const QuickExtras = z.object({
  badges: z.array(QuickBadge).nullable().optional(),
  stock_counter: z.number().nullable().optional(),
  rating_summary: z.number().nullable().optional(),
  review_count: z.number().nullable().optional(),
  short_description_html: z.string().nullable().optional(),
  featured_image: MediaImage.nullable().optional(),
});

const QuickProduct = z.object({
  uid: z.string(),
  __typename: z.string().nullable().optional(),
  name: z.string(),
  sku: z.string(),
  url_key: z.string().nullable().optional(),
  url_suffix: z.string().nullable().optional(),
  stock_status: z.string().nullable().optional(),
  image: MediaImage.nullable().optional(),
  small_image: MediaImage.nullable().optional(),
  short_description: z.object({ html: z.string().nullable().optional() }).nullable().optional(),
  price_range: PriceRange,
  panth_quickview: QuickExtras.nullable().optional(),
});
export type QuickProductT = z.infer<typeof QuickProduct>;

const Response = z.object({
  products: z.object({
    items: z.array(QuickProduct).nullable().optional(),
  }),
});

// Without the panth_quickview field (used as graceful fallback when the
// parent module is not installed).
const ResponseCore = z.object({
  products: z.object({
    items: z
      .array(QuickProduct.omit({ panth_quickview: true }))
      .nullable()
      .optional(),
  }),
});

const QUICK_QUERY_PANTH = /* GraphQL */ `
  query PanthQuickView($urlKey: String!) {
    products(filter: { url_key: { eq: $urlKey } }) {
      items {
        uid
        __typename
        name
        sku
        url_key
        url_suffix
        stock_status
        image { url label }
        small_image { url label }
        short_description { html }
        price_range {
          minimum_price {
            regular_price { value currency }
            final_price { value currency }
          }
        }
        panth_quickview {
          badges { label color }
          stock_counter
          rating_summary
          review_count
          short_description_html
          featured_image { url label }
        }
      }
    }
  }
`;

const QUICK_QUERY_CORE = /* GraphQL */ `
  query QuickViewProductCore($urlKey: String!) {
    products(filter: { url_key: { eq: $urlKey } }) {
      items {
        uid
        __typename
        name
        sku
        url_key
        url_suffix
        stock_status
        image { url label }
        small_image { url label }
        short_description { html }
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

const GRAPHQL_ENDPOINT = "/graphql";

async function post(doc: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Store: "default" },
    body: JSON.stringify({ query: doc, variables }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: unknown; errors?: unknown };
  if (body.errors) return null;
  return body.data ?? null;
}

/**
 * Fetch quick-view product data. Tries the `Panth_Quickview` enriched query
 * first, falls back to the core product query when the parent module is not
 * installed or the field is unknown. Never throws.
 */
export async function getQuickviewProduct(urlKey: string): Promise<QuickProductT | null> {
  if (!urlKey || typeof urlKey !== "string") return null;
  try {
    const data = await post(QUICK_QUERY_PANTH, { urlKey });
    const parsed = Response.safeParse(data);
    if (parsed.success) {
      const first = (parsed.data.products.items ?? [])[0];
      if (first) return first;
    }
  } catch {
    // fall through to core
  }
  try {
    const data = await post(QUICK_QUERY_CORE, { urlKey });
    const parsed = ResponseCore.safeParse(data);
    if (!parsed.success) return null;
    const first = (parsed.data.products.items ?? [])[0];
    if (!first) return null;
    return { ...first, panth_quickview: null };
  } catch {
    return null;
  }
}
