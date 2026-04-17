/**
 * URL-manipulation helpers shared across the layered-nav components.
 *
 * These are pure string utilities — no GraphQL, no Magento. They only know
 * how to "add this option to a multi-select param", "remove it", "clear a
 * filter", and "render a final href string" that preserves the other params.
 *
 * Everything resets `page` to 1 when filters change, per Luma behaviour.
 */

import { RESERVED_PARAMS } from "./queries-catalog";

/** Clone so we never mutate the caller's URLSearchParams. */
function clone(sp: URLSearchParams): URLSearchParams {
  return new URLSearchParams(sp.toString());
}

/** Remove pagination params so filter changes reset to page 1. */
function resetPage(sp: URLSearchParams): void {
  sp.delete("page");
  sp.delete("p");
}

/**
 * Encode a set of params to a query string with a leading `?`, or "" if empty.
 * We also sort keys so URLs are stable (cache-friendly, share-friendly).
 */
export function toQueryString(sp: URLSearchParams): string {
  const entries = Array.from(sp.entries()).filter(([, v]) => v !== "");
  entries.sort(([a], [b]) => a.localeCompare(b));
  const out = new URLSearchParams();
  for (const [k, v] of entries) out.append(k, v);
  const s = out.toString();
  return s ? `?${s}` : "";
}

export function buildHref(basePath: string, sp: URLSearchParams): string {
  return `${basePath}${toQueryString(sp)}`;
}

/**
 * Return a new searchParams with `value` added to (or removed from) the
 * comma-separated list at `key`. Toggle behaviour.
 */
export function toggleMultiValue(
  sp: URLSearchParams,
  key: string,
  value: string,
): URLSearchParams {
  const next = clone(sp);
  resetPage(next);
  const current = (next.get(key) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const idx = current.indexOf(value);
  if (idx === -1) current.push(value);
  else current.splice(idx, 1);

  if (current.length === 0) next.delete(key);
  else next.set(key, current.join(","));
  return next;
}

/** Remove a specific value from a multi-select filter (leave the rest). */
export function removeValue(
  sp: URLSearchParams,
  key: string,
  value: string,
): URLSearchParams {
  const next = clone(sp);
  resetPage(next);
  const current = (next.get(key) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const filtered = current.filter((v) => v !== value);
  if (filtered.length === 0) next.delete(key);
  else next.set(key, filtered.join(","));
  return next;
}

/** Remove an entire filter key regardless of value. */
export function removeKey(sp: URLSearchParams, key: string): URLSearchParams {
  const next = clone(sp);
  resetPage(next);
  next.delete(key);
  return next;
}

/** Clear every filter param, keep reserved ones (sort, pageSize, q). */
export function clearAllFilters(sp: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  for (const [k, v] of sp.entries()) {
    if (RESERVED_PARAMS.has(k)) next.set(k, v);
  }
  resetPage(next);
  return next;
}

/** Set a single-value param (sort, page, pageSize). Doesn't reset page unless asked. */
export function setParam(
  sp: URLSearchParams,
  key: string,
  value: string,
  options?: { resetPage?: boolean },
): URLSearchParams {
  const next = clone(sp);
  if (options?.resetPage) resetPage(next);
  if (value === "") next.delete(key);
  else next.set(key, value);
  return next;
}

/** Does the searchParams currently contain this value for this key? */
export function hasValue(
  sp: URLSearchParams,
  key: string,
  value: string,
): boolean {
  const current = (sp.get(key) ?? "")
    .split(",")
    .map((s) => s.trim());
  return current.includes(value);
}

/**
 * Return a list of `{ key, label, value, href }` chips describing every
 * currently active filter. The `href` points to a URL with *that* filter
 * value removed.
 */
export interface ActiveFilterChip {
  key: string;
  label: string;
  value: string;
  displayValue: string;
  href: string;
}

export function listActiveFilters(
  sp: URLSearchParams,
  basePath: string,
  labels: Record<string, string> = {},
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  for (const [key, raw] of sp.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;
    if (!raw) continue;

    if (key === "price") {
      // Parse "20-40" → "$20 – $40"
      const m = raw.match(/^(\d*(?:\.\d+)?)-(\d*(?:\.\d+)?)$/);
      if (m) {
        const from = m[1] ?? "";
        const to = m[2] ?? "";
        const display = from && to
          ? `$${from} – $${to}`
          : from
            ? `$${from}+`
            : to
              ? `Up to $${to}`
              : "Price";
        chips.push({
          key,
          label: labels[key] ?? "Price",
          value: raw,
          displayValue: display,
          href: buildHref(basePath, removeKey(sp, key)),
        });
      }
      continue;
    }

    const values = raw.split(",").map((s) => s.trim()).filter(Boolean);
    for (const v of values) {
      chips.push({
        key,
        label: labels[key] ?? key,
        value: v,
        displayValue: v,
        href: buildHref(basePath, removeValue(sp, key, v)),
      });
    }
  }
  return chips;
}

/**
 * Build a human-readable price label from a Magento aggregation bucket value.
 * Magento returns price bucket values like `20_29.99` (underscore separator,
 * last bucket open-ended like `80_*`). Convert to `20-30` for the URL, and
 * show "$20 – $30" in the UI.
 */
export function parsePriceBucket(rawValue: string): {
  urlValue: string;
  displayLabel: string;
} {
  // Magento emits `20_29.99` (inclusive) or `80_*` for open-ended.
  const [fromPart, toPart] = rawValue.split("_");
  const from = fromPart ?? "";
  const to = toPart === "*" || toPart === undefined ? "" : toPart;
  const urlValue = `${from}-${to}`;
  if (from && to) return { urlValue, displayLabel: `$${from} – $${to}` };
  if (from && !to) return { urlValue, displayLabel: `$${from}+` };
  if (!from && to) return { urlValue, displayLabel: `Up to $${to}` };
  return { urlValue: rawValue, displayLabel: rawValue };
}
