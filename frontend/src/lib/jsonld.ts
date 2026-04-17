/**
 * Pure functions that return JSON-LD objects (schema.org).
 * Consumed by the <Seo/> component which serialises them via safeStringify().
 *
 * SEO rules satisfied:
 *   - Structured data per Google's 2026 rich-result requirements.
 *   - Stable @id per entity (absolute URL) — lets Google connect entities
 *     across multiple script tags and across pages.
 *   - Optional @graph composition so a page can emit one script tag with
 *     every entity in it (cleaner, easier for Google to consume).
 *   - Product rich results: aggregateRating, priceValidUntil, itemCondition,
 *     brand, aggregateOffer (for configurables).
 *   - Page-type entities: WebPage, CollectionPage, SearchResultsPage, Article,
 *     FAQPage — mapped to our CMS / category / search / article surfaces.
 */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface MoneyValue {
  value: number | null;
  currency: string | null;
}

export interface ProductImage {
  url: string | null;
  label: string | null;
}

export interface ProductGalleryImage {
  url: string;
  label: string | null;
}

export interface ProductLike {
  name: string;
  sku: string;
  url_key: string | null;
  url_suffix?: string | null;
  description?: { html: string | null } | null;
  short_description?: { html: string | null } | null;
  image?: ProductImage | null;
  media_gallery?: ProductGalleryImage[] | null;
  price_range: {
    minimum_price: {
      regular_price: MoneyValue;
      final_price: MoneyValue;
    };
  };
  stock_status?: string | null;
}

export interface ProductCardLike {
  name: string;
  sku: string;
  url_key: string | null;
  small_image?: { url: string | null; label: string | null } | null;
  price_range: {
    minimum_price: {
      regular_price: MoneyValue;
      final_price: MoneyValue;
    };
  };
}

export interface AggregateRating {
  ratingValue: number;
  reviewCount: number;
}

export interface OrganizationSchema {
  "@context": "https://schema.org";
  "@type": "Organization";
  "@id": string;
  name: string;
  url: string;
  logo: string;
}

export interface WebSiteSchema {
  "@context": "https://schema.org";
  "@type": "WebSite";
  "@id": string;
  name: string;
  url: string;
  potentialAction: {
    "@type": "SearchAction";
    target: {
      "@type": "EntryPoint";
      urlTemplate: string;
    };
    "query-input": string;
  };
}

export interface BreadcrumbListSchema {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
}

export interface ProductOffer {
  "@type": "Offer";
  price: string;
  priceCurrency: string;
  availability: string;
  url: string;
  priceValidUntil?: string;
  itemCondition?: string;
}

export interface ProductAggregateOffer {
  "@type": "AggregateOffer";
  lowPrice: string;
  highPrice: string;
  priceCurrency: string;
  offerCount: number;
  availability: string;
  url: string;
  priceValidUntil?: string;
  itemCondition?: string;
}

export interface ProductSchema {
  "@context": "https://schema.org";
  "@type": "Product";
  "@id": string;
  name: string;
  sku: string;
  image: string[];
  description: string;
  url: string;
  brand?: { "@type": "Brand"; name: string };
  aggregateRating?: {
    "@type": "AggregateRating";
    ratingValue: string;
    reviewCount: number;
  };
  offers: ProductOffer | ProductAggregateOffer;
}

export interface ItemListSchema {
  "@context": "https://schema.org";
  "@type": "ItemList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    url: string;
    name: string;
  }>;
}

export interface WebPageSchema {
  "@context": "https://schema.org";
  "@type": "WebPage";
  "@id": string;
  url: string;
  name: string;
  description: string;
  breadcrumb?: BreadcrumbListSchema;
}

export interface CollectionPageSchema {
  "@context": "https://schema.org";
  "@type": "CollectionPage";
  "@id": string;
  url: string;
  name: string;
  description: string;
  numberOfItems: number;
}

export interface SearchResultsPageSchema {
  "@context": "https://schema.org";
  "@type": "SearchResultsPage";
  "@id": string;
  url: string;
  name: string;
  description: string;
}

export interface FAQPageSchema {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }>;
}

export interface ArticleSchema {
  "@context": "https://schema.org";
  "@type": "Article";
  "@id": string;
  headline: string;
  description: string;
  url: string;
  image?: string | string[];
  datePublished: string;
  dateModified: string;
  author: { "@type": "Person" | "Organization"; name: string };
}

export interface AggregateOfferSchema {
  "@context": "https://schema.org";
  "@type": "AggregateOffer";
  "@id"?: string;
  lowPrice: string;
  highPrice: string;
  priceCurrency: string;
  offerCount: number;
  availability: string;
  url: string;
}

export interface GraphRoot {
  "@context": "https://schema.org";
  "@graph": unknown[];
}

const SITE_NAME = "mage2react";

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function absoluteUrl(path: string, siteUrl: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = siteUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function addYearIso(days = 365): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function organizationLd(siteUrl: string): OrganizationSchema {
  const base = siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: SITE_NAME,
    url: siteUrl,
    logo: `${base}/logo.svg`,
  };
}

export function websiteLd(siteUrl: string): WebSiteSchema {
  const base = siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: SITE_NAME,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: ReadonlyArray<BreadcrumbItem>): BreadcrumbListSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface ProductLdExtra {
  aggregateRating?: AggregateRating | null;
  brand?: string | null;
  priceValidUntil?: string | null;
  priceRange?: { min: number; max: number } | null;
  offerCount?: number | null;
}

