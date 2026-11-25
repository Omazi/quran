import { useEffect } from 'react';

import { getActiveDiagnostics } from './active';
import { ErrorFallback } from './error-fallback';

/**
 * The `ErrorBoundary` a layout exports for expo-router: it catches an error of the layout itself
 * (the `DiagnosticBoundary` inside it catches those of its screens). expo-router gives it the
 * error and `retry`, no component stack.
 */
export function RouteErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => void | Promise<void>;
}) {
  useEffect(() => {
    try {
      getActiveDiagnostics()?.recordBoundaryError(error, null);
    } catch {
      // Recording must not turn one error into two.
    }
  }, [error]);
  return <ErrorFallback error={error} retry={retry} />;
}
