import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-banner-slider.ts
 *
 * Typed helper for `Panth_BannerSlider`. The parent module is expected to
 * expose a `panthBannerSlider(identifier: String)` query returning
 * `{ items: [...] }`. All fields are `.nullable().optional()` — we cannot
 * verify the schema, so `safeParse` + empty fallback is the rule.
 *
 * Never throws. Returns an empty `{items:[]}` on any failure — callers can
 * rely on `items.length` to decide whether to render anything.
 */

const BannerSlide = z.object({
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  cta_label: z.string().nullable().optional(),
  cta_url: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
});
export type BannerSlideT = z.infer<typeof BannerSlide>;

const Envelope = z.object({
  panthBannerSlider: z
    .object({
      items: z.array(BannerSlide).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type BannerSliderResult = {
  items: BannerSlideT[];
};

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-banner-slider] panthBannerSlider field missing — install/enable Panth_BannerSlider.",
    );
  } else {
    console.warn("[panth-banner-slider] query failed:", msg);
  }
}

/**
 * Returns an active banner slider by identifier. Never throws. On any error
 * or schema mismatch, returns `{ items: [] }`.
 */
export async function getBannerSlider(
  identifier: string = "home",
): Promise<BannerSliderResult> {
  const empty: BannerSliderResult = { items: [] };

  const doc = /* GraphQL */ `
    query PanthBannerSlider($identifier: String!) {
      panthBannerSlider(identifier: $identifier) {
        items {
          title
          subtitle
          image
          cta_label
          cta_url
          alt
          priority
        }
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, { identifier });
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return empty;
    const env = parsed.data.panthBannerSlider;
    if (!env) return empty;
    const items = (env.items ?? []).filter(
      (s): s is BannerSlideT => s !== null && s !== undefined,
    );
    // Sort by priority descending (higher = earlier). Slides without a
    // priority default to 0 and retain array order.
    items.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return { items };
  } catch (err) {
    logSchemaMiss(err);
    return empty;
  }
}
