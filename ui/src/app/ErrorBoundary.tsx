import React from "react";

type State = { hasError: boolean; message?: string };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error("[UI_ERROR]", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="mx-auto mt-20 max-w-xl rounded border bg-white p-6 text-slate-900 shadow">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">The page crashed. You can reload and continue.</p>
        {import.meta.env.DEV && this.state.message ? (
          <p className="mt-2 rounded bg-slate-100 p-2 font-mono text-xs">{this.state.message}</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a className="rounded border border-slate-300 px-3 py-2 text-sm" href="mailto:support@kontraui.com">
            Report issue
          </a>
        </div>
      </div>
    );
  }
}
