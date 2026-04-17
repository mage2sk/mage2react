import { z } from "zod";
import { GraphQLClient } from "graphql-request";
import { query } from "./graphql";

/* -------------------------------------------------------------------------- */
/* Auth-aware GraphQL client                                                  */
/* -------------------------------------------------------------------------- */
/**
 * The shared `query()` helper in `./graphql.ts` uses a module-level
 * GraphQLClient without per-request headers. For any call that requires a
 * customer token we build a one-off `GraphQLClient` with an
 * `Authorization: Bearer <token>` header and run the request through it.
 *
 * We intentionally do not mutate the shared client — multiple concurrent
 * customer sessions would race on a shared header.
 */
const isBrowser = typeof window !== "undefined";
// Server-side hits Magento directly. Browser-side goes through our Astro
// proxy at /api/graphql which forwards with auth headers from the HttpOnly
// token cookie — so client islands never see the raw token.
const endpoint = isBrowser
  ? `${window.location.origin}/api/graphql`
  : (import.meta.env.MAGENTO_GRAPHQL_URL ?? "http://mage2react.local/graphql");

export async function authQuery<T>(
  document: string,
  variables: Record<string, unknown> | undefined,
  token: string,
): Promise<T> {
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

const Region = z
  .object({
    region_code: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    region_id: z.union([z.number(), z.string()]).nullable().optional(),
  })
  .nullable()
  .optional();

const CustomerAddress = z.object({
  id: z.number(),
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  street: z.array(z.string()).nullable(),
  city: z.string().nullable(),
  region: Region,
  postcode: z.string().nullable(),
  country_code: z.string().nullable(),
  telephone: z.string().nullable(),
  default_shipping: z.boolean().nullable().optional(),
  default_billing: z.boolean().nullable().optional(),
  company: z.string().nullable().optional(),
});
export type CustomerAddressT = z.infer<typeof CustomerAddress>;

const Customer = z.object({
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  email: z.string().nullable(),
  is_subscribed: z.boolean().nullable().optional(),
  default_shipping: z.string().nullable().optional(),
  default_billing: z.string().nullable().optional(),
  addresses: z.array(CustomerAddress).nullable().optional(),
});
export type CustomerT = z.infer<typeof Customer>;

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

const TokenSchema = z.object({
  generateCustomerToken: z.object({ token: z.string() }),
});

export async function createCustomerToken(
  email: string,
  password: string,
): Promise<string> {
  const doc = /* GraphQL */ `
    mutation GenerateCustomerToken($email: String!, $password: String!) {
      generateCustomerToken(email: $email, password: $password) {
        token
      }
    }
  `;
  const raw = await query<unknown>(doc, { email, password });
  return TokenSchema.parse(raw).generateCustomerToken.token;
}

const RevokeSchema = z.object({ revokeCustomerToken: z.object({ result: z.boolean() }) });

export async function revokeCustomerToken(token: string): Promise<boolean> {
  const doc = /* GraphQL */ `
    mutation RevokeCustomerToken {
      revokeCustomerToken { result }
    }
  `;
  try {
    const raw = await authQuery<unknown>(doc, undefined, token);
    return RevokeSchema.parse(raw).revokeCustomerToken.result;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Customer create / read / update                                            */
/* -------------------------------------------------------------------------- */

export type CreateCustomerInput = {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  is_subscribed?: boolean;
};

const CreateCustomerSchema = z.object({
  createCustomerV2: z.object({
    customer: z.object({
      firstname: z.string().nullable(),
      lastname: z.string().nullable(),
      email: z.string().nullable(),
    }),
  }),
});

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<{ firstname: string | null; lastname: string | null; email: string | null }> {
  const doc = /* GraphQL */ `
    mutation CreateCustomer($input: CustomerCreateInput!) {
      createCustomerV2(input: $input) {
        customer {
          firstname
          lastname
          email
        }
      }
    }
  `;
  const raw = await query<unknown>(doc, { input });
  return CreateCustomerSchema.parse(raw).createCustomerV2.customer;
}

const GetCustomerSchema = z.object({ customer: Customer });

export async function getCustomer(token: string): Promise<CustomerT> {
  const doc = /* GraphQL */ `
    query Customer {
      customer {
        firstname
        lastname
        email
        is_subscribed
        default_shipping
        default_billing
        addresses {
          id
          firstname
          lastname
          street
          city
          region {
            region_code
            region
            region_id
          }
          postcode
          country_code
          telephone
          default_shipping
          default_billing
          company
        }
      }
    }
  `;
  const raw = await authQuery<unknown>(doc, undefined, token);
  return GetCustomerSchema.parse(raw).customer;
}

const UpdateCustomerSchema = z.object({
  updateCustomerV2: z.object({
    customer: z.object({
      firstname: z.string().nullable(),
      lastname: z.string().nullable(),
      email: z.string().nullable(),
    }),
  }),
});

export async function updateCustomer(
  token: string,
  input: { firstname: string; lastname: string; email?: string; password?: string },
): Promise<{ firstname: string | null; lastname: string | null; email: string | null }> {
  const doc = /* GraphQL */ `
    mutation UpdateCustomer($input: CustomerUpdateInput!) {
      updateCustomerV2(input: $input) {
        customer { firstname lastname email }
      }
    }
  `;
  const raw = await authQuery<unknown>(doc, { input }, token);
  return UpdateCustomerSchema.parse(raw).updateCustomerV2.customer;
}

const ChangePasswordSchema = z.object({
  changeCustomerPassword: z.object({ email: z.string().nullable() }),
});

export async function changeCustomerPassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const doc = /* GraphQL */ `
    mutation ChangeCustomerPassword($currentPassword: String!, $newPassword: String!) {
      changeCustomerPassword(currentPassword: $currentPassword, newPassword: $newPassword) {
        email
      }
    }
  `;
  const raw = await authQuery<unknown>(doc, { currentPassword, newPassword }, token);
  ChangePasswordSchema.parse(raw);
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                             */
/* -------------------------------------------------------------------------- */

const RequestPasswordResetSchema = z.object({ requestPasswordResetEmail: z.boolean() });

export async function requestPasswordResetEmail(email: string): Promise<boolean> {
  const doc = /* GraphQL */ `
    mutation RequestPasswordResetEmail($email: String!) {
      requestPasswordResetEmail(email: $email)
    }
  `;
  try {
    const raw = await query<unknown>(doc, { email });
    return RequestPasswordResetSchema.parse(raw).requestPasswordResetEmail;
  } catch {
    // Don't leak user enumeration — callers render a generic success message.
    return false;
  }
}

const ResetPasswordSchema = z.object({ resetPassword: z.boolean() });

export async function resetPassword(
  email: string,
  resetPasswordToken: string,
  newPassword: string,
): Promise<boolean> {
  const doc = /* GraphQL */ `
    mutation ResetPassword(
      $email: String!
      $resetPasswordToken: String!
      $newPassword: String!
    ) {
      resetPassword(
        email: $email
        resetPasswordToken: $resetPasswordToken
        newPassword: $newPassword
      )
    }
  `;
  const raw = await query<unknown>(doc, { email, resetPasswordToken, newPassword });
  return ResetPasswordSchema.parse(raw).resetPassword;
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

const OrderListItem = z.object({
  id: z.string(),
  number: z.string(),
  order_date: z.string(),
  status: z.string(),
  total: z
    .object({
      grand_total: Money,
    })
    .nullable(),
  items: z
    .array(
      z
        .object({
          product_name: z.string().nullable(),
          quantity_ordered: z.number().nullable(),
        })
        .nullable(),
    )
    .nullable()
    .optional(),
  shipping_address: z
    .object({
      firstname: z.string().nullable(),
      lastname: z.string().nullable(),
      city: z.string().nullable(),
      postcode: z.string().nullable(),
    })
    .nullable()
    .optional(),
});
export type OrderListItemT = z.infer<typeof OrderListItem>;

const OrderListSchema = z.object({
  customer: z.object({
    orders: z
      .object({
        items: z.array(OrderListItem),
        page_info: z.object({
          total_pages: z.number(),
          current_page: z.number(),
          page_size: z.number(),
        }),
        total_count: z.number(),
      })
      .nullable(),
  }),
});

export async function getCustomerOrders(
  token: string,
  { page = 1, pageSize = 10 }: { page?: number; pageSize?: number } = {},
): Promise<{
  items: OrderListItemT[];
  totalPages: number;
  currentPage: number;
  pageSize: number;
  totalCount: number;
}> {
  const doc = /* GraphQL */ `
    query CustomerOrders($page: Int!, $pageSize: Int!) {
      customer {
        orders(currentPage: $page, pageSize: $pageSize) {
          items {
            id
            number
            order_date
            status
            total {
              grand_total { value currency }
            }
            items {
              product_name
              quantity_ordered
            }
            shipping_address {
              firstname
              lastname
              city
              postcode
            }
          }
          page_info { total_pages current_page page_size }
          total_count
        }
      }
    }
  `;
  const raw = await authQuery<unknown>(doc, { page, pageSize }, token);
  const parsed = OrderListSchema.parse(raw);
  const orders = parsed.customer.orders;
  if (!orders) {
    return { items: [], totalPages: 0, currentPage: page, pageSize, totalCount: 0 };
  }
  return {
    items: orders.items,
    totalPages: orders.page_info.total_pages,
    currentPage: orders.page_info.current_page,
    pageSize: orders.page_info.page_size,
    totalCount: orders.total_count,
  };
}

const OrderAddress = z.object({
  firstname: z.string().nullable(),
  lastname: z.string().nullable(),
  street: z.array(z.string()).nullable(),
  city: z.string().nullable(),
  region: z.string().nullable().optional(),
  region_id: z.union([z.number(), z.string()]).nullable().optional(),
  postcode: z.string().nullable(),
  country_code: z.string().nullable(),
  telephone: z.string().nullable(),
});
export type OrderAddressT = z.infer<typeof OrderAddress>;

const OrderItemDetail = z.object({
  product_name: z.string().nullable(),
  product_sku: z.string().nullable(),
  product_url_key: z.string().nullable(),
  product_sale_price: Money.nullable().optional(),
  quantity_ordered: z.number().nullable(),
  selected_options: z
    .array(
      z.object({
        label: z.string().nullable(),
        value: z.string().nullable(),
      }),
    )
    .nullable()
    .optional(),
});
export type OrderItemDetailT = z.infer<typeof OrderItemDetail>;

const OrderDetail = z.object({
  id: z.string(),
  number: z.string(),
  order_date: z.string(),
  status: z.string(),
  shipping_address: OrderAddress.nullable().optional(),
  billing_address: OrderAddress.nullable().optional(),
  items: z.array(OrderItemDetail.nullable()).nullable(),
  total: z
    .object({
      subtotal: Money.nullable().optional(),
      grand_total: Money.nullable().optional(),
      taxes: z
        .array(
          z.object({
            amount: Money,
            title: z.string().nullable(),
          }),
        )
        .nullable()
        .optional(),
      shipping_handling: z
        .object({
          amount_including_tax: Money.nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  shipments: z
    .array(
      z.object({
        tracking: z
          .array(
            z.object({
              carrier: z.string().nullable(),
              number: z.string().nullable(),
              title: z.string().nullable(),
            }),
          )
          .nullable()
          .optional(),
      }),
    )
    .nullable()
    .optional(),
});
export type OrderDetailT = z.infer<typeof OrderDetail>;

const OrderDetailSchema = z.object({
  customer: z.object({
    orders: z
      .object({
        items: z.array(OrderDetail),
      })
      .nullable(),
  }),
});

export async function getCustomerOrder(
  token: string,
  orderNumber: string,
): Promise<OrderDetailT | null> {
  const doc = /* GraphQL */ `
    query CustomerOrder($number: String!) {
      customer {
        orders(filter: { number: { eq: $number } }) {
          items {
            id
            number
            order_date
            status
            shipping_address {
              firstname
              lastname
              street
              city
              region
              region_id
              postcode
              country_code
              telephone
            }
            billing_address {
              firstname
              lastname
              street
              city
              region
              region_id
              postcode
              country_code
              telephone
            }
            items {
              product_name
              product_sku
              product_url_key
              product_sale_price { value currency }
              quantity_ordered
              selected_options { label value }
            }
            total {
              subtotal { value currency }
              grand_total { value currency }
              taxes {
                amount { value currency }
                title
              }
              shipping_handling {
                amount_including_tax { value currency }
              }
            }
            shipments {
              tracking { carrier number title }
            }
          }
        }
      }
    }
  `;
  const raw = await authQuery<unknown>(doc, { number: orderNumber }, token);
  const parsed = OrderDetailSchema.parse(raw);
  return parsed.customer.orders?.items[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Addresses                                                                  */
/* -------------------------------------------------------------------------- */

export type CustomerAddressInput = {
  firstname: string;
  lastname: string;
  street: string[];
  city: string;
  region: { region_code?: string; region?: string; region_id?: number };
  postcode: string;
  country_code: string;
  telephone: string;
  default_shipping?: boolean;
  default_billing?: boolean;
  company?: string;
};

const CreateAddressSchema = z.object({ createCustomerAddress: CustomerAddress });

export async function addCustomerAddress(
  token: string,
  input: CustomerAddressInput,
): Promise<CustomerAddressT> {
  const doc = /* GraphQL */ `
    mutation CreateCustomerAddress($input: CustomerAddressInput!) {
      createCustomerAddress(input: $input) {
        id
        firstname
        lastname
        street
        city
        region { region_code region region_id }
        postcode
        country_code
        telephone
        default_shipping
        default_billing
        company
      }
    }
  `;
  const raw = await authQuery<unknown>(doc, { input }, token);
  return CreateAddressSchema.parse(raw).createCustomerAddress;
}

const UpdateAddressSchema = z.object({ updateCustomerAddress: CustomerAddress });

export async function updateCustomerAddress(
  token: string,
  id: number,
  input: CustomerAddressInput,
): Promise<CustomerAddressT> {
  const doc = /* GraphQL */ `
    mutation UpdateCustomerAddress($id: Int!, $input: CustomerAddressInput!) {
      updateCustomerAddress(id: $id, input: $input) {
        id
        firstname
        lastname
        street
        city
        region { region_code region region_id }
        postcode
        country_code
        telephone
        default_shipping
        default_billing
        company
      }
    }
  `;
  const raw = await authQuery<unknown>(doc, { id, input }, token);
  return UpdateAddressSchema.parse(raw).updateCustomerAddress;
}

const DeleteAddressSchema = z.object({ deleteCustomerAddress: z.boolean() });

export async function deleteCustomerAddress(
  token: string,
  id: number,
): Promise<boolean> {
  const doc = /* GraphQL */ `
    mutation DeleteCustomerAddress($id: Int!) {
      deleteCustomerAddress(id: $id)
    }
  `;
  const raw = await authQuery<unknown>(doc, { id }, token);
  return DeleteAddressSchema.parse(raw).deleteCustomerAddress;
}

/* -------------------------------------------------------------------------- */
/* Countries (for region dropdowns)                                           */
/* -------------------------------------------------------------------------- */

const Country = z.object({
  id: z.string().nullable(),
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
export type CountryT = z.infer<typeof Country>;

const CountriesSchema = z.object({ countries: z.array(Country) });

let cachedCountries: { data: CountryT[]; at: number } | null = null;
const COUNTRIES_TTL_MS = 60 * 60 * 1000;

export async function getCountries(): Promise<CountryT[]> {
  const now = Date.now();
  if (cachedCountries && now - cachedCountries.at < COUNTRIES_TTL_MS) {
    return cachedCountries.data;
  }
  const doc = /* GraphQL */ `
    query Countries {
      countries {
        id
        full_name_english
        full_name_locale
        available_regions { id code name }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const data = CountriesSchema.parse(raw).countries;
    cachedCountries = { data, at: now };
    return data;
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Newsletter                                                                 */
/* -------------------------------------------------------------------------- */

const SubscribeSchema = z.object({
  subscribeEmailToNewsletter: z.object({ status: z.string().nullable() }),
});

export async function subscribeEmailToNewsletter(email: string): Promise<string | null> {
  const doc = /* GraphQL */ `
    mutation SubscribeEmailToNewsletter($email: String!) {
      subscribeEmailToNewsletter(email: $email) {
        status
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { email });
    return SubscribeSchema.parse(raw).subscribeEmailToNewsletter.status;
  } catch {
    return null;
  }
}

/**
 * Toggle the authenticated customer's newsletter subscription via
 * `updateCustomerV2(input: { is_subscribed })`. If the running Magento
 * instance rejects `is_subscribed` on `CustomerUpdateInput`, we fall back
 * to `subscribeEmailToNewsletter` for subscribes; unsubscribes silently
 * no-op (no first-class mutation exists upstream).
 */
export async function setCustomerNewsletter(
  token: string,
  isSubscribed: boolean,
): Promise<void> {
  const doc = /* GraphQL */ `
    mutation UpdateSubscription($input: CustomerUpdateInput!) {
      updateCustomerV2(input: $input) {
        customer { is_subscribed }
      }
    }
  `;
  try {
    await authQuery<unknown>(doc, { input: { is_subscribed: isSubscribed } }, token);
  } catch (err) {
    console.warn("[customer-newsletter] updateCustomerV2 failed; falling back", {
      message: err instanceof Error ? err.message : String(err),
    });
    if (isSubscribed) {
      const customer = await getCustomer(token);
      if (customer.email) {
        await subscribeEmailToNewsletter(customer.email);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Product reviews                                                            */
/* -------------------------------------------------------------------------- */

export type CreateReviewInput = {
  sku: string;
  nickname: string;
  summary: string;
  text: string;
  ratings: { id: string; value_id: string }[];
};

const CreateReviewSchema = z.object({
  createProductReview: z.object({
    review: z.object({
      nickname: z.string().nullable(),
      summary: z.string().nullable(),
      text: z.string().nullable(),
    }),
  }),
});

export async function createProductReview(
  input: CreateReviewInput,
  token?: string,
): Promise<void> {
  const doc = /* GraphQL */ `
    mutation CreateProductReview($input: CreateProductReviewInput!) {
      createProductReview(input: $input) {
        review {
          nickname
          summary
          text
        }
      }
    }
  `;
  const raw = token
    ? await authQuery<unknown>(doc, { input }, token)
    : await query<unknown>(doc, { input });
  CreateReviewSchema.parse(raw);
}

/* -------------------------------------------------------------------------- */
/* Wishlist                                                                   */
/* -------------------------------------------------------------------------- */

const WishlistItem = z.object({
  id: z.string(),
  quantity: z.number(),
  added_at: z.string().nullable().optional(),
  product: z
    .object({
      uid: z.string(),
      sku: z.string(),
      name: z.string(),
      url_key: z.string().nullable(),
      url_suffix: z.string().nullable().optional(),
      stock_status: z.string().nullable().optional(),
      small_image: z
        .object({
          url: z.string().nullable(),
          label: z.string().nullable(),
        })
        .nullable()
        .optional(),
      price_range: z.object({
        minimum_price: z.object({
          final_price: Money,
          regular_price: Money,
        }),
      }),
    })
    .nullable(),
});
export type WishlistItemT = z.infer<typeof WishlistItem>;

const Wishlist = z.object({
  id: z.string(),
  items_count: z.number(),
  items_v2: z
    .object({
      items: z.array(WishlistItem),
    })
    .nullable(),
});
export type WishlistT = z.infer<typeof Wishlist>;

const WishlistSchema = z.object({
  customer: z.object({
    wishlists: z.array(Wishlist),
  }),
});

export async function getWishlist(token: string): Promise<WishlistT | null> {
  const doc = /* GraphQL */ `
    query Wishlist {
      customer {
        wishlists {
          id
          items_count
          items_v2 {
            items {
              id
              quantity
              added_at
              product {
                uid
                sku
                name
                url_key
                url_suffix
                stock_status
                small_image { url label }
                price_range {
                  minimum_price {
                    final_price { value currency }
                    regular_price { value currency }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  try {
    const raw = await authQuery<unknown>(doc, undefined, token);
    const parsed = WishlistSchema.parse(raw);
    return parsed.customer.wishlists[0] ?? null;
  } catch {
    return null;
  }
}

const AddWishlistSchema = z.object({
  addProductsToWishlist: z.object({
    wishlist: Wishlist,
    user_errors: z.array(
      z.object({
        code: z.string().nullable(),
        message: z.string(),
      }),
    ),
  }),
});

export async function addProductsToWishlist(
  token: string,
  wishlistId: string,
  items: { sku: string; quantity: number; selected_options?: string[] }[],
): Promise<{ wishlist: WishlistT; userErrors: { code: string | null; message: string }[] }> {
  const doc = /* GraphQL */ `
    mutation AddProductsToWishlist(
      $wishlistId: ID!
      $wishlistItems: [WishlistItemInput!]!
    ) {
      addProductsToWishlist(
        wishlistId: $wishlistId
        wishlistItems: $wishlistItems
      ) {
        wishlist {
          id
          items_count
          items_v2 {
            items {
              id
              quantity
              added_at
              product {
                uid
                sku
                name
                url_key
                url_suffix
                stock_status
                small_image { url label }
                price_range {
                  minimum_price {
                    final_price { value currency }
                    regular_price { value currency }
                  }
                }
              }
            }
          }
        }
        user_errors { code message }
      }
    }
  `;
  const wishlistItems = items.map((i) => ({
    sku: i.sku,
    quantity: i.quantity,
    ...(i.selected_options && i.selected_options.length > 0
      ? { selected_options: i.selected_options }
      : {}),
  }));
  const raw = await authQuery<unknown>(
    doc,
    { wishlistId, wishlistItems },
    token,
  );
  const parsed = AddWishlistSchema.parse(raw);
  return {
    wishlist: parsed.addProductsToWishlist.wishlist,
    userErrors: parsed.addProductsToWishlist.user_errors.map((e) => ({
      code: e.code ?? null,
      message: e.message,
    })),
  };
}

const RemoveWishlistSchema = z.object({
  removeProductsFromWishlist: z.object({
    wishlist: Wishlist,
    user_errors: z.array(
      z.object({
        code: z.string().nullable(),
        message: z.string(),
      }),
    ),
  }),
});

export async function removeProductsFromWishlist(
  token: string,
  wishlistId: string,
  wishlistItemsIds: string[],
): Promise<{ wishlist: WishlistT; userErrors: { code: string | null; message: string }[] }> {
  const doc = /* GraphQL */ `
    mutation RemoveProductsFromWishlist(
      $wishlistId: ID!
      $wishlistItemsIds: [ID!]!
    ) {
      removeProductsFromWishlist(
        wishlistId: $wishlistId
        wishlistItemsIds: $wishlistItemsIds
      ) {
        wishlist {
          id
          items_count
          items_v2 {
            items {
              id
              quantity
              added_at
              product {
                uid
                sku
                name
                url_key
                url_suffix
                stock_status
                small_image { url label }
                price_range {
                  minimum_price {
                    final_price { value currency }
                    regular_price { value currency }
                  }
                }
              }
            }
          }
        }
        user_errors { code message }
      }
    }
  `;
  const raw = await authQuery<unknown>(
    doc,
    { wishlistId, wishlistItemsIds },
    token,
  );
  const parsed = RemoveWishlistSchema.parse(raw);
  return {
    wishlist: parsed.removeProductsFromWishlist.wishlist,
    userErrors: parsed.removeProductsFromWishlist.user_errors.map((e) => ({
      code: e.code ?? null,
      message: e.message,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Cart add for wishlist → cart coordination                                  */
/* -------------------------------------------------------------------------- */
/**
 * Wishlist pages need to add items to the guest/customer cart without
 * depending on `queries-cart.ts`'s client-side `addItem` helper. We replicate
 * a minimal server-side `addProductsToCart` here that runs in the Astro
 * frontmatter (where we already have the `m2r_cart_id` cookie in hand).
 */

const CartAddResultSchema = z.object({
  addProductsToCart: z.object({
    cart: z.object({
      id: z.string(),
      total_quantity: z.number(),
    }),
    user_errors: z.array(
      z.object({
        code: z.string().nullable(),
        message: z.string(),
      }),
    ),
  }),
});

export async function addSkuToCart(
  cartId: string,
  sku: string,
  quantity = 1,
): Promise<{ totalQuantity: number; userErrors: { message: string }[] }> {
  const doc = /* GraphQL */ `
    mutation AddSkuToCart($cartId: String!, $cartItems: [CartItemInput!]!) {
      addProductsToCart(cartId: $cartId, cartItems: $cartItems) {
        cart { id total_quantity }
        user_errors { code message }
      }
    }
  `;
  const raw = await query<unknown>(doc, {
    cartId,
    cartItems: [{ sku, quantity }],
  });
  const parsed = CartAddResultSchema.parse(raw);
  return {
    totalQuantity: parsed.addProductsToCart.cart.total_quantity,
    userErrors: parsed.addProductsToCart.user_errors.map((e) => ({
      message: e.message,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Friendly error mapper                                                      */
/* -------------------------------------------------------------------------- */
/**
 * Magento GraphQL errors expose raw upstream messages that are often PHP
 * stack traces or include PII. Always route through this mapper before
 * rendering the error to the customer.
 */
export function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("sign in") || lower.includes("invalid login") || lower.includes("account sign-in"))
    return "The account sign-in was incorrect or your account is disabled temporarily. Please wait and try again later.";
  if (lower.includes("email")) return "Please check your email address.";
  if (lower.includes("password")) return "Please check your password and try again.";
  if (lower.includes("customer with this email already exists"))
    return "A customer with that email already exists.";
  if (lower.includes("token") && lower.includes("expired"))
    return "Your session expired. Please sign in again.";
  if (lower.includes("current user cannot")) return "You must be signed in to do that.";
  if (lower.includes("unauthorized")) return "You must be signed in to do that.";
  return "We couldn't complete that request. Please try again.";
}
