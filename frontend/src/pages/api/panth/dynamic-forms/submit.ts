import type { APIContext, APIRoute } from "astro";
import { z } from "zod";
import { query } from "~/lib/graphql";
import {
  buildFieldValidator,
  getDynamicForm,
  type DynamicForm,
} from "~/lib/queries-dynamic-forms";

/**
 * POST /api/panth/dynamic-forms/submit
 *
 * Accepts a `multipart/form-data` body matching the field definitions of
 * the dynamic form identified by the required `slug` field. Each value is
 * Zod-validated against the admin-defined schema; file uploads are enforced
 * against a MIME / extension / size allowlist; then the payload is forwarded
 * to Magento's `panthDynamicFormSubmit` mutation.
 *
 * Responses:
 *   200 { ok: true,  message }
 *   400 { ok: false, message, errors? }  — invalid body / bad file
 *   429 { ok: false, message }            — rate limited
 *   502 { ok: false, message }            — Magento rejected / missing mutation
 */
export const prerender = false;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

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
  "exe", "msi", "bat", "cmd", "com", "scr", "js", "vbs", "ps1", "sh",
  "app", "jar", "dll", "bin", "apk", "dmg",
]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

/* ------------------------------------------------------------------------- */
/* Rate limiter                                                               */
/* ------------------------------------------------------------------------- */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const buckets = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? [];
  const fresh = bucket.filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= MAX_PER_WINDOW) {
    buckets.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(ip, fresh);
  return true;
}

function resolveClientIp(ctx: APIContext): string {
  try {
    if (ctx.clientAddress) return ctx.clientAddress;
  } catch {
    /* adapter may throw */
  }
  const xff = ctx.request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}

/* ------------------------------------------------------------------------- */
/* File validation                                                            */
/* ------------------------------------------------------------------------- */

function validateFile(file: File): string | null {
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_FILE_BYTES) return "File is too large. The limit is 10 MB.";
  const ext = extOf(file.name);
  if (FORBIDDEN_EXT.has(ext)) return "Executable files are not allowed.";
  const mimeOk = file.type.length > 0 ? ALLOWED_MIME.has(file.type) : false;
  const extOk = ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) return "Allowed types: PDF, PNG, JPG, JPEG, WebP, TXT, ZIP.";
  return null;
}

/* ------------------------------------------------------------------------- */
/* Forward                                                                    */
/* ------------------------------------------------------------------------- */

interface FilePayload {
  name: string;
  size: number;
  mime: string;
  data_base64: string;
}

async function forward(
  slug: string,
  values: Record<string, string>,
  files: Record<string, FilePayload>,
): Promise<{ ok: boolean; message: string }> {
  const doc = /* GraphQL */ `
    mutation PanthDynamicFormSubmit($input: PanthDynamicFormSubmitInput!) {
      panthDynamicFormSubmit(input: $input) {
        ok
        message
      }
    }
  `;
  try {
    const res = await query<{
      panthDynamicFormSubmit?: { ok?: boolean | null; message?: string | null } | null;
    }>(doc, {
      input: {
        slug,
        fields: Object.entries(values).map(([k, v]) => ({
          id: k.replace(/^f_/, ""),
          value: v,
        })),
        files: Object.entries(files).map(([k, f]) => ({
          id: k.replace(/^f_/, ""),
          name: f.name,
          size: f.size,
          mime: f.mime,
          data_base64: f.data_base64,
        })),
      },
    });
    const r = res.panthDynamicFormSubmit;
    return {
      ok: r?.ok === true,
      message: r?.message?.trim() || "Thanks — we received your submission.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Cannot query field|Unknown type|not exist|panthDynamicFormSubmit/i.test(msg)) {
      return { ok: false, message: "This form is not available right now." };
    }
    console.warn("[panth-dynamic-forms] forward failed:", msg);
    return { ok: false, message: "We could not process the submission. Please try again." };
  }
}

/* ------------------------------------------------------------------------- */
/* Handler                                                                    */
/* ------------------------------------------------------------------------- */

function buildValidator(form: DynamicForm): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of form.fields) {
    if (f.type === "file") continue;
    shape[`f_${f.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`] = buildFieldValidator(f);
  }
  shape["slug"] = z.string().trim().min(1).max(200);
  return z.object(shape).strip();
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      buf.subarray(i, Math.min(i + chunk, buf.length)) as unknown as number[],
    );
  }
  return btoa(bin);
}

export const POST: APIRoute = async (ctx) => {
  const ip = resolveClientIp(ctx);
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ ok: false, message: "Too many requests. Please try again in a minute." }),
      { status: 429, headers: JSON_HEADERS },
    );
  }

  let fd: FormData;
  try {
    fd = await ctx.request.formData();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, message: "Invalid body." }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const slug = (fd.get("slug") ?? "").toString().trim();
  if (!slug) {
    return new Response(
      JSON.stringify({ ok: false, message: "Missing form identifier." }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const form = await getDynamicForm(slug);
  if (!form) {
    return new Response(
      JSON.stringify({ ok: false, message: "This form is not available." }),
      { status: 502, headers: JSON_HEADERS },
    );
  }

  // Separate scalar values from files. Only keys that match a declared field
  // name are forwarded — drive-by form fields are silently dropped.
  const allowedNames = new Set(
    form.fields.map((f) => `f_${f.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`),
  );
  const scalarPayload: Record<string, string> = { slug };
  const files: Record<string, File> = {};
  let totalBytes = 0;

  for (const [k, v] of fd.entries()) {
    if (k === "slug") continue;
    if (!allowedNames.has(k)) continue;
    if (v instanceof File) {
      const err = validateFile(v);
      if (err) {
        return new Response(
          JSON.stringify({ ok: false, message: err, errors: { [k]: err } }),
          { status: 400, headers: JSON_HEADERS },
        );
      }
      totalBytes += v.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return new Response(
          JSON.stringify({ ok: false, message: "Total upload size exceeds 12 MB." }),
          { status: 400, headers: JSON_HEADERS },
        );
      }
      files[k] = v;
    } else if (typeof v === "string") {
      scalarPayload[k] = v;
    }
  }

  const validator = buildValidator(form);
  const parsed = validator.safeParse(scalarPayload);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.length > 0 ? String(issue.path[0]) : "_";
      if (!errors[key]) errors[key] = issue.message;
    }
    return new Response(
      JSON.stringify({ ok: false, message: "Please check the highlighted fields.", errors }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const validated = parsed.data as Record<string, unknown>;
  const stringValues: Record<string, string> = {};
  for (const [k, v] of Object.entries(validated)) {
    if (k === "slug") continue;
    if (typeof v === "string") stringValues[k] = v;
    else if (typeof v === "boolean") stringValues[k] = v ? "true" : "false";
    else if (typeof v === "number") stringValues[k] = String(v);
    else if (v !== null && v !== undefined) stringValues[k] = String(v);
  }

  const filePayloads: Record<string, FilePayload> = {};
  for (const [k, file] of Object.entries(files)) {
    filePayloads[k] = {
      name: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
      data_base64: await fileToBase64(file),
    };
  }

  const result = await forward(form.slug, stringValues, filePayloads);
  if (!result.ok) {
    return new Response(JSON.stringify({ ok: false, message: result.message }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }
  return new Response(
    JSON.stringify({ ok: true, message: form.success_message ?? result.message }),
    { status: 200, headers: JSON_HEADERS },
  );
};

export const GET: APIRoute = async () =>
  new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST", "Content-Type": "text/plain" },
  });
