/**
 * Small performance helpers for Astro pages.
 *
 * - `preloadHints` normalises an array of preload descriptors so the page
 *   template can iterate them and render `<link rel="preload">` tags.
 * - `cacheHeaders` composes a `Cache-Control` string with sensible
 *   `s-maxage` / `stale-while-revalidate` defaults.
 */

export type PreloadAs = "image" | "font" | "style" | "script";

export interface PreloadResource {
  href: string;
  as: PreloadAs;
  type?: string;
  crossorigin?: boolean;
}

export interface PreloadHint {
  rel: "preload";
  href: string;
  as: PreloadAs;
  type: string | undefined;
  crossorigin: "anonymous" | undefined;
}

/**
 * Normalise preload descriptors. Iterate the returned array in an Astro
 * template like:
 *
 * ```astro
 * {preloadHints(resources).map((h) => (
 *   <link rel={h.rel} href={h.href} as={h.as} type={h.type} crossorigin={h.crossorigin} />
 * ))}
 * ```
 */
export function preloadHints(resources: PreloadResource[]): PreloadHint[] {
  return resources.map((r) => ({
    rel: "preload",
    href: r.href,
    as: r.as,
    type: r.type,
    // Fonts and cross-origin scripts need `crossorigin="anonymous"` to
    // actually get used by the browser; coerce boolean → attribute string.
    crossorigin: r.crossorigin ? "anonymous" : undefined,
  }));
}

/**
 * Compose a `Cache-Control` header value.
 *
 * - `maxAge` — browser cache TTL in seconds.
 * - `sMaxAge` — shared (CDN/proxy) cache TTL in seconds.
 * - `swr` — `stale-while-revalidate` window in seconds.
 */
export function cacheHeaders(
  maxAge: number,
  sMaxAge?: number,
  swr?: number,
): string {
  const parts: string[] = ["public", `max-age=${Math.max(0, Math.floor(maxAge))}`];
  if (typeof sMaxAge === "number") {
    parts.push(`s-maxage=${Math.max(0, Math.floor(sMaxAge))}`);
  }
  if (typeof swr === "number") {
    parts.push(`stale-while-revalidate=${Math.max(0, Math.floor(swr))}`);
  }
  return parts.join(", ");
}
