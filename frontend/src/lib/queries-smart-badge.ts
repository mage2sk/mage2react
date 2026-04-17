import { z } from "zod";

/**
 * queries-smart-badge.ts
 *
 * Helpers for consuming the `smart_badges` product-level field contributed
 * by `Panth_SmartBadge`. We do not own the parent schema, so:
 *   - Every field is `.nullable().optional()`.
 *   - Callers `safeParse` and fall back to `[]` on any mismatch.
 *
 * The fragment is meant to be spliced into an existing `products(...)` query
 * via the standard GraphQL `...Fragment` spread in the `items { ... }` block.
 */

/* -------------------------------------------------------------------------- */
/* GraphQL fragment                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Paste this fragment definition alongside the query that requests it, then
 * spread `...SmartBadgeProductFragment` inside `products { items { ... } }`.
 *
 * Example:
 *   const doc = gql`
 *     ${SMART_BADGE_PRODUCT_FRAGMENT}
 *     query Catalog { products(...) { items { sku ...SmartBadgeProductFragment } } }
 *   `;
 */
export const SMART_BADGE_PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment SmartBadgeProductFragment on ProductInterface {
    smart_badges {
      label
      color
      priority
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const SmartBadge = z.object({
  label: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
});
export type SmartBadgeT = {
  label: string;
  color: string;
  priority: number;
};

const ProductWithBadges = z.object({
  smart_badges: z.array(SmartBadge).nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Extractor                                                                  */
/* -------------------------------------------------------------------------- */

// A small allowlist so callers can't inject arbitrary CSS via `color`. If the
// parent module emits a free-form hex/CSS value, we fall back to a neutral
// brand tone rather than echoing unverified strings into a `style=` attribute.
const COLOR_ALLOWLIST: Record<string, string> = {
  red: "#dc2626",
  green: "#16a34a",
  blue: "#2563eb",
  amber: "#d97706",
  yellow: "#ca8a04",
  gray: "#4b5563",
  zinc: "#3f3f46",
  black: "#111827",
  brand: "var(--color-brand)",
};

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normaliseColor(raw: string | null | undefined): string {
  if (!raw) return COLOR_ALLOWLIST.gray!;
  const key = raw.trim().toLowerCase();
  if (key in COLOR_ALLOWLIST) return COLOR_ALLOWLIST[key]!;
  if (HEX_RE.test(key)) return key;
  return COLOR_ALLOWLIST.gray!;
}

/**
 * Safely extract `smart_badges` from any product-shaped object. Returns an
 * empty array on any schema mismatch or when the parent module is not
 * installed. Badges are sorted by descending priority (higher = shown first);
 * unlabelled entries are dropped.
 */
export function extractSmartBadges(product: unknown): SmartBadgeT[] {
  const parsed = ProductWithBadges.safeParse(product);
  if (!parsed.success) return [];
  const raw = parsed.data.smart_badges ?? [];
  const cleaned: SmartBadgeT[] = [];
  for (const b of raw) {
    const label = (b.label ?? "").trim();
    if (!label) continue;
    cleaned.push({
      label,
      color: normaliseColor(b.color),
      priority: typeof b.priority === "number" ? b.priority : 0,
    });
  }
  cleaned.sort((a, b) => b.priority - a.priority);
  return cleaned;
}
