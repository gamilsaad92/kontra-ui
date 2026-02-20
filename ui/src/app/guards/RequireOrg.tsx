import { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useOrg } from "../org/OrgContext";

const orgOptionalRoutes = ["/organizations", "/settings"];

export default function RequireOrg({ children }: { children?: ReactNode }) {
  const location = useLocation();
 const { orgId, isLoading, error, retryInitialization } = useOrg();

  if (orgOptionalRoutes.some((path) => location.pathname.startsWith(path))) {
    return <>{children ?? <Outlet />}</>;
  }

     if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
        <p className="text-sm">Loading organization context…</p>
      </div>
    );
  }

    if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900" role="alert">
        <p className="text-sm font-medium">{error}</p>
        <button
          type="button"
          className="rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600"
          onClick={() => void retryInitialization()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!orgId) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/organizations?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
