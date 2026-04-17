/**
 * CompareBadge — header pill linking to /compare.
 *
 * Hidden when the store reports zero items. Pulses briefly whenever the
 * count increases, matching the `MiniCart` badge treatment.
 */
import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import { compareIds } from "~/lib/compare-store";

export default function CompareBadge() {
  const ids = useStore(compareIds);
  const count = ids.length;
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  if (count === 0) return null;

  return (
    <a
      href="/compare"
      className="relative inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
      aria-label={`Compare ${count} ${count === 1 ? "product" : "products"}`}
    >
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
      <span
        className={`grid min-w-5 place-items-center rounded-full bg-[var(--color-brand)] px-1 text-[10px] font-semibold text-white transition-transform ${
          pulse ? "scale-125" : "scale-100"
        }`}
      >
        {count}
      </span>
    </a>
  );
}
