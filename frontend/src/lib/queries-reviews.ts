import { z } from "zod";
import { GraphQLClient } from "graphql-request";
import { query } from "./graphql";

/* -------------------------------------------------------------------------- */
/* Auth-aware GraphQL client (local copy — keep queries-customer.ts untouched) */
/* -------------------------------------------------------------------------- */
/**
 * The shared `query()` helper in `./graphql.ts` uses a module-level
 * GraphQLClient without per-request headers. For any call that requires a
 * customer token we build a one-off `GraphQLClient` with an
 * `Authorization: Bearer <token>` header and run the request through it.
 *
 * We intentionally do not mutate the shared client — multiple concurrent
 * customer sessions would race on a shared header.
 */
const isBrowser = typeof window !== "undefined";
const endpoint = isBrowser
  ? "/graphql"
  : (import.meta.env.MAGENTO_GRAPHQL_URL ?? "http://mage2react.local/graphql");

async function authQuery<T>(
  document: string,
  variables: Record<string, unknown> | undefined,
  token: string,
): Promise<T> {
  const client = new GraphQLClient(endpoint, {
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "mage2react-frontend",
      Store: "default",
      Authorization: `Bearer ${token}`,
    },
    fetch: globalThis.fetch,
  });
  return client.request<T>(document, variables);
}

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const RatingBreakdownItem = z.object({
  name: z.string().nullable(),
  value: z.string().nullable(),
});

const ReviewItem = z.object({
  nickname: z.string().nullable(),
  summary: z.string().nullable(),
  text: z.string().nullable(),
  created_at: z.string().nullable(),
  average_rating: z.number().nullable(),
  ratings_breakdown: z.array(RatingBreakdownItem).nullable().optional(),
});
export type ReviewItemT = z.infer<typeof ReviewItem>;

const ReviewsPage = z.object({
  items: z.array(ReviewItem),
  page_info: z.object({
    total_pages: z.number(),
    current_page: z.number().nullable().optional(),
    page_size: z.number().nullable().optional(),
  }),
});

const ProductReviewsSchema = z.object({
  products: z.object({
    items: z.array(
      z.object({
        sku: z.string().nullable().optional(),
        review_count: z.number().nullable().optional(),
        rating_summary: z.number().nullable().optional(),
        reviews: ReviewsPage,
      }),
    ),
  }),
});

export type ProductReviewsResult = {
  items: ReviewItemT[];
  totalPages: number;
  currentPage: number;
  pageSize: number;
  reviewCount: number;
  ratingSummary: number;
};

/* -------------------------------------------------------------------------- */
/* List reviews                                                               */
/* -------------------------------------------------------------------------- */

export async function getProductReviews(
  sku: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<ProductReviewsResult> {
  const doc = /* GraphQL */ `
    query ProductReviews($sku: String!, $page: Int!, $pageSize: Int!) {
      products(filter: { sku: { eq: $sku } }) {
        items {
          sku
          review_count
          rating_summary
          reviews(pageSize: $pageSize, currentPage: $page) {
            items {
              nickname
              summary
              text
              created_at
              average_rating
              ratings_breakdown {
                name
                value
              }
            }
            page_info {
              total_pages
              current_page
              page_size
            }
          }
        }
      }
    }
  `;
  const raw = await query<unknown>(doc, { sku, page, pageSize });
  const parsed = ProductReviewsSchema.parse(raw);
  const product = parsed.products.items[0];
  if (!product) {
    return {
      items: [],
      totalPages: 0,
      currentPage: page,
      pageSize,
      reviewCount: 0,
      ratingSummary: 0,
    };
  }
  return {
    items: product.reviews.items,
    totalPages: product.reviews.page_info.total_pages,
    currentPage: product.reviews.page_info.current_page ?? page,
    pageSize: product.reviews.page_info.page_size ?? pageSize,
    reviewCount: product.review_count ?? 0,
    ratingSummary: product.rating_summary ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Review rating metadata (cached in-module 10 minutes)                       */
/* -------------------------------------------------------------------------- */

const RatingMetadataValue = z.object({
  value_id: z.string(),
  value: z.string().nullable(),
});

const RatingMetadataItem = z.object({
  id: z.string(),
  name: z.string().nullable(),
  values: z.array(RatingMetadataValue),
});
export type RatingMetadataItemT = z.infer<typeof RatingMetadataItem>;
export type RatingMetadataValueT = z.infer<typeof RatingMetadataValue>;

const RatingMetadataSchema = z.object({
  productReviewRatingsMetadata: z.object({
    items: z.array(RatingMetadataItem),
  }),
});

const METADATA_TTL_MS = 10 * 60 * 1000;
let cachedMetadata: { data: RatingMetadataItemT[]; at: number } | null = null;

export async function getReviewMetadata(): Promise<RatingMetadataItemT[]> {
  const now = Date.now();
  if (cachedMetadata && now - cachedMetadata.at < METADATA_TTL_MS) {
    return cachedMetadata.data;
  }
  const doc = /* GraphQL */ `
    query ProductReviewRatingsMetadata {
      productReviewRatingsMetadata {
        items {
          id
          name
          values {
            value_id
            value
          }
        }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const data = RatingMetadataSchema.parse(raw).productReviewRatingsMetadata.items;
    cachedMetadata = { data, at: now };
    return data;
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Submit review                                                              */
/* -------------------------------------------------------------------------- */

export type SubmitReviewInput = {
  sku: string;
  nickname: string;
  summary: string;
  text: string;
  ratings: { id: string; value_id: string }[];
};

export type SubmitReviewUserError = {
  code: string | null;
  message: string;
};

export type SubmitReviewResult = {
  review: {
    nickname: string | null;
    summary: string | null;
    text: string | null;
    average_rating: number | null;
  } | null;
  userErrors: SubmitReviewUserError[];
};

const SubmitReviewSchema = z.object({
  createProductReview: z.object({
    review: z
      .object({
        nickname: z.string().nullable(),
        summary: z.string().nullable(),
        text: z.string().nullable(),
        average_rating: z.number().nullable(),
      })
      .nullable(),
  }),
});

/**
 * Submit a product review.
 *
 * Magento 2.4.8's `createProductReview` mutation does not expose a
 * `user_errors` field on the output type — validation failures bubble up as
 * GraphQL errors. We catch those, unpack the first message, and normalise
 * everything into a `userErrors` array so callers have a single shape to
 * render against.
 *
 * When `token` is provided, the mutation runs with an `Authorization: Bearer`
 * header so the review attaches to the logged-in customer account. Without a
 * token the call is anonymous — Magento respects the store-level "Allow
 * Guests to Write Reviews" config.
 */
export async function submitProductReview(
  input: SubmitReviewInput,
  token?: string,
): Promise<SubmitReviewResult> {
  const doc = /* GraphQL */ `
    mutation CreateProductReview($input: CreateProductReviewInput!) {
      createProductReview(input: $input) {
        review {
          nickname
          summary
          text
          average_rating
        }
      }
    }
  `;
  try {
    const raw = token
      ? await authQuery<unknown>(doc, { input }, token)
      : await query<unknown>(doc, { input });
    const parsed = SubmitReviewSchema.parse(raw);
    return {
      review: parsed.createProductReview.review,
      userErrors: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      review: null,
      userErrors: [{ code: null, message }],
    };
  }
}
