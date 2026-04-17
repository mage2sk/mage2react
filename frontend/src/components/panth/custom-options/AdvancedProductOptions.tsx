/**
 * AdvancedProductOptions.tsx
 *
 * Panth_CustomOptionsReact — client island rendering advanced product
 * option types (color swatch, dropdown, radio, checkbox, textarea,
 * textarea_rich, file, date). Collects values into a Magento-compatible
 * shape and fires a `panth:options-changed` CustomEvent the surrounding
 * PDP can listen for to toggle the Add-to-Cart button and compute totals.
 *
 * INTEGRATION (leave as comments; never auto-wire — do NOT edit shipped
 * PDP templates from this module):
 *
 *     import AdvancedProductOptions from
 *       "~/components/panth/custom-options/AdvancedProductOptions";
 *     <AdvancedProductOptions client:visible sku={product.sku} />
 *
 *   Listen for the emitted event on the PDP root and forward the payload
 *   to your existing `addProductsToCart` call:
 *
 *     document.addEventListener("panth:options-changed", (e) => {
 *       const detail = (e as CustomEvent).detail;
 *       // detail: { selected_options: string[], entered_options: {uid, value}[], valid: boolean }
 *     });
 *
 * SECURITY:
 *   - All help-text HTML runs through `sanitizeHtml()` before `set:html`.
 *   - Option labels render as text nodes (no innerHTML).
 *   - File-upload handling is a PLACEHOLDER — actual upload wiring is out
 *     of scope for this module; the UI captures the file name only.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAdvancedProductOptions,
  normaliseOptionType,
  type AdvancedOptionT,
  type AdvancedOptionValueT,
} from "~/lib/queries-custom-options";
import { sanitizeHtml } from "~/lib/sanitize";
import { formatMoney } from "~/lib/money";

interface Props {
  sku: string;
}

type SelectionMap = Record<string, string | string[]>; // optionUid -> valueUid(s) or entered text

function priceSuffix(v: AdvancedOptionValueT): string {
  const val = v.price?.value;
  if (val == null || val === 0) return "";
  const currency = v.price?.currency ?? "USD";
  const sign = val > 0 ? "+" : "−";
  return ` (${sign}${formatMoney(Math.abs(val), currency)})`;
}

export default function AdvancedProductOptions({ sku }: Props): JSX.Element | null {
  const [options, setOptions] = useState<AdvancedOptionT[] | null>(null);
  const [selected, setSelected] = useState<SelectionMap>({});
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!sku) return;
    void (async () => {
      const opts = await getAdvancedProductOptions(sku);
      if (cancelled) return;
      if (opts == null) {
        setMissing(true);
        return;
      }
      setOptions(opts);
    })();
    return () => {
      cancelled = true;
    };
  }, [sku]);

  const isValid = useMemo(() => {
    if (!options) return false;
    for (const o of options) {
      if (!o.required) continue;
      const uid = o.uid ?? "";
      const type = normaliseOptionType(o.type);
      if (type === "textarea" || type === "textarea_rich" || type === "text" || type === "date") {
        if (!(entered[uid] ?? "").trim()) return false;
      } else if (type === "checkbox") {
        const v = selected[uid];
        if (!Array.isArray(v) || v.length === 0) return false;
      } else {
        const v = selected[uid];
        if (!v || (typeof v === "string" && v.length === 0)) return false;
      }
    }
    return true;
  }, [options, selected, entered]);

  // Emit state upstream.
  useEffect(() => {
    if (!rootRef.current) return;
    const selectedOptions: string[] = [];
    for (const v of Object.values(selected)) {
      if (Array.isArray(v)) selectedOptions.push(...v);
      else if (typeof v === "string" && v.length > 0) selectedOptions.push(v);
    }
    const enteredOptions = Object.entries(entered)
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([uid, value]) => ({ uid, value }));
    rootRef.current.dispatchEvent(
      new CustomEvent("panth:options-changed", {
        bubbles: true,
        detail: { selected_options: selectedOptions, entered_options: enteredOptions, valid: isValid },
      }),
    );
  }, [selected, entered, isValid]);

  if (missing) return null;
  if (!options || options.length === 0) return null;

  // Stable ordering by admin sort_order.
  const sorted = [...options].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div ref={rootRef} className="space-y-4 mt-4" aria-label="Advanced product options">
      {sorted.map((opt) => {
        const type = normaliseOptionType(opt.type);
        const uid = opt.uid ?? "";
        const labelId = `panth-opt-${uid}`;
        const help = opt.help_text_html ? sanitizeHtml(opt.help_text_html) : null;
        return (
          <fieldset key={uid} className="border border-[var(--color-border,theme(colors.gray.200))] rounded-md p-3">
            <legend id={labelId} className="text-sm font-medium text-[var(--color-fg,theme(colors.gray.800))] px-1">
              {opt.title ?? "Option"}
              {opt.required && <span aria-label="required" className="text-red-600 ml-1">*</span>}
            </legend>
            {help && (
              <div
                className="text-xs text-[var(--color-fg-muted,theme(colors.gray.600))] mt-1 mb-2"
                dangerouslySetInnerHTML={{ __html: help }}
              />
            )}
            {renderInput(type, opt, selected, setSelected, entered, setEntered, uid)}
          </fieldset>
        );
      })}
      <p className="text-xs text-[var(--color-fg-muted,theme(colors.gray.500))]">
        {isValid ? "All required options selected." : "Select required options to continue."}
      </p>
    </div>
  );
}

function renderInput(
  type: ReturnType<typeof normaliseOptionType>,
  opt: AdvancedOptionT,
  selected: SelectionMap,
  setSelected: (updater: (prev: SelectionMap) => SelectionMap) => void,
  entered: Record<string, string>,
  setEntered: (updater: (prev: Record<string, string>) => Record<string, string>) => void,
  uid: string,
): JSX.Element {
  const values = (opt.values ?? []).filter(
    (v): v is AdvancedOptionValueT => v != null && typeof v.uid === "string",
  );

  switch (type) {
    case "color_swatch":
      return (
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {values.map((v) => {
            const active = selected[uid] === v.uid;
            return (
              <button
                key={v.uid}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() =>
                  setSelected((p) => ({ ...p, [uid]: v.uid ?? "" }))
                }
                title={`${v.title ?? ""}${priceSuffix(v)}`}
                className={
                  "h-9 w-9 rounded-full border-2 " +
                  (active
                    ? "border-[var(--color-brand,theme(colors.emerald.600))]"
                    : "border-[var(--color-border,theme(colors.gray.300))]")
                }
                style={{
                  backgroundColor: v.swatch_hex ?? undefined,
                  backgroundImage: v.swatch_image ? `url("${v.swatch_image}")` : undefined,
                  backgroundSize: "cover",
                }}
              >
                <span className="sr-only">{v.title ?? v.swatch_label ?? v.uid}</span>
              </button>
            );
          })}
        </div>
      );
    case "dropdown":
      return (
        <select
          value={(selected[uid] as string | undefined) ?? ""}
          onChange={(e) => setSelected((p) => ({ ...p, [uid]: e.target.value }))}
          className="w-full rounded border border-[var(--color-border,theme(colors.gray.300))] bg-white p-2 text-sm"
        >
          <option value="">— select —</option>
          {values.map((v) => (
            <option key={v.uid} value={v.uid ?? ""}>
              {(v.title ?? "") + priceSuffix(v)}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div role="radiogroup" className="space-y-1">
          {values.map((v) => (
            <label key={v.uid} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`panth-opt-${uid}`}
                checked={selected[uid] === v.uid}
                onChange={() => setSelected((p) => ({ ...p, [uid]: v.uid ?? "" }))}
              />
              <span>{(v.title ?? "") + priceSuffix(v)}</span>
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="space-y-1">
          {values.map((v) => {
            const arr = Array.isArray(selected[uid]) ? (selected[uid] as string[]) : [];
            const active = arr.includes(v.uid ?? "");
            return (
              <label key={v.uid} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() =>
                    setSelected((p) => {
                      const current = Array.isArray(p[uid]) ? (p[uid] as string[]) : [];
                      const next = active
                        ? current.filter((x) => x !== v.uid)
                        : [...current, v.uid ?? ""];
                      return { ...p, [uid]: next };
                    })
                  }
                />
                <span>{(v.title ?? "") + priceSuffix(v)}</span>
              </label>
            );
          })}
        </div>
      );
    case "textarea":
    case "textarea_rich":
      return (
        <textarea
          value={entered[uid] ?? ""}
          onChange={(e) => setEntered((p) => ({ ...p, [uid]: e.target.value }))}
          maxLength={opt.max_characters ?? 2000}
          rows={4}
          className="w-full rounded border border-[var(--color-border,theme(colors.gray.300))] bg-white p-2 text-sm"
        />
      );
    case "file": {
      const exts = (opt.file_extensions ?? []).join(",");
      const accept = exts
        ? exts
            .split(",")
            .map((s) => (s.startsWith(".") ? s.trim() : `.${s.trim()}`))
            .join(",")
        : undefined;
      // Placeholder: capture filename only. Real upload wiring is the
      // consuming PDP's responsibility.
      return (
        <input
          type="file"
          accept={accept}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setEntered((p) => ({ ...p, [uid]: f ? f.name : "" }));
          }}
          className="block text-sm"
        />
      );
    }
    case "date":
      return (
        <input
          type="date"
          value={entered[uid] ?? ""}
          onChange={(e) => setEntered((p) => ({ ...p, [uid]: e.target.value }))}
          className="rounded border border-[var(--color-border,theme(colors.gray.300))] bg-white p-2 text-sm"
        />
      );
    default:
      return (
        <input
          type="text"
          value={entered[uid] ?? ""}
          onChange={(e) => setEntered((p) => ({ ...p, [uid]: e.target.value }))}
          maxLength={opt.max_characters ?? 255}
          className="w-full rounded border border-[var(--color-border,theme(colors.gray.300))] bg-white p-2 text-sm"
        />
      );
  }
}
