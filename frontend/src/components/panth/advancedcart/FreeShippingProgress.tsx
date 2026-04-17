/**
 * FreeShippingProgress.tsx
 *
 * Panth_AdvancedcartReact — client island that visualises progress toward
 * the free-shipping threshold and reacts to cart mutations via the shared
 * `cart-store` nanostore.
 *
 * INTEGRATION (leave as comments; never auto-wire):
 *   In your cart/minicart JSX, mount with a low-priority directive:
 *
 *     import FreeShippingProgress from
 *       "~/components/panth/advancedcart/FreeShippingProgress";
 *     <FreeShippingProgress client:idle />
 *
 *   The island bootstraps itself against the shared cart store — it does
 *   not need any props. If the parent `Panth_AdvancedCart` module is
 *   unavailable the island renders nothing after mount.
 */
import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { cart, cartId as cartIdStore, cartSubtotal } from "~/lib/cart-store";
import {
  computeFreeShippingProgress,
  getAdvancedCart,
  type AdvancedCartT,
} from "~/lib/queries-advancedcart";
import { formatMoney } from "~/lib/money";
import { sanitizeHtml } from "~/lib/sanitize";

export default function FreeShippingProgress(): JSX.Element | null {
  const cartValue = useStore(cart);
  const id = useStore(cartIdStore);
  const [extra, setExtra] = useState<AdvancedCartT | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    void (async () => {
      const data = await getAdvancedCart(id);
      if (cancelled) return;
      if (data == null) {
        setMissing(true);
      } else {
        setExtra(data);
        setMissing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the cart id or total quantity changes.
  }, [id, cartValue?.total_quantity]);

  if (missing || !extra || !extra.free_shipping_enabled) return null;

  const threshold = extra.free_shipping_threshold ?? 0;
  if (threshold <= 0) return null;

  const subtotal = cartSubtotal(cartValue);
  const currency = subtotal?.currency ?? extra.free_shipping_currency ?? "USD";

  const { ratio, remaining, achieved } =
    typeof subtotal?.value === "number"
      ? computeFreeShippingProgress(subtotal.value, threshold)
      : {
          ratio: extra.free_shipping_achieved ? 1 : 0,
          remaining: extra.free_shipping_remaining ?? threshold,
          achieved: Boolean(extra.free_shipping_achieved),
        };

  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);

  const msgRaw = achieved
    ? extra.message_achieved ?? "You've earned free shipping!"
    : (extra.message_progress ?? "You're {remaining} away from free shipping!").replace(
        /\{\{?\s*remaining\s*\}?\}/gi,
        formatMoney(remaining, currency),
      );

  // Magento admin-authored strings are text-only renders here (no innerHTML),
  // but we still sanitise defensively in case HTML slips through the parent
  // module's admin field.
  const msg = sanitizeHtml(msgRaw);

  return (
    <div
      className="rounded-md border border-[var(--color-border,theme(colors.gray.200))] bg-white p-3"
      aria-label="Free shipping progress"
    >
      <p
        className={
          achieved
            ? "text-sm font-medium text-[var(--color-brand,theme(colors.emerald.700))]"
            : "text-sm font-medium text-[var(--color-fg,theme(colors.gray.800))]"
        }
      >
        {msg}
      </p>
      <div
        className="mt-2 h-2 w-full rounded-full bg-[var(--color-muted,theme(colors.gray.100))] overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full bg-[var(--color-brand,theme(colors.emerald.600))] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
