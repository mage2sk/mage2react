/**
 * ⚠️ Filename preserved on purpose.
 *
 * `Base.astro` imports this file as `CartDrawer`. The component was
 * re-designed into a Luma-style **MiniCart** (header dropdown on desktop,
 * slide-in drawer on mobile) but the filename is left as `CartDrawer.tsx`
 * so no edit to `Base.astro` is needed. The exported component is still
 * the default export; callers get the new UI automatically.
 */
import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import {
  cart,
  cartCount,
  cartSubtotal,
  errorToast,
  isCartOpen,
  loading,
  nonNullItems,
  removeItem,
  setQty,
} from "~/lib/cart-store";
import { cartItemImage, type CartItemT } from "~/lib/queries-cart";
import { formatMoney } from "~/lib/money";

export default function MiniCart() {
  const c = useStore(cart);
  const open = useStore(isCartOpen);
  const busy = useStore(loading);
  const toast = useStore(errorToast);

  // Avoid SSR/client hydration mismatch: server doesn't know the cart state
  // (cookie → Magento fetch happens client-side). Render the 0-item shell on
  // first paint, then swap to the real count on mount.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const count = hydrated ? cartCount(c) : 0;
  const items = hydrated ? nonNullItems(c) : [];
  const subtotal = hydrated ? cartSubtotal(c) : null;

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [pulse, setPulse] = useState(false);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCountRef = useRef(count);

  // Responsive breakpoint (≤640px = mobile drawer, else dropdown).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = (): void => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Pulse badge + auto-close timer on count change (increase only).
  useEffect(() => {
    if (count > prevCountRef.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      // Auto-close after 4s unless the user is hovering the panel.
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
      autoCloseRef.current = setTimeout(() => {
        if (!panelRef.current?.matches(":hover")) isCartOpen.set(false);
      }, 4000);
      prevCountRef.current = count;
      return () => clearTimeout(t);
    }
    prevCountRef.current = count;
  }, [count]);

  // Cancel auto-close if the panel is closed manually.
  useEffect(() => {
    if (!open && autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
  }, [open]);

  // Escape closes; basic focus management on open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        isCartOpen.set(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Focus first actionable element inside the panel.
    requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector<HTMLElement>(
        "a, button, input, [tabindex]",
      );
      el?.focus();
    });
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Click outside closes (desktop only — on mobile the backdrop handles it).
  useEffect(() => {
    if (!open || isMobile) return;
    const onClick = (e: MouseEvent): void => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (
        !panelRef.current?.contains(t) &&
        !triggerRef.current?.contains(t)
      ) {
        isCartOpen.set(false);
      }
    };
    // Defer so the click that opened the panel doesn't immediately close it.
    const timer = setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, isMobile]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => isCartOpen.set(!open)}
        className="relative inline-flex items-center gap-2 rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)]"
        aria-label={`Open cart (${count} ${count === 1 ? "item" : "items"})`}
        aria-expanded={hydrated ? open : false}
        aria-haspopup="dialog"
      >
        <svg
          className="size-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
        </svg>
        <span>Cart</span>
        <span
          className={`grid min-w-5 place-items-center rounded-full bg-white/20 px-1 text-xs transition-transform ${
            pulse ? "scale-125" : "scale-100"
          }`}
        >
          {count}
        </span>
      </button>

      {hydrated && open && isMobile && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => isCartOpen.set(false)}
          role="presentation"
        />
      )}

      {hydrated && open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Shopping cart"
          {...(isMobile ? { "aria-modal": true } : {})}
          className={
            isMobile
              ? "fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl"
              : "absolute top-full right-0 z-50 mt-2 flex w-[380px] flex-col rounded-lg border border-zinc-200 bg-white shadow-xl"
          }
        >
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              {count === 0
                ? "Your cart is empty"
                : `You have ${count} ${count === 1 ? "item" : "items"} in your cart`}
            </h2>
            <button
              type="button"
              onClick={() => isCartOpen.set(false)}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
              aria-label="Close cart"
            >
              <svg className="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          {toast && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700" role="alert">
              {toast}
            </div>
          )}

          <div
            className={`flex-1 overflow-y-auto px-4 py-3 ${
              isMobile ? "" : "max-h-96"
            }`}
          >
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-zinc-500">You have no items in your cart</p>
                <a
                  href="/"
                  onClick={() => isCartOpen.set(false)}
                  className="mt-4 inline-block text-sm font-medium text-[var(--color-brand)] hover:underline"
                >
                  Start Shopping
                </a>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {items.map((it) => (
                  <MiniCartRow key={it.uid} item={it} disabled={busy} />
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <footer className="border-t border-zinc-200 px-4 py-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-zinc-500">Subtotal</span>
                <span className="text-base font-semibold text-zinc-900">
                  {subtotal
                    ? formatMoney(subtotal.value, subtotal.currency)
                    : "\u2014"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href="/checkout"
                  onClick={() => isCartOpen.set(false)}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)]"
                >
                  Proceed to Checkout
                </a>
                <a
                  href="/checkout/cart"
                  onClick={() => isCartOpen.set(false)}
                  className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  View Cart
                </a>
              </div>
            </footer>
          )}
        </div>
      )}
    </div>
  );
}

function MiniCartRow({
  item,
  disabled,
}: {
  item: CartItemT;
  disabled: boolean;
}) {
  const img = cartItemImage(item);
  const price = item.prices.row_total_including_tax;
  const unit = item.prices.price;
  const options =
    item.__typename === "ConfigurableCartItem"
      ? (item.configurable_options ?? [])
      : [];

  const dec = (): void => void setQty(item.uid, Math.max(0, item.quantity - 1));
  const inc = (): void => void setQty(item.uid, item.quantity + 1);
  const remove = (): void => void removeItem(item.uid);

  return (
    <li className="flex gap-3 py-3">
      {img.url ? (
        <img
          src={img.url}
          alt={img.label}
          width={60}
          height={60}
          loading="lazy"
          className="size-[60px] shrink-0 rounded object-cover"
        />
      ) : (
        <div className="size-[60px] shrink-0 rounded bg-zinc-100" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium text-zinc-900">
            {item.product.name}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={remove}
            aria-label={`Remove ${item.product.name}`}
            title="Remove"
            className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 6h18" strokeLinecap="round" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinejoin="round" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeLinejoin="round" />
              <path d="M10 11v6M14 11v6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {options.length > 0 && (
          <p className="mt-0.5 text-xs text-zinc-500">
            {options
              .map((o) => `${o.option_label ?? ""}: ${o.value_label ?? ""}`)
              .join(" / ")}
          </p>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          {formatMoney(unit.value, unit.currency)}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center overflow-hidden rounded-full border border-zinc-200">
            <button
              type="button"
              disabled={disabled || item.quantity <= 1}
              onClick={dec}
              aria-label="Decrease quantity"
              className="grid size-7 place-items-center text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            <span className="min-w-[1.75rem] px-1 text-center text-sm font-medium tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={inc}
              aria-label="Increase quantity"
              className="grid size-7 place-items-center text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="text-sm font-semibold text-zinc-900 tabular-nums">
            {formatMoney(price.value, price.currency)}
          </div>
        </div>
      </div>
    </li>
  );
}
