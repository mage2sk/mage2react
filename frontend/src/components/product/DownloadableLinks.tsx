import { useMemo, useState } from "react";
import { addItem } from "~/lib/cart-store";
import { formatMoney } from "~/lib/money";

export type DownloadableLinkT = {
  uid: string;
  title: string | null;
  price: number | null | undefined;
  sample_url: string | null | undefined;
};

type Props = {
  parentSku: string;
  parentName: string;
  parentImage: string | null;
  basePrice: number;
  currency: string;
  links: DownloadableLinkT[];
  linksTitle: string | null;
};

export default function DownloadableLinks({
  parentSku,
  parentName,
  parentImage,
  basePrice,
  currency,
  links,
  linksTitle,
}: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState(false);

  const extras = useMemo(() => {
    let sum = 0;
    for (const l of links) {
      if (selected[l.uid]) sum += l.price ?? 0;
    }
    return sum;
  }, [links, selected]);

  const total = basePrice + extras;

  return (
    <div>
      <div className="mt-6 text-2xl font-bold">
        {formatMoney(total, currency)}
      </div>

      {links.length > 0 && (
        <fieldset className="mt-6 rounded-lg border border-zinc-200 p-4">
          <legend className="px-2 text-sm font-medium text-zinc-700">
            {linksTitle ?? "Links"}
          </legend>
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={l.uid} className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    checked={!!selected[l.uid]}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [l.uid]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span>{l.title}</span>
                  {l.price != null && l.price > 0 && (
                    <span className="text-zinc-500">
                      (+{formatMoney(l.price, currency)})
                    </span>
                  )}
                </label>
                {l.sample_url && (
                  <a
                    href={l.sample_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-astro-reload
                    className="text-xs text-zinc-500 underline hover:text-zinc-900"
                  >
                    Sample
                  </a>
                )}
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="mt-6">
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setOk(false);
            const selectedOptionUids = links
              .filter((l) => selected[l.uid])
              .map((l) => l.uid);
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
          {pending ? "Adding\u2026" : ok ? "Added \u2713" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
