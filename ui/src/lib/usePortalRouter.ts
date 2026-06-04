/**
 * usePortalRouter — Authentication vs Authorization separation.
 *
 * After login, ALL users → /onboarding (if first time) or /workspace.
 * Legacy portals (/dashboard, /investor, /borrower, /servicer) remain
 * accessible and are linked from the Enterprise section of /workspace.
 */

import { useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "./authContext";

type AppRole =
  | "platform_admin"
  | "lender_admin"
  | "lender"
  | "servicer"
  | "asset_manager"
  | "investor"
  | "borrower"
  | "member";

// ── Public path prefixes (never redirect away from these) ──────────
const PUBLIC_PATHS = [
  "/",
  "/home",
  "/marketplace",
  "/pricing",
  "/tools",
  "/waitlist",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/workspace",
  "/select-portal",
];

// ── Helpers ────────────────────────────────────────────────────────

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

/** Still used by the old portals for their home-link logic. */
export function getPortalPath(role: AppRole | string): string {
  switch (role) {
    case "investor":       return "/investor";
    case "borrower":       return "/borrower";
    case "servicer":       return "/servicer/overview";
    case "lender":
    case "lender_admin":
    case "asset_manager":
    case "platform_admin": return "/dashboard";
    default:               return "/workspace";
  }
}

export function usePortalHome(): string {
  const { session } = useContext(AuthContext) as { session: { access_token?: string } | null };
  const role = getAppRoleFromToken(session?.access_token);
  return getPortalPath(role);
}

// ── Hook ──────────────────────────────────────────────────────────

/**
 * Mount once inside AuthedApp.
 * Fires only when an authenticated user lands on bare "/" —
 * sends them to /onboarding (first time) or /workspace (returning).
 */
export function usePortalRouter(): void {
  const { session } = useContext(AuthContext) as { session: { access_token?: string; user?: { id?: string } } | null };
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;

    const pathname = location.pathname;

    // Only act on bare root — leave all other paths alone
    if (pathname !== "/" && pathname !== "") return;

    // Check onboarding state for this user
    const userId = session?.user?.id || "demo";
    const onboardingDone = localStorage.getItem(`kontra_onboarding_${userId}`);

    if (!onboardingDone) {
      navigate("/onboarding", { replace: true });
    } else {
      navigate("/workspace", { replace: true });
    }
  }, [session?.access_token, location.pathname, navigate]);
}
