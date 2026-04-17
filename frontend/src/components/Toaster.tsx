import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { dismissToast, toasts, type ToastKind } from "~/lib/toast-store";

const kindStyles: Record<ToastKind, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-zinc-900 text-white",
  warning: "bg-amber-500 text-zinc-900",
};

const kindIcons: Record<ToastKind, JSX.Element> = {
  success: (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5M12 16v.01" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5M12 8v.01" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
      <path d="M12 10v4M12 18v.01" strokeLinecap="round" />
    </svg>
  ),
};

export default function Toaster() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const items = useStore(toasts);
  if (!hydrated || items.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[100] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${kindStyles[t.kind]}`}
        >
          {kindIcons[t.kind]}
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="rounded p-1 opacity-80 hover:opacity-100"
            aria-label="Dismiss"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
