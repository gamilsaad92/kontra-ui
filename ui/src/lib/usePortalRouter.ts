/**
 * usePortalRouter — Authentication vs Authorization separation.
 *
 * Authentication = Supabase session (who you are).
 * Authorization  = app_role in JWT claims (what portal you enter).
 *
 * Routing rules after login:
 *   ALL roles → /dashboard  (unified CRE workspace & marketplace hub)
 *
 * Advanced portals are still accessible via nav links:
 *   /investor/*    Investor portal
 *   /borrower/*    Borrower portal
 *   /servicer/*    Servicer portal
 *   /lender-tools/* Full lender platform (portfolio, markets, compliance)
 */

import { useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "./authContext";

// ── Types ──────────────────────────────────────────────────────
type AppRole =
  | "platform_admin"
  | "lender_admin"
  | "lender"
  | "servicer"
  | "asset_manager"
  | "investor"
  | "borrower"
  | "member";

// ── Public path prefixes (never redirect away from these) ───────
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/select-portal",
  "/properties",
  "/service-providers",
  "/pricing",
  "/waitlist",
  "/admin",
];

// ── Helpers ────────────────────────────────────────────────────

/** Decode JWT payload without verifying signature (Supabase already verified it). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Extract app_role from JWT custom claims. */
export function getAppRoleFromToken(accessToken: string | null | undefined): AppRole {
  if (!accessToken) return "member";
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return "member";
  const role =
    (payload?.app_metadata as Record<string, string>)?.app_role ??
    (payload?.user_metadata as Record<string, string>)?.app_role ??
    null;
  return (role as AppRole) ?? "member";
}

/**
 * Returns the unified dashboard path for any role.
 * All users land on /dashboard after login — the CRE marketplace hub.
 * Advanced portals are accessible from the dashboard via navigation.
 */
export function getPortalPath(_role?: AppRole | string): string {
  return "/dashboard";
}

/**
 * Returns the "home" link destination for the currently signed-in user.
 */
export function usePortalHome(): string {
  return "/dashboard";
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Mount once inside AuthedApp (inside Router context).
 * Fires when authenticated user lands on bare "/" — redirects to /dashboard.
 */
export function usePortalRouter(): void {
  const { session } = useContext(AuthContext) as { session: { access_token?: string } | null };
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;

    const pathname = location.pathname;

    // Only fire on the bare root
    if (pathname !== "/" && pathname !== "") return;

    // Never redirect from public routes
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;

    navigate("/dashboard", { replace: true });
  }, [session?.access_token, location.pathname, navigate]);
}
