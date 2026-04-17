// LoadingState — tri-state wrapper (loading / error / ready).
//
// Usage:
//   <LoadingState
//     loading={isLoading}
//     error={err}
//     skeleton={<SkeletonGrid count={4} />}
//     errorFallback={<p>Couldn't load products.</p>}
//   >
//     <ProductList items={items} />
//   </LoadingState>
//
// While `loading` is true the skeleton is rendered inside an aria-live
// polite region with a hidden "Loading" label so screen reader users are
// told the view is pending. When `error` is set the errorFallback (or a
// small default alert) is shown. Otherwise children render normally.

import type { ReactNode } from "react";

export interface LoadingStateProps {
  loading?: boolean;
  error?: Error | string | null;
  /** Skeleton markup to render while loading. */
  skeleton?: ReactNode;
  /** Fallback rendered on error. A minimal default is used if omitted. */
  errorFallback?: ReactNode;
  /** Accessible loading label announced to screen readers. */
  loadingLabel?: string;
  children: ReactNode;
}

function DefaultErrorFallback({ message }: { message: string }): ReactNode {
  return (
    <div
      role="alert"
      className="rounded-md border border-zinc-200 p-3 text-sm text-zinc-700"
    >
      {message}
    </div>
  );
}

export default function LoadingState({
  loading = false,
  error = null,
  skeleton,
  errorFallback,
  loadingLabel = "Loading",
  children,
}: LoadingStateProps): ReactNode {
  if (error) {
    const message =
      typeof error === "string"
        ? error
        : "Couldn't load this section. Please try again.";
    return errorFallback ?? <DefaultErrorFallback message={message} />;
  }

  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true">
        <span className="sr-only">{loadingLabel}</span>
        {skeleton}
      </div>
    );
  }

  return <>{children}</>;
}
