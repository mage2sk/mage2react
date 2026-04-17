import { z } from "zod";
import { query } from "./graphql";

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                          */
/* -------------------------------------------------------------------------- */

const Money = z.object({
  value: z.number().nullable(),
  currency: z.string().nullable(),
});

const MediaImage = z.object({
  url: z.string().nullable(),
  label: z.string().nullable(),
});

/* -------------------------------------------------------------------------- */
/* Cart schema — typed union of simple / configurable / bundle cart items.    */
/* -------------------------------------------------------------------------- */

const CartItemPrices = z.object({
  row_total_including_tax: Money,
  price: Money,
});

const CartItemProduct = z.object({
  uid: z.string(),
  name: z.string(),
  sku: z.string(),
  url_key: z.string().nullable(),
  url_suffix: z.string().nullable().optional(),
  small_image: MediaImage.nullable().optional(),
  stock_status: z.string().nullable().optional(),
});

const BaseCartItem = {
  uid: z.string(),
  quantity: z.number(),
  product: CartItemProduct,
  prices: CartItemPrices,
} as const;

const SimpleCartItem = z.object({
  __typename: z.literal("SimpleCartItem"),
  ...BaseCartItem,
});

const VirtualCartItem = z.object({
  __typename: z.literal("VirtualCartItem"),
  ...BaseCartItem,
});

const DownloadableCartItem = z.object({
  __typename: z.literal("DownloadableCartItem"),
  ...BaseCartItem,
});

const ConfigurableCartItem = z.object({
  __typename: z.literal("ConfigurableCartItem"),
  ...BaseCartItem,
  configurable_options: z
    .array(
      z.object({
        option_label: z.string().nullable(),
        value_label: z.string().nullable(),
      }),
    )
    .nullable()
    .optional(),
  configured_variant: z
    .object({
      sku: z.string(),
      image: MediaImage.nullable().optional(),
    })
    .nullable()
    .optional(),
});

const BundleCartItem = z.object({
  __typename: z.literal("BundleCartItem"),
  ...BaseCartItem,
  bundle_options: z
    .array(
      z.object({
        label: z.string().nullable(),
        values: z.array(
          z.object({
            label: z.string().nullable(),
            quantity: z.number().nullable(),
          }),
        ),
      }),
    )
    .nullable()
    .optional(),
});

// Fallback for any cart-item type we haven't specialised.
const UnknownCartItem = z.object({
  __typename: z.string(),
  ...BaseCartItem,
});

const CartItem = z.union([
  SimpleCartItem,
  VirtualCartItem,
  DownloadableCartItem,
  ConfigurableCartItem,
  BundleCartItem,
  UnknownCartItem,
]);

export type CartItemT = z.infer<typeof CartItem>;

const CartPrices = z.object({
  subtotal_excluding_tax: Money.nullable().optional(),
  subtotal_including_tax: Money.nullable().optional(),
  grand_total: Money.nullable().optional(),
  applied_taxes: z
    .array(
      z.object({
        label: z.string().nullable(),
        amount: Money,
      }),
    )
    .nullable()
    .optional(),
});

const AppliedCoupon = z.object({ code: z.string() });

const Cart = z.object({
  id: z.string(),
  total_quantity: z.number(),
  prices: CartPrices.nullable().optional(),
  items: z.array(CartItem.nullable()).nullable().optional(),
  applied_coupons: z.array(AppliedCoupon).nullable().optional(),
});

export type CartT = z.infer<typeof Cart>;

/* -------------------------------------------------------------------------- */
/* User-error envelope                                                        */
/* -------------------------------------------------------------------------- */

const UserError = z.object({
  code: z.string().nullable().optional(),
  message: z.string(),
});

export type CartUserErrorT = z.infer<typeof UserError>;

