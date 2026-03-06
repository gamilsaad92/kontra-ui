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
  const { orgId, isLoading, error, warning, retryInitialization } = useOrg();

  // 1) Never require org for these routes
  if (orgOptionalRoutes.some((path) => location.pathname.startsWith(path))) {
    return <>{children ?? <Outlet />}</>;
  }

  // 2) Do not block route rendering for org bootstrap states
  if (isLoading || error || warning) {
    if (error) {
      console.warn("[bootstrap] organization context warning", error);
    }
    if (warning) {
      console.info("[bootstrap] organization context warning", warning);
    }
    return <>{children ?? <Outlet />}</>;
 }
  
// 3) Finished loading, but no org selected/found -> redirect to org picker
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
