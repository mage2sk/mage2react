import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-custom-options.ts
 *
 * Typed fetch helpers for `Panth_CustomOptions`'s storefront-facing GraphQL
 * extensions: advanced option types (color swatch, rich textarea, file
 * upload, dependent options) on top of Magento's standard
 * `product.options` array.
 *
 * Contract (advanced options are modelled as an extended `panth_options`
 * array alongside the standard `options` array — the parent module exposes
 * hex/image metadata and allowed file extensions per value):
 *   - `products(filter: { sku: { eq } }).items.panth_custom_options { ... }`
 *   - `storeConfig { panth_customoptions_enabled }`
 *
 * Every field is `.nullable().optional()` and parsed with `safeParse`.
 */

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const Money = z.object({
  value: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

const AdvancedOptionValue = z.object({
  uid: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  price: Money.nullable().optional(),
  price_type: z.string().nullable().optional(),
  sort_order: z.number().nullable().optional(),
  swatch_hex: z.string().nullable().optional(),
  swatch_image: z.string().nullable().optional(),
  swatch_label: z.string().nullable().optional(),
});
export type AdvancedOptionValueT = z.infer<typeof AdvancedOptionValue>;

const AdvancedOption = z.object({
  uid: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  type: z.string().nullable().optional(), // e.g. color_swatch | textarea_rich | file | dropdown | checkbox
  required: z.boolean().nullable().optional(),
  sort_order: z.number().nullable().optional(),
  max_characters: z.number().nullable().optional(),
  file_extensions: z.array(z.string()).nullable().optional(),
  max_file_size_kb: z.number().nullable().optional(),
  values: z.array(AdvancedOptionValue).nullable().optional(),
  help_text_html: z.string().nullable().optional(),
});
export type AdvancedOptionT = z.infer<typeof AdvancedOption>;

const ProductWithAdvancedOptions = z.object({
  sku: z.string().nullable().optional(),
  panth_custom_options: z.array(AdvancedOption).nullable().optional(),
});

const ProductsQuery = z.object({
  products: z
    .object({
      items: z.array(ProductWithAdvancedOptions.nullable()).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const CustomOptionsConfig = z.object({
  panth_customoptions_enabled: z.boolean().nullable().optional(),
});
export type CustomOptionsConfigT = z.infer<typeof CustomOptionsConfig>;

const CustomOptionsConfigEnvelope = z.object({
  storeConfig: CustomOptionsConfig.nullable().optional(),
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
      `[panth-custom-options] ${scope}: schema field missing — ` +
        `install/enable Panth_CustomOptions on the Magento side.`,
    );
  } else {
    console.warn(`[panth-custom-options] ${scope} failed:`, msg);
  }
}

/**
 * Normalises the free-form `type` string to one of the renderable types we
 * support. Anything unrecognised falls through to `"text"`.
 */
export type RenderableOptionType =
  | "color_swatch"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "textarea_rich"
  | "textarea"
  | "text"
  | "file"
  | "date";

export function normaliseOptionType(raw: string | null | undefined): RenderableOptionType {
  const t = (raw ?? "").trim().toLowerCase();
  switch (t) {
    case "color_swatch":
    case "swatch":
    case "color":
      return "color_swatch";
    case "drop_down":
    case "dropdown":
    case "select":
      return "dropdown";
    case "radio":
      return "radio";
    case "checkbox":
    case "multiselect":
      return "checkbox";
    case "textarea_rich":
    case "wysiwyg":
      return "textarea_rich";
    case "textarea":
      return "textarea";
    case "file":
    case "file_upload":
      return "file";
    case "date":
    case "date_time":
    case "time":
      return "date";
    default:
      return "text";
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export async function getAdvancedProductOptions(
  sku: string,
): Promise<AdvancedOptionT[] | null> {
  const doc = /* GraphQL */ `
    query PanthCustomOptions($sku: String!) {
      products(filter: { sku: { eq: $sku } }) {
        items {
          sku
          panth_custom_options {
            uid
            title
            type
            required
            sort_order
            max_characters
            file_extensions
            max_file_size_kb
            help_text_html
            values {
              uid
              title
              price { value currency }
              price_type
              sort_order
              swatch_hex
              swatch_image
              swatch_label
            }
          }
        }
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { sku });
    const parsed = ProductsQuery.safeParse(raw);
    if (!parsed.success) return null;
    const first = parsed.data.products?.items?.[0];
    return first?.panth_custom_options ?? null;
  } catch (err) {
    logSchemaMiss("getAdvancedProductOptions", err);
    return null;
  }
}

export async function getCustomOptionsConfig(): Promise<CustomOptionsConfigT | null> {
  const doc = /* GraphQL */ `
    query PanthCustomOptionsConfig {
      storeConfig {
        panth_customoptions_enabled
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const parsed = CustomOptionsConfigEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.storeConfig ?? null;
  } catch (err) {
    logSchemaMiss("getCustomOptionsConfig", err);
    return null;
  }
}
