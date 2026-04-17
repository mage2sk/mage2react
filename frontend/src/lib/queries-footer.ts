import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-footer.ts
 *
 * Typed helper for `Panth_Footer`. Admin-configured footer columns, social
 * links, copyright HTML, and payment-method metadata. All fields
 * `.nullable().optional()`; `safeParse` + empty fallback.
 */

const FooterLink = z.object({
  label: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});
export type FooterLinkT = z.infer<typeof FooterLink>;

const FooterColumn = z.object({
  title: z.string().nullable().optional(),
  links: z.array(FooterLink).nullable().optional(),
});
export type FooterColumnT = z.infer<typeof FooterColumn>;

const SocialLink = z.object({
  platform: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
});
export type SocialLinkT = z.infer<typeof SocialLink>;

const PaymentMethod = z.object({
  label: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
});
export type PaymentMethodT = z.infer<typeof PaymentMethod>;

const Envelope = z.object({
  panthFooterConfig: z
    .object({
      columns: z.array(FooterColumn).nullable().optional(),
      social_links: z.array(SocialLink).nullable().optional(),
      copyright_html: z.string().nullable().optional(),
      payment_methods: z.array(PaymentMethod).nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type FooterConfig = {
  columns: FooterColumnT[];
  social_links: SocialLinkT[];
  copyright_html: string;
  payment_methods: PaymentMethodT[];
};

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-footer] panthFooterConfig field missing — install/enable Panth_Footer.",
    );
  } else {
    console.warn("[panth-footer] query failed:", msg);
  }
}

/**
 * Returns the admin-managed footer configuration. Never throws. Empty
 * fallback on any error or schema mismatch.
 */
export async function getFooterConfig(): Promise<FooterConfig> {
  const empty: FooterConfig = {
    columns: [],
    social_links: [],
    copyright_html: "",
    payment_methods: [],
  };

  const doc = /* GraphQL */ `
    query PanthFooterConfig {
      panthFooterConfig {
        columns {
          title
          links {
            label
            url
          }
        }
        social_links {
          platform
          url
          label
        }
        copyright_html
        payment_methods {
          label
          code
        }
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, {});
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return empty;
    const env = parsed.data.panthFooterConfig;
    if (!env) return empty;
    return {
      columns: (env.columns ?? []).filter(
        (c): c is FooterColumnT => c !== null && c !== undefined,
      ),
      social_links: (env.social_links ?? []).filter(
        (s): s is SocialLinkT => s !== null && s !== undefined,
      ),
      copyright_html: env.copyright_html ?? "",
      payment_methods: (env.payment_methods ?? []).filter(
        (p): p is PaymentMethodT => p !== null && p !== undefined,
      ),
    };
  } catch (err) {
    logSchemaMiss(err);
    return empty;
  }
}
