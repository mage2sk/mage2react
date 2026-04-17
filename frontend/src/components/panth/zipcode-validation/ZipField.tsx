/**
 * ZipField.tsx
 *
 * Panth_ZipcodeValidationReact — drop-in `<input>` wrapper that surfaces
 * country-scoped postal-code validation as advisory UX.
 *
 * INTEGRATION (leave as comments; never auto-wire — do NOT edit
 * `frontend/src/components/checkout/AddressForm.astro` from this module):
 *
 *     import ZipField from
 *       "~/components/panth/zipcode-validation/ZipField";
 *     <ZipField
 *       client:idle
 *       name="postcode"
 *       country={country}
 *       defaultValue={address.postcode ?? ""}
 *     />
 *
 * The component keeps its own internal value but stays compatible with
 * controlled usage via `onChange`. All returned server messages are
 * rendered as TEXT NODES (no innerHTML), so no sanitisation is needed
 * inside the field itself — but do not wrap this in a parent that uses
 * `dangerouslySetInnerHTML` on the same string.
 */
import { useId, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { useZipValidation } from "./useZipValidation";

interface Props
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  name: string;
  country: string | null | undefined;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  /** Visible label; defaults to "Postal code". */
  label?: string;
}

export default function ZipField({
  name,
  country,
  defaultValue = "",
  value,
  onChange,
  label = "Postal code",
  required,
  ...rest
}: Props): JSX.Element {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const id = useId();
  const descId = `${id}-desc`;
  const snap = useZipValidation(current, country);

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const next = e.target.value;
    if (onChange) {
      onChange(next);
    } else {
      setInternal(next);
    }
  }

  const ring =
    snap.state === "valid"
      ? "ring-2 ring-[var(--color-brand,theme(colors.emerald.500))]"
      : snap.state === "invalid"
        ? "ring-2 ring-red-500"
        : "";

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--color-fg,theme(colors.gray.800))] mb-1"
      >
        {label}
        {required && <span aria-hidden="true" className="text-red-600 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        value={current}
        onChange={handleChange}
        aria-describedby={descId}
        aria-invalid={snap.state === "invalid" ? true : undefined}
        required={required}
        className={
          "block w-full rounded-md border border-[var(--color-border,theme(colors.gray.300))] bg-white p-2 text-sm text-[var(--color-fg,theme(colors.gray.900))] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand,theme(colors.emerald.500))] " +
          ring
        }
        {...rest}
      />
      <p id={descId} className="mt-1 text-xs min-h-[1em]" aria-live="polite">
        {snap.state === "loading" && (
          <span className="text-[var(--color-fg-muted,theme(colors.gray.500))]">Checking…</span>
        )}
        {snap.state === "valid" && (
          <span className="text-[var(--color-brand,theme(colors.emerald.700))]">
            {snap.message ?? (snap.regionHint ? `Valid — ${snap.regionHint}` : "Valid postal code.")}
          </span>
        )}
        {snap.state === "invalid" && (
          <span className="text-red-600">{snap.message ?? "Please enter a valid postal code."}</span>
        )}
      </p>
    </div>
  );
}
