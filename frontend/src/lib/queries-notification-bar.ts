import { panthConfig } from "./panth-db";

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

/**
 * Returns the active notification bars. Panth_NotificationBar has no
 * dedicated table in this deployment — we derive a single bar from
 * `core_config_data` (`panth_notification_bar/general/message`). Additional
 * bars can be added once the module ships a dedicated table.
 *
 * Never throws. Returns `[]` when disabled or the message is missing.
 */
export async function getNotificationBars(): Promise<NotificationBarT[]> {
  const enabled = (await panthConfig("panth_notification_bar/general/enabled")) === "1";
  if (!enabled) return [];
  const msg = await panthConfig("panth_notification_bar/general/message");
  if (!msg) return [];
  const link = await panthConfig("panth_notification_bar/general/link");
  const bg = await panthConfig("panth_notification_bar/general/bg_color");
  const fg = await panthConfig("panth_notification_bar/general/text_color");
  const dismissible = (await panthConfig("panth_notification_bar/general/dismissible")) !== "0";
  return [
    {
      id: "config",
      message: msg,
      link: link && link.length > 0 ? link : null,
      bg_color: bg && bg.length > 0 ? bg : null,
      text_color: fg && fg.length > 0 ? fg : null,
      dismissible,
      priority: 0,
      start_at: null,
      end_at: null,
    },
  ];
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
