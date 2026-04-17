import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-testimonials.ts
 *
 * Typed helper for `Panth_Testimonials`. The parent module is expected to
 * expose a `panthTestimonials(pageSize, currentPage)` query returning
 * `{ items: [...], page_info }`. All fields are `.nullable().optional()` —
 * we cannot verify the schema, so `safeParse` + empty fallback is the rule.
 */

const TestimonialItem = z.object({
  customer_name: z.string().nullable().optional(),
  photo: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type TestimonialT = z.infer<typeof TestimonialItem>;

const PageInfo = z.object({
  total_pages: z.number().nullable().optional(),
  current_page: z.number().nullable().optional(),
  page_size: z.number().nullable().optional(),
});

const Envelope = z.object({
  panthTestimonials: z
    .object({
      items: z.array(TestimonialItem).nullable().optional(),
      page_info: PageInfo.nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type TestimonialsPage = {
  items: TestimonialT[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
};

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-testimonials] panthTestimonials field missing — install/enable Panth_Testimonials.",
    );
  } else {
    console.warn("[panth-testimonials] query failed:", msg);
  }
}

/**
 * Returns a page of testimonials. Never throws. On any error or schema
 * mismatch, returns an empty page with the requested pagination shape.
 */
export async function getTestimonials(
  pageSize: number = 12,
  currentPage: number = 1,
): Promise<TestimonialsPage> {
  const empty: TestimonialsPage = {
    items: [],
    currentPage,
    pageSize,
    totalPages: 0,
  };

  const doc = /* GraphQL */ `
    query PanthTestimonials($pageSize: Int!, $currentPage: Int!) {
      panthTestimonials(pageSize: $pageSize, currentPage: $currentPage) {
        items {
          customer_name
          photo
          rating
          title
          body
          created_at
        }
        page_info {
          total_pages
          current_page
          page_size
        }
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, { pageSize, currentPage });
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return empty;
    const env = parsed.data.panthTestimonials;
    if (!env) return empty;
    const items = (env.items ?? []).filter(
      (t): t is TestimonialT => t !== null && t !== undefined,
    );
    const info = env.page_info ?? {};
    return {
      items,
      currentPage: info.current_page ?? currentPage,
      pageSize: info.page_size ?? pageSize,
      totalPages: info.total_pages ?? 0,
    };
  } catch (err) {
    logSchemaMiss(err);
    return empty;
  }
}
