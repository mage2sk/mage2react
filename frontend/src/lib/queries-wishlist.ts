import { z } from "zod";
import { authQuery } from "./queries-customer";

/* -------------------------------------------------------------------------- */
/* Wishlist lookups for the heart-toggle button                               */
/* -------------------------------------------------------------------------- */
/**
 * These helpers live alongside the richer `getWishlist` / `addProductsToWishlist`
 * helpers in `queries-customer.ts`, but are deliberately leaner:
 *
 *   - `getWishlistIds` only fetches the `(wishlistId, itemId, sku)` tuples the
 *     heart button needs to hydrate its state. Avoids pulling images, price,
 *     stock — all of which the PDP already has.
 *   - `addToWishlistBySku` / `removeFromWishlistById` surface normalised
 *     `{ ok, error? }` results and map Magento's `user_errors[]` into a single
 *     human-readable string the `/api/wishlist/*` endpoints can pass through.
 *
 * Magento supports multiple wishlists per customer (e.g. "Birthday", "Work
 * supplies"), but the storefront only exposes the default. We always operate
 * on `wishlists[0]`.
 */

/* -------------------------------------------------------------------------- */
/* Read: minimal SKU list                                                     */
/* -------------------------------------------------------------------------- */

const WishlistIdsSchema = z.object({
  customer: z.object({
    wishlists: z.array(
      z.object({
        id: z.string(),
        items_v2: z
          .object({
            items: z.array(
              z.object({
                id: z.string(),
                product: z
                  .object({
                    sku: z.string(),
                  })
                  .nullable(),
              }),
            ),
          })
          .nullable(),
      }),
    ),
  }),
});

export type WishlistHydration = {
  wishlistId: string | null;
  skus: string[];
  /** Lookup for O(1) remove-by-sku from the button component. */
  bySku: Record<string, string>;
};

export async function getWishlistIds(token: string): Promise<WishlistHydration> {
  const doc = /* GraphQL */ `
    query WishlistIds {
      customer {
        wishlists {
          id
          items_v2 {
            items {
              id
              product {
                sku
              }
            }
          }
        }
      }
    }
  `;
  try {
    const raw = await authQuery<unknown>(doc, undefined, token);
    const parsed = WishlistIdsSchema.parse(raw);
    const first = parsed.customer.wishlists[0];
    if (!first) {
      return { wishlistId: null, skus: [], bySku: {} };
    }
    const items = first.items_v2?.items ?? [];
    const bySku: Record<string, string> = {};
    const skus: string[] = [];
    for (const item of items) {
      if (item.product?.sku) {
        bySku[item.product.sku] = item.id;
        skus.push(item.product.sku);
      }
    }
    return { wishlistId: first.id, skus, bySku };
  } catch {
    return { wishlistId: null, skus: [], bySku: {} };
  }
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

const AddSchema = z.object({
  addProductsToWishlist: z.object({
    wishlist: z.object({
      id: z.string(),
      items_v2: z
        .object({
          items: z.array(
            z.object({
              id: z.string(),
              product: z.object({ sku: z.string() }).nullable(),
            }),
          ),
        })
        .nullable(),
    }),
    user_errors: z.array(
      z.object({
        code: z.string().nullable(),
        message: z.string(),
      }),
    ),
  }),
});

export type AddWishlistResult =
  | { ok: true; wishlistId: string; wishlistItemId: string }
  | { ok: false; error: string };

/**
 * Resolve (or create, via the first add) the default wishlist for the
 * authenticated customer and add a single SKU to it. If Magento returns a
 * `user_errors[]` we forward the first message.
 */
export async function addToWishlistBySku(
  token: string,
  sku: string,
): Promise<AddWishlistResult> {
  // Look up the customer's wishlist id first. Magento requires it on the
  // `addProductsToWishlist` mutation.
  const hydration = await getWishlistIds(token);
  if (!hydration.wishlistId) {
    // Magento auto-provisions a default wishlist on first use; if it's still
    // null here it's an account-config issue we surface to the caller.
    return {
      ok: false,
      error: "No wishlist available on this account.",
    };
  }

  const doc = /* GraphQL */ `
    mutation AddToWishlistBySku(
      $wishlistId: ID!
      $wishlistItems: [WishlistItemInput!]!
    ) {
      addProductsToWishlist(
        wishlistId: $wishlistId
        wishlistItems: $wishlistItems
      ) {
        wishlist {
          id
          items_v2 {
            items {
              id
              product { sku }
            }
          }
        }
        user_errors { code message }
      }
    }
  `;

  try {
    const raw = await authQuery<unknown>(
      doc,
      {
        wishlistId: hydration.wishlistId,
        wishlistItems: [{ sku, quantity: 1 }],
      },
      token,
    );
    const parsed = AddSchema.parse(raw);
    const firstErr = parsed.addProductsToWishlist.user_errors[0];
    if (firstErr) {
      return { ok: false, error: firstErr.message };
    }
    // Find the newly-added item. Magento returns the full wishlist, so we
    // look up by SKU to grab the item id.
    const added = parsed.addProductsToWishlist.wishlist.items_v2?.items.find(
      (i) => i.product?.sku === sku,
    );
    if (!added) {
      return { ok: false, error: "Item was not added." };
    }
    return {
      ok: true,
      wishlistId: parsed.addProductsToWishlist.wishlist.id,
      wishlistItemId: added.id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

const RemoveSchema = z.object({
  removeProductsFromWishlist: z.object({
    wishlist: z.object({ id: z.string() }),
    user_errors: z.array(
      z.object({
        code: z.string().nullable(),
        message: z.string(),
      }),
    ),
  }),
});

export type RemoveWishlistResult = { ok: true } | { ok: false; error: string };

export async function removeFromWishlistById(
  token: string,
  wishlistId: string,
  wishlistItemId: string,
): Promise<RemoveWishlistResult> {
  const doc = /* GraphQL */ `
    mutation RemoveFromWishlistById(
      $wishlistId: ID!
      $wishlistItemsIds: [ID!]!
    ) {
      removeProductsFromWishlist(
        wishlistId: $wishlistId
        wishlistItemsIds: $wishlistItemsIds
      ) {
        wishlist { id }
        user_errors { code message }
      }
    }
  `;
  try {
    const raw = await authQuery<unknown>(
      doc,
      { wishlistId, wishlistItemsIds: [wishlistItemId] },
      token,
    );
    const parsed = RemoveSchema.parse(raw);
    const firstErr = parsed.removeProductsFromWishlist.user_errors[0];
    if (firstErr) {
      return { ok: false, error: firstErr.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
