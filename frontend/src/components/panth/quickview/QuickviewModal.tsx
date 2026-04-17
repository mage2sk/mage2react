/**
 * QuickviewModal.tsx — drop-in replacement for `src/components/product/QuickView.tsx`.
 *
 * INTEGRATION (comment-only; do not edit Base.astro from this module):
 *   import QuickviewModal from "~/components/panth/quickview/QuickviewModal";
 *   <QuickviewModal client:idle />
 *
 * Listens for `window.m2r:quick-view` events (already dispatched by
 * `CardActions.tsx`) and opens a richer modal backed by `Panth_Quickview`.
 * Features:
 *   - Badges (admin-defined label + allowlisted color)
 *   - Stock counter ("Only N left!")
 *   - Rating summary (out of 5)
 *   - Short description (sanitized)
 *   - Add-to-cart for simples, "Choose options" for configurables
 *   - Keyboard: Esc closes, focus trap on open, restores focus on close
 *
 * Hydration-safe: state is guarded with a `hasMounted` flag before any
 * DOM measurement or portal work. Uses `useId` for unique ids.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { addItem } from "~/lib/cart-store";
import { formatMoney } from "~/lib/money";
import { sanitizeHtml } from "~/lib/sanitize";
import { toast } from "~/lib/toast-store";
import { getQuickviewProduct, type QuickProductT } from "~/lib/queries-quickview";

const COLOR_ALLOWLIST: Record<string, string> = {
  red: "#dc2626",
  green: "#16a34a",
  blue: "#2563eb",
  amber: "#d97706",
  yellow: "#ca8a04",
  gray: "#4b5563",
  zinc: "#3f3f46",
  black: "#111827",
  brand: "var(--color-brand)",
};
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normaliseColor(raw: string | null | undefined): string {
  if (!raw) return COLOR_ALLOWLIST.gray!;
  const key = raw.trim().toLowerCase();
  if (key in COLOR_ALLOWLIST) return COLOR_ALLOWLIST[key]!;
  if (HEX_RE.test(key)) return key;
  return COLOR_ALLOWLIST.gray!;
}

function cleanText(v: string | null | undefined): string {
  if (!v) return "";
  return sanitizeHtml(v).replace(/<[^>]*>/g, "").trim();
}

export default function QuickviewModal(): ReactElement | null {
  const [hasMounted, setHasMounted] = useState(false);
  const [urlKey, setUrlKey] = useState<string | null>(null);
  const [product, setProduct] = useState<QuickProductT | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const uid = useId();
  const titleId = `qv-title-${uid.replace(/[:]/g, "")}`;

  useEffect(() => setHasMounted(true), []);

  // Listen for the custom event dispatched by CardActions.
  useEffect(() => {
    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<{ urlKey?: string }>).detail;
      if (!detail?.urlKey || typeof detail.urlKey !== "string") return;
      returnFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
      setUrlKey(detail.urlKey);
    };
    window.addEventListener("m2r:quick-view", handler as EventListener);
    return () => window.removeEventListener("m2r:quick-view", handler as EventListener);
  }, []);

  // Fetch the product when urlKey changes.
  useEffect(() => {
    if (!urlKey) {
      setProduct(null);
      return;
    }
    setLoading(true);
    setProduct(null);
    let cancelled = false;
    void getQuickviewProduct(urlKey).then((p) => {
      if (cancelled) return;
      setProduct(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [urlKey]);

  // Escape to close, lock body scroll, and trap focus to the dialog.
  useEffect(() => {
    if (!urlKey) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") trapFocus(e);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the close button on open so keyboard users land inside the dialog.
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  const close = useCallback((): void => {
    setUrlKey(null);
    // Restore focus to the element that opened the modal.
    const r = returnFocusRef.current;
    if (r && typeof r.focus === "function") window.setTimeout(() => r.focus(), 0);
  }, []);

  const trapFocus = useCallback((e: KeyboardEvent): void => {
    const root = dialogRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!hasMounted || !urlKey) return null;

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
    if (ok) {
      toast.success(`${product.name} added to cart`);
      close();
    }
  }

  const extras = product?.panth_quickview ?? null;
  const badges = (extras?.badges ?? [])
    .map((b) => ({ label: cleanText(b.label), color: normaliseColor(b.color) }))
    .filter((b) => b.label.length > 0)
    .slice(0, 4);

  const rating = typeof extras?.rating_summary === "number" ? extras.rating_summary : null;
  const stockCounter =
    typeof extras?.stock_counter === "number" && extras.stock_counter > 0
      ? extras.stock_counter
      : null;

  const imgSrc =
    extras?.featured_image?.url ??
    product?.image?.url ??
    product?.small_image?.url ??
    null;
  const imgAlt =
    extras?.featured_image?.label ??
    product?.image?.label ??
    product?.small_image?.label ??
    product?.name ??
    "";

  const shortHtml =
    extras?.short_description_html ??
    product?.short_description?.html ??
    null;
  const safeShortHtml = shortHtml ? sanitizeHtml(shortHtml) : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      onClick={close}
    >
      <div
        ref={dialogRef}
        className="relative flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close quick view"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 text-zinc-700 shadow hover:bg-zinc-100"
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
                onClick={close}
                className="mt-4 rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {!loading && product && (
          <div className="grid w-full grid-cols-1 overflow-y-auto md:grid-cols-2">
            <div className="relative aspect-[4/5] bg-zinc-100 md:aspect-auto">
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={imgAlt}
                  width={500}
                  height={625}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-zinc-400">No image</div>
              )}
              {badges.length > 0 && (
                <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1">
                  {badges.map((b) => (
                    <span
                      key={b.label}
                      className="rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow"
                      style={{ backgroundColor: b.color }}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div>
                <h2 id={titleId} className="text-xl font-bold">{product.name}</h2>
                <p className="mt-1 text-xs text-zinc-500">SKU: {product.sku}</p>
                {rating != null && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-zinc-600">
                    <svg className="size-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
                    </svg>
                    <span>{rating.toFixed(1)} / 5</span>
                    {typeof extras?.review_count === "number" && extras.review_count > 0 && (
                      <span className="text-zinc-500">({extras.review_count})</span>
                    )}
                  </p>
                )}
              </div>
              <div className="text-2xl font-semibold">
                {formatMoney(
                  product.price_range.minimum_price?.final_price?.value ?? null,
                  product.price_range.minimum_price?.final_price?.currency ?? null,
                )}
              </div>
              {stockCounter != null && (
                <p className="text-sm font-medium text-amber-700">
                  Only {stockCounter} left in stock
                </p>
              )}
              {safeShortHtml && (
                <div
                  className="prose prose-sm max-w-none text-zinc-700"
                  dangerouslySetInnerHTML={{ __html: safeShortHtml }}
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
