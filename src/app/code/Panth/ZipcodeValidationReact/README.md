# Panth_ZipcodeValidationReact

React/Astro storefront companion for `Panth_ZipcodeValidation`. Thin glue layer — depends on the parent module via `<sequence>` so country-scoped postal-code rules (PIN codes for IN, ZIP+4 for US, etc.) are available headlessly. Ships no PHP logic.

## Storefront integration

- `frontend/src/lib/queries-zipcode-validation.ts` — typed `safeParse` helpers for `panthValidateZipcode(zip, country)` and the related `storeConfig` flags. All fields `.nullable().optional()`.
- `frontend/src/components/panth/zipcode-validation/useZipValidation.ts` — tiny React hook that debounces the input and surfaces `{ state: 'idle' | 'loading' | 'valid' | 'invalid', message, regionHint }`.
- `frontend/src/components/panth/zipcode-validation/ZipField.tsx` — drop-in `<input>` wrapper that uses the hook and renders an accessible success/error hint.

### Wiring into `AddressForm.astro`

Do not edit `frontend/src/components/checkout/AddressForm.astro` from this module. Either:

1. Fork the address form and replace the postcode input with `<ZipField client:idle country={country} />`; or
2. Compose `<ZipField>` into a bespoke address form.

Error messages returned by Magento pass through the hook unchanged but are rendered as text only (never `innerHTML`). The hook never blocks form submission — it's advisory UX; submit-time validation remains server-side.
