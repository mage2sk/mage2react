// ErrorBoundary — defensive wrapper for React islands in the Astro storefront.
//
// How to harden an existing island (WITHOUT editing the island):
//
//   import CartDrawer from "~/components/CartDrawer.tsx";
//   import { withErrorBoundary } from "~/components/system/ErrorBoundaryHOC.tsx";
//   const SafeCartDrawer = withErrorBoundary(CartDrawer);
//   <SafeCartDrawer client:idle />
//
// Or inline JSX inside an island's own parent page:
//   import ErrorBoundary from "~/components/system/ErrorBoundary.tsx";
//   <ErrorBoundary><CartDrawer client:idle /></ErrorBoundary>
//
// Loading state usage:
//   import LoadingState from "~/components/system/LoadingState.tsx";
//   import { SkeletonGrid } from "~/components/system/Skeleton.tsx";
//   <LoadingState loading={isLoading} skeleton={<SkeletonGrid count={4} />}>
//     <ProductList items={items} />
//   </LoadingState>

import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  /** Optional custom fallback UI. When omitted a minimal default alert is rendered. */
  fallback?: ReactNode;
  /** Optional hook so parents can report the error (telemetry, toast, etc.). */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * Optional reset key. When this value changes between renders the boundary
   * clears its error state, letting children attempt to render again.
   */
  resetKey?: string | number;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  lastResetKey: string | number | undefined;
}

function DefaultFallback(): ReactNode {
  const handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      className="rounded-md border border-zinc-200 bg-[var(--color-surface,theme(colors.white))] p-3 text-sm text-zinc-700"
    >
      <p className="mb-2">Something went wrong — refresh to try again.</p>
      <button
        type="button"
        onClick={handleReload}
        className="inline-flex items-center rounded-md bg-[var(--color-brand)] px-3 py-1 text-xs font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
      >
        Reload
      </button>
    </div>
  );
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      lastResetKey: props.resetKey,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(
    nextProps: ErrorBoundaryProps,
    prevState: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    // Reset the boundary when the caller's resetKey changes — lets parents
    // recover from an error by bumping the key instead of remounting.
    if (nextProps.resetKey !== prevState.lastResetKey) {
      return {
        hasError: false,
        error: null,
        lastResetKey: nextProps.resetKey,
      };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Tagged log so it's easy to grep in the browser console.
    // eslint-disable-next-line no-console
    console.error("[m2r:error-boundary]", error, info);
    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultFallback />;
    }
    return this.props.children;
  }
}
