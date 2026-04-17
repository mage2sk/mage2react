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

const GalleryImage = z.object({
  url: z.string(),
  label: z.string().nullable(),
  disabled: z.boolean().nullable().optional(),
  position: z.number().nullable().optional(),
});

const Breadcrumb = z.object({
  category_uid: z.string().nullable().optional(),
  category_url_key: z.string().nullable().optional(),
  category_url_path: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(),
});

const CategoryRef = z.object({
  uid: z.string(),
  name: z.string().nullable(),
  url_path: z.string().nullable().optional(),
  url_key: z.string().nullable().optional(),
  breadcrumbs: z.array(Breadcrumb).nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Product-card shape (listing + related strips)                              */
/* -------------------------------------------------------------------------- */

const ProductCard = z.object({
  uid: z.string(),
  __typename: z.string().optional(),
  name: z.string(),
  sku: z.string(),
  url_key: z.string().nullable(),
  url_suffix: z.string().nullable().optional(),
  small_image: MediaImage.nullable().optional(),
  price_range: PriceRange,
});
export type ProductCardT = z.infer<typeof ProductCard>;

/* -------------------------------------------------------------------------- */
/* Featured products — used on home page                                      */
/* -------------------------------------------------------------------------- */

const FeaturedSchema = z.object({
  products: z.object({
    total_count: z.number(),
    items: z.array(ProductCard),
  }),
});

export async function getFeaturedProducts(limit = 8) {
  const doc = /* GraphQL */ `
    query FeaturedProducts($pageSize: Int!) {
      products(search: "", pageSize: $pageSize, currentPage: 1, sort: { position: ASC }) {
        total_count
        items {
          uid
          __typename
          name
          sku
          url_key
          url_suffix
          small_image { url label }
          price_range {
            minimum_price {
              regular_price { value currency }
              final_price { value currency }
            }
          }
        }
      }
    }
  `;
  const raw = await query<unknown>(doc, { pageSize: limit });
  return FeaturedSchema.parse(raw).products;
}

/* -------------------------------------------------------------------------- */
/* urlResolver — the routing primitive                                        */
/* -------------------------------------------------------------------------- */

const UrlResolverSchema = z.object({
  urlResolver: z
    .object({
      type: z.string().nullable().optional(),
      id: z.number().nullable().optional(),
      relative_url: z.string().nullable().optional(),
      redirectCode: z.number().nullable().optional(),
      entity_uid: z.string().nullable().optional(),
    })
    .nullable(),
});

export type ResolvedUrl = {
  type: "CATEGORY" | "PRODUCT" | "CMS_PAGE" | null;
  id: number | null;
  uid: string | null;
  relativeUrl: string | null;
  redirectCode: number;
};

export async function resolveUrl(url: string): Promise<ResolvedUrl> {
  const doc = /* GraphQL */ `
    query ResolveUrl($url: String!) {
      urlResolver(url: $url) {
        type
        id
        relative_url
        redirectCode
        entity_uid
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { url });
    const parsed = UrlResolverSchema.parse(raw);
    const r = parsed.urlResolver;
    const type = r?.type;
    if (!r || !type || (type !== "CATEGORY" && type !== "PRODUCT" && type !== "CMS_PAGE")) {
      return { type: null, id: null, uid: null, relativeUrl: null, redirectCode: 0 };
    }
    return {
      type,
      id: r.id ?? null,
      uid: r.entity_uid ?? null,
      relativeUrl: r.relative_url ?? null,
      redirectCode: r.redirectCode ?? 0,
    };
  } catch {
    return { type: null, id: null, uid: null, relativeUrl: null, redirectCode: 0 };
  }
}

/* -------------------------------------------------------------------------- */
/* CMS page + block                                                           */
/* -------------------------------------------------------------------------- */

const CmsPageSchema = z.object({
  cmsPage: z
    .object({
      title: z.string().nullable(),
      content: z.string().nullable(),
      content_heading: z.string().nullable().optional(),
      meta_title: z.string().nullable().optional(),
      meta_description: z.string().nullable().optional(),
      meta_keywords: z.string().nullable().optional(),
      url_key: z.string().nullable().optional(),
      identifier: z.string().nullable().optional(),
    })
    .nullable(),
});

export type CmsPageT = NonNullable<z.infer<typeof CmsPageSchema>["cmsPage"]>;

export async function getCmsPage(identifierOrId: string | number): Promise<CmsPageT | null> {
  const doc = /* GraphQL */ `
    query CmsPage($id: String!) {
      cmsPage(identifier: $id) {
        title
        content
        content_heading
        meta_title
        meta_description
        meta_keywords
        url_key
        identifier
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { id: String(identifierOrId) });
    const parsed = CmsPageSchema.parse(raw);
    return parsed.cmsPage ?? null;
  } catch {
    return null;
  }
}

const CmsBlocksSchema = z.object({
  cmsBlocks: z
    .object({
      items: z.array(
        z.object({
          identifier: z.string().nullable(),
          title: z.string().nullable(),
          content: z.string().nullable(),
        }),
      ),
    })
    .nullable(),
});

export type CmsBlockT = {
  identifier: string;
  title: string;
  content: string;
};
export type CmsBlocksMap = Record<string, { title: string; content: string }>;

export async function getCmsBlocks(identifiers: string[]): Promise<CmsBlocksMap> {
  if (identifiers.length === 0) return {};
  const doc = /* GraphQL */ `
    query CmsBlocks($ids: [String]!) {
      cmsBlocks(identifiers: $ids) {
        items {
          identifier
          title
          content
        }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { ids: identifiers });
    const parsed = CmsBlocksSchema.parse(raw);
    const map: CmsBlocksMap = {};
    for (const item of parsed.cmsBlocks?.items ?? []) {
      if (!item.identifier) continue;
      map[item.identifier] = {
        title: item.title ?? "",
        content: item.content ?? "",
      };
    }
    return map;
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* Product — full multi-type discriminated union                              */
/* -------------------------------------------------------------------------- */

const BaseProduct = {
  uid: z.string(),
  name: z.string(),
  sku: z.string(),
  url_key: z.string().nullable(),
  url_suffix: z.string().nullable().optional(),
  stock_status: z.string().nullable().optional(),
  only_x_left_in_stock: z.number().nullable().optional(),
  description: z.object({ html: z.string().nullable() }).nullable().optional(),
  short_description: z.object({ html: z.string().nullable() }).nullable().optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  meta_keyword: z.string().nullable().optional(),
  image: MediaImage.nullable().optional(),
  media_gallery: z.array(GalleryImage).nullable().optional(),
  price_range: PriceRange,
  categories: z.array(CategoryRef).nullable().optional(),
  related_products: z.array(ProductCard).nullable().optional(),
  upsell_products: z.array(ProductCard).nullable().optional(),
  crosssell_products: z.array(ProductCard).nullable().optional(),
  review_count: z.number().nullable().optional(),
  rating_summary: z.number().nullable().optional(),
} as const;

const ConfigurableOption = z.object({
  uid: z.string(),
  attribute_code: z.string().nullable(),
  label: z.string().nullable(),
  position: z.number().nullable().optional(),
  attribute_id: z.string().nullable().optional(),
  values: z.array(
    z.object({
      uid: z.string(),
      value_index: z.number().nullable(),
      label: z.string().nullable(),
      swatch_data: z
        .object({
          value: z.string().nullable().optional(),
          __typename: z.string().nullable().optional(),
          thumbnail: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    }),
  ),
});

const ConfigurableVariant = z.object({
  attributes: z.array(
    z.object({
      code: z.string().nullable(),
      value_index: z.number().nullable(),
      label: z.string().nullable().optional(),
    }),
  ),
  product: z.object({
    uid: z.string(),
    sku: z.string(),
    name: z.string(),
    stock_status: z.string().nullable().optional(),
    image: MediaImage.nullable().optional(),
    price_range: PriceRange,
  }),
});

const BundleItem = z.object({
  uid: z.string(),
  option_id: z.number().nullable(),
  title: z.string().nullable(),
  required: z.boolean().nullable(),
  type: z.string().nullable(),
  position: z.number().nullable().optional(),
  options: z.array(
    z.object({
      uid: z.string(),
      label: z.string().nullable(),
      quantity: z.number().nullable(),
      position: z.number().nullable().optional(),
      is_default: z.boolean().nullable().optional(),
      product: z.object({
        sku: z.string(),
        name: z.string(),
        price_range: z.object({
          minimum_price: z.object({ final_price: Money }),
        }),
      }),
    }),
  ),
});

const GroupedItem = z.object({
  qty: z.number().nullable(),
  position: z.number().nullable().optional(),
  product: z.object({
    uid: z.string(),
    sku: z.string(),
    name: z.string(),
    url_key: z.string().nullable(),
    stock_status: z.string().nullable().optional(),
    image: MediaImage.nullable().optional(),
    price_range: PriceRange,
  }),
});

const DownloadableLink = z.object({
  uid: z.string(),
  title: z.string().nullable(),
  sort_order: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  sample_url: z.string().nullable().optional(),
});

const DownloadableSample = z.object({
  title: z.string().nullable(),
  sort_order: z.number().nullable().optional(),
  sample_url: z.string().nullable().optional(),
});

const SimpleProduct = z.object({
  __typename: z.literal("SimpleProduct"),
  ...BaseProduct,
});

const ConfigurableProduct = z.object({
  __typename: z.literal("ConfigurableProduct"),
  ...BaseProduct,
  configurable_options: z.array(ConfigurableOption).nullable().optional(),
  variants: z.array(ConfigurableVariant).nullable().optional(),
});

const BundleProductSchema = z.object({
  __typename: z.literal("BundleProduct"),
  ...BaseProduct,
  dynamic_sku: z.boolean().nullable().optional(),
  dynamic_price: z.boolean().nullable().optional(),
  dynamic_weight: z.boolean().nullable().optional(),
  price_view: z.string().nullable().optional(),
  ship_bundle_items: z.string().nullable().optional(),
  items: z.array(BundleItem).nullable().optional(),
});

const GroupedProductSchema = z.object({
  __typename: z.literal("GroupedProduct"),
  ...BaseProduct,
  items: z.array(GroupedItem).nullable().optional(),
});

const DownloadableProductSchema = z.object({
  __typename: z.literal("DownloadableProduct"),
  ...BaseProduct,
  links_title: z.string().nullable().optional(),
  downloadable_product_links: z.array(DownloadableLink).nullable().optional(),
  downloadable_product_samples: z.array(DownloadableSample).nullable().optional(),
});

const VirtualProductSchema = z.object({
  __typename: z.literal("VirtualProduct"),
  ...BaseProduct,
});

const ProductUnion = z.discriminatedUnion("__typename", [
  SimpleProduct,
  ConfigurableProduct,
  BundleProductSchema,
  GroupedProductSchema,
  DownloadableProductSchema,
  VirtualProductSchema,
]);

export type ProductT = z.infer<typeof ProductUnion>;
export type ConfigurableOptionT = z.infer<typeof ConfigurableOption>;
export type ConfigurableVariantT = z.infer<typeof ConfigurableVariant>;
export type BundleItemT = z.infer<typeof BundleItem>;
export type GroupedItemT = z.infer<typeof GroupedItem>;
export type DownloadableLinkT = z.infer<typeof DownloadableLink>;

const ProductDetailSchema = z.object({
  products: z.object({
    items: z.array(ProductUnion),
  }),
});

const PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment CardFields on ProductInterface {
    uid
    __typename
    name
    sku
    url_key
    url_suffix
    small_image { url label }
    price_range {
      minimum_price {
        regular_price { value currency }
        final_price { value currency }
      }
    }
  }
`;

export async function getProductByUrlKey(urlKey: string): Promise<ProductT | null> {
  const doc = /* GraphQL */ `
    ${PRODUCT_FRAGMENT}
    query ProductByUrlKey($urlKey: String!) {
      products(filter: { url_key: { eq: $urlKey } }) {
        items {
          __typename
          uid
          name
          sku
          url_key
          url_suffix
          stock_status
          only_x_left_in_stock
          description { html }
          short_description { html }
          meta_title
          meta_description
          meta_keyword
          image { url label }
          media_gallery { url label disabled position }
          price_range {
            minimum_price {
              regular_price { value currency }
              final_price { value currency }
            }
          }
          categories {
            uid
            name
            url_path
            url_key
            breadcrumbs {
              category_uid
              category_url_key
              category_url_path
              category_name
            }
          }
          related_products { ...CardFields }
          upsell_products { ...CardFields }
          crosssell_products { ...CardFields }
          review_count
          rating_summary
          ... on ConfigurableProduct {
            configurable_options {
              uid
              attribute_code
              label
              position
              attribute_id
              values {
                uid
                value_index
                label
                swatch_data {
                  value
                  __typename
                  ... on ImageSwatchData { thumbnail }
                }
              }
            }
            variants {
              attributes { code value_index label }
              product {
                uid
                sku
                name
                stock_status
                image { url label }
                price_range {
                  minimum_price {
                    regular_price { value currency }
                    final_price { value currency }
                  }
                }
              }
            }
          }
          ... on BundleProduct {
            dynamic_sku
            dynamic_price
            dynamic_weight
            price_view
            ship_bundle_items
            items {
              uid
              option_id
              title
              required
              type
              position
              options {
                uid
                label
                quantity
                position
                is_default
                product {
                  sku
                  name
                  price_range {
                    minimum_price {
                      final_price { value currency }
                    }
                  }
                }
              }
            }
          }
          ... on GroupedProduct {
            items {
              qty
              position
              product {
                uid
                sku
                name
                url_key
                stock_status
                image { url label }
                price_range {
                  minimum_price {
                    regular_price { value currency }
                    final_price { value currency }
                  }
                }
              }
            }
          }
          ... on DownloadableProduct {
            links_title
            downloadable_product_links {
              uid
              title
              sort_order
              price
              sample_url
            }
            downloadable_product_samples {
              title
              sort_order
              sample_url
            }
          }
        }
      }
    }
  `;
  const raw = await query<unknown>(doc, { urlKey });
  const parsed = ProductDetailSchema.parse(raw);
  return parsed.products.items[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Category — by UID + products-by-UID                                         */
/* -------------------------------------------------------------------------- */

const CategoryListSchema = z.object({
  categories: z
    .object({
      items: z
        .array(
          z.object({
            uid: z.string(),
            name: z.string().nullable(),
            description: z.string().nullable().optional(),
            meta_title: z.string().nullable().optional(),
            meta_description: z.string().nullable().optional(),
            meta_keywords: z.string().nullable().optional(),
            url_key: z.string().nullable().optional(),
            url_path: z.string().nullable().optional(),
            image: z.string().nullable().optional(),
            breadcrumbs: z.array(Breadcrumb).nullable().optional(),
            children_count: z.string().nullable().optional(),
            children: z.array(
              z.object({
                uid: z.string(),
                name: z.string().nullable(),
                url_key: z.string().nullable().optional(),
                url_path: z.string().nullable().optional(),
                image: z.string().nullable().optional(),
                include_in_menu: z.number().nullable().optional(),
                product_count: z.number().nullable().optional(),
              }),
            ).nullable().optional(),
            display_mode: z.string().nullable().optional(),
            cms_block: z
              .object({
                identifier: z.string().nullable(),
                title: z.string().nullable(),
                content: z.string().nullable(),
              })
              .nullable()
              .optional(),
            landing_page: z.number().nullable().optional(),
          }),
        )
        .nullable()
        .optional(),
    })
    .nullable(),
});

export type CategoryT = NonNullable<
  NonNullable<z.infer<typeof CategoryListSchema>["categories"]>["items"]
>[number];

export async function getCategoryByUid(categoryUid: string): Promise<CategoryT | null> {
  const doc = /* GraphQL */ `
    query CategoryByUid($uid: String!) {
      categories(filters: { category_uid: { eq: $uid } }) {
        items {
          uid
          name
          description
          meta_title
          meta_description
          meta_keywords
          url_key
          url_path
          image
          breadcrumbs {
            category_uid
            category_url_path
            category_name
          }
          children_count
          children {
            uid
            name
            url_key
            url_path
            image
            include_in_menu
            product_count
          }
          display_mode
          cms_block {
            identifier
            title
            content
          }
          landing_page
        }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { uid: categoryUid });
    const parsed = CategoryListSchema.parse(raw);
    return parsed.categories?.items?.[0] ?? null;
  } catch {
    return null;
  }
}

const CategoryProductCard = z.object({
  uid: z.string(),
  __typename: z.string().optional(),
  name: z.string(),
  sku: z.string(),
  url_key: z.string().nullable(),
  url_suffix: z.string().nullable().optional(),
  small_image: MediaImage.nullable().optional(),
  price_range: PriceRange,
  // Swatch preview — only present for ConfigurableProduct; lazily validated
  configurable_options: z
    .array(
      z.object({
        attribute_code: z.string().nullable(),
        label: z.string().nullable(),
        values: z.array(
          z.object({
            uid: z.string(),
            label: z.string().nullable(),
            swatch_data: z
              .object({
                value: z.string().nullable().optional(),
                __typename: z.string().nullable().optional(),
                thumbnail: z.string().nullable().optional(),
              })
              .nullable()
              .optional(),
          }),
        ),
      }),
    )
    .nullable()
    .optional(),
});

export type CategoryProductCardT = z.infer<typeof CategoryProductCard>;

const CategoryProductsSchema = z.object({
  products: z.object({
    total_count: z.number(),
    items: z.array(CategoryProductCard),
    page_info: z.object({
      current_page: z.number(),
      page_size: z.number(),
      total_pages: z.number(),
    }),
  }),
});

export async function getProductsByCategoryUid(
  categoryUid: string,
  page = 1,
  pageSize = 24,
  sort?: string,
  descendantUids?: string[],
) {
  // `sort` parameter is accepted for API symmetry; only a fixed allowlist of
  // fields is forwarded to Magento to avoid GraphQL parse failures on arbitrary
  // input. The accepted values correspond to Magento's `ProductAttributeSortInput`.
  const sortClause = (() => {
    switch (sort) {
      case "price_asc":
        return "{ price: ASC }";
      case "price_desc":
        return "{ price: DESC }";
      case "name_asc":
        return "{ name: ASC }";
      case "name_desc":
        return "{ name: DESC }";
      default:
        return "{ position: ASC }";
    }
  })();

  const uids =
    descendantUids && descendantUids.length > 0
      ? [categoryUid, ...descendantUids]
      : [categoryUid];
  const doc = /* GraphQL */ `
    query CategoryProducts($uids: [String!]!, $page: Int!, $pageSize: Int!) {
      products(
        filter: { category_uid: { in: $uids } },
        currentPage: $page,
        pageSize: $pageSize,
        sort: ${sortClause}
      ) {
        total_count
        items {
          __typename
          uid
          name
          sku
          url_key
          url_suffix
          small_image { url label }
          price_range {
            minimum_price {
              regular_price { value currency }
              final_price { value currency }
            }
          }
          ... on ConfigurableProduct {
            configurable_options {
              attribute_code
              label
              values {
                uid
                label
                swatch_data {
                  value
                  __typename
                  ... on ImageSwatchData { thumbnail }
                }
              }
            }
          }
        }
        page_info { current_page page_size total_pages }
      }
    }
  `;
  const raw = await query<unknown>(doc, {
    uids,
    page,
    pageSize,
  });
  const parsed = CategoryProductsSchema.parse(raw);
  return { products: parsed.products };
}

/* -------------------------------------------------------------------------- */
/* Store config — cached in-module                                            */
/* -------------------------------------------------------------------------- */

const StoreConfigSchema = z.object({
  storeConfig: z.object({
    store_code: z.string().nullable().optional(),
    base_url: z.string().nullable().optional(),
    base_media_url: z.string().nullable().optional(),
    base_static_url: z.string().nullable().optional(),
    default_title: z.string().nullable().optional(),
    default_description: z.string().nullable().optional(),
    default_keywords: z.string().nullable().optional(),
    title_prefix: z.string().nullable().optional(),
    title_suffix: z.string().nullable().optional(),
    title_separator: z.string().nullable().optional(),
    copyright: z.string().nullable().optional(),
    absolute_footer: z.string().nullable().optional(),
    welcome: z.string().nullable().optional(),
    head_includes: z.string().nullable().optional(),
    head_shortcut_icon: z.string().nullable().optional(),
    header_logo_src: z.string().nullable().optional(),
    logo_alt: z.string().nullable().optional(),
    logo_width: z.union([z.number(), z.string()]).nullable().optional().transform((v) =>
      v == null ? null : typeof v === "number" ? v : Number.parseInt(v, 10) || null,
    ),
    logo_height: z.union([z.number(), z.string()]).nullable().optional().transform((v) =>
      v == null ? null : typeof v === "number" ? v : Number.parseInt(v, 10) || null,
    ),
    locale: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    weight_unit: z.string().nullable().optional(),
    minimum_password_length: z.string().nullable().optional(),
  }),
});

export type StoreConfigT = z.infer<typeof StoreConfigSchema>["storeConfig"];

const STORE_CONFIG_TTL_MS = 5 * 60 * 1000;
let cached: { data: StoreConfigT; at: number } | null = null;

export async function getStoreConfig(force = false): Promise<StoreConfigT> {
  const now = Date.now();
  if (!force && cached && now - cached.at < STORE_CONFIG_TTL_MS) {
    return cached.data;
  }
  const doc = /* GraphQL */ `
    query StoreConfig {
      storeConfig {
        store_code
        base_url
        base_media_url
        base_static_url
        default_title
        default_description
        default_keywords
        title_prefix
        title_suffix
        title_separator
        copyright
        absolute_footer
        welcome
        head_includes
        head_shortcut_icon
        header_logo_src
        logo_alt
        logo_width
        logo_height
        locale
        timezone
        weight_unit
        minimum_password_length
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const parsed = StoreConfigSchema.parse(raw);
    cached = { data: parsed.storeConfig, at: now };
    return parsed.storeConfig;
  } catch {
    // Return empty-but-typed config on failure so callers can fall back to defaults.
    const empty: StoreConfigT = {};
    cached = { data: empty, at: now };
    return empty;
  }
}

/* -------------------------------------------------------------------------- */
/* Menu tree — cached 5-minute category tree for the header mega-menu        */
/* -------------------------------------------------------------------------- */

const MenuNode: z.ZodType<{
  uid: string;
  name: string | null;
  url_path: string | null | undefined;
  url_key: string | null | undefined;
  url_suffix: string | null | undefined;
  include_in_menu: number | null | undefined;
  position: number | null | undefined;
  children?: unknown[] | null;
}> = z.lazy(() =>
  z.object({
    uid: z.string(),
    name: z.string().nullable(),
    url_path: z.string().nullable().optional(),
    url_key: z.string().nullable().optional(),
    url_suffix: z.string().nullable().optional(),
    include_in_menu: z.number().nullable().optional(),
    position: z.number().nullable().optional(),
    children: z.array(MenuNode).nullable().optional(),
  }),
);

export type MenuNodeT = {
  uid: string;
  name: string | null;
  url_path: string | null | undefined;
  url_key: string | null | undefined;
  url_suffix: string | null | undefined;
  include_in_menu: number | null | undefined;
  position: number | null | undefined;
  children?: MenuNodeT[];
};

const MenuSchema = z.object({
  categories: z
    .object({
      items: z.array(MenuNode),
    })
    .nullable(),
});

let menuCache: { data: MenuNodeT[]; at: number } | null = null;

export async function getMenuTree(force = false): Promise<MenuNodeT[]> {
  const now = Date.now();
  if (!force && menuCache && now - menuCache.at < 5 * 60 * 1000) {
    return menuCache.data;
  }
  const doc = /* GraphQL */ `
    query MenuTree {
      categories(filters: { parent_id: { eq: "2" } }) {
        items {
          uid
          name
          url_path
          url_key
          url_suffix
          include_in_menu
          position
          children {
            uid
            name
            url_path
            url_key
            url_suffix
            include_in_menu
            position
            children {
              uid
              name
              url_path
              url_key
              url_suffix
              include_in_menu
              position
            }
          }
        }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const parsed = MenuSchema.parse(raw);
    const items = (parsed.categories?.items ?? [])
      .filter((c) => (c.include_in_menu ?? 1) !== 0)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) as MenuNodeT[];
    menuCache = { data: items, at: now };
    return items;
  } catch {
    menuCache = { data: [], at: now };
    return [];
  }
}
