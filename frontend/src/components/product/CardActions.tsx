import { useState } from "react";
import { addItem } from "~/lib/cart-store";
import { toast } from "~/lib/toast-store";

type Props = {
  sku: string;
  name: string;
  urlKey: string;
  urlSuffix: string;
  typename?: string;
  productHref: string;
};

/**
 * Hover-activated action bar on product cards: Add to cart (simple only —
 * configurables link to PDP), Wishlist, Compare, Quick view.
 * Renders absolutely inside the card so it floats over the image.
 */
export default function CardActions({ sku, name, urlKey, typename, productHref }: Props) {
  const [pending, setPending] = useState(false);

  async function addSimple(e: React.MouseEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    if (typename && typename !== "SimpleProduct" && typename !== "VirtualProduct") {
      // Configurable/bundle/grouped/downloadable: send user to PDP to pick options.
      window.location.href = productHref;
      return;
    }
    setPending(true);
    const ok = await addItem({ sku, quantity: 1 });
    setPending(false);
    if (!ok) return;
  }

  async function addWishlist(e: React.MouseEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch("/api/wishlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      if (res.status === 401) {
        toast.info("Please sign in to save items");
        window.location.href = `/customer/account/login?return=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (body.ok) toast.success(`${name} added to wishlist`);
      else toast.error(body.error ?? "Couldn't add to wishlist");
    } catch {
      toast.error("Couldn't reach server");
    }
  }

  async function addCompare(e: React.MouseEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    try {
      const mod = await import("~/lib/compare-store");
      await mod.addToCompare(urlKey);
      toast.success(`${name} added to compare`);
    } catch {
      toast.error("Couldn't update compare list");
    }
  }

  function openQuickView(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("m2r:quick-view", { detail: { urlKey } }));
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-2 bottom-2 flex translate-y-2 items-center justify-center gap-1 rounded-full bg-white/95 p-1 opacity-0 shadow-md ring-1 ring-black/5 backdrop-blur transition group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
      aria-hidden={false}
    >
      <button
        type="button"
        onClick={addSimple}
        disabled={pending}
        aria-label="Add to cart"
        title={typename && typename !== "SimpleProduct" ? "Choose options" : "Add to cart"}
        className="grid size-9 place-items-center rounded-full text-zinc-700 hover:bg-[var(--color-brand)] hover:text-white disabled:opacity-60"
      >
        {pending ? (
          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={addWishlist}
        aria-label="Add to wishlist"
        title="Add to wishlist"
        className="grid size-9 place-items-center rounded-full text-zinc-700 hover:bg-pink-500 hover:text-white"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M19 14c1.5-1.4 3-3 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 1-4.5 2.5C10.5 4 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.5 1.5 4.1 3 5.5l7 7z" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={addCompare}
        aria-label="Add to compare"
        title="Add to compare"
        className="grid size-9 place-items-center rounded-full text-zinc-700 hover:bg-zinc-900 hover:text-white"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M16 3l4 4-4 4M8 21l-4-4 4-4M4 7h16M20 17H4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={openQuickView}
        aria-label="Quick view"
        title="Quick view"
        className="grid size-9 place-items-center rounded-full text-zinc-700 hover:bg-zinc-100"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  );
}
