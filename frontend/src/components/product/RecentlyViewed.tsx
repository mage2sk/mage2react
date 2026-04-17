// PDP integration (inside src/pages/[...slug].astro PRODUCT branch):
//   import RecordViewEffect from "~/components/product/RecordViewEffect.tsx";
//   import RecentlyViewed from "~/components/product/RecentlyViewed.tsx";
//   <RecordViewEffect client:idle sku={productView.p.sku} />
//   <RecentlyViewed client:visible excludeSku={productView.p.sku} />
//
// Home integration (src/pages/index.astro):
//   import RecentlyViewed from "~/components/product/RecentlyViewed.tsx";
//   <RecentlyViewed client:visible />
import { useStore } from "@nanostores/react";
import { useEffect, useState, type ReactElement } from "react";
import { formatMoney } from "~/lib/money";
import {
  getProductsBySku,
  type RecentProductCardT,
} from "~/lib/queries-recent";
import {
  hydrateRecentlyViewed,
  recentlyViewed,
} from "~/lib/recently-viewed-store";

type Props = {
  excludeSku?: string;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const MIN_ITEMS_TO_SHOW = 2;

function productHref(p: RecentProductCardT): string {
  const suffix = p.url_suffix ?? ".html";
  return p.url_key ? `/${p.url_key}${suffix}` : "#";
}

function Skeleton(): ReactElement {
  // Five translucent cards approximate the loaded layout — enough to avoid
  // a layout jump without being overly spammy on smaller lists.
  const cells = [0, 1, 2, 3, 4];
  return (
    <ul
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
      aria-hidden="true"
    >
      {cells.map((i) => (
        <li
          key={i}
          className="w-[180px] shrink-0 snap-start sm:w-[200px]"
        >
          <div className="aspect-[4/5] w-full animate-pulse rounded-xl bg-zinc-200" />
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-zinc-200" />
        </li>
      ))}
    </ul>
  );
}

function Card({
  product,
}: {
  product: RecentProductCardT;
}): ReactElement {
  const href = productHref(product);
  const imageUrl = product.small_image?.url ?? null;
  const imageAlt = product.small_image?.label ?? product.name;
  const final = product.price_range.minimum_price.final_price;

  return (
    <a
      href={href}
      className="group flex w-[180px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md sm:w-[200px]"
    >
      <div className="aspect-[4/5] w-full overflow-hidden bg-zinc-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            width="400"
            height="500"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-900">
          {product.name}
        </h3>
        <p className="mt-auto text-sm font-semibold text-zinc-900">
          {formatMoney(final.value, final.currency)}
        </p>
      </div>
    </a>
  );
}

export default function RecentlyViewed({
  excludeSku,
}: Props): ReactElement | null {
  // Ensure the store is hydrated before we read from it — this is safe to
  // call many times; only the first call touches localStorage.
  useEffect(() => {
    hydrateRecentlyViewed();
  }, []);

  const skus = useStore(recentlyViewed);
  const [products, setProducts] = useState<RecentProductCardT[]>([]);
  const [state, setState] = useState<LoadState>("idle");

  // Filter out the excluded SKU (current PDP product).
  const targetSkus = excludeSku
    ? skus.filter((s) => s !== excludeSku)
    : skus;

  const targetKey = targetSkus.join("|");

  useEffect(() => {
    if (targetSkus.length < MIN_ITEMS_TO_SHOW) {
      setProducts([]);
      setState("ready");
      return;
    }

    let cancelled = false;
    setState("loading");
    void (async () => {
      try {
        const items = await getProductsBySku(targetSkus);
        if (cancelled) return;
        setProducts(items);
        setState("ready");
      } catch {
        if (cancelled) return;
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // `targetKey` captures order + membership of the filtered SKU list; the
    // effect body only reads from `targetSkus`, which is derived from it.
  }, [targetKey]);

  // Hide entirely when the visitor has fewer than 2 recorded products
  // (post-exclusion). A single card isn't really a "strip".
  if (targetSkus.length < MIN_ITEMS_TO_SHOW) return null;

  // Also hide if the fetch resolved to fewer than 2 valid products (e.g. if
  // some SKUs are disabled / out-of-stock and filtered out by Magento).
  if (state === "ready" && products.length < MIN_ITEMS_TO_SHOW) return null;

  if (state === "error") return null;

  return (
    <section
      aria-labelledby="recent-heading"
      className="mt-12 border-t border-zinc-200 pt-8"
    >
      <h2
        id="recent-heading"
        className="mb-4 text-xl font-semibold text-zinc-900"
      >
        Recently viewed
      </h2>
      {state === "loading" || state === "idle" ? (
        <Skeleton />
      ) : (
        <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2">
          {products.map((p) => (
            <li key={p.uid} className="shrink-0">
              <Card product={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
