// SafeIsland — one-liner hardening for any React island.
//
// Wraps children with both an ErrorBoundary (catches thrown render errors)
// and React.Suspense (handles components that throw promises, e.g. lazy /
// `use(...)` data fetches). This gives any island a friendly fallback for
// both runtime errors AND loading states without touching the island itself.
//
// Usage:
//   import SafeIsland from "~/components/system/SafeIsland.tsx";
//   <SafeIsland><RecentlyViewed client:idle /></SafeIsland>
//
// Custom fallbacks:
//   <SafeIsland
//     errorFallback={<p>Cart unavailable.</p>}
//     loadingFallback={<SkeletonGrid count={3} />}
//   >
//     <CartDrawer client:idle />
//   </SafeIsland>

import { Suspense, type ReactNode } from "react";
import ErrorBoundary from "./ErrorBoundary.tsx";
import { Skeleton } from "./Skeleton.tsx";

export interface SafeIslandProps {
  /** Rendered when the inner tree throws. */
  errorFallback?: ReactNode;
  /** Rendered while a suspended child resolves. */
  loadingFallback?: ReactNode;
  /** Optional hook into caught errors. */
  onError?: (error: Error, info: { componentStack?: string | null }) => void;
  /** Optional resetKey forwarded to the internal ErrorBoundary. */
  resetKey?: string | number;
  children: ReactNode;
}

function DefaultLoadingFallback(): ReactNode {
  return (
    <div aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-6 w-full" />
    </div>
  );
}

export default function SafeIsland({
  errorFallback,
  loadingFallback,
  onError,
  resetKey,
  children,
}: SafeIslandProps): ReactNode {
  return (
    <ErrorBoundary
      fallback={errorFallback}
      onError={onError}
      resetKey={resetKey}
    >
      <Suspense fallback={loadingFallback ?? <DefaultLoadingFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
