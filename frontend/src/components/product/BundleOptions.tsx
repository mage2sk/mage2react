import { useMemo, useState } from "react";
import { addItem } from "~/lib/cart-store";
import { formatMoney } from "~/lib/money";

export type BundleOptionChoice = {
  uid: string;
  label: string | null;
  quantity: number | null;
  is_default: boolean | null | undefined;
  product: {
    sku: string;
    name: string;
    price_range: {
      minimum_price: {
        final_price: { value: number | null; currency: string | null };
      };
    };
  };
};

export type BundleItemT = {
  uid: string;
  option_id: number | null;
  title: string | null;
  required: boolean | null;
  type: string | null;
  options: BundleOptionChoice[];
};

type Props = {
  parentSku: string;
  parentName: string;
  parentImage: string | null;
  fallbackPrice: number;
  fallbackCurrency: string;
  items: BundleItemT[];
};

export default function BundleOptions({
  parentSku,
  parentName,
  parentImage,
  fallbackPrice,
  fallbackCurrency,
  items,
}: Props) {
  // Seed selection with each item's default choice (if any) and qty 1.
  const initial = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const it of items) {
      const def = it.options.find((o) => o.is_default) ?? it.options[0];
      if (def) m[it.uid] = def.uid;
    }
    return m;
  }, [items]);

  const [choice, setChoice] = useState<Record<string, string>>(initial);
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState(false);

  const complete = items.every(
    (it) => !it.required || (choice[it.uid] != null && choice[it.uid] !== ""),
  );

  const total = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      const selUid = choice[it.uid];
      if (!selUid) continue;
      const opt = it.options.find((o) => o.uid === selUid);
      if (!opt) continue;
      const qty = opt.quantity ?? 1;
      sum += (opt.product.price_range.minimum_price.final_price.value ?? 0) * qty;
    }
    return sum > 0 ? sum : fallbackPrice;
  }, [choice, items, fallbackPrice]);

  return (
    <div>
      <div className="mt-6 text-2xl font-bold">
        {!complete && (
          <span className="mr-2 text-sm font-medium uppercase tracking-wider text-zinc-500">
            From
          </span>
        )}
        {formatMoney(total, fallbackCurrency)}
      </div>

      <div className="mt-6 space-y-4">
        {items.map((it) => (
          <div key={it.uid} className="rounded-lg border border-zinc-200 p-4">
            <label className="block text-sm font-medium text-zinc-700">
              {it.title}
              {it.required && <span className="ml-1 text-red-600">*</span>}
            </label>
            <select
              value={choice[it.uid] ?? ""}
              onChange={(e) =>
                setChoice((s) => ({ ...s, [it.uid]: e.target.value }))
              }
              className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {!it.required && <option value="">— none —</option>}
              {it.options.map((o) => {
                const p = o.product.price_range.minimum_price.final_price;
                const qtyLabel = (o.quantity ?? 1) > 1 ? `${o.quantity} × ` : "";
                return (
                  <option key={o.uid} value={o.uid}>
                    {qtyLabel}
                    {o.label} (+{formatMoney(p.value, p.currency)})
                  </option>
                );
              })}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          type="button"
          disabled={pending || !complete}
          onClick={async () => {
            setPending(true);
            setOk(false);
            const selectedOptionUids = Object.values(choice).filter(Boolean);
            const result = await addItem({
              sku: parentSku,
              quantity: 1,
              selectedOptionUids,
            });
            void parentName;
            void parentImage;
            void total;
            if (result) {
              setOk(true);
              setTimeout(() => setOk(false), 1500);
            }
            setPending(false);
          }}
          className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium text-white transition disabled:opacity-60 ${
            ok
              ? "bg-emerald-600"
              : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)]"
          }`}
          aria-live="polite"
        >
          {pending
            ? "Adding\u2026"
            : ok
              ? "Added \u2713"
              : complete
                ? "Add to cart"
                : "Choose required options"}
        </button>
      </div>
    </div>
  );
}
