/**
 * TabsKeyboardNav.tsx — tiny `client:idle` island that adds arrow-key navigation
 * to the `ProductTabs.astro` server-rendered tablist.
 *
 * The Astro parent owns the markup (tab buttons with `role="tab"`). This island
 * just attaches keyboard handlers to the container looked up via the host
 * element's `ownerDocument` — no `document.querySelector` in render.
 *
 * Keys:
 *   ← / ↑   focus previous tab
 *   → / ↓   focus next tab
 *   Home    focus first tab
 *   End     focus last tab
 */
import { useEffect, useRef } from "react";

interface Props {
  containerId: string;
}

export default function TabsKeyboardNav({ containerId }: Props): JSX.Element {
  const hostRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const doc = host.ownerDocument;
    const root = doc.getElementById(containerId);
    if (!root) return;

    const tabs = Array.from(
      root.querySelectorAll<HTMLElement>('[role="tab"]'),
    );
    if (tabs.length === 0) return;

    const focusAt = (idx: number): void => {
      const i = ((idx % tabs.length) + tabs.length) % tabs.length;
      const el = tabs[i];
      if (el) el.focus();
    };

    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const idx = tabs.indexOf(target);
      if (idx < 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        focusAt(idx + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        focusAt(idx - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        focusAt(0);
      } else if (e.key === "End") {
        e.preventDefault();
        focusAt(tabs.length - 1);
      }
    };

    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, [containerId]);

  return <span ref={hostRef} aria-hidden="true" className="sr-only" />;
}
