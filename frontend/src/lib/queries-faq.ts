import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-faq.ts
 *
 * Typed helpers for `Panth_Faq`. The parent module is expected to expose:
 *   - `panthFaqCategories` — flat list of categories
 *   - `panthFaqItems(categoryId, pageSize, currentPage)` — paginated Q/A list
 *
 * `.nullable().optional()` everywhere, `safeParse` + safe empty fallback.
 */

/* -------------------------------------------------------------------------- */
/* Zod                                                                         */
/* -------------------------------------------------------------------------- */

const RawCategory = z.object({
  id: z.union([z.string(), z.number()]).nullable().optional(),
  name: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  position: z.number().nullable().optional(),
});

const RawItem = z.object({
  id: z.union([z.string(), z.number()]).nullable().optional(),
  category_id: z.union([z.string(), z.number()]).nullable().optional(),
  question: z.string().nullable().optional(),
  answer: z.string().nullable().optional(),
  position: z.number().nullable().optional(),
});

const PageInfo = z.object({
  total_pages: z.number().nullable().optional(),
  current_page: z.number().nullable().optional(),
  page_size: z.number().nullable().optional(),
});

const CategoriesEnvelope = z.object({
  panthFaqCategories: z
    .object({
      items: z.array(RawCategory).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const ItemsEnvelope = z.object({
  panthFaqItems: z
    .object({
      items: z.array(RawItem).nullable().optional(),
      page_info: PageInfo.nullable().optional(),
    })
    .nullable()
    .optional(),
});

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

export interface FaqCategory {
  id: string;
  name: string;
  slug: string;
  position: number;
}

export interface FaqItem {
  id: string;
  category_id: string | null;
  question: string;
  answer: string;
  position: number;
}

export interface FaqItemsPage {
  items: FaqItem[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

/* -------------------------------------------------------------------------- */
/* Warnings                                                                    */
/* -------------------------------------------------------------------------- */

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-faq] panthFaqCategories/panthFaqItems missing — install/enable Panth_Faq.",
    );
  } else {
    console.warn("[panth-faq] query failed:", msg);
  }
}

/* -------------------------------------------------------------------------- */
/* Coercion                                                                    */
/* -------------------------------------------------------------------------- */

function coerceCategory(raw: z.infer<typeof RawCategory>, idx: number): FaqCategory | null {
  const rawId = raw.id;
  const id = typeof rawId === "number" ? String(rawId) : (rawId ?? "").trim();
  const name = (raw.name ?? "").trim();
  if (!id || !name) return null;
  const slug = (raw.slug ?? "").trim() || id;
  return {
    id,
    name,
    slug,
    position: typeof raw.position === "number" ? raw.position : idx,
  };
}

function coerceItem(raw: z.infer<typeof RawItem>, idx: number): FaqItem | null {
  const rawId = raw.id;
  const id = typeof rawId === "number" ? String(rawId) : (rawId ?? "").trim();
  const rawCat = raw.category_id;
  const category_id = typeof rawCat === "number" ? String(rawCat) : rawCat?.trim() || null;
  const question = (raw.question ?? "").trim();
  const answer = (raw.answer ?? "").trim();
  if (!id || !question || !answer) return null;
  return {
    id,
    category_id,
    question,
    answer,
    position: typeof raw.position === "number" ? raw.position : idx,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Returns all FAQ categories sorted by position. Never throws.
 */
export async function getFaqCategories(): Promise<FaqCategory[]> {
  const doc = /* GraphQL */ `
    query PanthFaqCategories {
      panthFaqCategories {
        items {
          id
          name
          slug
          position
        }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, {});
    const parsed = CategoriesEnvelope.safeParse(raw);
    if (!parsed.success) return [];
    const env = parsed.data.panthFaqCategories;
    if (!env) return [];
    const out: FaqCategory[] = [];
    (env.items ?? []).forEach((c, idx) => {
      if (!c) return;
      const coerced = coerceCategory(c, idx);
      if (coerced) out.push(coerced);
    });
    out.sort((a, b) => a.position - b.position);
    return out;
  } catch (err) {
    logSchemaMiss(err);
    return [];
  }
}

/**
 * Returns a paginated list of FAQ items, optionally filtered to one
 * category. Never throws.
 */
export async function getFaqItems(
  categoryId: string | null = null,
  currentPage: number = 1,
  pageSize: number = 24,
): Promise<FaqItemsPage> {
  const empty: FaqItemsPage = {
    items: [],
    currentPage,
    pageSize,
    totalPages: 0,
  };

  const doc = /* GraphQL */ `
    query PanthFaqItems($categoryId: String, $pageSize: Int!, $currentPage: Int!) {
      panthFaqItems(categoryId: $categoryId, pageSize: $pageSize, currentPage: $currentPage) {
        items {
          id
          category_id
          question
          answer
          position
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
    const raw = await query<unknown>(doc, {
      categoryId: categoryId || null,
      pageSize,
      currentPage,
    });
    const parsed = ItemsEnvelope.safeParse(raw);
    if (!parsed.success) return empty;
    const env = parsed.data.panthFaqItems;
    if (!env) return empty;
    const items: FaqItem[] = [];
    (env.items ?? []).forEach((it, idx) => {
      if (!it) return;
      const coerced = coerceItem(it, idx);
      if (coerced) items.push(coerced);
    });
    items.sort((a, b) => a.position - b.position);
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
