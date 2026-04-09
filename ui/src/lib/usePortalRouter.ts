/**
 * usePortalRouter — Authentication vs Authorization separation.
 *
 * Authentication = Supabase session (who you are).
 * Authorization  = app_role in JWT claims (what portal you enter).
 *
 * Routing rules after login (bare "/" only):
 *   investor        → /investor          (direct, no selection screen)
 *   borrower        → /borrower          (direct, no selection screen)
 *   servicer        → /dashboard         (direct, single-purpose role)
 *   asset_manager   → /dashboard         (direct, single-purpose role)
 *   lender_admin    → /select-portal     (may want to review other portals)
 *   platform_admin  → /select-portal     (full access, must choose explicitly)
 *   member/unknown  → /select-portal     (show all options)
 *
 * Portal switching from inside any portal's sidebar is intentionally removed.
 * The only place to switch portals is /select-portal.
 */

import { useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "./authContext";

// ── Types ──────────────────────────────────────────────────────
type AppRole =
  | "platform_admin"
  | "lender_admin"
  | "servicer"
  | "asset_manager"
  | "investor"
  | "borrower"
  | "member";

// ── Public path prefixes (never redirect here) ─────────────────
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/select-portal",
];

// ── Helpers ────────────────────────────────────────────────────

/** Decode JWT payload without verifying signature (Supabase already verified it) */
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

/** Extract the Kontra app_role from JWT custom claims injected by custom_access_token_hook */
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

/** Returns the correct home path for a role */
export function getPortalPath(role: AppRole): string {
  switch (role) {
    case "investor":      return "/investor";
    case "borrower":      return "/borrower";
    case "servicer":      return "/dashboard";
    case "asset_manager": return "/dashboard";
    case "lender_admin":  return "/select-portal";
    case "platform_admin":return "/select-portal";
    default:              return "/select-portal";
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

    // Only fire on the bare root — all other paths are intentional
    if (pathname !== "/" && pathname !== "") return;

    // Never redirect from public routes
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;

    const role = getAppRoleFromToken(token);
    const target = getPortalPath(role);

    navigate(target, { replace: true });
  }, [session?.access_token, location.pathname, navigate]);
}
