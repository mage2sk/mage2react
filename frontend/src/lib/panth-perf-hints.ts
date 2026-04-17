/**
 * Admin-managed resource-hint helper for Panth_PerformanceOptimizerReact.
 *
 * Reads a Panth-provided `storeConfig.panth_perf_hints` shape and returns a
 * list of `<link>` attribute objects you can render in `Base.astro` `<head>`.
 *
 * Usage in `Base.astro`:
 *
 * ```astro
 * ---
 * import { panthPerfHints } from "../lib/panth-perf-hints";
 * const hints = panthPerfHints(storeConfig.panth_perf_hints);
 * ---
 * {hints.map((h) => (
 *   <link rel={h.rel} href={h.href} as={h.as} type={h.type} crossorigin={h.crossorigin} />
 * ))}
 * ```
 *
 * Security: hostnames are safe-listed to `http(s)` only. Entries containing
 * `javascript:`, `data:`, or any whitespace are rejected. Validation still
 * belongs on the server side of the Panth admin form — this is a last-chance
 * filter before the value reaches the DOM.
 */

export type PanthHintRel = "preconnect" | "dns-prefetch" | "preload";

export type PanthPreloadAs = "image" | "font" | "style" | "script" | "fetch";

export interface PanthPreloadEntry {
  href: string;
  as: PanthPreloadAs;
  type?: string;
  crossorigin?: boolean;
}

export interface PanthPerfHintsConfig {
  preconnect?: ReadonlyArray<string> | null;
  dns_prefetch?: ReadonlyArray<string> | null;
  preload?: ReadonlyArray<PanthPreloadEntry> | null;
}

export interface PanthHintLink {
  rel: PanthHintRel;
  href: string;
  as: PanthPreloadAs | undefined;
  type: string | undefined;
  crossorigin: "anonymous" | undefined;
}

const UNSAFE_PREFIXES: ReadonlyArray<string> = ["javascript:", "data:", "vbscript:", "file:"];

/**
 * Return true if `href` is a safe, http(s) URL with no whitespace and no
 * dangerous pseudo-scheme.
 */
function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  if (href.length === 0) return false;
  if (/\s/.test(href)) return false;
  const lower = href.toLowerCase();
  for (const bad of UNSAFE_PREFIXES) {
    if (lower.startsWith(bad)) return false;
  }
  try {
    const u = new URL(href);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function dedupe<T>(items: ReadonlyArray<T>, key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/**
 * Normalise admin-configured resource hints into render-ready `<link>` attrs.
 *
 * Invalid or unsafe entries are silently dropped so a bad admin input cannot
 * break the page render.
 */
export function panthPerfHints(config: PanthPerfHintsConfig | null | undefined): PanthHintLink[] {
  if (!config) return [];

  const links: PanthHintLink[] = [];

  const preconnect = (config.preconnect ?? []).filter(isSafeHref);
  for (const href of preconnect) {
    links.push({
      rel: "preconnect",
      href,
      as: undefined,
      type: undefined,
      crossorigin: "anonymous",
    });
  }

  const dnsPrefetch = (config.dns_prefetch ?? []).filter(isSafeHref);
  for (const href of dnsPrefetch) {
    links.push({
      rel: "dns-prefetch",
      href,
      as: undefined,
      type: undefined,
      crossorigin: undefined,
    });
  }

  const preload = config.preload ?? [];
  for (const entry of preload) {
    if (!entry || !isSafeHref(entry.href)) continue;
    links.push({
      rel: "preload",
      href: entry.href,
      as: entry.as,
      type: entry.type,
      crossorigin: entry.crossorigin ? "anonymous" : undefined,
    });
  }

  return dedupe(links, (l) => `${l.rel}|${l.href}|${l.as ?? ""}`);
}
