import { z } from "zod";
import { GraphQLClient } from "graphql-request";
import { query } from "./graphql";

/* -------------------------------------------------------------------------- */
/* Auth-aware client (mirrors queries-customer.ts pattern)                    */
/* -------------------------------------------------------------------------- */
/**
 * Magento's cart mutations accept an optional `Authorization: Bearer <token>`
 * header. When a customer is signed in we must send it so the cart is
 * associated with the customer record (enabling saved-address lookup, order
 * history, etc). When absent we hit the guest code-path, which needs the
 * additional `setGuestEmailOnCart` mutation before place-order.
 */
const isBrowser = typeof window !== "undefined";
const endpoint = isBrowser
  ? "/graphql"
  : (import.meta.env.MAGENTO_GRAPHQL_URL ?? "http://mage2react.local/graphql");

export async function authMutation<T>(
  document: string,
  variables: Record<string, unknown> | undefined,
  token: string | null,
): Promise<T> {
  if (!token) {
    return query<T>(document, variables);
  }
  const client = new GraphQLClient(endpoint, {
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "mage2react-frontend",
      Store: "default",
      Authorization: `Bearer ${token}`,
    },
    fetch: globalThis.fetch,
  });
  return client.request<T>(document, variables);
}

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
/* Checkout cart schema — far richer than the basic cart schema because we    */
/* need shipping/billing addresses, available carriers and payment methods    */
/* in order to render the checkout pages.                                      */
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
export type CheckoutCartItemT = z.infer<typeof CartItem>;

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

const AvailableShippingMethod = z.object({
  carrier_code: z.string(),
  carrier_title: z.string().nullable(),
  method_code: z.string().nullable(),
  method_title: z.string().nullable(),
  amount: Money,
  available: z.boolean().nullable().optional(),
  error_message: z.string().nullable().optional(),
  price_incl_tax: Money.nullable().optional(),
  price_excl_tax: Money.nullable().optional(),
});
export type AvailableShippingMethodT = z.infer<typeof AvailableShippingMethod>;

const SelectedShippingMethod = z
  .object({
    carrier_code: z.string().nullable(),
    carrier_title: z.string().nullable(),
    method_code: z.string().nullable(),
    method_title: z.string().nullable(),
    amount: Money.nullable().optional(),
  })
  .nullable()
  .optional();
export type SelectedShippingMethodT = z.infer<typeof SelectedShippingMethod>;

const Region = z
  .object({
    code: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    region_id: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

const CartAddressCountry = z.object({
  code: z.string().nullable(),
  label: z.string().nullable(),
});

const ShippingCartAddress = z
  .object({
    firstname: z.string().nullable().optional(),
    lastname: z.string().nullable().optional(),
    street: z.array(z.string()).nullable(),
    city: z.string().nullable(),
    postcode: z.string().nullable(),
    telephone: z.string().nullable(),
    region: Region,
    country: CartAddressCountry,
    available_shipping_methods: z
      .array(AvailableShippingMethod.nullable())
      .nullable()
      .optional(),
    selected_shipping_method: SelectedShippingMethod,
  })
  .nullable()
  .optional();
export type ShippingCartAddressT = z.infer<typeof ShippingCartAddress>;

const BillingCartAddress = z
  .object({
    firstname: z.string().nullable().optional(),
    lastname: z.string().nullable().optional(),
    street: z.array(z.string()).nullable(),
    city: z.string().nullable(),
    postcode: z.string().nullable(),
    telephone: z.string().nullable(),
    region: Region,
    country: CartAddressCountry,
  })
  .nullable()
  .optional();
export type BillingCartAddressT = z.infer<typeof BillingCartAddress>;

const AvailablePaymentMethod = z.object({
  code: z.string(),
  title: z.string().nullable(),
});
export type AvailablePaymentMethodT = z.infer<typeof AvailablePaymentMethod>;

const SelectedPaymentMethod = z
  .object({
    code: z.string().nullable(),
    title: z.string().nullable(),
  })
  .nullable()
  .optional();

const CheckoutCart = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  total_quantity: z.number(),
  is_virtual: z.boolean().nullable().optional(),
  prices: CartPrices.nullable().optional(),
  items: z.array(CartItem.nullable()).nullable().optional(),
  applied_coupons: z.array(AppliedCoupon).nullable().optional(),
  shipping_addresses: z.array(ShippingCartAddress).nullable().optional(),
  billing_address: BillingCartAddress,
  available_payment_methods: z
    .array(AvailablePaymentMethod.nullable())
    .nullable()
    .optional(),
  selected_payment_method: SelectedPaymentMethod,
});
export type CheckoutCartT = z.infer<typeof CheckoutCart>;

