import { z } from "zod";
import { query } from "./graphql";
import { panthConfig } from "./panth-db";

/**
 * queries-footer.ts
 *
 * Typed helper for `Panth_Footer`. Admin-configured footer columns, social
 * links, copyright HTML, and payment-method metadata.
 *
 * Panth_Footer does not expose GraphQL, so if the field is missing we fall
 * back to a reasonable default Luma-style footer (About, Shop, Help, Connect
 * + payment badges) so the storefront always renders a full footer instead
 * of just a bare copyright row.
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

const DEFAULT_CONFIG: FooterConfig = {
  columns: [
    {
      title: "Shop",
      links: [
        { label: "What's New", url: "/what-is-new.html" },
        { label: "Women", url: "/women.html" },
        { label: "Men", url: "/men.html" },
        { label: "Gear", url: "/gear.html" },
        { label: "Sale", url: "/sale.html" },
      ],
    },
    {
      title: "Help",
      links: [
        { label: "FAQ", url: "/faq" },
        { label: "Shipping & Returns", url: "/shipping-information" },
        { label: "Contact Us", url: "/contact" },
        { label: "Track Order", url: "/customer/account" },
      ],
    },
    {
      title: "About",
      links: [
        { label: "About Us", url: "/about-us" },
        { label: "Customer Service", url: "/customer-service" },
        { label: "Privacy Policy", url: "/privacy-policy" },
        { label: "Terms", url: "/terms-of-service" },
      ],
    },
    {
      title: "Account",
      links: [
        { label: "My Account", url: "/customer/account" },
        { label: "Wishlist", url: "/wishlist" },
        { label: "Orders & Returns", url: "/customer/account" },
        { label: "Compare Products", url: "/compare" },
      ],
    },
  ],
  social_links: [
    { platform: "facebook", url: "https://facebook.com/", label: "Facebook" },
    { platform: "instagram", url: "https://instagram.com/", label: "Instagram" },
    { platform: "x", url: "https://x.com/", label: "X (Twitter)" },
    { platform: "youtube", url: "https://youtube.com/", label: "YouTube" },
  ],
  copyright_html: "",
  payment_methods: [
    { label: "Visa", code: "visa" },
    { label: "Mastercard", code: "mc" },
    { label: "Amex", code: "amex" },
    { label: "PayPal", code: "paypal" },
    { label: "Apple Pay", code: "applepay" },
  ],
};

/**
 * Returns the admin-managed footer configuration. Never throws. Falls back to
 * `DEFAULT_CONFIG` when Panth_Footer is not installed or returns no rows —
 * that way the storefront always has a full footer instead of a bare row.
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
    if (!parsed.success) return resolveFallback();
    const env = parsed.data.panthFooterConfig;
    if (!env) return resolveFallback();
    const cfg: FooterConfig = {
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
    if (cfg.columns.length === 0 && cfg.social_links.length === 0 && cfg.payment_methods.length === 0) {
      return resolveFallback(cfg.copyright_html);
    }
    return cfg;
  } catch (err) {
    logSchemaMiss(err);
    return resolveFallback();
  }
}

async function resolveFallback(copyrightOverride?: string): Promise<FooterConfig> {
  // Allow admins to toggle a minimal vs default footer via config.
  const minimal = (await panthConfig("panth_footer/general/minimal")) === "1";
  if (minimal) {
    return {
      columns: [],
      social_links: [],
      copyright_html: copyrightOverride ?? "",
      payment_methods: [],
    };
  }
  return {
    ...DEFAULT_CONFIG,
    copyright_html: copyrightOverride ?? DEFAULT_CONFIG.copyright_html,
  };
}
