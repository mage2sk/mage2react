import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import {
  cart,
  loading,
  nonNullItems,
  refreshCart,
  removeItem,
  setQty,
} from "~/lib/cart-store";
import {
  cartItemImage,
  cartItemUrl,
  type CartItemT,
  type CartT,
} from "~/lib/queries-cart";
import { formatMoney } from "~/lib/money";

type Props = {
  /**
   * Server-fetched cart JSON, injected so the island can render instantly
   * without waiting for the client fetch. When the atom is still null we
   * fall back to this snapshot; once the atom populates we prefer it.
   */
  initialCart: CartT | null;
};

export default function CartPageItems({ initialCart }: Props) {
  const live = useStore(cart);
  const busy = useStore(loading);

  // On first mount, seed the atom from the server payload so the UI doesn't
  // flash blank while `bootstrapCart` fetches the fresh copy.
  useEffect(() => {
    if (cart.get() == null && initialCart) {
      cart.set(initialCart);
      void refreshCart(); // re-sync in background.
    }
  }, [initialCart]);

  const current = live ?? initialCart;
  const items = nonNullItems(current);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center">
        <p className="text-lg font-medium text-zinc-700">
          You have no items in your cart
        </p>
        <a
          href="/"
          className="mt-4 inline-block rounded-full bg-[var(--color-brand)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)]"
        >
          Shop our products
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="hidden border-b border-zinc-200 pb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 md:grid md:grid-cols-[1fr_100px_120px_100px] md:gap-4">
        <span>Item</span>
        <span className="text-right">Price</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Subtotal</span>
      </div>
      <ul className="divide-y divide-zinc-200">
        {items.map((it) => (
          <CartRow key={it.uid} item={it} disabled={busy} />
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Continue Shopping
        </a>
        <a
          href="/checkout"
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)]"
        >
          Proceed to Checkout
        </a>
      </div>
    </div>
  );
}

function CartRow({
  item,
  disabled,
}: {
  item: CartItemT;
  disabled: boolean;
}) {
  const [qty, setLocalQty] = useState<number>(item.quantity);
  const img = cartItemImage(item);
  const rowTotal = item.prices.row_total_including_tax;
  const unit = item.prices.price;
  const url = cartItemUrl(item);
  const options =
    item.__typename === "ConfigurableCartItem"
      ? (item.configurable_options ?? [])
      : [];

  // Keep local input in sync when the atom's authoritative qty changes.
  useEffect(() => { setLocalQty(item.quantity); }, [item.quantity]);

  const dirty = qty !== item.quantity;

  async function commit(): Promise<void> {
    if (!dirty) return;
    await setQty(item.uid, qty);
  }

  return (
    <li className="py-5 md:grid md:grid-cols-[1fr_100px_120px_100px] md:items-start md:gap-4">
      <div className="flex gap-4">
        {img.url ? (
          <img
            src={img.url}
            alt={img.label}
            width={96}
            height={96}
            loading="lazy"
            className="size-24 flex-shrink-0 rounded object-cover"
          />
        ) : (
          <div className="size-24 flex-shrink-0 rounded bg-zinc-100" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900">
            {url ? (
              <a href={url} className="hover:underline">{item.product.name}</a>
            ) : (
              item.product.name
            )}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">SKU: {item.product.sku}</p>
          {options.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-zinc-600">
              {options.map((o, idx) => (
                <li key={idx}>
                  <span className="font-medium">{o.option_label}:</span>{" "}
                  {o.value_label}
                </li>
              ))}
            </ul>
          )}
          {item.__typename === "BundleCartItem" &&
            (item.bundle_options ?? []).map((bo, idx) => (
              <ul key={idx} className="mt-2 space-y-0.5 text-xs text-zinc-600">
                <li>
                  <span className="font-medium">{bo.label}:</span>{" "}
                  {bo.values.map((v) => `${v.quantity ?? 1} × ${v.label}`).join(", ")}
                </li>
              </ul>
            ))}
          <div className="mt-3 flex gap-3 text-xs">
            {url && (
              <a href={url} className="text-zinc-500 underline hover:text-zinc-900">
                Edit
              </a>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => void removeItem(item.uid)}
              className="text-zinc-500 underline hover:text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 text-sm text-zinc-900 md:mt-0 md:text-right">
        <span className="md:hidden text-xs text-zinc-500 mr-2">Price:</span>
        {formatMoney(unit.value, unit.currency)}
      </div>
      <div className="mt-3 flex items-center gap-2 md:mt-0 md:justify-center">
        <label className="sr-only" htmlFor={`qty-${item.uid}`}>Quantity</label>
        <input
          id={`qty-${item.uid}`}
          type="number"
          min={0}
          max={999}
          value={qty}
          onChange={(e) =>
            setLocalQty(Math.max(0, Math.min(999, Number.parseInt(e.target.value, 10) || 0)))
          }
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
          }}
          className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm"
          disabled={disabled}
        />
        {dirty && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void commit()}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
          >
            Update
          </button>
        )}
      </div>
      <div className="mt-3 text-sm font-semibold text-zinc-900 md:mt-0 md:text-right">
        <span className="md:hidden text-xs font-normal text-zinc-500 mr-2">Subtotal:</span>
        {formatMoney(rowTotal.value, rowTotal.currency)}
      </div>
    </li>
  );
}
