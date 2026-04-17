import { useEffect, useState } from "react";
import { z } from "zod";
import { addItem } from "~/lib/cart-store";
import { formatMoney } from "~/lib/money";
import { toast } from "~/lib/toast-store";

const Money = z.object({
  value: z.number().nullable(),
  currency: z.string().nullable(),
});

const QuickProduct = z.object({
  uid: z.string(),
  __typename: z.string(),
  name: z.string(),
  sku: z.string(),
  url_key: z.string().nullable(),
  url_suffix: z.string().nullable().optional(),
  stock_status: z.string().nullable().optional(),
  image: z
    .object({ url: z.string().nullable(), label: z.string().nullable() })
    .nullable()
    .optional(),
  short_description: z.object({ html: z.string().nullable() }).nullable().optional(),
  price_range: z.object({
    minimum_price: z.object({
      regular_price: Money,
      final_price: Money,
    }),
  }),
});

type QuickProductT = z.infer<typeof QuickProduct>;

const Response = z.object({
  products: z.object({ items: z.array(QuickProduct) }),
});

const QUICK_QUERY = /* GraphQL */ `
  query QuickViewProduct($urlKey: String!) {
    products(filter: { url_key: { eq: $urlKey } }) {
      items {
        uid
        __typename
        name
        sku
        url_key
        url_suffix
        stock_status
        image {
          url
          label
        }
        short_description {
          html
        }
        price_range {
          minimum_price {
            regular_price {
              value
              currency
            }
            final_price {
              value
              currency
            }
          }
        }
      }
    }
  }
`;

async function fetchProduct(urlKey: string): Promise<QuickProductT | null> {
  try {
    const res = await fetch(`${window.location.origin}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUICK_QUERY, variables: { urlKey } }),
    });
    const body = (await res.json()) as unknown;
    const parsed = Response.safeParse((body as { data?: unknown }).data);
    if (!parsed.success) return null;
    return parsed.data.products.items[0] ?? null;
  } catch {
    return null;
  }
}

export default function QuickView() {
  const [urlKey, setUrlKey] = useState<string | null>(null);
  const [product, setProduct] = useState<QuickProductT | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<{ urlKey: string }>).detail;
      if (!detail?.urlKey) return;
      setUrlKey(detail.urlKey);
    };
    window.addEventListener("m2r:quick-view", handler as EventListener);
    return () => window.removeEventListener("m2r:quick-view", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!urlKey) {
      setProduct(null);
      return;
    }
    setLoading(true);
    setProduct(null);
    void fetchProduct(urlKey).then((p) => {
      setProduct(p);
      setLoading(false);
    });
  }, [urlKey]);

  useEffect(() => {
    if (!urlKey) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setUrlKey(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [urlKey]);

  if (!urlKey) return null;

  const simple =
    product &&
    (product.__typename === "SimpleProduct" || product.__typename === "VirtualProduct");
  const pdpHref = product?.url_key
    ? `/${product.url_key}${product.url_suffix ?? ".html"}`
    : "#";

  async function doAdd(): Promise<void> {
    if (!product) return;
    if (!simple) {
      window.location.href = pdpHref;
      return;
    }
    setAdding(true);
    const ok = await addItem({ sku: product.sku, quantity: 1 });
    setAdding(false);
    if (ok) setUrlKey(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick view"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      onClick={() => setUrlKey(null)}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setUrlKey(null)}
          aria-label="Close quick view"
          className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-zinc-700 shadow hover:bg-zinc-100"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {loading && (
          <div className="grid h-96 w-full place-items-center">
            <svg className="size-8 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {!loading && !product && (
          <div className="grid h-96 w-full place-items-center p-8 text-center">
            <div>
              <p className="text-sm text-zinc-600">Couldn't load product details.</p>
              <button
                type="button"
                onClick={() => setUrlKey(null)}
                className="mt-4 rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {!loading && product && (
          <div className="grid w-full grid-cols-1 overflow-y-auto md:grid-cols-2">
            <div className="aspect-[4/5] bg-zinc-100 md:aspect-auto">
              {product.image?.url && (
                <img
                  src={product.image.url}
                  alt={product.image.label ?? product.name}
                  width={500}
                  height={625}
                  loading="eager"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div>
                <h2 className="text-xl font-bold">{product.name}</h2>
                <p className="mt-1 text-xs text-zinc-500">SKU: {product.sku}</p>
              </div>
              <div className="text-2xl font-semibold">
                {formatMoney(
                  product.price_range.minimum_price.final_price.value,
                  product.price_range.minimum_price.final_price.currency,
                )}
              </div>
              {product.short_description?.html && (
                <div
                  className="prose prose-sm max-w-none text-zinc-700"
                  dangerouslySetInnerHTML={{ __html: product.short_description.html }}
                />
              )}
              <div className="mt-auto flex flex-col gap-2 pt-4">
                <button
                  type="button"
                  onClick={doAdd}
                  disabled={adding}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
                >
                  {adding ? "Adding\u2026" : simple ? "Add to cart" : "Choose options"}
                </button>
                <a
                  href={pdpHref}
                  className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  onClick={() => {
                    void toast;
                  }}
                >
                  View full details
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
