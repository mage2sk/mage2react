/**
 * Catalog listing / search / layered-nav queries.
 *
 * Intentionally isolated from `queries.ts` so the two can evolve independently
 * (this file changes every time a new filterable attribute shows up; the core
 * product/category schemas rarely do).
 *
 * Everything here is Zod-validated and strict-TS clean. The module exposes:
 *   - searchProducts(…)              — for /search and keyword lookups.
 *   - getCategoryProductsWithFacets  — for category pages with filters + facets.
 *   - buildFilterInput(searchParams) — URLSearchParams → ProductAttributeFilterInput
 *   - serializeFilters(obj)          — the reverse direction.
 *   - ALLOWED_SORTS                  — whitelist the toolbar can lean on.
 *
 * URL grammar accepted by buildFilterInput:
 *   ?color=Red,Blue        → { color: { in: ["Red","Blue"] } }
 *   ?price=20-40           → { price: { from: "20", to: "40" } }
 *   ?size=M                → { size: { eq: "M" } }
 *   ?<attr>=a,b,c          → { <attr>: { in: ["a","b","c"] } } (multi)
 *   ?<attr>=a              → { <attr>: { eq: "a" } }            (single)
 *
 * Reserved query params (NOT treated as filters):
 *   page, p, pageSize, ps, sort, q, view, dir
 */

import { z } from "zod";
import { query } from "./graphql";

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                          */
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

/* -------------------------------------------------------------------------- */
/* Card shape — reuses the same fields as ProductCard but lives locally so     */
/* this module is self-contained.                                             */
/* -------------------------------------------------------------------------- */

const CatalogProductCard = z.object({
  uid: z.string(),
  __typename: z.string().optional(),
  name: z.string(),
  sku: z.string(),
  url_key: z.string().nullable(),
  url_suffix: z.string().nullable().optional(),
  small_image: MediaImage.nullable().optional(),
  price_range: PriceRange,
});
export type CatalogProductCardT = z.infer<typeof CatalogProductCard>;

const PageInfo = z.object({
  current_page: z.number(),
  page_size: z.number(),
  total_pages: z.number(),
});
export type PageInfoT = z.infer<typeof PageInfo>;

/* -------------------------------------------------------------------------- */
/* Aggregations & sort fields                                                 */
/* -------------------------------------------------------------------------- */

const AggregationOption = z.object({
  label: z.string().nullable(),
  value: z.string(),
  count: z.number().nullable(),
});
export type AggregationOptionT = z.infer<typeof AggregationOption>;

const Aggregation = z.object({
  attribute_code: z.string(),
  label: z.string().nullable(),
  position: z.number().nullable().optional(),
  count: z.number().nullable().optional(),
  options: z.array(AggregationOption),
});
export type AggregationT = z.infer<typeof Aggregation>;

const SortFieldOption = z.object({
  label: z.string().nullable(),
  value: z.string(),
});
export type SortFieldOptionT = z.infer<typeof SortFieldOption>;

const SortFields = z.object({
  default: z.string().nullable().optional(),
  options: z.array(SortFieldOption),
});
export type SortFieldsT = z.infer<typeof SortFields>;

/* -------------------------------------------------------------------------- */
/* Response schema                                                            */
/* -------------------------------------------------------------------------- */

const ProductsResponseSchema = z.object({
  products: z.object({
    total_count: z.number(),
    items: z.array(CatalogProductCard),
    page_info: PageInfo,
    aggregations: z.array(Aggregation).nullable().optional(),
    sort_fields: SortFields.nullable().optional(),
  }),
});

export type CatalogProductsResultT = {
  items: CatalogProductCardT[];
  total_count: number;
  page_info: PageInfoT;
  aggregations: AggregationT[];
  sort_fields: SortFieldsT | null;
};

/* -------------------------------------------------------------------------- */
/* Reserved (non-filter) URL params + sort whitelist                          */
/* -------------------------------------------------------------------------- */

export const RESERVED_PARAMS = new Set<string>([
  "page", "p", "pageSize", "ps", "sort", "q", "view", "dir", "cols",
]);

/** Known sort keys we'll forward to Magento. Anything else falls back to default. */
export const ALLOWED_SORTS = {
  position_asc: { position: "ASC" },
  relevance: { relevance: "DESC" },
  name_asc: { name: "ASC" },
  name_desc: { name: "DESC" },
  price_asc: { price: "ASC" },
  price_desc: { price: "DESC" },
} as const;

export type SortKey = keyof typeof ALLOWED_SORTS;

export function isSortKey(v: string | null | undefined): v is SortKey {
  return !!v && Object.prototype.hasOwnProperty.call(ALLOWED_SORTS, v);
}

export const DEFAULT_PAGE_SIZE = 12;
export const ALLOWED_PAGE_SIZES = [12, 24, 36] as const;
export type PageSize = (typeof ALLOWED_PAGE_SIZES)[number];

export function normalizePageSize(v: string | number | null | undefined): PageSize {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE;
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n)
    ? (n as PageSize)
    : DEFAULT_PAGE_SIZE;
}

