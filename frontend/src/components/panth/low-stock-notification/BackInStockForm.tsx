import { useCallback, useEffect, useId, useState } from "react";

/**
 * BackInStockForm.tsx — `client:idle` React 19 island.
 *
 * Renders a compact email-subscription form for a single product. Meant to
 * be mounted on the PDP **only** when `stock_status !== 'IN_STOCK'`.
 *
 * UX:
 *   - Email is pre-filled with the signed-in customer's email via a best-
 *     effort fetch to `/api/customer/me` (the HttpOnly token cookie stays
 *     on the server).
 *   - On submit, POSTs through the same-origin `/api/graphql` proxy using
 *     the shared rate-limited route; the upstream mutation is
 *     `panthLowStockSubscribe`.
 *   - Disables the button while submitting and surfaces a polite status
 *     message.
 */

interface Props {
  sku: string;
  label?: string;
}

interface Status {
  kind: "idle" | "submitting" | "success" | "error";
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const MUTATION = /* GraphQL */ `
  mutation PanthLowStockSubscribe($input: PanthLowStockSubscribeInput!) {
    panthLowStockSubscribe(input: $input) {
      ok
      message
    }
  }
`;

interface MutationResult {
  data?: {
    panthLowStockSubscribe?: {
      ok?: boolean | null;
      message?: string | null;
    } | null;
  };
  errors?: Array<{ message?: string }> | null;
}

export default function BackInStockForm({ sku, label = "Email me when it's back" }: Props): JSX.Element {
  const inputId = useId();
  const [email, setEmail] = useState<string>("");
  const [status, setStatus] = useState<Status>({ kind: "idle", message: "" });

  // Best-effort pre-fill from the signed-in customer's session.
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
      setStatus({ kind: "submitting", message: "Saving..." });
      try {
        const res = await fetch("/api/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            query: MUTATION,
            variables: { input: { sku, email: trimmed } },
          }),
        });
        const body = (await res.json().catch(() => null)) as MutationResult | null;
        if (!res.ok || !body) {
          setStatus({ kind: "error", message: "We could not save that. Please try again." });
          return;
        }
        if (body.errors && body.errors.length > 0) {
          const firstMsg = body.errors[0]?.message ?? "";
          if (/Cannot query field|Unknown type|not exist/i.test(firstMsg)) {
            setStatus({
              kind: "error",
              message: "Back-in-stock alerts are not available right now.",
            });
            return;
          }
          setStatus({ kind: "error", message: "We could not save that. Please try again." });
          return;
        }
        const res2 = body.data?.panthLowStockSubscribe;
        if (res2?.ok === true) {
          setStatus({
            kind: "success",
            message: res2.message?.trim() || "We will email you when this is back in stock.",
          });
        } else {
          setStatus({
            kind: "error",
            message: res2?.message?.trim() || "We could not save that. Please try again.",
          });
        }
      } catch {
        setStatus({ kind: "error", message: "Network error. Please try again." });
      }
    },
    [email, sku],
  );

  const submitting = status.kind === "submitting";
  const done = status.kind === "success";

  return (
    <section
      aria-label="Notify me when back in stock"
      className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor" className="text-[var(--color-brand)]">
          <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        <p className="text-sm font-medium text-[var(--color-fg)]">{label}</p>
      </div>

      {!done ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={inputId} className="sr-only">
            Email address
          </label>
          <input
            id={inputId}
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
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          >
            {submitting ? "Saving..." : "Notify me"}
          </button>
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
