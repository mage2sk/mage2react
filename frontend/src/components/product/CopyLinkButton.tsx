/**
 * CopyLinkButton — a tiny React island rendered beside the social share row
 * on PDPs. Clicking copies the canonical PDP URL to the clipboard and flashes
 * a "Copied!" affordance for 1.5s.
 *
 * Hydration: `client:visible`. It doesn't need to hydrate until the share row
 * is scrolled into view.
 *
 * Graceful fallback: some embedded browsers (older Safari, locked-down iframes)
 * do not expose `navigator.clipboard.writeText`. We fall back to selecting the
 * URL in a temporarily-injected hidden input and invoking `document.execCommand("copy")`
 * — deprecated but still supported everywhere the modern API is missing.
 */
import { useRef, useState } from "react";

type Props = { url: string };

type Phase = "idle" | "copied" | "error";

function fallbackCopy(url: string): boolean {
  try {
    const input = document.createElement("input");
    input.value = url;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.top = "-1000px";
    input.style.left = "-1000px";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.focus();
    input.select();
    input.setSelectionRange(0, url.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(input);
    return ok;
  } catch {
    return false;
  }
}

export default function CopyLinkButton({ url }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timerRef = useRef<number | null>(null);

  function schedule(next: Phase, resetAfterMs: number) {
    setPhase(next);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setPhase("idle");
      timerRef.current = null;
    }, resetAfterMs);
  }

  async function onClick() {
    // Prefer the async Clipboard API where available (requires a secure context
    // AND user activation — both satisfied by a click handler on HTTPS pages).
    const hasAsyncClipboard =
      typeof navigator !== "undefined" &&
      typeof navigator.clipboard !== "undefined" &&
      typeof navigator.clipboard.writeText === "function";

    if (hasAsyncClipboard) {
      try {
        await navigator.clipboard.writeText(url);
        schedule("copied", 1500);
        return;
      } catch {
        // Permission denied or transient failure — fall through to legacy path.
      }
    }

    const ok = fallbackCopy(url);
    schedule(ok ? "copied" : "error", 1500);
  }

  const label =
    phase === "copied"
      ? "Copied \u2713"
      : phase === "error"
        ? "Copy failed"
        : "Copy link";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copy product link to clipboard"
      aria-live="polite"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
      title={label}
    >
      {phase === "copied" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
