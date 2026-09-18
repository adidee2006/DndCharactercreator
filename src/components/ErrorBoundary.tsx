import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, any uncaught render error (e.g. a malformed field from a
 * hand-edited custom compendium import) unmounts the entire React tree and
 * leaves a blank page with no way back except clearing site data blind.
 * This keeps the header/nav alive and offers the two most likely fixes.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card mx-auto mt-10 max-w-xl p-6">
          <h2 className="mb-2 text-lg font-bold text-red-700 dark:text-red-400">Something went wrong</h2>
          <p className="mb-3 text-sm text-stone-500">
            This page hit an error and couldn't render. This usually happens when a custom/homebrew compendium entry
            is missing a field the app expected, or a character was saved with unexpected data.
          </p>
          <pre className="mb-4 max-h-32 overflow-auto rounded bg-stone-100 p-2 text-xs text-stone-500 dark:bg-stone-800">
            {this.state.error.message}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => this.setState({ error: null })}>
              Try Again
            </button>
            <a className="btn-secondary" href="#/compendium">
              Go to Compendium (fix/clear custom data)
            </a>
            <a className="btn-ghost" href="#/">
              Go Home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
