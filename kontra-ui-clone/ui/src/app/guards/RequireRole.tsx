import { ReactNode, useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";
import { getAppRoleFromToken, getPortalPath } from "../../lib/usePortalRouter";

export type PortalKey = "lender" | "servicer" | "investor" | "borrower";

const PORTAL_ROLES: Record<PortalKey, string[]> = {
  lender:   ["platform_admin", "lender_admin", "asset_manager"],
  servicer: ["platform_admin", "lender_admin", "servicer", "asset_manager"],
  investor: ["platform_admin", "investor"],
  borrower: ["platform_admin", "borrower"],
};

type RequireRoleProps = {
  portal: PortalKey;
  children: ReactNode;
};

/**
 * RequireRole — Portal-level authorization guard.
 *
 * Sits inside RequireAuth. Reads the app_role from the JWT custom claims
 * (injected by custom_access_token_hook in Supabase) and enforces that the
 * signed-in user is permitted to access this specific portal.
 *
 * If their role doesn't match, they are redirected silently to their own portal
 * rather than shown an error — keeps the UX clean.
 */
export default function RequireRole({ portal, children }: RequireRoleProps) {
  const { session } = useContext(AuthContext) as {
    session: { access_token?: string } | null;
  };

  const role = getAppRoleFromToken(session?.access_token);
  const allowed = PORTAL_ROLES[portal];

  if (!allowed.includes(role)) {
    const correctPath = getPortalPath(role);
    return <Navigate to={correctPath} replace />;
  }

  return <>{children}</>;
}
