import { z } from "zod";

/**
 * queries-search-autocomplete.ts
 *
 * Typed helper for `Panth_SearchAutocomplete`. The parent module exposes
 *
 *   panthSearchAutocomplete(query: String!, pageSize: Int!) {
 *     total_count
 *     suggestions {
 *       type   # "product" | "category" | "term"
 *       label
 *       url
 *       thumbnail
 *       price { value currency }
 *       popularity
 *     }
 *   }
 *
 * All fields are `.nullable().optional()`. When the parent module is missing
 * we fall back to a stock `products(search:...)` query and synthesise
 * product-only suggestions.
 */

/* -------------------------------------------------------------------------- */
/* Public shape                                                               */
/* -------------------------------------------------------------------------- */

export type SuggestionType = "product" | "category" | "term";

export interface Suggestion {
  type: SuggestionType;
  label: string;
  url: string;
  thumbnail: string | null;
  price: { value: number | null; currency: string | null } | null;
  popularity: number | null;
}

export interface AutocompleteResult {
  suggestions: Suggestion[];
  total_count: number;
}

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const Money = z.object({
  value: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

const PanthSuggestion = z.object({
  type: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  price: Money.nullable().optional(),
  popularity: z.number().nullable().optional(),
});

const PanthEnvelope = z.object({
  panthSearchAutocomplete: z
    .object({
      total_count: z.number().nullable().optional(),
      suggestions: z.array(PanthSuggestion).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const CoreProductEnvelope = z.object({
  products: z
    .object({
      total_count: z.number().nullable().optional(),
      items: z
        .array(
          z.object({
            uid: z.string().nullable().optional(),
            name: z.string().nullable().optional(),
            url_key: z.string().nullable().optional(),
            url_suffix: z.string().nullable().optional(),
            small_image: z
              .object({ url: z.string().nullable().optional() })
              .nullable()
              .optional(),
            price_range: z
              .object({
                minimum_price: z
                  .object({ final_price: Money.nullable().optional() })
                  .nullable()
                  .optional(),
              })
              .nullable()
              .optional(),
          }),
        )
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});

/* -------------------------------------------------------------------------- */
/* Fetch helpers                                                              */
/* -------------------------------------------------------------------------- */

const GRAPHQL_ENDPOINT = "/graphql";

async function post(
  doc: string,
  variables: Record<string, unknown>,
  signal: AbortSignal,
): Promise<unknown> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Store: "default" },
    body: JSON.stringify({ query: doc, variables }),
    signal,
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: unknown; errors?: unknown };
  if (body.errors) return null;
  return body.data ?? null;
}

function normaliseType(t: string | null | undefined): SuggestionType {
  const v = (t ?? "").trim().toLowerCase();
  if (v === "category") return "category";
  if (v === "term" || v === "query" || v === "suggestion") return "term";
  return "product";
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Returns grouped autocomplete suggestions for `query`. Never throws. Empty
 * result is `{ suggestions: [], total_count: 0 }`.
 */
export async function searchAutocomplete(
  queryText: string,
  pageSize: number = 8,
  signal?: AbortSignal,
): Promise<AutocompleteResult> {
  const q = queryText.trim();
  const empty: AutocompleteResult = { suggestions: [], total_count: 0 };
  if (q.length < 2) return empty;

  const ctrl = signal ?? new AbortController().signal;

  // Try the Panth query first.
  const panthDoc = /* GraphQL */ `
    query PanthSearchAutocomplete($q: String!, $pageSize: Int!) {
      panthSearchAutocomplete(query: $q, pageSize: $pageSize) {
        total_count
        suggestions {
          type
          label
          url
          thumbnail
          price { value currency }
          popularity
        }
      }
    }
  `;

  try {
    const data = await post(panthDoc, { q, pageSize }, ctrl);
    const parsed = PanthEnvelope.safeParse(data);
    if (parsed.success && parsed.data.panthSearchAutocomplete) {
      const env = parsed.data.panthSearchAutocomplete;
      const raw = env.suggestions ?? [];
      const suggestions: Suggestion[] = [];
      for (const s of raw) {
        const label = (s.label ?? "").trim();
        const url = (s.url ?? "").trim();
        if (!label || !url) continue;
        suggestions.push({
          type: normaliseType(s.type),
          label,
          url,
          thumbnail: (s.thumbnail ?? "").trim() || null,
          price: s.price
            ? { value: s.price.value ?? null, currency: s.price.currency ?? null }
            : null,
          popularity: typeof s.popularity === "number" ? s.popularity : null,
        });
      }
      if (suggestions.length > 0) {
        return {
          suggestions,
          total_count: env.total_count ?? suggestions.length,
        };
      }
    }
  } catch {
    // fall through
  }

  // Fallback: stock products search.
  const coreDoc = /* GraphQL */ `
    query SearchAutocompleteCore($q: String!, $pageSize: Int!) {
      products(search: $q, pageSize: $pageSize, currentPage: 1) {
        total_count
        items {
          uid
          name
          url_key
          url_suffix
          small_image { url }
          price_range { minimum_price { final_price { value currency } } }
        }
      }
    }
  `;

  try {
    const data = await post(coreDoc, { q, pageSize }, ctrl);
    const parsed = CoreProductEnvelope.safeParse(data);
    if (!parsed.success) return empty;
    const items = parsed.data.products?.items ?? [];
    const suggestions: Suggestion[] = [];
    for (const p of items) {
      const label = (p.name ?? "").trim();
      const urlKey = (p.url_key ?? "").trim();
      if (!label || !urlKey) continue;
      const url = `/${urlKey}${p.url_suffix ?? ".html"}`;
      suggestions.push({
        type: "product",
        label,
        url,
        thumbnail: p.small_image?.url ?? null,
        price: {
          value: p.price_range?.minimum_price?.final_price?.value ?? null,
          currency: p.price_range?.minimum_price?.final_price?.currency ?? null,
        },
        popularity: null,
      });
    }
    return {
      suggestions,
      total_count: parsed.data.products?.total_count ?? suggestions.length,
    };
  } catch {
    return empty;
  }
}
