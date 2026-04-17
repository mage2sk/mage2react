/**
 * FocusTrap — keeps keyboard focus inside a modal/drawer while active.
 *
 * Integration (coordinator):
 *   // Used by any modal/drawer island. Example in a drawer:
 *   //   <FocusTrap active={open}><div role="dialog" aria-modal="true">...</div></FocusTrap>
 *
 * Behaviour:
 *   - When `active` flips true, the previously focused element is remembered
 *     and focus moves to `initialFocus` (or the first focusable descendant).
 *   - `Tab` / `Shift+Tab` cycle within the trap (wrap around).
 *   - When `active` flips false, focus returns to `returnFocus` (if provided)
 *     or the element that was focused prior to activation.
 *   - While inactive the component is a no-op — it will NOT steal focus from
 *     elements outside the trap.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    // Skip elements that are not rendered.
    const rects = el.getClientRects();
    return rects.length > 0;
  });
}

export interface FocusTrapProps {
  active: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Hook form — trap focus inside `containerRef` while `active` is true.
 * Exposed for callers that prefer wiring it to an existing wrapper element.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: {
    active: boolean;
    initialFocus?: RefObject<HTMLElement | null>;
    returnFocus?: RefObject<HTMLElement | null>;
  },
): void {
  const { active, initialFocus, returnFocus } = options;
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;

    const initial = initialFocus?.current ?? getFocusable(container)[0] ?? container;
    // Ensure container can receive focus as a last resort.
    if (initial === container && !container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    initial.focus();

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = getFocusable(container as HTMLElement);
      if (focusable.length === 0) {
        event.preventDefault();
        (container as HTMLElement).focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeEl === first || !container!.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last || !container!.contains(activeEl)) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const target = returnFocus?.current ?? previouslyFocused.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    };
  }, [active, containerRef, initialFocus, returnFocus]);
}

export default function FocusTrap({
  active,
  initialFocus,
  returnFocus,
  children,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(containerRef, { active, initialFocus, returnFocus });

  // Optional safety net: intercept Tab on the wrapper when active so focus
  // cannot escape even if the document-level listener is paused.
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!active || event.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const activeEl = document.activeElement as HTMLElement | null;
      if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [active],
  );

  return (
    <div ref={containerRef} onKeyDown={onKeyDown} data-focus-trap={active ? "active" : "inactive"}>
      {children}
    </div>
  );
}
