// Skeleton — presentational shimmer placeholders for loading UI.
//
// All skeletons are aria-hidden so screen readers skip them. Parents should
// pair them with an aria-live "Loading …" announcement (see LoadingState).
// Styling uses Tailwind's built-in animate-pulse + zinc palette — no extra
// dependencies, no background motion libraries.

import type { CSSProperties, ReactNode } from "react";

export interface SkeletonProps {
  /** Tailwind utility classes to size/shape the skeleton. */
  className?: string;
  /** Escape hatch for inline styles (e.g. fixed widths from measured content). */
  style?: CSSProperties;
}

const BASE_CLASS = "animate-pulse rounded-md bg-zinc-200";

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/** Generic rounded pulse — size with className (e.g. "h-4 w-full"). */
export function Skeleton({ className, style }: SkeletonProps): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={cx(BASE_CLASS, className ?? "h-4 w-full")}
      style={style}
    />
  );
}

export interface SkeletonTextProps {
  /** Number of lines to render. Defaults to 3. */
  lines?: number;
  className?: string;
}

/** Multi-line text block skeleton. Last line is intentionally shorter. */
export function SkeletonText({
  lines = 3,
  className,
}: SkeletonTextProps): ReactNode {
  const count = Math.max(1, Math.floor(lines));
  return (
    <div aria-hidden="true" className={cx("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cx(
            BASE_CLASS,
            "h-3",
            i === count - 1 && count > 1 ? "w-2/3" : "w-full",
          )}
        />
      ))}
    </div>
  );
}

export interface SkeletonCardProps {
  className?: string;
}

/** Product-card shaped skeleton (image area + 2 text lines + price line). */
export function SkeletonCard({ className }: SkeletonCardProps): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "flex flex-col gap-3 rounded-lg border border-zinc-100 p-3",
        className,
      )}
    >
      <div className={cx(BASE_CLASS, "aspect-square w-full")} />
      <div className={cx(BASE_CLASS, "h-4 w-5/6")} />
      <div className={cx(BASE_CLASS, "h-3 w-2/3")} />
      <div className={cx(BASE_CLASS, "mt-1 h-4 w-1/3")} />
    </div>
  );
}

export interface SkeletonGridProps {
  /** Number of cards to render. Defaults to 8. */
  count?: number;
  /** Number of columns at md+ breakpoint. Defaults to 4. */
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}

// Static class map — Tailwind's JIT needs the full class name to appear in source.
const COL_CLASSES: Record<Required<SkeletonGridProps>["columns"], string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-6",
};

/** Grid of SkeletonCard — handy for PLP / category / recently-viewed. */
export function SkeletonGrid({
  count = 8,
  columns = 4,
  className,
}: SkeletonGridProps): ReactNode {
  const n = Math.max(1, Math.floor(count));
  return (
    <div
      aria-hidden="true"
      className={cx("grid gap-4", COL_CLASSES[columns], className)}
    >
      {Array.from({ length: n }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export interface SkeletonAvatarProps {
  /** Diameter token. Defaults to "md". */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const AVATAR_SIZE: Record<Required<SkeletonAvatarProps>["size"], string> = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

/** Circular avatar placeholder. */
export function SkeletonAvatar({
  size = "md",
  className,
}: SkeletonAvatarProps): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "animate-pulse rounded-full bg-zinc-200",
        AVATAR_SIZE[size],
        className,
      )}
    />
  );
}

export interface SkeletonButtonProps {
  className?: string;
}

/** Button-shaped skeleton — useful for CTA areas during hydration. */
export function SkeletonButton({ className }: SkeletonButtonProps): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={cx(BASE_CLASS, "h-10 w-28", className)}
    />
  );
}

export default Skeleton;
