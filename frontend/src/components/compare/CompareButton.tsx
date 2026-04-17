/**
 * CompareButton — "⇄ Compare" / "Added to compare ×" toggle.
 *
 * Integration snippets — drop these into the indicated files verbatim.
 * (Deliberately NOT wired here; the coordinator will edit those files.)
 *
 *   // PDP integration (inside src/pages/[...slug].astro PRODUCT branch):
 *   //   import CompareButton from "~/components/compare/CompareButton.tsx";
 *   //   <CompareButton client:visible productUid={productView.p.uid} productName={productView.p.name} />
 *   //
 *   // ProductCard integration (inside src/components/ProductCard.astro card footer):
 *   //   import CompareButton from "~/components/compare/CompareButton.tsx";
 *   //   <CompareButton client:visible productUid={product.uid} productName={product.name} />
 *   //
 *   // Header badge (inside src/layouts/Base.astro header):
 *   //   import CompareBadge from "~/components/compare/CompareBadge.tsx";
 *   //   <CompareBadge client:idle />
 */
import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import {
  addToCompare,
  compareErrorToast,
  compareIds,
  compareLoading,
  removeFromCompare,
} from "~/lib/compare-store";

type Props = {
  productUid: string;
  productName: string;
};

export default function CompareButton({ productUid, productName }: Props) {
  const ids = useStore(compareIds);
  const busy = useStore(compareLoading);
  const toast = useStore(compareErrorToast);
  const inCompare = ids.includes(productUid);
  const [disabled, setDisabled] = useState(false);
  const [failureTip, setFailureTip] = useState<string | null>(null);
  const lastToast = useRef<string | null>(null);

  // A toast surfaced by the store counts as "Magento is probably up but
  // something rejected"; don't permanently disable — disable only if the
  // queries-compare module reports a hard failure (we surface that by
  // detecting a toast that fires immediately after our own click).
  useEffect(() => {
    if (toast && lastToast.current !== toast) {
      lastToast.current = toast;
      if (toast.startsWith("Couldn't reach server")) {
        setDisabled(true);
        setFailureTip("Try again");
        // Auto-recover after 6s so the user can retry.
        const t = setTimeout(() => {
          setDisabled(false);
          setFailureTip(null);
        }, 6000);
        return () => clearTimeout(t);
      }
    }
  }, [toast]);

  async function onClick(): Promise<void> {
    if (disabled || busy) return;
    if (inCompare) {
      await removeFromCompare(productUid);
    } else {
      await addToCompare(productUid);
    }
  }

  const label = inCompare
    ? `Remove ${productName} from compare`
    : `Add ${productName} to compare`;

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled || busy}
      aria-label={label}
      title={failureTip ?? (inCompare ? "Added to compare" : "Compare")}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        inCompare
          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
        disabled || busy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      {inCompare ? (
        <>
          <svg
            className="size-3.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>Added to compare</span>
          <span aria-hidden="true" className="ml-1 text-zinc-500">×</span>
        </>
      ) : (
        <>
          <svg
            className="size-3.5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 7h13" />
            <path d="m16 3 4 4-4 4" />
            <path d="M17 17H4" />
            <path d="m8 21-4-4 4-4" />
          </svg>
          <span>Compare</span>
        </>
      )}
    </button>
  );
}
