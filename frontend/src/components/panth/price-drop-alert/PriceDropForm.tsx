import { useCallback, useEffect, useId, useState } from "react";

/**
 * PriceDropForm.tsx — `client:idle` React 19 island.
 *
 * Compact "notify me when price drops" form for a PDP. Optional target-price
 * input lets the customer subscribe for "drops to X or lower" rather than
 * any drop.
 *
 * UX:
 *   - Email pre-fills from `/api/customer/me` when the customer is logged
 *     in.
 *   - Submission goes to the same-origin server endpoint
 *     `/api/panth/price-drop` which re-validates and rate-limits before
 *     forwarding to Magento.
 *   - Target price is constrained to non-negative numbers below the current
 *     price (when `currentPrice` is provided).
 */

interface Props {
  sku: string;
  currency?: string;
  currentPrice?: number | null;
  label?: string;
}

interface Status {
  kind: "idle" | "submitting" | "success" | "error";
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function formatPriceHint(currency: string | undefined, currentPrice: number | null | undefined): string {
  if (!currentPrice || !Number.isFinite(currentPrice) || currentPrice <= 0) return "";
  const cur = (currency ?? "USD").toUpperCase();
  try {
    const fmt = new Intl.NumberFormat(undefined, { style: "currency", currency: cur });
    return `Current price: ${fmt.format(currentPrice)}`;
  } catch {
    return `Current price: ${currentPrice.toFixed(2)} ${cur}`;
  }
}

export default function PriceDropForm({ sku, currency, currentPrice, label = "Notify me when the price drops" }: Props): JSX.Element {
  const emailId = useId();
  const targetId = useId();
  const [email, setEmail] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [status, setStatus] = useState<Status>({ kind: "idle", message: "" });

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch("/api/customer/me", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { authenticated?: boolean; email?: string };
        if (cancelled) return;
        if (data.authenticated && typeof data.email === "string" && EMAIL_RE.test(data.email)) {
          setEmail(data.email);
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>): Promise<void> => {
      ev.preventDefault();
      const trimmed = email.trim().toLowerCase();
      if (!EMAIL_RE.test(trimmed)) {
        setStatus({ kind: "error", message: "Please enter a valid email address." });
        return;
      }
      let targetPrice: number | null = null;
      if (target.trim().length > 0) {
        const n = Number.parseFloat(target);
        if (!Number.isFinite(n) || n <= 0) {
          setStatus({ kind: "error", message: "Enter a positive target price, or leave it blank." });
          return;
        }
        if (typeof currentPrice === "number" && Number.isFinite(currentPrice) && n >= currentPrice) {
          setStatus({
            kind: "error",
            message: "Target price must be lower than the current price.",
          });
          return;
        }
        targetPrice = Math.round(n * 100) / 100;
      }

      setStatus({ kind: "submitting", message: "Saving..." });
      try {
        const res = await fetch("/api/panth/price-drop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ sku, email: trimmed, target_price: targetPrice }),
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; message?: string }
          | null;
        if (!res.ok || !body) {
          setStatus({
            kind: "error",
            message: (body && body.message) || "We could not save that. Please try again.",
          });
          return;
        }
        if (body.ok === true) {
          setStatus({
            kind: "success",
            message: body.message || "We will email you when the price drops.",
          });
        } else {
          setStatus({
            kind: "error",
            message: body.message || "We could not save that. Please try again.",
          });
        }
      } catch {
        setStatus({ kind: "error", message: "Network error. Please try again." });
      }
    },
    [email, target, sku, currentPrice],
  );

  const submitting = status.kind === "submitting";
  const done = status.kind === "success";
  const hint = formatPriceHint(currency, currentPrice ?? null);

  return (
    <section
      aria-label="Price drop notification"
      className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor" className="text-[var(--color-brand)]">
          <path d="M21 11.5V4a1 1 0 0 0-1-1h-7.5a1 1 0 0 0-.7.3L3 11.6a1 1 0 0 0 0 1.4l8 8a1 1 0 0 0 1.4 0l8.3-8.4a1 1 0 0 0 .3-.7zM7 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
        </svg>
        <p className="text-sm font-medium text-[var(--color-fg)]">{label}</p>
      </div>

      {hint && <p className="text-xs text-[var(--color-fg-muted)]">{hint}</p>}

      {!done ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={emailId} className="sr-only">
              Email address
            </label>
            <input
              id={emailId}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={254}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              disabled={submitting}
              className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            />
            <label htmlFor={targetId} className="sr-only">
              Target price (optional)
            </label>
            <input
              id={targetId}
              type="number"
              name="target_price"
              step="0.01"
              min="0"
              placeholder="Target price (optional)"
              value={target}
              onChange={(e) => setTarget(e.currentTarget.value)}
              disabled={submitting}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] sm:w-40"
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            >
              {submitting ? "Saving..." : "Notify me"}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-[var(--color-success,theme(colors.emerald.700))]">
          {status.message}
        </p>
      )}

      <p
        role="status"
        aria-live="polite"
        className={
          status.kind === "error"
            ? "text-sm text-[var(--color-danger,theme(colors.red.700))]"
            : "sr-only"
        }
      >
        {status.kind === "error" ? status.message : ""}
      </p>
    </section>
  );
}
