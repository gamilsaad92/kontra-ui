import { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useOrg } from "../org/OrgContext";

const orgOptionalRoutes = ["/organizations", "/settings"];

export default function RequireOrg({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { orgId, isLoading } = useOrg();

  if (orgOptionalRoutes.some((path) => location.pathname.startsWith(path))) {
    return <>{children ?? <Outlet />}</>;
  }

    if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm">Loading organization context…</p>
      </div>
    );
  }

  if (!orgId) {
   const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/organizations?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
