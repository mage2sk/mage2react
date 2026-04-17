/**
 * GiftMessageForm.tsx
 *
 * Panth_CheckoutExtendedReact — client island for the optional gift-message
 * form (to / from / message). Collapsible by default; posts via the
 * extended `setGiftMessageOnCart` mutation.
 *
 * INTEGRATION (leave as comments; never auto-wire — do NOT edit
 * `/frontend/src/pages/checkout/payment.astro` from this module):
 *
 *     import GiftMessageForm from
 *       "~/components/panth/checkout-extended/GiftMessageForm";
 *     <GiftMessageForm client:visible cartId={cartId} />
 *
 * The island pre-fetches the current gift-message state on mount and
 * renders nothing when the parent module is disabled.
 */
import { useEffect, useState } from "react";
import {
  getCheckoutExtended,
  setGiftMessageOnCart,
  type CheckoutExtendedT,
  type GiftMessageT,
} from "~/lib/queries-checkout-extended";
import { formatMoney } from "~/lib/money";
import { sanitizeHtml } from "~/lib/sanitize";

interface Props {
  cartId: string;
}

export default function GiftMessageForm({ cartId }: Props): JSX.Element | null {
  const [data, setData] = useState<CheckoutExtendedT | null>(null);
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<null | "saved" | "error">(null);

  useEffect(() => {
    let cancelled = false;
    if (!cartId) return;
    void (async () => {
      const d = await getCheckoutExtended(cartId);
      if (cancelled) return;
      if (!d) {
        setMissing(true);
        return;
      }
      setData(d);
      setFrom(d.gift_message?.from ?? "");
      setTo(d.gift_message?.to ?? "");
      setMessage(d.gift_message?.message ?? "");
      if ((d.gift_message?.message ?? "").length > 0) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [cartId]);

  if (missing) return null;
  if (!data) return null;
  if (data.gift_message_enabled === false) return null;

  async function save(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const payload: GiftMessageT = { from, to, message };
      const updated = await setGiftMessageOnCart(cartId, payload);
      if (updated == null) {
        setStatus("error");
      } else {
        setStatus("saved");
        setData({ ...data, ...updated });
      }
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  const feeLabel =
    data.gift_message_fee?.value != null && data.gift_message_fee.value > 0
      ? ` (+${formatMoney(
          data.gift_message_fee.value,
          data.gift_message_fee.currency ?? "USD",
        )})`
      : "";

  return (
    <div className="mt-4 border border-[var(--color-border,theme(colors.gray.200))] rounded-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="panth-gift-message-body"
        className="w-full flex justify-between items-center px-3 py-2 text-sm font-medium text-[var(--color-fg,theme(colors.gray.800))] bg-[var(--color-muted,theme(colors.gray.50))] rounded-t-md"
      >
        <span>{sanitizeHtml("Add a gift message")}{feeLabel}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div id="panth-gift-message-body" className="p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="block mb-1 text-[var(--color-fg-muted,theme(colors.gray.600))]">From</span>
              <input
                type="text"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                maxLength={120}
                className="w-full rounded border border-[var(--color-border,theme(colors.gray.300))] bg-white p-2 text-sm focus:ring-2 focus:ring-[var(--color-brand,theme(colors.emerald.500))]"
              />
            </label>
            <label className="block text-xs">
              <span className="block mb-1 text-[var(--color-fg-muted,theme(colors.gray.600))]">To</span>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                maxLength={120}
                className="w-full rounded border border-[var(--color-border,theme(colors.gray.300))] bg-white p-2 text-sm focus:ring-2 focus:ring-[var(--color-brand,theme(colors.emerald.500))]"
              />
            </label>
          </div>
          <label className="block text-xs">
            <span className="block mb-1 text-[var(--color-fg-muted,theme(colors.gray.600))]">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded border border-[var(--color-border,theme(colors.gray.300))] bg-white p-2 text-sm focus:ring-2 focus:ring-[var(--color-brand,theme(colors.emerald.500))]"
            />
          </label>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--color-fg-muted,theme(colors.gray.500))]">
              {message.length} / 500
            </p>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center rounded-md bg-[var(--color-brand,theme(colors.emerald.600))] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save gift message"}
            </button>
          </div>
          {status === "saved" && (
            <p className="text-xs text-[var(--color-brand,theme(colors.emerald.700))]" role="status">
              Gift message saved.
            </p>
          )}
          {status === "error" && (
            <p className="text-xs text-red-600" role="alert">
              Could not save — please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
