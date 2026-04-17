import { z } from "zod";

/**
 * queries-product-attachments.ts
 *
 * Helpers for consuming the `ProductInterface.panth_attachments` field
 * contributed by `Panth_ProductAttachments`. We do not own the parent
 * schema, so:
 *   - Every field is `.nullable().optional()`.
 *   - Callers `safeParse` and fall back to `[]` on any mismatch.
 *
 * The fragment is meant to be spliced into an existing `products(...)` /
 * `product` query via the standard GraphQL `...Fragment` spread in the
 * `items { ... }` block.
 */

/* -------------------------------------------------------------------------- */
/* GraphQL fragment                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Paste this fragment definition alongside the query that requests it, then
 * spread `...PanthAttachmentsProductFragment` inside `product { ... }` /
 * `products { items { ... } }`.
 */
export const PANTH_ATTACHMENTS_PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment PanthAttachmentsProductFragment on ProductInterface {
    panth_attachments {
      label
      url
      size
      icon
      type
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Zod                                                                         */
/* -------------------------------------------------------------------------- */

const RawAttachment = z.object({
  label: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  size: z.union([z.number(), z.string()]).nullable().optional(),
  icon: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
});

const ProductWithAttachments = z.object({
  panth_attachments: z.array(RawAttachment).nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

export type PanthAttachmentType = "pdf" | "doc" | "zip" | "txt" | "image" | "other";

export interface PanthAttachmentT {
  label: string;
  url: string;
  size: number | null;
  icon: string | null;
  type: PanthAttachmentType;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Strict http(s) allowlist. Rejects `javascript:`, `data:`, relative paths
 * without a leading `/`, and protocol-relative URLs.
 */
export function validateAttachmentUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.length) return null;
  // Absolute URL with explicit protocol.
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (ALLOWED_PROTOCOLS.has(u.protocol)) return u.toString();
      return null;
    } catch {
      return null;
    }
  }
  // Relative path under the same origin (media). Must start with a single `/`.
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) {
    return v;
  }
  return null;
}

function coerceSize(raw: number | string | null | undefined): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function classifyType(type: string | null | undefined, url: string): PanthAttachmentType {
  const t = (type ?? "").trim().toLowerCase();
  if (t === "pdf" || t === "doc" || t === "zip" || t === "txt" || t === "image") return t;
  const ext = url.toLowerCase().split("?")[0]!.split("#")[0]!.split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "doc";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "zip";
  if (ext === "txt") return "txt";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
  return "other";
}

export function formatAttachmentSize(bytes: number | null): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const rounded = v >= 10 ? v.toFixed(0) : v.toFixed(1);
  return `${rounded} ${units[i]}`;
}

/**
 * Coerce a raw GraphQL response node into a safe typed attachment. Returns
 * `null` when the payload is unusable (bad URL, missing label, etc.).
 */
export function extractAttachments(raw: unknown): PanthAttachmentT[] {
  const parsed = ProductWithAttachments.safeParse(raw);
  if (!parsed.success) return [];
  const list = parsed.data.panth_attachments ?? [];
  const out: PanthAttachmentT[] = [];
  for (const a of list) {
    if (!a) continue;
    const url = validateAttachmentUrl(a.url);
    if (!url) continue;
    const label = (a.label ?? "").trim();
    if (!label) continue;
    out.push({
      label,
      url,
      size: coerceSize(a.size ?? null),
      icon: a.icon?.trim() || null,
      type: classifyType(a.type, url),
    });
  }
  return out;
}
