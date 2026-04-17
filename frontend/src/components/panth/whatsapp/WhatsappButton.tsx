import { useEffect, useState } from "react";

/**
 * WhatsappButton.tsx — `client:idle` React 19 island.
 *
 * Floating corner button that deep-links to WhatsApp chat. Fetches the
 * admin-configured settings from the same-origin `/api/graphql` proxy,
 * validates the phone (E.164-like) and button color (hex / named CSS
 * allowlist) **again** client-side (server already did it — defense-in-
 * depth), and renders nothing if the parent module is disabled or the
 * config fails validation.
 *
 * A11y:
 *   - `aria-label` announces the action.
 *   - Focus ring + keyboard-reachable.
 *   - Opens WhatsApp in a new tab via `rel="noopener noreferrer"`.
 *
 * No new npm deps. Strict TS. No `any`.
 */

const POSITIONS = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
] as const;
type Position = (typeof POSITIONS)[number];

interface Config {
  phone: string;
  message_template: string | null;
  position: Position;
  button_color: string | null;
}

const QUERY = /* GraphQL */ `
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

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const NAMED_COLORS = new Set<string>([
  "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "brown", "gray", "grey", "cyan", "magenta", "teal", "navy",
  "maroon", "olive", "lime", "aqua", "silver", "gold",
]);

function validatePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(/[\s()-]/g, "");
  const match = stripped.match(/^\+?(\d{7,15})$/u);
  if (!match) return null;
  return match[1] ?? null;
}

function validateColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (!v.length) return null;
  if (HEX_RE.test(v)) return v;
  if (NAMED_COLORS.has(v)) return v;
  return null;
}

function isPosition(v: unknown): v is Position {
  return typeof v === "string" && (POSITIONS as readonly string[]).includes(v);
}

function positionClasses(p: Position): string {
  switch (p) {
    case "bottom-left":
      return "bottom-5 left-5";
    case "top-right":
      return "top-5 right-5";
    case "top-left":
      return "top-5 left-5";
    case "bottom-right":
    default:
      return "bottom-5 right-5";
  }
}

async function fetchConfig(signal: AbortSignal): Promise<Config | null> {
  try {
    const res = await fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      signal,
      body: JSON.stringify({ query: QUERY }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: {
        panthWhatsappConfig?: {
          enabled?: boolean | null;
          phone?: string | null;
          message_template?: string | null;
          position?: string | null;
          button_color?: string | null;
        } | null;
      };
    };
    const env = body.data?.panthWhatsappConfig;
    if (!env || env.enabled !== true) return null;
    const phone = validatePhone(env.phone);
    if (!phone) return null;
    return {
      phone,
      message_template:
        typeof env.message_template === "string" && env.message_template.trim().length > 0
          ? env.message_template.trim()
          : null,
      position: isPosition(env.position) ? env.position : "bottom-right",
      button_color: validateColor(env.button_color),
    };
  } catch {
    return null;
  }
}

export default function WhatsappButton(): JSX.Element | null {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const c = await fetchConfig(controller.signal);
      setConfig(c);
    })();
    return () => controller.abort();
  }, []);

  if (!config) return null;

  const msg = config.message_template ?? "";
  const href = `https://wa.me/${config.phone}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
  const posClass = positionClasses(config.position);
  const bgStyle: React.CSSProperties | undefined = config.button_color
    ? { backgroundColor: config.button_color }
    : undefined;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={`fixed z-40 ${posClass} inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]`}
      style={bgStyle ?? { backgroundColor: "#25D366" }}
    >
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
        <path d="M20.5 3.5A11 11 0 0 0 3.1 17.1L2 22l5-1.3A11 11 0 1 0 20.5 3.5zM12 20a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.6-6c-.3-.1-1.5-.7-1.8-.8-.2-.1-.4-.1-.6.1s-.7.8-.8 1-.3.1-.5 0a6.6 6.6 0 0 1-3.3-2.8c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4H8c-.2 0-.5.1-.7.3a2.6 2.6 0 0 0-.8 1.9c0 1.1.8 2.2 1 2.4.1.2 1.7 2.6 4.1 3.6 1.6.7 2.2.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z" />
      </svg>
    </a>
  );
}
