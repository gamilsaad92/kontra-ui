import { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getOrgId } from "../../lib/orgContext";

const orgOptionalRoutes = ["/organizations"];

export default function RequireOrg({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const orgId = getOrgId();

  if (orgOptionalRoutes.some((path) => location.pathname.startsWith(path))) {
    return <>{children ?? <Outlet />}</>;
  }

  if (!orgId) {
    return <Navigate to="/organizations" replace state={{ message: "Select an organization to continue" }} />;
  }

  return <>{children ?? <Outlet />}</>;
}
