import { useCallback, useId, useRef, useState } from "react";

/**
 * UploadAttachment.tsx — `client:visible` React 19 island.
 *
 * Lets a signed-in customer attach a file to an existing order. The browser
 * POSTs `multipart/form-data` to `/api/panth/order-attachments/upload`; that
 * Astro endpoint reads the HttpOnly `m2r_customer_token` cookie and forwards
 * to Magento with a bearer header. The raw token never reaches client JS.
 *
 * Client-side validation (enforced again on the server):
 *   - max 10 MB
 *   - MIME allowlist: pdf, png, jpg, jpeg, webp, txt, zip
 *   - no executables
 *
 * No new npm deps. No `any`. Strict TS.
 */

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/zip",
  // Some browsers report .zip as x-zip-compressed.
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

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; filename: string }
  | { kind: "error"; message: string };

interface Props {
  orderNumber: string;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

function validate(file: File): string | null {
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_BYTES) return "File is too large. The limit is 10 MB.";
  const ext = extOf(file.name);
  if (FORBIDDEN_EXT.has(ext)) return "Executable files are not allowed.";
  const mimeOk = file.type ? ALLOWED_MIME.has(file.type) : false;
  const extOk = ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) {
    return "Allowed types: PDF, PNG, JPG, JPEG, WebP, TXT, ZIP.";
  }
  return null;
}

export default function UploadAttachment({ orderNumber }: Props): JSX.Element {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [selected, setSelected] = useState<File | null>(null);

  const onPick = useCallback((ev: React.ChangeEvent<HTMLInputElement>): void => {
    const f = ev.currentTarget.files?.[0] ?? null;
    if (!f) {
      setSelected(null);
      return;
    }
    const err = validate(f);
    if (err) {
      setSelected(null);
      setStatus({ kind: "error", message: err });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSelected(f);
    setStatus({ kind: "idle" });
  }, []);

  const onSubmit = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>): Promise<void> => {
      ev.preventDefault();
      if (!selected) {
        setStatus({ kind: "error", message: "Choose a file first." });
        return;
      }
      const err = validate(selected);
      if (err) {
        setStatus({ kind: "error", message: err });
        return;
      }
      setStatus({ kind: "uploading" });
      const body = new FormData();
      body.append("orderNumber", orderNumber);
      body.append("file", selected, selected.name);
      try {
        const res = await fetch("/api/panth/order-attachments/upload", {
          method: "POST",
          body,
          credentials: "same-origin",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const msg = text && text.length > 0 && text.length < 200
            ? text
            : "Upload failed. Please try again.";
          setStatus({ kind: "error", message: msg });
          return;
        }
        setStatus({ kind: "success", filename: selected.name });
        setSelected(null);
        if (inputRef.current) inputRef.current.value = "";
      } catch {
        setStatus({ kind: "error", message: "Network error. Please try again." });
      }
    },
    [orderNumber, selected],
  );

  const uploading = status.kind === "uploading";

  return (
    <section
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mt-4"
      aria-label="Upload an attachment to this order"
    >
      <h2 className="text-base font-semibold text-[var(--color-fg)] mb-3 flex items-center gap-2">
        <i className="bi bi-cloud-upload" aria-hidden="true" />
        <span>Upload an attachment</span>
      </h2>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        encType="multipart/form-data"
      >
        <label htmlFor={inputId} className="sr-only">
          Choose a file
        </label>
        <input
          ref={inputRef}
          id={inputId}
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.zip,application/pdf,image/png,image/jpeg,image/webp,text/plain,application/zip"
          onChange={onPick}
          disabled={uploading}
          className="block w-full text-sm text-[var(--color-fg)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-muted)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-fg)] hover:file:bg-[var(--color-border)]"
        />
        <button
          type="submit"
          disabled={uploading || !selected}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
        >
          {uploading ? (
            <>
              <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <i className="bi bi-upload" aria-hidden="true" />
              <span>Upload</span>
            </>
          )}
        </button>
      </form>

      <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
        Max 10 MB. Allowed: PDF, PNG, JPG, JPEG, WebP, TXT, ZIP.
      </p>

      <div className="mt-3" role="status" aria-live="polite">
        {status.kind === "success" && (
          <p className="text-sm text-[var(--color-success,theme(colors.emerald.700))] flex items-center gap-1.5">
            <i className="bi bi-check-circle" aria-hidden="true" />
            <span>Uploaded {status.filename}. Refresh to see it in the list.</span>
          </p>
        )}
        {status.kind === "error" && (
          <p className="text-sm text-[var(--color-danger,theme(colors.red.700))] flex items-center gap-1.5">
            <i className="bi bi-exclamation-triangle" aria-hidden="true" />
            <span>{status.message}</span>
          </p>
        )}
      </div>
    </section>
  );
}
