import type { ReactNode } from "react";

type DataStateProps = {
  isLoading: boolean;
  isError: boolean;
  error?: string | null;
  isEmpty: boolean;
  emptyTitle?: string;
  emptyCta?: ReactNode;
  children: ReactNode;
};

export default function DataState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyTitle = "No data yet.",
  emptyCta,
  children,
}: DataStateProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {isError ? (
        <p className="text-sm text-rose-600">{error || "Unable to load data."}</p>
      ) : null}
      {!isLoading && !isError && isEmpty ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{emptyTitle}</p>
          {emptyCta}
        </div>
      ) : null}
      {!isLoading && !isError && !isEmpty ? children : null}
    </div>
  );
}
