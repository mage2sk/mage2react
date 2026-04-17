import type { APIRoute } from "astro";
import { getCustomerToken } from "~/lib/auth";

/**
 * POST /api/panth/order-attachments/upload
 *
 * Accepts a `multipart/form-data` body from `UploadAttachment.tsx` with:
 *   - `orderNumber`: string  (non-empty)
 *   - `file`:        File    (required)
 *
 * Forwards the multipart payload to Magento's
 *   POST {MAGENTO_BASE}/rest/V1/panth-order-attachments/upload
 * REST endpoint with `Authorization: Bearer <customer-token>` read from the
 * HttpOnly `m2r_customer_token` cookie. The raw token never leaves the
 * server. We intentionally hit the Magento REST surface because GraphQL has
 * no first-class binary upload primitive, and the parent module is expected
 * to expose a matching REST route.
 *
 * Responses:
 *   200 — upload accepted by Magento; response body echoed for success JSON
 *   400 — validation failure (file missing / too big / disallowed type)
 *   401 — not signed in
 *   502 — upstream Magento returned non-2xx
 *
 * Validation (mirrors the client):
 *   - max 10 MB
 *   - MIME allowlist: pdf, png, jpg, jpeg, webp, txt, zip
 *   - no executables
 */
export const prerender = false;

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

const ALLOWED_EXT = new Set<string>([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "txt",
  "zip",
]);

const FORBIDDEN_EXT = new Set<string>([
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "js",
  "vbs",
  "ps1",
  "sh",
  "app",
  "jar",
  "dll",
  "bin",
  "apk",
  "dmg",
]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain", "Cache-Control": "private, no-store" },
  });
}

/**
 * Resolves the Magento base URL (without the trailing `/graphql`) so we can
 * POST to `/rest/V1/...`. `MAGENTO_GRAPHQL_URL` is always defined in
 * `env.d.ts`; strip the GraphQL suffix to get the base.
 */
function resolveMagentoBase(): string {
  const graphql = import.meta.env.MAGENTO_GRAPHQL_URL ?? "http://mage2react.local/graphql";
  return graphql.replace(/\/graphql\/?$/i, "");
}

export const POST: APIRoute = async (ctx) => {
  const token = getCustomerToken(ctx);
  if (!token) {
    return textResponse(401, "You must be signed in to upload attachments.");
  }

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return textResponse(400, "Invalid multipart body.");
  }

  const orderNumberRaw = form.get("orderNumber");
  const fileRaw = form.get("file");

  if (typeof orderNumberRaw !== "string" || orderNumberRaw.trim().length === 0) {
    return textResponse(400, "Missing order number.");
  }
  const orderNumber = orderNumberRaw.trim();

  if (!(fileRaw instanceof File)) {
    return textResponse(400, "No file received.");
  }
  const file = fileRaw;

  if (file.size <= 0) {
    return textResponse(400, "That file is empty.");
  }
  if (file.size > MAX_BYTES) {
    return textResponse(400, "File is too large. The limit is 10 MB.");
  }

  const ext = extOf(file.name);
  if (FORBIDDEN_EXT.has(ext)) {
    return textResponse(400, "Executable files are not allowed.");
  }
  const mimeOk = file.type.length > 0 ? ALLOWED_MIME.has(file.type) : false;
  const extOk = ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) {
    return textResponse(400, "Allowed types: PDF, PNG, JPG, JPEG, WebP, TXT, ZIP.");
  }

  // Rebuild the multipart body so field names match the Magento REST route
  // contract and no stray client fields leak through.
  const upstreamBody = new FormData();
  upstreamBody.append("order_number", orderNumber);
  upstreamBody.append("file", file, file.name);

  const base = resolveMagentoBase();
  const url = `${base}/rest/V1/panth-order-attachments/upload`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Requested-With": "mage2react-frontend",
      },
      body: upstreamBody,
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.warn("[panth-order-attachments] upstream upload failed", {
        status: upstream.status,
        detail: detail.slice(0, 500),
      });
      return textResponse(502, "Upload failed upstream. Please try again.");
    }
    const body = await upstream.text();
    return new Response(body.length > 0 ? body : JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[panth-order-attachments] network error", msg);
    return textResponse(502, "Network error contacting Magento. Please try again.");
  }
};

export const GET: APIRoute = async () =>
  new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "text/plain" },
  });
