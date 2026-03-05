import { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useOrg } from "../org/OrgContext";

const orgOptionalRoutes = [
  "/login",
  "/signup",
  "/organizations",
  "/settings",
];

export default function RequireOrg({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { orgId, isLoading, error, retryInitialization } = useOrg();

  // 1) Never require org for these routes
  if (orgOptionalRoutes.some((path) => location.pathname.startsWith(path))) {
    return <>{children ?? <Outlet />}</>;
  }

  // 2) While org context is initializing
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
        <p className="text-sm">Loading organization context…</p>
      </div>
    );
  }

  // 3) If org init failed, do NOT brick the app — offer retry + escape hatch
  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900" role="alert">
        <p className="text-sm font-medium">{error}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600"
            onClick={() => void retryInitialization()}
          >
            Retry
          </button>

          <button
            type="button"
            className="rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100"
            onClick={() => (window.location.href = "/organizations")}
          >
            Choose organization
          </button>
        </div>
      </div>
    );
  }

  // 4) Finished loading, but no org selected/found -> redirect to org picker
  if (!orgId) {
    return (
      <Navigate
        to="/organizations"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // 5) Org exists -> allow
  return <>{children ?? <Outlet />}</>;
}
