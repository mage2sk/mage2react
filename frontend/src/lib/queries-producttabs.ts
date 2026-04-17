import { z } from "zod";

/**
 * queries-producttabs.ts
 *
 * Helpers for `Panth_Producttabs` (`mage2kishan/module-producttabs`). The
 * parent module contributes a `panth_tabs` field to `ProductInterface`:
 *
 *   panth_tabs { id, title, content, sort_order }
 *
 * Every field is `.nullable().optional()` because we don't own the upstream
 * schema. Callers splice the fragment into the PDP query and call
 * `extractPanthTabs(product)` to get a cleaned, sorted list.
 */

export const PANTH_TABS_PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment PanthTabsProductFragment on ProductInterface {
    panth_tabs {
      id
      title
      content
      sort_order
    }
  }
`;

const PanthTab = z.object({
  id: z.union([z.string(), z.number()]).nullable().optional(),
  title: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  sort_order: z.number().nullable().optional(),
});

export type PanthTabT = {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
};

const ProductWithTabs = z.object({
  panth_tabs: z.array(PanthTab).nullable().optional(),
});

/**
 * Slugify a title into a stable id — deterministic, no randomness.
 */
function slugify(s: string, fallback: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || fallback;
}

/**
 * Safe-parse the `panth_tabs` list. Returns `[]` on any mismatch.
 * Sorted by `sort_order` ascending. Entries with empty title are dropped.
 */
export function extractPanthTabs(product: unknown): PanthTabT[] {
  const parsed = ProductWithTabs.safeParse(product);
  if (!parsed.success) return [];
  const raw = parsed.data.panth_tabs ?? [];
  const cleaned: PanthTabT[] = [];
  let index = 0;
  for (const r of raw) {
    const title = (r.title ?? "").trim();
    if (!title) continue;
    const rawId = r.id == null ? "" : String(r.id).trim();
    const id = slugify(rawId || title, `tab-${index}`);
    cleaned.push({
      id,
      title,
      content: r.content ?? "",
      sortOrder: typeof r.sort_order === "number" ? r.sort_order : index,
    });
    index += 1;
  }
  cleaned.sort((a, b) => a.sortOrder - b.sortOrder);
  return cleaned;
}
