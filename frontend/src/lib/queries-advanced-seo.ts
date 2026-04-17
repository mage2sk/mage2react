import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-advanced-seo.ts
 *
 * Typed fetch helpers for `Panth_AdvancedSeo`'s storefront-facing GraphQL
 * fields. We cannot verify the parent module's schema at build time so every
 * field is marked `.nullable().optional()` and we never `parse()` — always
 * `safeParse()` and fall back to `null` / `[]` on mismatch.
 *
 * Contract (based on the parent module's feature list):
 *   - `panthAdvancedSeo(path: String!)` — per-URL meta override envelope
 *     containing AI-generated description / title / canonical / robots.
 *   - `panthAdvancedSeoResolveRedirect(path: String!)` — resolves a legacy URL
 *     to its canonical destination. Returns null when no redirect exists.
 *   - `storeConfig { panth_advanced_seo_* }` — store-scope toggles.
 *
 * If a field does not exist on the live schema, Magento returns a GraphQL
 * error; we catch it, log once, and resolve `null`.
 */

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const SeoMetaOverride = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  canonical: z.string().nullable().optional(),
  robots: z.string().nullable().optional(),
  og_image: z.string().nullable().optional(),
  og_image_alt: z.string().nullable().optional(),
  noindex: z.boolean().nullable().optional(),
  ai_generated: z.boolean().nullable().optional(),
});
export type SeoMetaOverrideT = z.infer<typeof SeoMetaOverride>;

const AdvancedSeoEnvelope = z.object({
  panthAdvancedSeo: SeoMetaOverride.nullable().optional(),
});

const RedirectResolution = z.object({
  target: z.string().nullable().optional(),
  code: z.number().nullable().optional(),
});
export type RedirectResolutionT = z.infer<typeof RedirectResolution>;

const RedirectEnvelope = z.object({
  panthAdvancedSeoResolveRedirect: RedirectResolution.nullable().optional(),
});

const AdvancedSeoConfig = z.object({
  panth_advanced_seo_enabled: z.boolean().nullable().optional(),
  panth_advanced_seo_ai_meta_enabled: z.boolean().nullable().optional(),
  panth_advanced_seo_sitemap_enabled: z.boolean().nullable().optional(),
  panth_advanced_seo_redirects_enabled: z.boolean().nullable().optional(),
});
export type AdvancedSeoConfigT = z.infer<typeof AdvancedSeoConfig>;

const AdvancedSeoConfigEnvelope = z.object({
  storeConfig: AdvancedSeoConfig.nullable().optional(),
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
    console.warn(`[panth-advanced-seo] ${scope}: schema field missing — ` +
      `install/enable Panth_AdvancedSeo on the Magento side.`);
  } else {
    console.warn(`[panth-advanced-seo] ${scope} failed:`, msg);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fetches the AI/admin-authored meta override for a storefront path.
 * Returns `null` on any error or when the field is absent.
 */
export async function getAdvancedSeoMeta(path: string): Promise<SeoMetaOverrideT | null> {
  const doc = /* GraphQL */ `
    query PanthAdvancedSeoMeta($path: String!) {
      panthAdvancedSeo(path: $path) {
        title
        description
        canonical
        robots
        og_image
        og_image_alt
        noindex
        ai_generated
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { path });
    const parsed = AdvancedSeoEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.panthAdvancedSeo ?? null;
  } catch (err) {
    logSchemaMiss("getAdvancedSeoMeta", err);
    return null;
  }
}

/**
 * Resolves a URL against the module's redirect table.
 * Returns `null` when no match.
 */
export async function resolveAdvancedSeoRedirect(path: string): Promise<RedirectResolutionT | null> {
  const doc = /* GraphQL */ `
    query PanthAdvancedSeoRedirect($path: String!) {
      panthAdvancedSeoResolveRedirect(path: $path) {
        target
        code
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc, { path });
    const parsed = RedirectEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    const r = parsed.data.panthAdvancedSeoResolveRedirect ?? null;
    if (!r || !r.target) return null;
    return r;
  } catch (err) {
    logSchemaMiss("resolveAdvancedSeoRedirect", err);
    return null;
  }
}

/**
 * Reads advanced-seo feature flags from `storeConfig`.
 * Returns `null` when the parent module is not installed.
 */
export async function getAdvancedSeoConfig(): Promise<AdvancedSeoConfigT | null> {
  const doc = /* GraphQL */ `
    query PanthAdvancedSeoConfig {
      storeConfig {
        panth_advanced_seo_enabled
        panth_advanced_seo_ai_meta_enabled
        panth_advanced_seo_sitemap_enabled
        panth_advanced_seo_redirects_enabled
      }
    }
  `;
  try {
    const raw = await query<unknown>(doc);
    const parsed = AdvancedSeoConfigEnvelope.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.storeConfig ?? null;
  } catch (err) {
    logSchemaMiss("getAdvancedSeoConfig", err);
    return null;
  }
}
