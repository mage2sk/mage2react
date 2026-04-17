/**
 * <ToolbarSelects/> — tiny React island that wires the sort + page-size
 * <select> elements to navigate on change.
 *
 * We ship this as a client:idle island (target ~1.5 KB gzipped). The <select>
 * elements themselves are rendered by the parent Astro component with pre-built
 * `data-href-*` attributes so the component is essentially a thin glue layer.
 *
 * No external libs, no state — just event listeners. Works with Astro's
 * ClientRouter because we use `location.assign(href)` rather than intercepting
 * the navigation.
 */

import { useEffect, useRef } from "react";

export interface ToolbarSelectsProps {
  /** IDs of the <select> elements to bind. */
  sortId: string;
  pageSizeId: string;
}

/**
 * Each <option> in the bound <select>s has a `data-href` attribute with the
 * URL to navigate to when chosen. On change we read that value and assign it
 * to `window.location`.
 */
export default function ToolbarSelects({ sortId, pageSizeId }: ToolbarSelectsProps) {
  const ids = useRef<[string, string]>([sortId, pageSizeId]);

  useEffect(() => {
    const [sid, psid] = ids.current;
    const nodes: HTMLSelectElement[] = [];
    for (const id of [sid, psid]) {
      const el = document.getElementById(id);
      if (el instanceof HTMLSelectElement) nodes.push(el);
    }

    const handler = (ev: Event) => {
      const target = ev.currentTarget as HTMLSelectElement | null;
      if (!target) return;
      const chosen = target.options[target.selectedIndex];
      const href = chosen?.dataset.href;
      if (href) window.location.assign(href);
    };

    for (const el of nodes) el.addEventListener("change", handler);
    return () => {
      for (const el of nodes) el.removeEventListener("change", handler);
    };
  }, []);

  return null;
}
