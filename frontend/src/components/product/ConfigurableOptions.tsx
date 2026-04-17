import { useMemo, useState } from "react";
import { addItem } from "~/lib/cart-store";
import { formatMoney } from "~/lib/money";

type SwatchData = {
  value?: string | null;
  __typename?: string | null;
  thumbnail?: string | null;
};

export type ConfigOptionValue = {
  uid: string;
  value_index: number | null;
  label: string | null;
  swatch_data?: SwatchData | null;
};

export type ConfigOption = {
  uid: string;
  attribute_code: string | null;
  label: string | null;
  position: number | null | undefined;
  attribute_id: string | null | undefined;
  values: ConfigOptionValue[];
};

export type ConfigVariantAttribute = {
  code: string | null;
  value_index: number | null;
  label: string | null | undefined;
};

export type ConfigVariant = {
  attributes: ConfigVariantAttribute[];
  product: {
    uid: string;
    sku: string;
    name: string;
    stock_status: string | null | undefined;
    image: { url: string | null; label: string | null } | null | undefined;
    price_range: {
      minimum_price: {
        regular_price: { value: number | null; currency: string | null };
        final_price: { value: number | null; currency: string | null };
      };
    };
  };
};

type Props = {
  parentSku: string;
  parentName: string;
  parentImage: string | null;
  fallbackPrice: number;
  fallbackCurrency: string;
  options: ConfigOption[];
  variants: ConfigVariant[];
};

type Selection = Record<string, number>; // attribute_code -> value_index

function isColourSwatch(v: ConfigOptionValue): boolean {
  const t = v.swatch_data?.__typename;
  return t === "ColorSwatchData" || t === "ImageSwatchData";
}

export default function ConfigurableOptions({
  parentSku,
  parentName,
  parentImage,
  fallbackPrice,
  fallbackCurrency,
  options,
  variants,
}: Props) {
  const [sel, setSel] = useState<Selection>({});
  const [pending, setPending] = useState(false);

  const complete = options.every(
    (o) => o.attribute_code != null && sel[o.attribute_code] != null,
  );

  const match = useMemo<ConfigVariant | null>(() => {
    if (!complete) return null;
    return (
      variants.find((v) =>
        v.attributes.every(
          (a) => a.code != null && sel[a.code] === a.value_index,
        ),
      ) ?? null
    );
  }, [complete, sel, variants]);

  // These variables (parentName/parentImage) are kept as props for API
  // compatibility with PDP call sites, but the live UI below sources
  // price/currency from the matched variant (falling back to parent).
  void parentName;
  void parentImage;

  const priceValue =
    match?.product.price_range.minimum_price.final_price.value ?? fallbackPrice;
  const currency =
    match?.product.price_range.minimum_price.final_price.currency ??
    fallbackCurrency;
  const inStock = match
    ? (match.product.stock_status ?? "IN_STOCK") === "IN_STOCK"
    : true;

  function pick(code: string, value: number): void {
    setSel((s) => ({ ...s, [code]: value }));
  }

  return (
    <div>
      <div className="mt-6 text-2xl font-bold">
        {formatMoney(priceValue, currency)}
      </div>

      {options.map((opt) => {
        const code = opt.attribute_code ?? opt.uid;
        const activeValue = sel[code];
        const isColor = opt.values.some(isColourSwatch);

        return (
          <fieldset key={opt.uid} className="mt-6">
            <legend className="text-sm font-medium text-zinc-700">
              {opt.label}
              {activeValue != null && (
                <span className="ml-2 text-zinc-500">
                  {opt.values.find((v) => v.value_index === activeValue)?.label}
                </span>
              )}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {opt.values.map((v) => {
                if (v.value_index == null) return null;
                const active = activeValue === v.value_index;
                if (isColor) {
                  const swatchValue = v.swatch_data?.value ?? "#e5e7eb";
                  const isImage =
                    v.swatch_data?.__typename === "ImageSwatchData" &&
                    v.swatch_data?.thumbnail;
                  return (
                    <button
                      key={v.uid}
                      type="button"
                      aria-label={v.label ?? undefined}
                      aria-pressed={active}
                      onClick={() => pick(code, v.value_index!)}
                      className={`h-8 w-8 rounded-full border-2 transition ${
                        active
                          ? "border-zinc-900 ring-2 ring-zinc-900 ring-offset-2"
                          : "border-zinc-200 hover:border-zinc-400"
                      }`}
                      style={
                        isImage
                          ? {
                              backgroundImage: `url(${v.swatch_data?.thumbnail})`,
                              backgroundSize: "cover",
                            }
                          : { backgroundColor: swatchValue }
                      }
                    />
                  );
                }
                return (
                  <button
                    key={v.uid}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pick(code, v.value_index!)}
                    className={`inline-flex h-10 min-w-[3rem] items-center justify-center rounded-full border px-3 text-sm font-medium transition ${
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !complete || !inStock}
          onClick={async () => {
            if (!complete) return;
            setPending(true);
            await addItem({
              sku: match?.product.sku ?? parentSku,
              parentSku,
              quantity: 1,
            });
            setPending(false);
          }}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60 hover:bg-[var(--color-brand-dark)]"
        >
          {pending
            ? "Adding\u2026"
            : !complete
              ? "Select options"
              : !inStock
                ? "Out of stock"
                : "Add to cart"}
        </button>
        {match && (
          <span className="text-sm text-zinc-500">SKU: {match.product.sku}</span>
        )}
      </div>
    </div>
  );
}
