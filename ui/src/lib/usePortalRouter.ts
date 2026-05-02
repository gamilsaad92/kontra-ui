/**
 * usePortalRouter — Authentication vs Authorization separation.
 *
 * Authentication = Supabase session (who you are).
 * Authorization  = app_role in JWT claims (what portal you enter).
 *
 * Routing rules after login:
 *   investor        → /investor
 *   borrower        → /borrower
 *   servicer        → /servicer/overview
 *   lender / lender_admin / asset_manager / platform_admin → /dashboard
 *   member/unknown  → /select-portal  (fallback — should not happen in demo)
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

/** Returns the correct home path for a given role. */
export function getPortalPath(role: AppRole | string): string {
  switch (role) {
    case "investor":
      return "/investor";
    case "borrower":
      return "/borrower";
    case "servicer":
      return "/servicer/overview";
    // All lender variants and admin roles go to the lender dashboard
    case "lender":
    case "lender_admin":
    case "asset_manager":
    case "platform_admin":
      return "/dashboard";
    default:
      return "/select-portal";
  }
}

/**
 * Returns the "home" link destination for the currently signed-in user.
 * Use this for logo/home nav links inside each portal.
 */
export function usePortalHome(): string {
  const { session } = useContext(AuthContext) as { session: { access_token?: string } | null };
  const role = getAppRoleFromToken(session?.access_token);
  return getPortalPath(role);
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Mount once inside AuthedApp (inside Router context).
 * Fires only when the user lands on bare "/" — redirects them to the
 * correct portal before any dashboard chrome loads.
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

    const role = getAppRoleFromToken(token);
    const target = getPortalPath(role);

    navigate(target, { replace: true });
  }, [session?.access_token, location.pathname, navigate]);
}
