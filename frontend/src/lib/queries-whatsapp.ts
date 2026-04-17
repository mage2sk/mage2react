import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-whatsapp.ts
 *
 * Typed helper for `Panth_Whatsapp`. The parent module is expected to
 * expose `panthWhatsappConfig` returning the admin-configured floating-
 * button settings.
 *
 * `.nullable().optional()` everywhere, `safeParse` + safe disabled fallback
 * so the island renders nothing when the parent module isn't installed.
 */

export const WHATSAPP_POSITIONS = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
] as const;

export type WhatsappPosition = (typeof WHATSAPP_POSITIONS)[number];

function isWhatsappPosition(v: unknown): v is WhatsappPosition {
  return typeof v === "string" && (WHATSAPP_POSITIONS as readonly string[]).includes(v);
}

const Envelope = z.object({
  panthWhatsappConfig: z
    .object({
      enabled: z.boolean().nullable().optional(),
      phone: z.string().nullable().optional(),
      message_template: z.string().nullable().optional(),
      position: z.string().nullable().optional(),
      button_color: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export interface WhatsappConfig {
  enabled: boolean;
  phone: string | null;
  message_template: string | null;
  position: WhatsappPosition;
  button_color: string | null;
}

export const DISABLED_WHATSAPP: WhatsappConfig = {
  enabled: false,
  phone: null,
  message_template: null,
  position: "bottom-right",
  button_color: null,
};

/**
 * Strict phone validator: `+` followed by 7 to 15 digits (E.164-like).
 * Any other character is rejected. Returns the cleaned digits-only form
 * (no leading `+`) suitable for `https://wa.me/<digits>`.
 */
export function validateWhatsappPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/[\s()-]/g, "");
  const match = stripped.match(/^\+?(\d{7,15})$/u);
  if (!match) return null;
  return match[1] ?? null;
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const NAMED_COLORS = new Set<string>([
  "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "brown", "gray", "grey", "cyan", "magenta", "teal", "navy",
  "maroon", "olive", "lime", "aqua", "silver", "gold",
]);

export function validateWhatsappColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v.length) return null;
  if (HEX_RE.test(v)) return v;
  if (NAMED_COLORS.has(v)) return v;
  return null;
}

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-whatsapp] panthWhatsappConfig missing — install/enable Panth_Whatsapp.",
    );
  } else {
    console.warn("[panth-whatsapp] query failed:", msg);
  }
}

/**
 * Returns the admin-configured WhatsApp button settings. Never throws. On
 * any error or schema mismatch, returns `DISABLED_WHATSAPP`.
 */
export async function getWhatsappConfig(): Promise<WhatsappConfig> {
  const doc = /* GraphQL */ `
    query PanthWhatsappConfig {
      panthWhatsappConfig {
        enabled
        phone
        message_template
        position
        button_color
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, {});
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return DISABLED_WHATSAPP;
    const env = parsed.data.panthWhatsappConfig;
    if (!env) return DISABLED_WHATSAPP;
    if (env.enabled !== true) return { ...DISABLED_WHATSAPP, enabled: false };

    const phone = validateWhatsappPhone(env.phone ?? null);
    if (!phone) return DISABLED_WHATSAPP;

    const position = isWhatsappPosition(env.position) ? env.position : "bottom-right";
    const color = validateWhatsappColor(env.button_color ?? null);
    const tpl = env.message_template?.trim() || null;

    return {
      enabled: true,
      phone,
      message_template: tpl,
      position,
      button_color: color,
    };
  } catch (err) {
    logSchemaMiss(err);
    return DISABLED_WHATSAPP;
  }
}
