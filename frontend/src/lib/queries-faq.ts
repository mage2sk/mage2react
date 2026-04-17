import { panthQuery } from "./panth-db";

/**
 * queries-faq.ts
 *
 * Reads `Panth_Faq` content directly from the seeded `panth_faq_*` tables.
 * Panth_Faq has no GraphQL resolver so we query MySQL over the Docker
 * network. Items are linked to categories via the `panth_faq_item_faq_category`
 * join table; unlinked items are returned when `categoryId` is `null`.
 *
 * Never throws. Returns `[]` / zero totals on any failure.
 */

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

export async function getFaqCategories(): Promise<FaqCategory[]> {
  const rows = await panthQuery<{
    category_id: number;
    name: string;
    url_key: string | null;
    sort_order: number | null;
  }>(
    "SELECT category_id, name, url_key, sort_order FROM panth_faq_category WHERE is_active = 1 ORDER BY sort_order ASC, category_id ASC",
  );
  return rows.map((r, idx) => ({
    id: String(r.category_id),
    name: (r.name ?? "").trim(),
    slug: (r.url_key ?? String(r.category_id)).trim() || String(r.category_id),
    position: typeof r.sort_order === "number" ? r.sort_order : idx,
  }));
}

export async function getFaqItems(
  categoryId: string | null = null,
  currentPage: number = 1,
  pageSize: number = 24,
): Promise<FaqItemsPage> {
  const page = Math.max(1, Math.floor(currentPage));
  const size = Math.max(1, Math.floor(pageSize));
  const offset = (page - 1) * size;

  // Use separate code paths for "all items" vs "category filter" so we can
  // avoid binding weirdness with optional categoryId. Dedupe by question text
  // because the seed introduced duplicates.
  const filterArgs: Array<string | number> = [];
  let itemsSql: string;
  let countSql: string;

  if (categoryId) {
    filterArgs.push(categoryId);
    itemsSql = `
      SELECT i.item_id, i.question, i.answer, i.sort_order, c.faq_category_id
        FROM panth_faq_item i
        INNER JOIN panth_faq_item_faq_category c ON c.item_id = i.item_id
       WHERE i.is_active = 1 AND c.faq_category_id = ?
         AND i.item_id IN (
           SELECT MIN(item_id) FROM panth_faq_item WHERE is_active = 1 GROUP BY question
         )
       ORDER BY i.sort_order ASC, i.item_id ASC
       LIMIT ${size} OFFSET ${offset}
    `;
    countSql = `
      SELECT COUNT(DISTINCT i.question) AS total
        FROM panth_faq_item i
        INNER JOIN panth_faq_item_faq_category c ON c.item_id = i.item_id
       WHERE i.is_active = 1 AND c.faq_category_id = ?
    `;
  } else {
    itemsSql = `
      SELECT i.item_id, i.question, i.answer, i.sort_order,
             (SELECT faq_category_id FROM panth_faq_item_faq_category x WHERE x.item_id = i.item_id LIMIT 1) AS faq_category_id
        FROM panth_faq_item i
       WHERE i.is_active = 1
         AND i.item_id IN (
           SELECT MIN(item_id) FROM panth_faq_item WHERE is_active = 1 GROUP BY question
         )
       ORDER BY i.sort_order ASC, i.item_id ASC
       LIMIT ${size} OFFSET ${offset}
    `;
    countSql = `
      SELECT COUNT(DISTINCT question) AS total FROM panth_faq_item WHERE is_active = 1
    `;
  }

  const rows = await panthQuery<{
    item_id: number;
    question: string;
    answer: string;
    sort_order: number | null;
    faq_category_id: number | null;
  }>(itemsSql, filterArgs);

  const totalRows = await panthQuery<{ total: number }>(countSql, filterArgs);
  const total = totalRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));

  const items: FaqItem[] = rows.map((r, idx) => ({
    id: String(r.item_id),
    category_id: r.faq_category_id != null ? String(r.faq_category_id) : null,
    question: (r.question ?? "").trim(),
    answer: (r.answer ?? "").trim(),
    position: typeof r.sort_order === "number" ? r.sort_order : idx,
  }));

  return { items, currentPage: page, pageSize: size, totalPages };
}
