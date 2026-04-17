import { useState } from "react";
import { addItem } from "~/lib/cart-store";

type Row = {
  sku: string;
  name: string;
  price: number;
  currency: string;
  image: string | null;
  initialQty: number;
  inStock: boolean;
};

type Props = { rows: Row[] };

export default function GroupedAddToCart({ rows }: Props) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.sku, r.initialQty])),
  );
  const [pending, setPending] = useState(false);

  const total = rows.reduce((sum, r) => sum + r.price * (qty[r.sku] ?? 0), 0);
  const hasAny = rows.some((r) => (qty[r.sku] ?? 0) > 0);

  return (
    <div className="mt-6">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500">
            <th className="py-2">Product</th>
            <th className="py-2">Price</th>
            <th className="py-2">Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sku} className="border-b border-zinc-100">
              <td className="py-3">
                <div className="font-medium text-zinc-900">{r.name}</div>
                <div className="text-xs text-zinc-500">SKU: {r.sku}</div>
                {!r.inStock && (
                  <div className="mt-1 text-xs font-medium text-red-600">Out of stock</div>
                )}
              </td>
              <td className="py-3 text-zinc-900">
                {r.currency} {r.price.toFixed(2)}
              </td>
              <td className="py-3">
                <input
                  type="number"
                  min={0}
                  value={qty[r.sku] ?? 0}
                  disabled={!r.inStock}
                  onChange={(e) =>
                    setQty((q) => ({
                      ...q,
                      [r.sku]: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                    }))
                  }
                  className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm disabled:bg-zinc-100"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-zinc-500">
          Total: {rows[0]?.currency ?? ""} {total.toFixed(2)}
        </span>
        <button
          type="button"
          disabled={pending || !hasAny}
          onClick={async () => {
            setPending(true);
            // Fire sequentially so each mutation's response keeps the atom in
            // a consistent shape; aggregate errors are flashed by the store.
            for (const r of rows) {
              const q = qty[r.sku] ?? 0;
              if (q > 0) {
                await addItem({ sku: r.sku, quantity: q });
              }
            }
            setPending(false);
          }}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60 hover:bg-[var(--color-brand-dark)]"
        >
          {pending ? "Adding\u2026" : "Add selected to cart"}
        </button>
      </div>
    </div>
  );
}
