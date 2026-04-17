/**
 * Thin compose layer between the catch-all `[...slug].astro` category branch
 * and the new `<CategoryGrid/>` component.
 *
 * Given a slug + the current request's searchParams, this function does all
 * the I/O (urlResolver → category → products+facets) and returns a payload
 * you can spread straight into `<CategoryGrid {...payload} />`.
 *
 * This keeps `[...slug].astro` untouched while still giving the route a clean
 * 3-line integration:
 *
 *   import CategoryGrid from "~/components/catalog/CategoryGrid.astro";
 *   import { renderCategoryPayload } from "~/lib/catalog-helpers";
 *   const payload = await renderCategoryPayload(slug, Astro.url.searchParams);
 *   <CategoryGrid {...payload} />
 */

import { resolveUrl, getCategoryByUid, type CategoryT } from "./queries";
import {
  buildFilterInput,
  getCategoryProductsWithFacets,
  isSortKey,
  normalizePage,
  normalizePageSize,
  type CatalogProductsResultT,
  type SortKey,
} from "./queries-catalog";
import {
  breadcrumbLd,
  itemListLd,
  type BreadcrumbItem,
  type ProductCardLike,
} from "./jsonld";

export interface CategoryPagePayload {
  category: CategoryT;
  result: CatalogProductsResultT;
  searchParams: URLSearchParams;
  basePath: string;
  activeSort: SortKey | null;
  pageSize: number;
  currentPage: number;
}

function stripSlashes(s: string): string {
  return s.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Resolve the slug, load the category metadata and a filtered/faceted product
 * page for the given URLSearchParams.
 *
 * Returns `null` if the slug doesn't resolve to a category OR we couldn't hydrate
 * the category from Magento — callers should fall back to whatever 404 / proxy
 * path they already have.
 */
export async function renderCategoryPayload(
  slug: string,
  searchParams: URLSearchParams,
): Promise<CategoryPagePayload | null> {
  const clean = stripSlashes(slug);
  const noSuffix = clean.endsWith(".html") ? clean.slice(0, -5) : clean;
  const withSuffix = `${noSuffix}.html`;

  const resolved = await resolveUrl(withSuffix);
  const finalResolved = resolved.type
    ? resolved
    : await resolveUrl(noSuffix);

  if (finalResolved.type !== "CATEGORY" || !finalResolved.uid) {
    return null;
  }

  const category = await getCategoryByUid(finalResolved.uid);
  if (!category) return null;

  const page = normalizePage(searchParams.get("page") ?? searchParams.get("p"));
  const pageSize = normalizePageSize(
    searchParams.get("pageSize") ?? searchParams.get("ps"),
  );
  const rawSort = searchParams.get("sort");
  const activeSort: SortKey | null = isSortKey(rawSort) ? rawSort : null;

  const filters = buildFilterInput(searchParams);

  const result = await getCategoryProductsWithFacets({
    categoryUid: finalResolved.uid,
    filters,
    sort: activeSort,
    page,
    pageSize,
  });

  return {
    category,
    result,
    searchParams,
    basePath: `/${noSuffix}.html`,
    activeSort,
    pageSize,
    currentPage: result.page_info.current_page,
  };
}

/**
 * Build JSON-LD blocks (BreadcrumbList + ItemList) for a category payload.
 * Callers should spread this into the `<Layout jsonLd={…}/>` prop.
 */
export function buildCategoryJsonLd(
  payload: CategoryPagePayload,
  siteUrl: string,
): unknown[] {
  const { category, result, basePath } = payload;

  const crumbs: BreadcrumbItem[] = [
    { name: "Home", url: new URL("/", siteUrl).toString() },
  ];
  if (category.breadcrumbs) {
    for (const b of category.breadcrumbs) {
      if (!b.category_url_path || !b.category_name) continue;
      crumbs.push({
        name: b.category_name,
        url: new URL(`/${b.category_url_path}.html`, siteUrl).toString(),
      });
    }
  }
  crumbs.push({
    name: category.name ?? "Category",
    url: new URL(basePath, siteUrl).toString(),
  });

  return [
    breadcrumbLd(crumbs),
    itemListLd(
      result.items as unknown as ProductCardLike[],
      (p) => (p.url_key ? `/${p.url_key}.html` : basePath),
      siteUrl,
    ),
  ];
}
