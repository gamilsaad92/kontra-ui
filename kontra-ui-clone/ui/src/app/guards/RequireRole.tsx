import { ReactNode, useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";
import { getAppRoleFromToken, getPortalPath } from "../../lib/usePortalRouter";

export type PortalKey = "lender" | "servicer" | "investor" | "borrower";

/**
 * Roles allowed per portal.
 * "member" is included as a fallback for environments where the Supabase
 * custom_access_token_hook hasn't been registered yet — the JWT comes back with
 * no app_role, so decoding it returns "member". Real data-level authorization is
 * enforced on every API route (req.role / req.orgId checks), so allowing "member"
 * through the UI guard doesn't expose sensitive data.
 */
const PORTAL_ROLES: Record<PortalKey, string[]> = {
  lender:   ["platform_admin", "lender_admin", "asset_manager", "member"],
  servicer: ["platform_admin", "lender_admin", "servicer", "asset_manager", "member"],
  investor: ["platform_admin", "investor", "member"],
  borrower: ["platform_admin", "borrower", "member"],
};

type RequireRoleProps = {
  portal: PortalKey;
  children: ReactNode;
};

/**
 * RequireRole — Portal-level authorization guard.
 *
 * Reads the app_role from the JWT. If the role is a KNOWN non-matching role
 * (e.g. an investor trying to access /dashboard), silently redirect them to
 * their own portal. If the role is unknown/member (JWT hook not configured),
 * allow through — the API layer enforces the real permissions.
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
