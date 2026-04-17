import { useState } from "react";
import { addItem } from "~/lib/cart-store";

type Props = {
  sku: string;
  /** Kept for API compatibility; UI shows the server-returned name post-add. */
  name: string;
  /** Kept for API compatibility; pricing is sourced from Magento on add. */
  price: number;
  /** Kept for API compatibility. */
  currency: string;
  /** Kept for API compatibility. */
  image: string | null;
  /** Parent SKU, required when `sku` is a configurable/bundle variant child. */
  parentSku?: string;
  /** Selected option UIDs for configurable/bundle/downloadable products. */
  selectedOptions?: string[];
};

type Phase = "idle" | "pending" | "success";

export default function AddToCartButton({ sku, parentSku, selectedOptions }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");

  async function onClick(): Promise<void> {
    setPhase("pending");
    const ok = await addItem({
      sku,
      quantity: 1,
      parentSku,
      selectedOptionUids: selectedOptions,
    });
    if (ok) {
      setPhase("success");
      setTimeout(() => setPhase("idle"), 1200);
    } else {
      setPhase("idle");
    }
  }

  const label =
    phase === "pending" ? "Adding\u2026" : phase === "success" ? "Added \u2713" : "Add to cart";

  return (
    <button
      type="button"
      disabled={phase === "pending"}
      onClick={onClick}
      aria-live="polite"
      className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium text-white transition disabled:opacity-60 ${
        phase === "success"
          ? "bg-emerald-600"
          : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)]"
      }`}
    >
      {phase === "pending" && (
        <svg className="mr-2 size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {label}
    </button>
  );
}
