/**
 * panth-image.ts — helpers for `Panth_Imageoptimizer` (`mage2kishan/module-imageoptimizer`).
 *
 * The optimizer is expected to expose a path-based route:
 *
 *   /panth-media/{w}x{h}/{format}/<original/media/path>
 *
 * …which Magento rewrites to a resized, format-converted rendition. When the
 * module isn't installed or the route isn't present, these helpers emit a
 * best-effort query-string form (`?w=…&h=…&fm=webp`) that an upstream
 * optimizer (Cloudflare Images, imgproxy, etc.) may understand. Absolute
 * off-site URLs are passed through unchanged.
 */

export type OptImageFormat = "avif" | "webp" | "jpeg" | "jpg" | "png" | "auto";

export interface PanthImageOpts {
  width?: number;
  height?: number;
  format?: OptImageFormat;
  /** Opt into the query-string form rather than the route-based form. */
  queryString?: boolean;
}

const MEDIA_PREFIX =
  (typeof import.meta !== "undefined"
    ? (import.meta.env?.PUBLIC_MEDIA_URL ?? "/media")
    : "/media"
  ).replace(/\/+$/, "");

const OPTIMIZER_PREFIX =
  (typeof import.meta !== "undefined"
    ? (import.meta.env?.PUBLIC_PANTH_OPTIMIZER_PREFIX ?? "/panth-media")
    : "/panth-media"
  ).replace(/\/+$/, "");

function sanitiseInt(v: number | undefined): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return Math.round(v);
}

function sanitiseFormat(f: OptImageFormat | undefined): OptImageFormat | null {
  if (!f) return null;
  const k = f.toLowerCase();
  if (k === "avif" || k === "webp" || k === "jpeg" || k === "jpg" || k === "png" || k === "auto") {
    return k as OptImageFormat;
  }
  return null;
}

function isAbsolute(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^data:/i.test(url);
}

/**
 * Returns `true` if the URL is already an optimizer URL (avoids double-wrapping).
 */
export function isPanthOptimizerUrl(url: string): boolean {
  if (!url) return false;
  return url.includes(`${OPTIMIZER_PREFIX}/`);
}

/**
 * Build a Panth-optimizer URL. Best-effort — falls back to the raw URL when
 * the input is already absolute/off-site or the path is empty.
 */
export function panthImageUrl(path: string, opts: PanthImageOpts = {}): string {
  if (!path || typeof path !== "string") return "";

  // Already optimized? Return as-is.
  if (isPanthOptimizerUrl(path)) return path;

  // Off-site absolute URL (third-party CDN / external) — pass through.
  if (isAbsolute(path)) {
    if (opts.queryString) {
      return withQueryString(path, opts);
    }
    return path;
  }

  const w = sanitiseInt(opts.width);
  const h = sanitiseInt(opts.height);
  const fmt = sanitiseFormat(opts.format) ?? "auto";

  // If no dims requested, just return the underlying media URL.
  if (!w && !h) return resolveMediaUrl(path);

  if (opts.queryString) {
    return withQueryString(resolveMediaUrl(path), { ...opts, width: w ?? undefined, height: h ?? undefined });
  }

  // Build /panth-media/{w}x{h}/{format}/<path> form.
  const suffix = path.startsWith("/") ? path : `/${path}`;
  // Strip any `/media/` prefix before feeding into the optimizer so the route
  // is canonical. The optimizer resolves both `/catalog/product/...` and the
  // bare filename form.
  const mediaRelative = suffix.replace(/^\/?media\//, "/");
  const dims = `${w ?? ""}x${h ?? ""}`.replace(/^x$/, "");
  return `${OPTIMIZER_PREFIX}/${dims}/${fmt}${mediaRelative.startsWith("/") ? "" : "/"}${mediaRelative}`;
}

function resolveMediaUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (suffix.startsWith("/media/")) return suffix;
  if (suffix.startsWith("/catalog/")) return `${MEDIA_PREFIX}${suffix}`;
  return `${MEDIA_PREFIX}/catalog/product${suffix}`;
}

function withQueryString(url: string, opts: PanthImageOpts): string {
  const u = new URL(url, isAbsolute(url) ? undefined : "http://x/");
  const w = sanitiseInt(opts.width);
  const h = sanitiseInt(opts.height);
  const fmt = sanitiseFormat(opts.format);
  if (w) u.searchParams.set("w", String(w));
  if (h) u.searchParams.set("h", String(h));
  if (fmt && fmt !== "auto") u.searchParams.set("fm", fmt);
  return isAbsolute(url) ? u.toString() : u.pathname + (u.search ? u.search : "");
}

/**
 * Build a `srcset` string across several widths. Emits one descriptor per
 * width pointing at the matching optimizer URL.
 */
export function panthResponsiveSrcset(
  path: string,
  widths: number[],
  opts: Omit<PanthImageOpts, "width"> = {},
): string {
  if (!path || widths.length === 0) return "";
  const unique = Array.from(new Set(widths.filter((w) => Number.isFinite(w) && w > 0))).sort((a, b) => a - b);
  return unique
    .map((w) => `${panthImageUrl(path, { ...opts, width: w })} ${w}w`)
    .join(", ");
}
