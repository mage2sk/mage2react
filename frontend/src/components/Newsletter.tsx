/**
 * Newsletter — footer subscribe widget.
 *
 * React island loaded at `client:idle`. POSTs the email to the server-side
 * `/api/newsletter/subscribe` endpoint, which proxies Magento's
 * `subscribeEmailToNewsletter` mutation and returns a status message.
 *
 * UX states:
 *   - idle        — form visible.
 *   - submitting  — button disabled, "Subscribing…" label.
 *   - success     — form replaced with a confirmation row.
 *   - error       — inline error below the input; form stays visible.
 *
 * Email is Zod-validated on the client before we hit the wire; the server
 * endpoint re-validates the body independently.
 */
import { useState, type FormEvent } from "react";
import { z } from "zod";

const EmailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

type ApiResponse = { ok: boolean; message?: string };

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) {
      setStatus("error");
      setMessage(parsed.error.issues[0]?.message ?? "Invalid email.");
      return;
    }
    setStatus("submitting");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parsed.data }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;
      if (response.ok && payload?.ok) {
        setStatus("success");
        setMessage(payload.message ?? "Thanks for subscribing!");
        return;
      }
      setStatus("error");
      setMessage(payload?.message ?? "Subscription failed. Please try again.");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span>{message}</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-describedby="newsletter-privacy">
      <label htmlFor="newsletter-email" className="mb-2 block text-sm font-semibold text-zinc-900">
        Sign Up for Our Newsletter
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="your@email.com"
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "newsletter-error" : undefined}
          disabled={status === "submitting"}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="shrink-0 rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
        >
          {status === "submitting" ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      {status === "error" && message && (
        <p id="newsletter-error" role="alert" className="mt-2 text-xs text-red-600">
          {message}
        </p>
      )}
      <p id="newsletter-privacy" className="mt-2 text-xs text-zinc-500">
        We'll never share your email. Unsubscribe anytime.
      </p>
    </form>
  );
}
