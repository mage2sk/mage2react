import { useStore } from "@nanostores/react";
import { useState } from "react";
import {
  applyCoupon,
  cart,
  cartGrandTotal,
  cartSubtotal,
  loading,
  removeCoupon,
} from "~/lib/cart-store";
import type { CartT } from "~/lib/queries-cart";
import { formatMoney } from "~/lib/money";

type Props = { initialCart: CartT | null };

export default function CartSummary({ initialCart }: Props) {
  const live = useStore(cart);
  const busy = useStore(loading);

  const current = live ?? initialCart;
  if (!current) return null;

  const subtotal = cartSubtotal(current);
  const grand = cartGrandTotal(current);
  const taxes = current.prices?.applied_taxes ?? [];
  const applied = current.applied_coupons?.[0]?.code ?? null;

  return (
    <aside className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-900">Summary</h2>

      <ShippingTaxesSection taxes={taxes} />
      <CouponSection applied={applied} busy={busy} />

      <dl className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-sm">
        {subtotal && (
          <div className="flex justify-between">
            <dt className="text-zinc-600">Subtotal</dt>
            <dd className="font-medium text-zinc-900">
              {formatMoney(subtotal.value, subtotal.currency)}
            </dd>
          </div>
        )}
        {taxes.map((t, i) => (
          <div key={i} className="flex justify-between text-zinc-600">
            <dt>Tax{t.label ? ` (${t.label})` : ""}</dt>
            <dd>{formatMoney(t.amount.value, t.amount.currency)}</dd>
          </div>
        ))}
        {grand && (
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
            <dt className="font-semibold text-zinc-900">Order Total</dt>
            <dd className="font-bold text-zinc-900">
              {formatMoney(grand.value, grand.currency)}
            </dd>
          </div>
        )}
      </dl>

      <a
        href="/checkout"
        data-astro-reload
        className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)]"
      >
        Proceed to Checkout
      </a>
    </aside>
  );
}

function ShippingTaxesSection({
  taxes,
}: {
  taxes: ReadonlyArray<{ label: string | null; amount: { value: number | null; currency: string | null } }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="mt-4 border-t border-zinc-200 pt-4"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-zinc-800">
        <span className="inline-flex items-center gap-1">
          <span className={`transition-transform ${open ? "rotate-90" : ""}`}>
            ›
          </span>
          Estimate Shipping and Tax
        </span>
      </summary>
      <div className="mt-3 text-xs text-zinc-600">
        <p>
          Shipping estimates require a delivery address and are calculated at
          checkout.
        </p>
        {taxes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {taxes.map((t, i) => (
              <li key={i} className="flex justify-between">
                <span>{t.label ?? "Tax"}</span>
                <span>{formatMoney(t.amount.value, t.amount.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function CouponSection({
  applied,
  busy,
}: {
  applied: string | null;
  busy: boolean;
}) {
  const [open, setOpen] = useState(applied != null);
  const [code, setCode] = useState("");

  async function onApply(): Promise<void> {
    const trimmed = code.trim();
    if (!trimmed) return;
    const ok = await applyCoupon(trimmed);
    if (ok) setCode("");
  }

  return (
    <details
      className="mt-3 border-t border-zinc-200 pt-4"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-zinc-800">
        <span className="inline-flex items-center gap-1">
          <span className={`transition-transform ${open ? "rotate-90" : ""}`}>
            ›
          </span>
          Apply Discount Code
        </span>
      </summary>
      <div className="mt-3">
        {applied ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {applied}
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeCoupon()}
                className="ml-1 text-emerald-900 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remove coupon ${applied}`}
              >
                ×
              </button>
            </span>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onApply();
                }
              }}
              placeholder="Enter code"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || code.trim() === ""}
              onClick={() => void onApply()}
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