const UserError = z.object({
  code: z.string().nullable().optional(),
  message: z.string(),
});
export type CheckoutUserErrorT = z.infer<typeof UserError>;

/**
 * The stock Magento 2.4.8 schema does NOT expose `user_errors` on the
 * cart-mutation output types (`SetShippingAddressesOnCartOutput` etc) — only
 * `cart` is returned. Non-user errors are thrown as GraphQL-level errors
 * which `graphql-request` surfaces as thrown Errors, so we rely on the
 * try/catch in each page. We keep `user_errors` optional here so that
 * merchants with custom extensions that *do* emit `user_errors` won't break
 * schema validation.
 */
const CartResult = z.object({
  cart: CheckoutCart.nullable(),
  user_errors: z.array(UserError).nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Shared GraphQL fragment                                                    */
/* -------------------------------------------------------------------------- */

const CHECKOUT_CART_FRAGMENT = /* GraphQL */ `
  fragment CheckoutCartFields on Cart {
    id
    email
    total_quantity
    is_virtual
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
    shipping_addresses {
      firstname
      lastname
      street
      city
      postcode
      telephone
      region { code label region_id }
      country { code label }
      available_shipping_methods {
        carrier_code
        carrier_title
        method_code
        method_title
        amount { value currency }
        available
        error_message
        price_incl_tax { value currency }
        price_excl_tax { value currency }
      }
      selected_shipping_method {
        carrier_code
        carrier_title
        method_code
        method_title
        amount { value currency }
      }
    }
    billing_address {
      firstname
      lastname
      street
      city
      postcode
      telephone
      region { code label region_id }
      country { code label }
    }
    available_payment_methods { code title }
    selected_payment_method { code title }
  }
`;

/* -------------------------------------------------------------------------- */
/* getCartForCheckout                                                         */
/* -------------------------------------------------------------------------- */

const GetCartForCheckoutSchema = z.object({ cart: CheckoutCart.nullable() });

export async function getCartForCheckout(
  cartId: string,
  token?: string | null,
): Promise<CheckoutCartT | null> {
  const doc = /* GraphQL */ `
    ${CHECKOUT_CART_FRAGMENT}
    query GetCheckoutCart($id: String!) {
      cart(cart_id: $id) {
        ...CheckoutCartFields
      }
    }
  `;
  try {
    const raw = await authMutation<unknown>(doc, { id: cartId }, token ?? null);
    const parsed = GetCartForCheckoutSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.cart;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* setGuestEmailOnCart                                                        */
/* -------------------------------------------------------------------------- */

const SetGuestEmailSchema = z.object({ setGuestEmailOnCart: CartResult });

export type CheckoutMutationResult = {
  cart: CheckoutCartT | null;
  userErrors: CheckoutUserErrorT[];
};

export async function setGuestEmailOnCart(
  cartId: string,
  email: string,
): Promise<CheckoutMutationResult> {
  const doc = /* GraphQL */ `
    ${CHECKOUT_CART_FRAGMENT}
    mutation SetGuestEmailOnCart($input: SetGuestEmailOnCartInput!) {
      setGuestEmailOnCart(input: $input) {
        cart { ...CheckoutCartFields }
      }
    }
  `;
  const raw = await query<unknown>(doc, {
    input: { cart_id: cartId, email },
  });
  const parsed = SetGuestEmailSchema.parse(raw);
  return {
    cart: parsed.setGuestEmailOnCart.cart,
    userErrors: parsed.setGuestEmailOnCart.user_errors ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/* Address input                                                              */
/* -------------------------------------------------------------------------- */

export type CheckoutAddressInput = {
  firstname: string;
  lastname: string;
  street: string[];
  city: string;
  region: { region_id?: number; region?: string; region_code?: string };
  postcode: string;
  country_code: string;
  telephone: string;
  save_in_address_book?: boolean;
  company?: string;
};

function toCartAddressInput(a: CheckoutAddressInput): Record<string, unknown> {
  // NB: `CartAddressInput` (used by setShipping/BillingAddressOnCart) takes
  // region/region_id as flat scalar fields, unlike `CustomerAddressInput`
  // which nests them under a `region` object. Do not confuse the two.
  const body: Record<string, unknown> = {
    firstname: a.firstname,
    lastname: a.lastname,
    street: a.street,
    city: a.city,
    postcode: a.postcode,
    country_code: a.country_code,
    telephone: a.telephone,
    save_in_address_book: a.save_in_address_book ?? false,
  };
  if (a.region.region_id != null) body.region_id = a.region.region_id;
  else if (a.region.region) body.region = a.region.region;
  if (a.company) body.company = a.company;
  return body;
}

/* -------------------------------------------------------------------------- */
/* setShippingAddressesOnCart                                                 */
/* -------------------------------------------------------------------------- */

const SetShippingAddressesSchema = z.object({
  setShippingAddressesOnCart: CartResult,
});

export async function setShippingAddressesOnCart(
  cartId: string,
  address: CheckoutAddressInput,
  token?: string | null,
  customerAddressId?: number,
): Promise<CheckoutMutationResult> {
  const doc = /* GraphQL */ `
    ${CHECKOUT_CART_FRAGMENT}
    mutation SetShippingAddresses($input: SetShippingAddressesOnCartInput!) {
      setShippingAddressesOnCart(input: $input) {
        cart { ...CheckoutCartFields }
      }
    }
  `;
  // Prefer customer_address_id for logged-in customers selecting a saved
  // address — it's cheaper and avoids region revalidation surprises.
  const shippingAddresses =
    customerAddressId != null
      ? [{ customer_address_id: customerAddressId }]
      : [{ address: toCartAddressInput(address) }];
  const raw = await authMutation<unknown>(
    doc,
    { input: { cart_id: cartId, shipping_addresses: shippingAddresses } },
    token ?? null,
  );
  const parsed = SetShippingAddressesSchema.parse(raw);
  return {
    cart: parsed.setShippingAddressesOnCart.cart,
    userErrors: parsed.setShippingAddressesOnCart.user_errors ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/* setBillingAddressOnCart                                                    */
/* -------------------------------------------------------------------------- */

const SetBillingAddressSchema = z.object({
  setBillingAddressOnCart: CartResult,
});

export type BillingArg =
  | { same_as_shipping: true }
  | { address: CheckoutAddressInput; customerAddressId?: number };

export async function setBillingAddressOnCart(
  cartId: string,
  arg: BillingArg,
  token?: string | null,
): Promise<CheckoutMutationResult> {
  const doc = /* GraphQL */ `
    ${CHECKOUT_CART_FRAGMENT}
    mutation SetBillingAddress($input: SetBillingAddressOnCartInput!) {
      setBillingAddressOnCart(input: $input) {
        cart { ...CheckoutCartFields }
      }
    }
  `;
  let billingAddress: Record<string, unknown>;
  if ("same_as_shipping" in arg) {
    billingAddress = { same_as_shipping: true };
  } else if (arg.customerAddressId != null) {
    billingAddress = { customer_address_id: arg.customerAddressId };
  } else {
    billingAddress = { address: toCartAddressInput(arg.address) };
  }
  const raw = await authMutation<unknown>(
    doc,
    { input: { cart_id: cartId, billing_address: billingAddress } },
    token ?? null,
  );
  const parsed = SetBillingAddressSchema.parse(raw);
  return {
    cart: parsed.setBillingAddressOnCart.cart,
    userErrors: parsed.setBillingAddressOnCart.user_errors ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/* setShippingMethodsOnCart                                                   */
/* -------------------------------------------------------------------------- */

const SetShippingMethodsSchema = z.object({
  setShippingMethodsOnCart: CartResult,
});

export async function setShippingMethodsOnCart(
  cartId: string,
  method: { carrier_code: string; method_code: string },
  token?: string | null,
): Promise<CheckoutMutationResult> {
  const doc = /* GraphQL */ `
    ${CHECKOUT_CART_FRAGMENT}
    mutation SetShippingMethods($input: SetShippingMethodsOnCartInput!) {
      setShippingMethodsOnCart(input: $input) {
        cart { ...CheckoutCartFields }
      }
    }
  `;
  const raw = await authMutation<unknown>(
    doc,
    {
      input: {
        cart_id: cartId,
        shipping_methods: [
          { carrier_code: method.carrier_code, method_code: method.method_code },
        ],
      },
    },
    token ?? null,
  );
  const parsed = SetShippingMethodsSchema.parse(raw);
  return {
    cart: parsed.setShippingMethodsOnCart.cart,
    userErrors: parsed.setShippingMethodsOnCart.user_errors ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/* setPaymentMethodOnCart                                                     */
/* -------------------------------------------------------------------------- */

const SetPaymentMethodSchema = z.object({
  setPaymentMethodOnCart: CartResult,
});

export async function setPaymentMethodOnCart(
  cartId: string,
  method: { code: string },
  token?: string | null,
): Promise<CheckoutMutationResult> {
  const doc = /* GraphQL */ `
    ${CHECKOUT_CART_FRAGMENT}
    mutation SetPaymentMethod($input: SetPaymentMethodOnCartInput!) {
      setPaymentMethodOnCart(input: $input) {
        cart { ...CheckoutCartFields }
      }
    }
  `;
  const raw = await authMutation<unknown>(
    doc,
    {
      input: {
        cart_id: cartId,
        payment_method: { code: method.code },
      },
    },
    token ?? null,
  );
  const parsed = SetPaymentMethodSchema.parse(raw);
  return {
    cart: parsed.setPaymentMethodOnCart.cart,
    userErrors: parsed.setPaymentMethodOnCart.user_errors ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/* placeOrder                                                                 */
/* -------------------------------------------------------------------------- */

const PlaceOrderSchema = z.object({
  placeOrder: z.object({
    order: z
      .object({
        order_number: z.string(),
      })
      .nullable()
      .optional(),
    errors: z
      .array(
        z.object({
          message: z.string(),
          code: z.string().nullable().optional(),
        }),
      )
      .nullable()
      .optional(),
  }),
});

export async function placeOrder(
  cartId: string,
  token?: string | null,
): Promise<{ orderNumber: string }> {
  const doc = /* GraphQL */ `
    mutation PlaceOrder($input: PlaceOrderInput!) {
      placeOrder(input: $input) {
        order { order_number }
        errors { message code }
      }
    }
  `;
  const raw = await authMutation<unknown>(
    doc,
    { input: { cart_id: cartId } },
    token ?? null,
  );
  const parsed = PlaceOrderSchema.parse(raw);
  const errors = parsed.placeOrder.errors ?? [];
  if (errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Could not place order.");
  }
  const order = parsed.placeOrder.order;
  if (!order) {
    throw new Error("Could not place order.");
  }
  return { orderNumber: order.order_number };
}

/* -------------------------------------------------------------------------- */
/* countries / country                                                        */
/* -------------------------------------------------------------------------- */

const Country = z.object({
  id: z.string().nullable(),
  two_letter_abbreviation: z.string().nullable().optional(),
  three_letter_abbreviation: z.string().nullable().optional(),
  full_name_english: z.string().nullable(),
  full_name_locale: z.string().nullable(),
  available_regions: z
    .array(
      z.object({
        id: z.number().nullable(),
        code: z.string().nullable(),
        name: z.string().nullable(),
      }),
    )
    .nullable()
    .optional(),
});
export type CheckoutCountryT = z.infer<typeof Country>;

const CountriesSchema = z.object({ countries: z.array(Country) });
const CountrySchema = z.object({ country: Country.nullable() });

type CountriesCacheEntry = { data: CheckoutCountryT[]; at: number };
type CountryCacheEntry = { data: CheckoutCountryT | null; at: number };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
let countriesCache: CountriesCacheEntry | null = null;
const countryByIdCache = new Map<string, CountryCacheEntry>();

export async function countries(): Promise<CheckoutCountryT[]> {
  const now = Date.now();
  if (countriesCache && now - countriesCache.at < CACHE_TTL_MS) {
    return countriesCache.data;
  }
  const doc = /* GraphQL */ `
    query CheckoutCountries {
      countries {
        id
        two_letter_abbreviation
        three_letter_abbreviation
        full_name_english
        full_name_locale
        available_regions { id code name }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const data = CountriesSchema.parse(raw).countries.filter((c) => c.id != null);
    // Sort by English name for a stable dropdown order.
    data.sort((a, b) =>
      (a.full_name_english ?? "").localeCompare(b.full_name_english ?? ""),
    );
    countriesCache = { data, at: now };
    return data;
  } catch {
    return [];
  }
}

export async function country(id: string): Promise<CheckoutCountryT | null> {
  const now = Date.now();
  const cached = countryByIdCache.get(id);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }
  const doc = /* GraphQL */ `
    query CheckoutCountry($id: String!) {
      country(id: $id) {
        id
        two_letter_abbreviation
        three_letter_abbreviation
        full_name_english
        full_name_locale
        available_regions { id code name }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { id });
    const data = CountrySchema.parse(raw).country;
    countryByIdCache.set(id, { data, at: now });
    return data;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Error mapper                                                               */
/* -------------------------------------------------------------------------- */
/**
 * Magento GraphQL error messages sometimes include PHP class references or
 * stack traces. Collapse those to a friendly, generic message while keeping
 * actionable customer-facing messages intact.
 */
export function friendlyCheckoutError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("out of stock") || lower.includes("stock status"))
    return "One of the items in your cart is out of stock. Please review your cart and try again.";
  if (lower.includes("quote") && lower.includes("total"))
    return "We couldn't calculate your totals. Please refresh and try again.";
  if (lower.includes("no such entity") && lower.includes("cart"))
    return "Your cart session expired. Please add items again and retry checkout.";
  if (
    lower.includes("already an account") ||
    (lower.includes("email") && lower.includes("account"))
  ) {
    return "An account with this email already exists. Please sign in or use a different email.";
  }
  if (lower.includes("email")) {
    // Surface Magento's own message when it's useful (e.g. "Customer email is
    // already assigned to another cart"). Strip the GraphQL wrapper if present.
    const m = raw.replace(/^GraphQL request failed:\s*/i, "").trim();
    return m || "Please check the email address and try again.";
  }
  if (lower.includes("no items for shipment") || lower.includes("shipping address is not allowed"))
    return "Your cart has no shippable items. Downloadable/virtual orders skip shipping — proceed to payment.";
  if (lower.includes("shipping method"))
    return "Please choose a shipping method before continuing.";
  if (lower.includes("payment method"))
    return "Please choose a payment method before placing your order.";
  if (lower.includes("address")) return "Please check the address and try again.";
  // Common Magento GraphQL wrapper prefixes — strip them and drop response
  // JSON that sometimes comes bundled with the error string.
  const firstLine = raw.split(":")[0] ?? raw;
  const cleaned = firstLine.replace(/^GraphQL Error \(Code:?\s*\d+\):?\s*/i, "").trim();
  if (cleaned.length > 0 && cleaned.length < 240) return cleaned;
  return "We couldn't complete your request. Please try again.";
}
