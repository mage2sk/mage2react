import { panthQuery } from "./panth-db";

/**
 * queries-testimonials.ts
 *
 * Reads `Panth_Testimonials` content directly from the seeded `panth_testimonial`
 * table. Panth_Testimonials has no GraphQL resolver so we query MySQL
 * over the Docker network.
 *
 * Never throws. Returns an empty page on any failure.
 */

export interface TestimonialT {
  customer_name?: string | null;
  photo?: string | null;
  rating?: number | null;
  title?: string | null;
  body?: string | null;
  created_at?: string | null;
  customer_title?: string | null;
  customer_company?: string | null;
}

export type TestimonialsPage = {
  items: TestimonialT[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
};

interface TestimonialRow {
  customer_name: string;
  customer_title: string | null;
  customer_company: string | null;
  customer_image: string | null;
  rating: number;
  title: string;
  content: string;
  short_content: string | null;
  created_at: string;
}

export async function getTestimonials(
  pageSize: number = 12,
  currentPage: number = 1,
): Promise<TestimonialsPage> {
  const size = Math.max(1, Math.floor(pageSize));
  const page = Math.max(1, Math.floor(currentPage));
  const offset = (page - 1) * size;

  const rows = await panthQuery<TestimonialRow>(
    `SELECT customer_name, customer_title, customer_company, customer_image,
            rating, title, content, short_content, created_at
       FROM panth_testimonial
      WHERE status = 1
      ORDER BY is_featured DESC, sort_order ASC, testimonial_id ASC
      LIMIT ${size} OFFSET ${offset}`,
  );

  const totalRows = await panthQuery<{ total: number }>(
    "SELECT COUNT(*) AS total FROM panth_testimonial WHERE status = 1",
  );
  const total = totalRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));

  const items: TestimonialT[] = rows.map((r) => ({
    customer_name: r.customer_name,
    customer_title: r.customer_title,
    customer_company: r.customer_company,
    photo: r.customer_image,
    rating: r.rating,
    title: r.title,
    body: r.short_content ?? r.content,
    created_at: r.created_at,
  }));

  return { items, currentPage: page, pageSize: size, totalPages };
}
