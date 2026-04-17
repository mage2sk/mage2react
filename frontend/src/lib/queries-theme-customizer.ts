import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-theme-customizer.ts
 *
 * Typed helper for `Panth_ThemeCustomizer`. Admin-configured brand tokens
 * (colors, fonts, border radius) returned as a flat object and validated so
 * they can be safely interpolated into a SSR `<style>` block.
 *
 * SECURITY MODEL:
 *   Admin input is NEVER passed through raw. Every color value is validated
 *   against an allowlist of safe CSS syntaxes (hex, rgb/rgba, oklch, named
 *   CSS colors). Font families are stripped of any character that could
 *   escape out of a declaration (`{`, `}`, `;`, `<`, `>`, newlines). Invalid
 *   values are dropped; callers fall back to their own defaults.
 */

const ColorTokens = z.object({
  brand: z.string().nullable().optional(),
  accent: z.string().nullable().optional(),
  fg: z.string().nullable().optional(),
  bg: z.string().nullable().optional(),
  muted: z.string().nullable().optional(),
  border: z.string().nullable().optional(),
});

const FontTokens = z.object({
  body: z.string().nullable().optional(),
  heading: z.string().nullable().optional(),
});

const Envelope = z.object({
  panthThemeTokens: z
    .object({
      colors: ColorTokens.nullable().optional(),
      fonts: FontTokens.nullable().optional(),
      radius: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type ThemeColors = Partial<Record<
  "brand" | "accent" | "fg" | "bg" | "muted" | "border",
  string
>>;
export type ThemeFonts = Partial<Record<"body" | "heading", string>>;

export type ThemeTokens = {
  colors: ThemeColors;
  fonts: ThemeFonts;
  radius: string | null;
};

/* -------------------------------------------------------------------------- */
/* Validators                                                                 */
/* -------------------------------------------------------------------------- */

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
// Very permissive rgb/rgba/oklch/hsl matcher — structural only, no arithmetic.
// We additionally require NO semicolons, braces, or angle brackets below.
const RGB_RE = /^rgba?\(\s*[\d.,%\s/]+\s*\)$/;
const HSL_RE = /^hsla?\(\s*[\d.,%\s/]+\s*\)$/;
const OKLCH_RE = /^oklch\(\s*[\d.,%\s/]+\s*\)$/;

const NAMED_COLORS = new Set<string>([
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige",
  "bisque", "black", "blanchedalmond", "blue", "blueviolet", "brown",
  "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue",
  "cornsilk", "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod",
  "darkgray", "darkgreen", "darkgrey", "darkkhaki", "darkmagenta",
  "darkolivegreen", "darkorange", "darkorchid", "darkred", "darksalmon",
  "darkseagreen", "darkslateblue", "darkslategray", "darkturquoise",
  "darkviolet", "deeppink", "deepskyblue", "dimgray", "dodgerblue",
  "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro",
  "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow",
  "grey", "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki",
  "lavender", "lavenderblush", "lawngreen", "lemonchiffon", "lightblue",
  "lightcoral", "lightcyan", "lightgoldenrodyellow", "lightgray",
  "lightgreen", "lightgrey", "lightpink", "lightsalmon", "lightseagreen",
  "lightskyblue", "lightslategray", "lightsteelblue", "lightyellow",
  "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine",
  "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen",
  "mediumslateblue", "mediumspringgreen", "mediumturquoise",
  "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin",
  "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange",
  "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise",
  "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum",
  "powderblue", "purple", "rebeccapurple", "red", "rosybrown", "royalblue",
  "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna",
  "silver", "skyblue", "slateblue", "slategray", "snow", "springgreen",
  "steelblue", "tan", "teal", "thistle", "tomato", "turquoise", "violet",
  "wheat", "white", "whitesmoke", "yellow", "yellowgreen", "transparent",
  "currentcolor", "inherit",
]);

const DANGEROUS_CHARS_RE = /[;{}<>\\`\n\r]/;

/**
 * Validate a CSS color string against a strict allowlist. Returns the input
 * (trimmed) if it is a safe hex / rgb[a] / hsl[a] / oklch / named color —
 * otherwise returns null. Any of `;{}<>\` \n \r` kills the value outright.
 */
export function validateColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.length) return null;
  if (DANGEROUS_CHARS_RE.test(v)) return null;
  const lower = v.toLowerCase();
  if (HEX_RE.test(v)) return v;
  if (RGB_RE.test(lower)) return lower;
  if (HSL_RE.test(lower)) return lower;
  if (OKLCH_RE.test(lower)) return lower;
  if (NAMED_COLORS.has(lower)) return lower;
  return null;
}

/**
 * Validate a CSS `font-family` token. We allow a restricted character class:
 * letters, digits, spaces, hyphens, commas, quotes, and periods. Anything
 * with `;`, `{`, `}`, `<`, `>`, `\`, or newlines is rejected.
 */
const FONT_SAFE_RE = /^[A-Za-z0-9\s\-',."]+$/;

export function validateFont(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.length) return null;
  if (DANGEROUS_CHARS_RE.test(v)) return null;
  if (!FONT_SAFE_RE.test(v)) return null;
  // Cap length — defensive.
  if (v.length > 200) return null;
  return v;
}

/**
 * Validate a radius value (e.g. `0.5rem`, `8px`, `4px`). Numeric units only.
 */
const RADIUS_RE = /^\d+(\.\d+)?(px|rem|em|%)$/;
export function validateRadius(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v.length) return null;
  if (DANGEROUS_CHARS_RE.test(v)) return null;
  if (!RADIUS_RE.test(v)) return null;
  return v;
}

/* -------------------------------------------------------------------------- */
/* Fetcher                                                                    */
/* -------------------------------------------------------------------------- */

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-theme-customizer] panthThemeTokens field missing — install/enable Panth_ThemeCustomizer.",
    );
  } else {
    console.warn("[panth-theme-customizer] query failed:", msg);
  }
}

/**
 * Returns the admin-configured theme tokens, pre-validated. Every entry is
 * guaranteed safe to interpolate into CSS. Never throws. Empty object on any
 * error / schema miss.
 */
export async function getThemeTokens(): Promise<ThemeTokens> {
  const empty: ThemeTokens = { colors: {}, fonts: {}, radius: null };

  const doc = /* GraphQL */ `
    query PanthThemeTokens {
      panthThemeTokens {
        colors {
          brand
          accent
          fg
          bg
          muted
          border
        }
        fonts {
          body
          heading
        }
        radius
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, {});
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return empty;
    const env = parsed.data.panthThemeTokens;
    if (!env) return empty;

    const colors: ThemeColors = {};
    if (env.colors) {
      for (const key of [
        "brand", "accent", "fg", "bg", "muted", "border",
      ] as const) {
        const v = validateColor(env.colors[key]);
        if (v !== null) colors[key] = v;
      }
    }

    const fonts: ThemeFonts = {};
    if (env.fonts) {
      for (const key of ["body", "heading"] as const) {
        const v = validateFont(env.fonts[key]);
        if (v !== null) fonts[key] = v;
      }
    }

    const radius = validateRadius(env.radius);

    return { colors, fonts, radius };
  } catch (err) {
    logSchemaMiss(err);
    return empty;
  }
}
