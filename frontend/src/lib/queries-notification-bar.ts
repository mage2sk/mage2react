import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-notification-bar.ts
 *
 * Typed helper for `Panth_NotificationBar`. Admin-configured top-of-page
 * announcement bars with scheduling, priority, optional link, and dismiss
 * behavior. `.nullable().optional()` everywhere; `safeParse` + empty fallback.
 *
 * Colors are returned RAW here — validation to a safe allowlist happens in
 * the component (it's where they get used).
 */

const Bar = z.object({
  id: z.union([z.string(), z.number()]).nullable().optional(),
  message: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  bg_color: z.string().nullable().optional(),
  text_color: z.string().nullable().optional(),
  dismissible: z.boolean().nullable().optional(),
  priority: z.number().nullable().optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
});
export type NotificationBarT = {
  id: string;
  message: string;
  link: string | null;
  bg_color: string | null;
  text_color: string | null;
  dismissible: boolean;
  priority: number;
  start_at: string | null;
  end_at: string | null;
};

const Envelope = z.object({
  panthNotificationBars: z
    .object({
      items: z.array(Bar).nullable().optional(),
    })
    .nullable()
    .optional(),
});

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-notification-bar] panthNotificationBars field missing — install/enable Panth_NotificationBar.",
    );
  } else {
    console.warn("[panth-notification-bar] query failed:", msg);
  }
}

function coerceBar(
  raw: z.infer<typeof Bar>,
  fallbackIdx: number,
): NotificationBarT | null {
  const rawId = raw.id;
  const id = typeof rawId === "number" ? String(rawId) : (rawId ?? "").trim();
  const msg = (raw.message ?? "").trim();
  if (!msg) return null;
  return {
    id: id.length ? id : `bar-${fallbackIdx}`,
    message: msg,
    link: raw.link?.trim() || null,
    bg_color: raw.bg_color?.trim() || null,
    text_color: raw.text_color?.trim() || null,
    dismissible: raw.dismissible === true,
    priority: typeof raw.priority === "number" ? raw.priority : 0,
    start_at: raw.start_at?.trim() || null,
    end_at: raw.end_at?.trim() || null,
  };
}

/**
 * Returns all configured notification bars — including expired/future ones.
 * Filtering by current time is the consumer's job (so SSR vs. client can make
 * their own decision). Sorted by priority descending.
 *
 * Never throws. Returns `[]` on any error / schema miss.
 */
export async function getNotificationBars(): Promise<NotificationBarT[]> {
  const doc = /* GraphQL */ `
    query PanthNotificationBars {
      panthNotificationBars {
        items {
          id
          message
          link
          bg_color
          text_color
          dismissible
          priority
          start_at
          end_at
        }
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, {});
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return [];
    const env = parsed.data.panthNotificationBars;
    if (!env) return [];
    const out: NotificationBarT[] = [];
    (env.items ?? []).forEach((b, idx) => {
      if (!b) return;
      const coerced = coerceBar(b, idx);
      if (coerced) out.push(coerced);
    });
    out.sort((a, b) => b.priority - a.priority);
    return out;
  } catch (err) {
    logSchemaMiss(err);
    return [];
  }
}

/**
 * Filter bars that are currently active against the supplied clock. Bars
 * without a `start_at`/`end_at` are always active. Invalid date strings are
 * treated as "not constraining" rather than erroring out.
 */
export function filterActiveBars(
  bars: NotificationBarT[],
  now: Date = new Date(),
): NotificationBarT[] {
  const t = now.getTime();
  return bars.filter((b) => {
    if (b.start_at) {
      const start = Date.parse(b.start_at);
      if (Number.isFinite(start) && t < start) return false;
    }
    if (b.end_at) {
      const end = Date.parse(b.end_at);
      if (Number.isFinite(end) && t > end) return false;
    }
    return true;
  });
}

/**
 * Strict color allowlist. Returns the raw value if it passes, otherwise null
 * so the caller can substitute a safe default. Supports:
 *   - `#abc` / `#aabbcc` hex
 *   - a fixed named-color allowlist (common CSS colors)
 *
 * `rgb()` / `rgba()` / `oklch()` and free-form strings are rejected here —
 * the notification bar only needs the simpler subset (theme customizer
 * handles the richer palette).
 */
const NAMED_COLORS = new Set<string>([
  "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "brown", "gray", "grey", "cyan", "magenta", "teal", "navy",
  "maroon", "olive", "lime", "aqua", "silver", "gold", "transparent",
]);

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function validateBarColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v.length) return null;
  if (HEX_RE.test(v)) return v;
  if (NAMED_COLORS.has(v)) return v;
  return null;
}
