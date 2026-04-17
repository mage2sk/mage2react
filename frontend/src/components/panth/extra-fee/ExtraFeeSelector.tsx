/**
 * ExtraFeeSelector.tsx
 *
 * Panth_ExtraFeeReact — client island on the cart page listing optional
 * surcharges (gift wrap, handling, etc.) with accessible checkboxes.
 * Submits selections via the extended `updateExtraFeesOnCart` mutation and
 * refreshes the shared cart store totals.
 *
 * INTEGRATION (leave as comments; never auto-wire — do NOT edit
 * `/frontend/src/pages/checkout/cart.astro` from this module):
 *
 *     import ExtraFeeSelector from
 *       "~/components/panth/extra-fee/ExtraFeeSelector";
 *     <ExtraFeeSelector client:idle cartId={cartId} />
 *
 * Any Magento-authored label/description passes through `sanitizeHtml()`
 * before rendering. Required fees are rendered as read-only rows. Malformed
 * prices coerce to 0 so a broken fee never blocks checkout.
 */
import { useEffect, useState } from "react";
import {
  getExtraFees,
  safeFeePrice,
  updateExtraFeesOnCart,
  type ExtraFeeT,
} from "~/lib/queries-extra-fee";
import { formatMoney } from "~/lib/money";
import { sanitizeHtml } from "~/lib/sanitize";

interface Props {
  cartId: string;
}

interface FeeBundle {
  fees: ExtraFeeT[];
  title: string;
  total: { value: number; currency: string };
}

export default function ExtraFeeSelector({ cartId }: Props): JSX.Element | null {
  const [bundle, setBundle] = useState<FeeBundle | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!cartId) return;
    void (async () => {
      const result = await getExtraFees(cartId);
      if (cancelled) return;
      if (!result) {
        setMissing(true);
        return;
      }
      setBundle(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [cartId]);

  if (missing || !bundle || bundle.fees.length === 0) return null;

  async function toggle(code: string, nextSelected: boolean): Promise<void> {
    if (busy) return;
    setBusy(code);
    setError(null);
    // Optimistic update.
    const previous = bundle;
    if (previous) {
      setBundle({
        ...previous,
        fees: previous.fees.map((f) =>
          f.code === code ? { ...f, selected: nextSelected } : f,
        ),
      });
    }
    try {
      const updated = await updateExtraFeesOnCart(cartId, [{ code, selected: nextSelected }]);
      if (updated == null) {
        // Revert.
        if (previous) setBundle(previous);
        setError("Could not update fees — please try again.");
      } else if (previous) {
        setBundle({ ...previous, fees: updated });
      }
    } catch {
      if (previous) setBundle(previous);
      setError("Could not update fees — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="rounded-lg border border-[var(--color-border,theme(colors.gray.200))] bg-white p-4 mb-4"
      aria-label={bundle.title}
    >
      <h2 className="text-sm font-semibold text-[var(--color-fg,theme(colors.gray.900))] mb-3">
        {sanitizeHtml(bundle.title)}
      </h2>
      <ul className="divide-y divide-[var(--color-border,theme(colors.gray.100))]">
        {bundle.fees
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((fee) => {
            const code = fee.code ?? "";
            const price = safeFeePrice(fee);
            const isRequired = Boolean(fee.required);
            const isChecked = Boolean(fee.selected) || isRequired;
            const disabled = isRequired || busy === code;
            return (
              <li key={code} className="py-2 flex items-start gap-3">
                <input
                  id={`panth-fee-${code}`}
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border,theme(colors.gray.300))] text-[var(--color-brand,theme(colors.emerald.600))] focus:ring-[var(--color-brand,theme(colors.emerald.500))]"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={(e) => {
                    if (!isRequired) void toggle(code, e.target.checked);
                  }}
                  aria-describedby={fee.description ? `panth-fee-desc-${code}` : undefined}
                />
                <label
                  htmlFor={`panth-fee-${code}`}
                  className="flex-1 cursor-pointer text-sm text-[var(--color-fg,theme(colors.gray.800))]"
                >
                  <span className="block font-medium">
                    {sanitizeHtml(fee.label ?? code)}
                    {isRequired && (
                      <span className="ml-1 text-xs text-[var(--color-fg-muted,theme(colors.gray.500))]">
                        (required)
                      </span>
                    )}
                  </span>
                  {fee.description && (
                    <span
                      id={`panth-fee-desc-${code}`}
                      className="block text-xs text-[var(--color-fg-muted,theme(colors.gray.600))] mt-0.5"
                    >
                      {sanitizeHtml(fee.description)}
                    </span>
                  )}
                </label>
                <span className="text-sm font-medium text-[var(--color-fg,theme(colors.gray.900))]">
                  {formatMoney(price.value, price.currency)}
                </span>
              </li>
            );
          })}
      </ul>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
