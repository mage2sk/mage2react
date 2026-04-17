/**
 * Magento catalog image helpers.
 *
 * These helpers produce URLs and prop bundles used across product tiles,
 * hero sections, and proxy-rendered content. They purposefully do NOT try to
 * reproduce Magento's image-cache hash path (that would require a round-trip
 * to Magento) — instead we hit the plain `/media/catalog/product/<path>`
 * URL, which Magento's URL rewrite resolves directly.
 *
 * TODO: once an image resizer (imgproxy / Cloudflare Images / similar) is in
 * place, swap `productImageUrl` / `responsiveSrcset` to emit signed resized
 * URLs so srcset actually serves different byte payloads per width.
 */

const MEDIA_URL: string =
  // `import.meta.env.PUBLIC_MEDIA_URL` is replaced at build time; fall back
  // to Magento's conventional `/media` path when the var is unset (dev/SSR
  // bootstrap before env is loaded).
  (import.meta.env.PUBLIC_MEDIA_URL ?? "/media").replace(/\/+$/, "");

export interface ImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  loading: "eager" | "lazy";
  decoding: "async" | "sync" | "auto";
  fetchpriority?: "high" | "low" | "auto";
}

/**
 * Build a Magento catalog image URL. Accepts either a raw filename
 * (`/m/b/mb01-black-0.jpg`) or a full URL (returned as-is).
 *
 * `width` / `height` are accepted for API compatibility with callers that
 * may later swap in a real resizer — they are currently ignored because
 * Magento serves a single rendition at this URL.
 */
export function productImageUrl(
  path: string,
  _width?: number,
  _height?: number,
): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  // Magento rewrites `/media/catalog/product/<img>` → actual file. If the
  // caller already passed a path under `/catalog/product/...`, keep it;
  // otherwise assume the bare filename belongs under catalog/product.
  const prefix = suffix.startsWith("/catalog/") ? "" : "/catalog/product";
  return `${MEDIA_URL}${prefix}${suffix}`;
}

/**
 * Build a `srcset` string.
 *
 * NOTE: Magento doesn't expose per-width renditions at a predictable URL,
 * so every descriptor points at the same upstream URL. The browser will
 * still pick a `w` based on viewport, and this keeps the markup compatible
 * with a future swap to real resized variants.
 */
export function responsiveSrcset(url: string, widths: number[]): string {
  if (!url || widths.length === 0) return "";
  const unique = Array.from(new Set(widths)).sort((a, b) => a - b);
  return unique.map((w) => `${url} ${w}w`).join(", ");
}

/**
 * Props for the above-the-fold LCP image. Sets `fetchpriority=high` and
 * eager loading so the browser prioritises it.
 */
export function heroImageProps(url: string, alt: string): ImageProps {
  return {
    src: url,
    alt,
    // Hero on mage2react is a 16:9 banner; defaults matter for CLS.
    width: 1600,
    height: 900,
    loading: "eager",
    decoding: "async",
    fetchpriority: "high",
  };
}

/**
 * Props for below-the-fold images (product grids, content sections).
 */
export function laterImageProps(
  url: string,
  alt: string,
  width: number,
  height: number,
): ImageProps {
  return {
    src: url,
    alt,
    width,
    height,
    loading: "lazy",
    decoding: "async",
  };
}
