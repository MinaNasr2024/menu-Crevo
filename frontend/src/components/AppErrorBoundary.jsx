import { Component } from 'react';

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // Keep the error visible in dev and in the browser console.
    // This prevents a full white screen when a route crashes at runtime.
    console.error('AppErrorBoundary caught an error:', error);
  }

  render() {
    try {
      if (typeof window !== 'undefined') {
        window.__crevoErrorBoundaryRendered = true;
      }
    } catch {
      // Ignore debug failures.
    }

    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
          <div className="max-w-2xl rounded-3xl border border-rose-200 bg-white p-6 shadow-xl">
            <div className="text-sm font-semibold text-rose-600">Application error</div>
            <h1 className="mt-2 text-2xl font-bold">The dashboard failed to render</h1>
            <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              {String(this.state.error?.message ?? this.state.error ?? 'Unknown error')}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
