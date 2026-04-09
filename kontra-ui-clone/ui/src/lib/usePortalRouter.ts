/**
 * usePortalRouter — Role-based redirect after login.
 *
 * Reads the effective app_role from the Supabase JWT (injected by the
 * custom_access_token_hook) and redirects the user to their portal.
 * Only fires when the user is at "/" or a genuinely wrong portal root.
 *
 * Role → Portal mapping:
 *   platform_admin | lender_admin | servicer | asset_manager → /dashboard
 *   investor  → /investor
 *   borrower  → /borrower
 */

import { useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "./authContext";

// ── Types ─────────────────────────────────────────────────────
type AppRole =
  | "platform_admin"
  | "lender_admin"
  | "servicer"
  | "asset_manager"
  | "investor"
  | "borrower"
  | "member";

type PortalPath = "/dashboard" | "/investor" | "/borrower";

// ── Constants ─────────────────────────────────────────────────
const ROLE_TO_PORTAL: Record<AppRole, PortalPath> = {
  platform_admin: "/dashboard",
  lender_admin:   "/dashboard",
  servicer:       "/dashboard",
  asset_manager:  "/dashboard",
  investor:       "/investor",
  borrower:       "/borrower",
  member:         "/dashboard",
};

// Paths that belong to each portal — used to detect mismatches
const LENDER_PATH_PREFIXES = [
  "/dashboard", "/portfolio", "/servicing", "/governance",
  "/markets", "/onchain", "/analytics", "/reports",
  "/workflow", "/settings",
];
const INVESTOR_PATH_PREFIXES = ["/investor"];
const BORROWER_PATH_PREFIXES = ["/borrower"];
const PUBLIC_PATH_PREFIXES   = ["/login", "/signup", "/forgot-password", "/reset-password"];

// ── Helpers ───────────────────────────────────────────────────

/** Decode the JWT payload without verifying signature (Supabase already verified it) */
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

/** Extract the Kontra app_role from JWT custom claims */
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

/** Extract portal from JWT claims (pre-computed by hook) */
export function getPortalFromToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;
  return (payload?.app_metadata as Record<string, string>)?.portal ?? null;
}

/** Derive the correct dashboard path for a given role */
export function getPortalPath(role: AppRole): PortalPath {
  return ROLE_TO_PORTAL[role] ?? "/dashboard";
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

function isOnCorrectPortal(role: AppRole, pathname: string): boolean {
  const target = getPortalPath(role);
  if (target === "/dashboard") {
    return LENDER_PATH_PREFIXES.some((p) => pathname.startsWith(p));
  }
  if (target === "/investor") {
    return INVESTOR_PATH_PREFIXES.some((p) => pathname.startsWith(p));
  }
  if (target === "/borrower") {
    return BORROWER_PATH_PREFIXES.some((p) => pathname.startsWith(p));
  }
  return false;
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Mount this once at the app root (inside Router + AuthContext).
 * It fires only when:
 *  1. The user is authenticated
 *  2. The current path is "/" (bare root, just after login)
 * For lender admins who deliberately open /investor or /borrower, we do NOT redirect.
 */
export function usePortalRouter(): void {
  const { session } = useContext(AuthContext) as { session: { access_token?: string } | null };
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;

    const pathname = location.pathname;

    // Never redirect on public routes
    if (isPublicPath(pathname)) return;

    // Only auto-redirect from the bare root "/"
    // Specific portal URLs (like /investor directly) are intentional.
    if (pathname !== "/" && pathname !== "") return;

    const role = getAppRoleFromToken(token);
    const target = getPortalPath(role);

    navigate(target, { replace: true });
  }, [session?.access_token, location.pathname, navigate]);
}

/**
 * Returns the correct home path for the currently authenticated user.
 * Use this for "go home" links across all portals.
 */
export function usePortalHome(): PortalPath {
  const { session } = useContext(AuthContext) as { session: { access_token?: string } | null };
  const role = getAppRoleFromToken(session?.access_token);
  return getPortalPath(role);
}
