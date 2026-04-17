/**
 * Magento 2.4.8 Compare List GraphQL bindings.
 *
 * Exposes typed, Zod-validated wrappers around the native compare-list
 * mutations/queries. The server-side identifier is a UUID the schema calls
 * `uid`; callers persist it in the `m2r_compare_uid` cookie.
 *
 * Scope is intentionally narrow — this module never imports from the
 * existing queries-*.ts files and never touches the schema shared by cart
 * or catalog code.
 */

import { z } from "zod";
import { query } from "./graphql";

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                          */
/* -------------------------------------------------------------------------- */

const Money = z.object({
  value: z.number().nullable(),
  currency: z.string().nullable(),
});

const PriceRange = z.object({
  minimum_price: z.object({
    regular_price: Money,
    final_price: Money,
  }),
});

const MediaImage = z.object({
  url: z.string().nullable(),
  label: z.string().nullable(),
});

/* -------------------------------------------------------------------------- */
/* Compare-list product + item schema                                         */
/* -------------------------------------------------------------------------- */

const CompareProduct = z.object({
  uid: z.string(),
  name: z.string(),
  sku: z.string(),
  url_key: z.string().nullable(),
  url_suffix: z.string().nullable().optional(),
  small_image: MediaImage.nullable().optional(),
  price_range: PriceRange,
  stock_status: z.string().nullable().optional(),
});

export type CompareProductT = z.infer<typeof CompareProduct>;

const CompareAttribute = z.object({
  code: z.string(),
  value: z.string(),
});

const CompareItem = z.object({
  uid: z.string(),
  product: CompareProduct,
  attributes: z.array(CompareAttribute).nullable().optional(),
});

export type CompareItemT = z.infer<typeof CompareItem>;

const AttributeRef = z.object({
  code: z.string(),
  label: z.string(),
});

const CompareList = z.object({
  uid: z.string(),
  item_count: z.number(),
  attributes: z.array(AttributeRef).nullable().optional(),
  items: z.array(CompareItem.nullable()).nullable().optional(),
});

export type CompareListT = z.infer<typeof CompareList>;

/* -------------------------------------------------------------------------- */
/* Shared GraphQL fragment                                                    */
/* -------------------------------------------------------------------------- */

const COMPARE_FRAGMENT = /* GraphQL */ `
  fragment CompareListFields on CompareList {
    uid
    item_count
    attributes {
      code
      label
    }
    items {
      uid
      product {
        uid
        name
        sku
        url_key
        url_suffix
        small_image { url label }
        stock_status
        price_range {
          minimum_price {
            regular_price { value currency }
            final_price { value currency }
          }
        }
      }
      attributes {
        code
        value
      }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

const CreateCompareListSchema = z.object({
  createCompareList: CompareList.nullable(),
});

export async function createCompareList(
  productUids: string[],
): Promise<string | null> {
  const doc = /* GraphQL */ `
    ${COMPARE_FRAGMENT}
    mutation CreateCompareList($input: CreateCompareListInput) {
      createCompareList(input: $input) {
        ...CompareListFields
      }
    }
  `;
  const raw = await query<unknown>(doc, {
    input: { products: productUids },
  });
  const parsed = CreateCompareListSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data.createCompareList?.uid ?? null;
}

const AddToCompareSchema = z.object({
  addProductsToCompareList: CompareList.nullable(),
});

export async function addProductsToCompareList(
  uid: string,
  productUids: string[],
): Promise<CompareListT | null> {
  const doc = /* GraphQL */ `
    ${COMPARE_FRAGMENT}
    mutation AddToCompareList($input: AddProductsToCompareListInput!) {
      addProductsToCompareList(input: $input) {
        ...CompareListFields
      }
    }
  `;
  const raw = await query<unknown>(doc, {
    input: { uid, products: productUids },
  });
  const parsed = AddToCompareSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data.addProductsToCompareList;
}

const RemoveFromCompareSchema = z.object({
  removeProductsFromCompareList: CompareList.nullable(),
});

export async function removeProductsFromCompareList(
  uid: string,
  productUids: string[],
): Promise<CompareListT | null> {
  const doc = /* GraphQL */ `
    ${COMPARE_FRAGMENT}
    mutation RemoveFromCompareList($input: RemoveProductsFromCompareListInput!) {
      removeProductsFromCompareList(input: $input) {
        ...CompareListFields
      }
    }
  `;
  const raw = await query<unknown>(doc, {
    input: { uid, products: productUids },
  });
  const parsed = RemoveFromCompareSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data.removeProductsFromCompareList;
}

const GetCompareListSchema = z.object({ compareList: CompareList.nullable() });

export async function getCompareList(uid: string): Promise<CompareListT | null> {
  const doc = /* GraphQL */ `
    ${COMPARE_FRAGMENT}
    query GetCompareList($uid: ID!) {
      compareList(uid: $uid) {
        ...CompareListFields
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { uid });
    const parsed = GetCompareListSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.compareList;
  } catch {
    return null;
  }
}

const DeleteCompareListSchema = z.object({
  deleteCompareList: z
    .object({ result: z.boolean() })
    .nullable()
    .optional(),
});

export async function deleteCompareList(uid: string): Promise<boolean> {
  const doc = /* GraphQL */ `
    mutation DeleteCompareList($uid: ID!) {
      deleteCompareList(uid: $uid) {
        result
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { uid });
    const parsed = DeleteCompareListSchema.safeParse(raw);
    return parsed.success && (parsed.data.deleteCompareList?.result ?? false);
  } catch {
    return false;
  }
}

/**
 * Returns an existing compare list (if `uid` is provided and still valid on
 * the server) or creates a fresh empty one. Never throws — returns `null`
 * on hard network/schema errors so callers can degrade gracefully.
 */
export async function getOrCreateCompareList(
  uid?: string | null,
): Promise<{ uid: string; list: CompareListT | null } | null> {
  if (uid) {
    const existing = await getCompareList(uid);
    if (existing) return { uid: existing.uid, list: existing };
  }
  try {
    const freshUid = await createCompareList([]);
    if (!freshUid) return null;
    const list = await getCompareList(freshUid);
    return { uid: freshUid, list };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Cookie helpers                                                             */
/* -------------------------------------------------------------------------- */

export const COMPARE_COOKIE_NAME = "m2r_compare_uid";
export const COMPARE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const COMPARE_MAX_ITEMS = 4;

/**
 * Shape-compatible subset of AstroCookies. Kept local so we don't take a
 * dependency on the cart module's `CookieJar` export.
 */
export interface CompareCookieJar {
  get(name: string): { value?: string } | undefined;
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none" | boolean;
      maxAge?: number;
      path?: string;
    },
  ): void;
  delete?(name: string, options?: { path?: string }): void;
}

export function readCompareCookie(jar: CompareCookieJar): string | null {
  return jar.get(COMPARE_COOKIE_NAME)?.value ?? null;
}

export function setCompareCookie(jar: CompareCookieJar, uid: string): void {
  jar.set(COMPARE_COOKIE_NAME, uid, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    maxAge: COMPARE_COOKIE_MAX_AGE,
    path: "/",
  });
}
