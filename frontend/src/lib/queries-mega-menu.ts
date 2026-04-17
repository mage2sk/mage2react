import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-mega-menu.ts
 *
 * Typed helper for `Panth_MegaMenu`. The parent module is expected to expose
 * a `panthMegaMenu` query returning a nested tree of menu items; each top-
 * level item has optional columns (sub-link groups), a featured product card,
 * a promo image, and an optional custom HTML block.
 *
 * All fields `.nullable().optional()`. `safeParse` + empty fallback.
 */

const MenuLink = z.object({
  label: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});
export type MenuLinkT = z.infer<typeof MenuLink>;

const MenuColumn = z.object({
  title: z.string().nullable().optional(),
  links: z.array(MenuLink).nullable().optional(),
});
export type MenuColumnT = z.infer<typeof MenuColumn>;

const FeaturedProduct = z.object({
  name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
});
export type FeaturedProductT = z.infer<typeof FeaturedProduct>;

const PromoImage = z.object({
  image: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});
export type PromoImageT = z.infer<typeof PromoImage>;

const MegaMenuItem = z.object({
  label: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  columns: z.array(MenuColumn).nullable().optional(),
  featured_product: FeaturedProduct.nullable().optional(),
  promo_image: PromoImage.nullable().optional(),
  html_block: z.string().nullable().optional(),
});
export type MegaMenuItemT = z.infer<typeof MegaMenuItem>;

const Envelope = z.object({
  panthMegaMenu: z
    .object({
      items: z.array(MegaMenuItem).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type MegaMenuResult = { items: MegaMenuItemT[] };

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-mega-menu] panthMegaMenu field missing — install/enable Panth_MegaMenu.",
    );
  } else {
    console.warn("[panth-mega-menu] query failed:", msg);
  }
}

/**
 * Returns the full mega-menu tree. Never throws. On any error or schema
 * mismatch, returns `{ items: [] }`.
 */
export async function getMegaMenu(): Promise<MegaMenuResult> {
  const empty: MegaMenuResult = { items: [] };

  const doc = /* GraphQL */ `
    query PanthMegaMenu {
      panthMegaMenu {
        items {
          label
          url
          columns {
            title
            links {
              label
              url
            }
          }
          featured_product {
            name
            url
            image
            price
          }
          promo_image {
            image
            alt
            url
          }
          html_block
        }
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, {});
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return empty;
    const env = parsed.data.panthMegaMenu;
    if (!env) return empty;
    const items = (env.items ?? []).filter(
      (i): i is MegaMenuItemT => i !== null && i !== undefined,
    );
    return { items };
  } catch (err) {
    logSchemaMiss(err);
    return empty;
  }
}
