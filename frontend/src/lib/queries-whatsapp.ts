import { panthConfig } from "./panth-db";

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

/**
 * Returns the admin-configured WhatsApp button settings, read directly from
 * `core_config_data`. Never throws. Returns `DISABLED_WHATSAPP` when the
 * module is disabled, the phone is missing/invalid, or the DB is unreachable.
 */
export async function getWhatsappConfig(): Promise<WhatsappConfig> {
  const enabled = (await panthConfig("panth_whatsapp/general/enabled")) === "1";
  if (!enabled) return DISABLED_WHATSAPP;

  const phoneRaw = await panthConfig("panth_whatsapp/general/phone");
  const phone = validateWhatsappPhone(phoneRaw);
  if (!phone) return DISABLED_WHATSAPP;

  const tpl = (await panthConfig("panth_whatsapp/general/message_template")) ?? null;
  const positionRaw = await panthConfig("panth_whatsapp/general/position");
  const colorRaw = await panthConfig("panth_whatsapp/general/button_color");

  return {
    enabled: true,
    phone,
    message_template: tpl && tpl.length > 0 ? tpl : null,
    position: isWhatsappPosition(positionRaw) ? positionRaw : "bottom-right",
    button_color: validateWhatsappColor(colorRaw),
  };
}
