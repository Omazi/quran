import { Component, type ErrorInfo, type ReactNode } from 'react';

import { getActiveDiagnostics } from './active';
import { ErrorFallback } from './error-fallback';

interface State {
  error: Error | null;
  componentStack: string | null;
}

export interface DiagnosticBoundaryProps {
  children: ReactNode;
  language?: string;
}

/**
 * Catches the render errors of what is under it (a navigator and its screens), shows the error
 * screen in their place and keeps what it shows for the next launch. It is a class because React
 * gives the component stack to `componentDidCatch` only; the `ErrorBoundary` that expo-router
 * lets a layout export does not receive it. "Réessayer" renders the children again.
 */
export class DiagnosticBoundary extends Component<DiagnosticBoundaryProps, State> {
  override state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? null;
    this.setState({ componentStack });
    try {
      getActiveDiagnostics()?.recordBoundaryError(error, componentStack);
    } catch {
      // Recording must not turn one error into two.
    }
  }

  private readonly retry = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  override render(): ReactNode {
    const { error, componentStack } = this.state;
    if (error === null) return this.props.children;
    return (
      <ErrorFallback
        error={error}
        componentStack={componentStack}
        retry={this.retry}
        language={this.props.language}
      />
    );
  }
}
