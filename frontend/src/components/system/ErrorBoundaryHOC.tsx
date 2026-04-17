// withErrorBoundary — HOC so existing React islands can be hardened without
// editing their source. Import the island, wrap it, export/use the wrapped
// version as the Astro client component.

import type { ComponentType, ReactNode } from "react";
import ErrorBoundary from "./ErrorBoundary.tsx";

export function withErrorBoundary<TProps extends object>(
  WrappedComponent: ComponentType<TProps>,
  fallback?: ReactNode,
  onError?: (error: Error, info: { componentStack?: string | null }) => void,
): ComponentType<TProps> {
  const displayName =
    WrappedComponent.displayName ?? WrappedComponent.name ?? "Component";

  const Hardened = (props: TProps): ReactNode => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  Hardened.displayName = `withErrorBoundary(${displayName})`;
  return Hardened;
}

export default withErrorBoundary;
