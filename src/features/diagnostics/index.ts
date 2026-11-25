/**
 * Diagnostics of a closure the owner cannot explain (no crash log reaches this project): an error
 * screen instead of a closed app on a render error, a record of the last fatal JavaScript error
 * with a trail of what the person did, one sheet at the next launch, and a row in the settings.
 * See diagnostics.ts, and docs/BUILD.md ("Diagnostic d'une fermeture").
 */

export { noteGestureStart } from './active';
export { ClosureSheet } from './closure-sheet';
export { DiagnosticBoundary } from './diagnostic-boundary';
export { DiagnosticsSection } from './diagnostics-section';
export { RouteErrorBoundary as ErrorBoundary } from './route-error-boundary';
export { startDiagnostics } from './start-diagnostics';
export { DiagnosticsProvider } from './use-diagnostics';
export { useRouteBreadcrumbs } from './use-route-breadcrumbs';