export function normalizePage(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/* -------------------------------------------------------------------------- */
/* URL filter <-> GraphQL filter                                              */
/* -------------------------------------------------------------------------- */

/**
 * Value type for a single filter clause.
 * Magento's ProductAttributeFilterInput accepts:
 *   - { eq: "X" }
 *   - { in: ["X","Y"] }
 *   - { from: "20", to: "40" }
 */
export type FilterClause =
  | { eq: string }
  | { in: string[] }
  | { from?: string; to?: string };

export type FilterInput = Record<string, FilterClause>;

/**
 * Parse `?price=20-40` style values. Returns null on parse failure.
 * Accepts open ranges: `20-` (from 20), `-40` (up to 40).
 */
function parsePriceRange(raw: string): { from?: string; to?: string } | null {
  // Multi-bucket aggregation values from Magento look like `20_29.99` — accept both.
  const norm = raw.replace("_", "-");
  const match = norm.match(/^(\d*(?:\.\d+)?)-(\d*(?:\.\d+)?)$/);
  if (!match) return null;
  const fromRaw = match[1] ?? "";
  const toRaw = match[2] ?? "";
  const out: { from?: string; to?: string } = {};
  if (fromRaw) out.from = fromRaw;
  if (toRaw) out.to = toRaw;
  return Object.keys(out).length ? out : null;
}

/**
 * Build a ProductAttributeFilterInput object from a URLSearchParams instance.
 * Pass `categoryUid` to auto-add the category clause (category listing page).
 */
export function buildFilterInput(
  searchParams: URLSearchParams,
  categoryUid?: string | null,
): FilterInput {
  const out: FilterInput = {};

  if (categoryUid) {
    out.category_uid = { eq: categoryUid };
  }

  for (const [key, rawValue] of searchParams.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;
    if (!rawValue) continue;

    if (key === "price") {
      const range = parsePriceRange(rawValue);
      if (range) out.price = range;
      continue;
    }

    const values = rawValue
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    if (values.length === 1) {
      out[key] = { eq: values[0]! };
    } else {
      out[key] = { in: values };
    }
  }

  return out;
}

/**
 * Turn a `FilterInput` back into URL search params. Used to build share-links
 * and the "Clear this filter" hrefs.
 */
export function serializeFilters(filters: FilterInput): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, clause] of Object.entries(filters)) {
    if (key === "category_uid") continue; // implicit in the URL path
    if ("eq" in clause && clause.eq) {
      out.set(key, clause.eq);
    } else if ("in" in clause && clause.in.length) {
      out.set(key, clause.in.join(","));
    } else if ("from" in clause || "to" in clause) {
      const f = ("from" in clause ? clause.from : undefined) ?? "";
      const t = ("to" in clause ? clause.to : undefined) ?? "";
      if (f || t) out.set(key, `${f}-${t}`);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* GraphQL document builder                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Build the sort clause. Magento's GraphQL parser is fussy about quoting, so
 * we inline a known-safe map rather than interpolating user input.
 */
function buildSortClause(sort: SortKey | null | undefined): string {
  if (!sort || !isSortKey(sort)) return "{ position: ASC }";
  const entry = ALLOWED_SORTS[sort];
  const pair = Object.entries(entry)[0];
  if (!pair) return "{ position: ASC }";
  return `{ ${pair[0]}: ${pair[1]} }`;
}

const PRODUCTS_DOC = (sortLiteral: string) => /* GraphQL */ `
  query CatalogProducts(
    $search: String
    $filter: ProductAttributeFilterInput!
    $page: Int!
    $pageSize: Int!
  ) {
    products(
      search: $search
      filter: $filter
      currentPage: $page
      pageSize: $pageSize
      sort: ${sortLiteral}
    ) {
      total_count
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
      page_info { current_page page_size total_pages }
      aggregations {
        attribute_code
        label
        count
        options { label value count }
      }
      sort_fields {
        default
        options { label value }
      }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface SearchProductsArgs {
  search?: string;
  filters?: FilterInput;
  sort?: SortKey | null;
  page?: number;
  pageSize?: number;
}

async function runQuery(
  search: string,
  filters: FilterInput,
  sort: SortKey | null | undefined,
  page: number,
  pageSize: number,
): Promise<CatalogProductsResultT> {
  const doc = PRODUCTS_DOC(buildSortClause(sort));
  const variables = {
    search: search || "",
    filter: filters,
    page: Math.max(1, Math.floor(page)),
    pageSize: Math.max(1, Math.floor(pageSize)),
  };

  const raw = await query<unknown>(doc, variables);
  const parsed = ProductsResponseSchema.parse(raw);
  return {
    items: parsed.products.items,
    total_count: parsed.products.total_count,
    page_info: parsed.products.page_info,
    aggregations: parsed.products.aggregations ?? [],
    sort_fields: parsed.products.sort_fields ?? null,
  };
}

export async function searchProducts(
  args: SearchProductsArgs,
): Promise<CatalogProductsResultT> {
  const {
    search = "",
    filters = {},
    sort = null,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = args;
  return runQuery(search, filters, sort, page, pageSize);
}

export interface CategoryProductsWithFacetsArgs {
  categoryUid: string;
  filters?: FilterInput;
  sort?: SortKey | null;
  page?: number;
  pageSize?: number;
}

export async function getCategoryProductsWithFacets(
  args: CategoryProductsWithFacetsArgs,
): Promise<CatalogProductsResultT> {
  const {
    categoryUid,
    filters = {},
    sort = null,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = args;
  const merged: FilterInput = {
    ...filters,
    category_uid: { eq: categoryUid },
  };
  return runQuery("", merged, sort, page, pageSize);
}