const CartResult = z.object({
  cart: Cart.nullable(),
  user_errors: z.array(UserError).nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Shared GraphQL fragment                                                    */
/* -------------------------------------------------------------------------- */

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    total_quantity
    prices {
      subtotal_excluding_tax { value currency }
      subtotal_including_tax { value currency }
      grand_total { value currency }
      applied_taxes { label amount { value currency } }
    }
    items {
      uid
      __typename
      quantity
      product {
        uid
        name
        sku
        url_key
        url_suffix
        small_image { url label }
        stock_status
      }
      ... on ConfigurableCartItem {
        configurable_options { option_label value_label }
        configured_variant { sku image { url label } }
      }
      ... on BundleCartItem {
        bundle_options { label values { label quantity } }
      }
      prices {
        row_total_including_tax { value currency }
        price { value currency }
      }
    }
    applied_coupons { code }
  }
`;

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

const CreateEmptyCartSchema = z.object({ createEmptyCart: z.string() });

export async function createEmptyCart(): Promise<string> {
  const doc = /* GraphQL */ `
    mutation CreateEmptyCart {
      createEmptyCart
    }
  `;
  const raw = await query<unknown>(doc);
  return CreateEmptyCartSchema.parse(raw).createEmptyCart;
}

const CartQuerySchema = z.object({ cart: Cart.nullable() });

export async function getCart(cartId: string): Promise<CartT | null> {
  const doc = /* GraphQL */ `
    ${CART_FRAGMENT}
    query GetCart($id: String!) {
      cart(cart_id: $id) {
        ...CartFields
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { id: cartId });
    const parsed = CartQuerySchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.cart;
  } catch {
    return null;
  }
}

export type AddProductInput = {
  sku: string;
  quantity: number;
  parent_sku?: string;
  selected_options?: string[];
};

export type CartMutationResult = {
  cart: CartT | null;
  userErrors: CartUserErrorT[];
};

const AddToCartSchema = z.object({ addProductsToCart: CartResult });

function sanitiseQty(q: number): number {
  const n = Math.floor(Number(q));
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 999) return 999;
  return n;
}

export async function addProductsToCart(
  cartId: string,
  items: AddProductInput[],
): Promise<CartMutationResult> {
  const doc = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation AddProductsToCart($cartId: String!, $cartItems: [CartItemInput!]!) {
      addProductsToCart(cartId: $cartId, cartItems: $cartItems) {
        cart { ...CartFields }
        user_errors { code message }
      }
    }
  `;
  const cartItems = items.map((i) => {
    const base: Record<string, unknown> = {
      sku: i.sku,
      quantity: sanitiseQty(i.quantity),
    };
    if (i.parent_sku) base.parent_sku = i.parent_sku;
    if (i.selected_options && i.selected_options.length > 0) {
      base.selected_options = i.selected_options;
    }
    return base;
  });
  const raw = await query<unknown>(doc, { cartId, cartItems });
  const parsed = AddToCartSchema.parse(raw);
  return {
    cart: parsed.addProductsToCart.cart,
    userErrors: parsed.addProductsToCart.user_errors ?? [],
  };
}

const UpdateCartItemsSchema = z.object({ updateCartItems: CartResult });

export async function updateCartItems(
  cartId: string,
  items: { cart_item_uid: string; quantity: number }[],
): Promise<CartMutationResult> {
  const doc = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation UpdateCartItems($input: UpdateCartItemsInput!) {
      updateCartItems(input: $input) {
        cart { ...CartFields }
      }
    }
  `;
  const input = {
    cart_id: cartId,
    cart_items: items.map((i) => ({
      cart_item_uid: i.cart_item_uid,
      quantity: sanitiseQty(i.quantity),
    })),
  };
  const raw = await query<unknown>(doc, { input });
  const parsed = UpdateCartItemsSchema.parse(raw);
  return {
    cart: parsed.updateCartItems.cart,
    userErrors: parsed.updateCartItems.user_errors ?? [],
  };
}

const RemoveItemSchema = z.object({ removeItemFromCart: CartResult });

export async function removeItemFromCart(
  cartId: string,
  cartItemUid: string,
): Promise<CartMutationResult> {
  const doc = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) {
      removeItemFromCart(input: $input) {
        cart { ...CartFields }
      }
    }
  `;
  const raw = await query<unknown>(doc, {
    input: { cart_id: cartId, cart_item_uid: cartItemUid },
  });
  const parsed = RemoveItemSchema.parse(raw);
  return {
    cart: parsed.removeItemFromCart.cart,
    userErrors: parsed.removeItemFromCart.user_errors ?? [],
  };
}

const ApplyCouponSchema = z.object({ applyCouponToCart: CartResult });

export async function applyCouponToCart(
  cartId: string,
  code: string,
): Promise<CartMutationResult> {
  const doc = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation ApplyCouponToCart($input: ApplyCouponToCartInput!) {
      applyCouponToCart(input: $input) {
        cart { ...CartFields }
      }
    }
  `;
  const raw = await query<unknown>(doc, {
    input: { cart_id: cartId, coupon_code: code },
  });
  const parsed = ApplyCouponSchema.parse(raw);
  return {
    cart: parsed.applyCouponToCart.cart,
    userErrors: parsed.applyCouponToCart.user_errors ?? [],
  };
}