export function productLd(
  p: ProductLike,
  siteUrl: string,
  extra: ProductLdExtra = {},
): ProductSchema {
  const images: string[] = [];
  if (p.image?.url) images.push(absoluteUrl(p.image.url, siteUrl));
  for (const g of p.media_gallery ?? []) {
    if (g.url && !images.includes(absoluteUrl(g.url, siteUrl))) {
      images.push(absoluteUrl(g.url, siteUrl));
    }
  }

  const description =
    stripHtml(p.description?.html) ||
    stripHtml(p.short_description?.html) ||
    p.name;

  const suffix = p.url_suffix ?? ".html";
  const productUrl = p.url_key
    ? absoluteUrl(`/${p.url_key}${suffix}`, siteUrl)
    : siteUrl;

  const price = p.price_range.minimum_price.final_price.value ?? 0;
  const currency = p.price_range.minimum_price.final_price.currency ?? "USD";
  const availability =
    (p.stock_status ?? "IN_STOCK") === "IN_STOCK"
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

  const priceValidUntil = extra.priceValidUntil ?? addYearIso(365);
  const itemCondition = "https://schema.org/NewCondition";

  const offers: ProductOffer | ProductAggregateOffer =
    extra.priceRange && extra.priceRange.min !== extra.priceRange.max
      ? {
          "@type": "AggregateOffer",
          lowPrice: extra.priceRange.min.toFixed(2),
          highPrice: extra.priceRange.max.toFixed(2),
          priceCurrency: currency,
          offerCount: extra.offerCount ?? 1,
          availability,
          url: productUrl,
          priceValidUntil,
          itemCondition,
        }
      : {
          "@type": "Offer",
          price: price.toFixed(2),
          priceCurrency: currency,
          availability,
          url: productUrl,
          priceValidUntil,
          itemCondition,
        };

  const schema: ProductSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": productUrl,
    name: p.name,
    sku: p.sku,
    image: images,
    description,
    url: productUrl,
    offers,
  };

  if (extra.brand && extra.brand.trim()) {
    schema.brand = { "@type": "Brand", name: extra.brand.trim() };
  }

  if (
    extra.aggregateRating &&
    Number.isFinite(extra.aggregateRating.ratingValue) &&
    Number.isFinite(extra.aggregateRating.reviewCount) &&
    extra.aggregateRating.reviewCount > 0
  ) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: extra.aggregateRating.ratingValue.toFixed(1),
      reviewCount: extra.aggregateRating.reviewCount,
    };
  }

  return schema;
}

export function itemListLd(
  products: ReadonlyArray<ProductCardLike>,
  urlFor: (p: ProductCardLike) => string,
  siteUrl: string,
): ItemListSchema {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(urlFor(product), siteUrl),
      name: product.name,
    })),
  };
}

export function webPageLd(
  title: string,
  description: string,
  url: string,
  breadcrumbs?: BreadcrumbListSchema,
): WebPageSchema {
  const schema: WebPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    name: title,
    description,
  };
  if (breadcrumbs) {
    schema.breadcrumb = breadcrumbs;
  }
  return schema;
}

export function faqPageLd(
  items: ReadonlyArray<{ question: string; answer: string }>,
): FAQPageSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: it.answer,
      },
    })),
  };
}

export interface ArticleLdInput {
  headline: string;
  description: string;
  url: string;
  image?: string | string[];
  datePublished: string;
  dateModified: string;
  author: string;
  authorType?: "Person" | "Organization";
}

export function articleLd(input: ArticleLdInput): ArticleSchema {
  const schema: ArticleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": input.url,
    headline: input.headline,
    description: input.description,
    url: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: {
      "@type": input.authorType ?? "Organization",
      name: input.author,
    },
  };
  if (input.image) {
    schema.image = input.image;
  }
  return schema;
}

export function collectionPageLd(
  title: string,
  description: string,
  url: string,
  numberOfItems: number,
): CollectionPageSchema {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": url,
    url,
    name: title,
    description,
    numberOfItems,
  };
}

export function searchResultsPageLd(
  query: string,
  totalResults: number,
  url: string,
): SearchResultsPageSchema {
  return {
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    "@id": url,
    url,
    name: query ? `Search results for '${query}'` : "Search",
    description: query
      ? `${totalResults} result${totalResults === 1 ? "" : "s"} for '${query}'.`
      : "Search the catalog.",
  };
}

export function aggregateOfferLd(
  minPrice: number,
  maxPrice: number,
  currency: string,
  offerCount: number,
  availability: string,
  url: string,
): AggregateOfferSchema {
  return {
    "@context": "https://schema.org",
    "@type": "AggregateOffer",
    "@id": `${url}#offers`,
    lowPrice: minPrice.toFixed(2),
    highPrice: maxPrice.toFixed(2),
    priceCurrency: currency,
    offerCount,
    availability,
    url,
  };
}

/**
 * Compose multiple LD entities into a single `@graph` root.
 * Strips any per-entity "@context" since the graph root provides it once.
 * Caller passes this single object to <Seo jsonLd={...}/> to emit exactly
 * one <script type="application/ld+json"> block per page.
 */
export function graphLd(entities: ReadonlyArray<unknown>): GraphRoot {
  const graph = entities
    .filter((e): e is Record<string, unknown> => e != null && typeof e === "object")
    .map((e) => {
      const copy: Record<string, unknown> = { ...e };
      delete copy["@context"];
      return copy;
    });
  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
