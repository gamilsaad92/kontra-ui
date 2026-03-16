import React from "react";

type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
      super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    console.error("Kontra crashed:", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-xl space-y-3 rounded-xl border border-rose-400/40 bg-rose-950/40 p-4">
              <p className="text-sm font-semibold">Kontra hit an unexpected error</p>
          <p className="text-xs text-rose-200">{this.state.message || "Unknown runtime error"}</p>
          <button
            className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900"
           onClick={() => window.location.reload()}
          >
            Reload app
          </button>
       </div>
      </div>
    );
  }        
}

export default ErrorBoundary;    
