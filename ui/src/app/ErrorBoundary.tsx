import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(err: any): State {
    return { hasError: true, message: err?.message || String(err) };
  }

  componentDidCatch(err: any) {
    console.error("Kontra crashed:", err);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-xl space-y-3 rounded-xl border border-rose-400/40 bg-rose-950/40 p-4">
          <p className="text-sm font-semibold">Kontra crashed</p>
          <p className="text-xs text-rose-200">{this.state.message}</p>
          <button
            className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }
}