const RemoveCouponSchema = z.object({ removeCouponFromCart: CartResult });

export async function removeCouponFromCart(
  cartId: string,
): Promise<CartMutationResult> {
  const doc = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation RemoveCouponFromCart($input: RemoveCouponFromCartInput!) {
      removeCouponFromCart(input: $input) {
        cart { ...CartFields }
      }
    }
  `;
  const raw = await query<unknown>(doc, { input: { cart_id: cartId } });
  const parsed = RemoveCouponSchema.parse(raw);
  return {
    cart: parsed.removeCouponFromCart.cart,
    userErrors: parsed.removeCouponFromCart.user_errors ?? [],
  };
}

const MergeCartsSchema = z.object({ mergeCarts: Cart });

export async function mergeCarts(
  sourceCartId: string,
  destCartId: string,
): Promise<CartT> {
  const doc = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation MergeCarts($source: String!, $dest: String!) {
      mergeCarts(source_cart_id: $source, destination_cart_id: $dest) {
        ...CartFields
      }
    }
  `;
  const raw = await query<unknown>(doc, {
    source: sourceCartId,
    dest: destCartId,
  });
  return MergeCartsSchema.parse(raw).mergeCarts;
}

/* -------------------------------------------------------------------------- */
/* Cookie helpers                                                             */
/* -------------------------------------------------------------------------- */

export const CART_COOKIE_NAME = "m2r_cart_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Shape-compatible subset of the `AstroCookies` API. Callers in `.astro`
 * files can pass `Astro.cookies` directly; we don't depend on the full type
 * to keep this module usable from middleware and API routes alike.
 */
export interface CookieJar {
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
}

function parseClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeClientCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${ONE_YEAR_SECONDS}`,
    "SameSite=Lax",
  ];
  if (typeof location !== "undefined" && location.protocol === "https:") {
    attrs.push("Secure");
  }
  document.cookie = attrs.join("; ");
}

export function setCartCookie(jar: CookieJar, cartId: string): void {
  jar.set(CART_COOKIE_NAME, cartId, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
}

export function readCartCookie(jar: CookieJar): string | null {
  return jar.get(CART_COOKIE_NAME)?.value ?? null;
}

/**
 * Reads `m2r_cart_id` from the ambient cookie store (client-side `document.cookie`
 * when a jar is not supplied, or the supplied server-side jar). If missing,
 * creates a new cart on Magento and writes the cookie. Returns the id.
 *
 * The cart id is a per-device public identifier; the cookie is `SameSite=Lax`,
 * `Secure`, `Max-Age=1 year`, `Path=/`, and deliberately not `HttpOnly` so
 * client code can read it.
 */
export async function getOrCreateCartId(jar?: CookieJar): Promise<string> {
  const existing = jar ? readCartCookie(jar) : parseClientCookie(CART_COOKIE_NAME);
  if (existing) return existing;
  const id = await createEmptyCart();
  if (jar) {
    setCartCookie(jar, id);
  } else {
    writeClientCookie(CART_COOKIE_NAME, id);
  }
  return id;
}

/* -------------------------------------------------------------------------- */
/* Helpers for UI                                                              */
/* -------------------------------------------------------------------------- */

export function cartItemImage(item: CartItemT): { url: string | null; label: string } {
  if (item.__typename === "ConfigurableCartItem") {
    const variant = item.configured_variant;
    if (variant?.image?.url) {
      return { url: variant.image.url, label: variant.image.label ?? item.product.name };
    }
  }
  const url = item.product.small_image?.url ?? null;
  return { url, label: item.product.small_image?.label ?? item.product.name };
}

export function cartItemUrl(item: CartItemT): string | null {
  if (!item.product.url_key) return null;
  const suffix = item.product.url_suffix ?? ".html";
  return `/${item.product.url_key}${suffix}`;
}
