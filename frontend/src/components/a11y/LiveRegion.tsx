/**
 * LiveRegion — polite/assertive screen-reader announcements.
 *
 * Mount one LiveRegion near the root of the app (typically inside a layout
 * island) to get SR announcements for async events like "Added to cart",
 * "Form validation error", etc.
 *
 * Two ways to use:
 *   1. Controlled: render <LiveRegion message={msg} level="polite" /> and
 *      update `message` to trigger an announcement.
 *   2. Imperative: call `announce("Added to cart")` from anywhere. This uses
 *      the singleton LiveRegion instance that registered itself on mount.
 */
import { useEffect, useRef, useState } from "react";

type Level = "polite" | "assertive";

type Announcer = (message: string, level?: Level) => void;

let activeAnnouncer: Announcer | null = null;

/**
 * Send a message to the currently mounted LiveRegion singleton.
 * Silent no-op when no LiveRegion is mounted.
 */
export function announce(message: string, level: Level = "polite"): void {
  if (activeAnnouncer) activeAnnouncer(message, level);
}

export interface LiveRegionProps {
  /** Current message. Empty string clears the region. */
  message?: string;
  /** Urgency. Default `polite`. */
  level?: Level;
}

export default function LiveRegion({ message = "", level = "polite" }: LiveRegionProps) {
  const [politeText, setPoliteText] = useState("");
  const [assertiveText, setAssertiveText] = useState("");
  const politeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assertiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reflect the controlled `message` prop.
  useEffect(() => {
    if (!message) return;
    if (level === "assertive") {
      setAssertiveText(message);
    } else {
      setPoliteText(message);
    }
  }, [message, level]);

  // Register as the process-wide announcer.
  useEffect(() => {
    const announcer: Announcer = (msg, lvl = "polite") => {
      if (!msg) return;
      if (lvl === "assertive") {
        // Clear then set so SR re-announces identical strings.
        setAssertiveText("");
        if (assertiveTimer.current) clearTimeout(assertiveTimer.current);
        assertiveTimer.current = setTimeout(() => setAssertiveText(msg), 20);
      } else {
        setPoliteText("");
        if (politeTimer.current) clearTimeout(politeTimer.current);
        politeTimer.current = setTimeout(() => setPoliteText(msg), 20);
      }
    };
    activeAnnouncer = announcer;
    return () => {
      if (activeAnnouncer === announcer) activeAnnouncer = null;
      if (politeTimer.current) clearTimeout(politeTimer.current);
      if (assertiveTimer.current) clearTimeout(assertiveTimer.current);
    };
  }, []);

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeText}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveText}
      </div>
    </>
  );
}
