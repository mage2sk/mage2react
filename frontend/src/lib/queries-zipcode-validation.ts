import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-zipcode-validation.ts
 *
 * Typed fetch helpers for `Panth_ZipcodeValidation`'s storefront-facing
 * GraphQL query. Validates postal codes against country-scoped rules
 * (IN: 6-digit PIN, US: 5 or 9, etc.) and returns a region hint on success.
 *
 * Contract (inferred from the parent module's admin config — see
 * `mage2kishan/module-zipcode-validation/etc/config.xml`):
 *   - `panthValidateZipcode(zip: String!, country: String!)` top-level query
 *   - `storeConfig { zipcode_validation_* }` flags
 *
 * All fields `.nullable().optional()`. Validation is advisory UX — the server
 * is still the source of truth; this helper only improves the form UX.
 */

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const ValidationResult = z.object({
  valid: z.boolean().nullable().optional(),
  message: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  region_code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  normalized: z.string().nullable().optional(),
});
export type ZipValidationResultT = z.infer<typeof ValidationResult>;

const ValidationEnvelope = z.object({
  panthValidateZipcode: ValidationResult.nullable().optional(),
});

const ZipConfig = z.object({
  zipcode_validation_enabled: z.boolean().nullable().optional(),
  zipcode_validation_success_color: z.string().nullable().optional(),
  zipcode_validation_error_color: z.string().nullable().optional(),
  zipcode_validation_show_success_message: z.boolean().nullable().optional(),
});
export type ZipConfigT = z.infer<typeof ZipConfig>;

const ZipConfigEnvelope = z.object({
  storeConfig: ZipConfig.nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

let warnedMissing = false;
function logSchemaMiss(scope: string, err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      `[panth-zipcode-validation] ${scope}: schema field missing — ` +
        `install/enable Panth_ZipcodeValidation on the Magento side.`,
    );
  } else {
    console.warn(`[panth-zipcode-validation] ${scope} failed:`, msg);
  }
}

/**
 * Offline heuristic fallback used when the server doesn't respond or the
 * parent module is unavailable. Covers the common countries that ship the
 * parent module out of the box. Deliberately permissive — the server remains
 * authoritative.
 */
const COUNTRY_ZIP_PATTERNS: Record<string, RegExp> = {
  IN: /^[1-9][0-9]{5}$/,
  US: /^\d{5}(-\d{4})?$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  CA: /^[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z] ?\d[A-CEGHJ-NPR-TV-Z]\d$/i,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  AU: /^\d{4}$/,
};

export function heuristicZipValid(
  zip: string,
  country: string | null | undefined,
): boolean {
  if (!zip || zip.length < 3) return false;
  const code = (country ?? "").toUpperCase();
  const pattern = COUNTRY_ZIP_PATTERNS[code];
  if (!pattern) return zip.length >= 3 && zip.length <= 12;
  return pattern.test(zip.trim());
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export async function validateZipcode(
  zip: string,
  country: string,
): Promise<ZipValidationResultT | null> {
  const doc = /* GraphQL */ `
    query PanthValidateZipcode($zip: String!, $country: String!) {
      panthValidateZipcode(zip: $zip, country: $country) {
        valid
        message
        state
        region_code
        city
        country
        normalized
      }
    }
  `;
  const trimmedZip = zip.trim();
  const trimmedCountry = country.trim().toUpperCase();
  if (!trimmedZip || !trimmedCountry) return null;
  try {
    const raw = await query<unknown>(doc, {
      zip: trimmedZip,
      country: trimmedCountry,
    });
    const parsed = ValidationEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.panthValidateZipcode ?? null;
  } catch (err) {
    logSchemaMiss("validateZipcode", err);
    return null;
  }
}

export async function getZipcodeValidationConfig(): Promise<ZipConfigT | null> {
  const doc = /* GraphQL */ `
    query PanthZipcodeValidationConfig {
      storeConfig {
        zipcode_validation_enabled
        zipcode_validation_success_color
        zipcode_validation_error_color
        zipcode_validation_show_success_message
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const parsed = ZipConfigEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.storeConfig ?? null;
  } catch (err) {
    logSchemaMiss("getZipcodeValidationConfig", err);
    return null;
  }
}
