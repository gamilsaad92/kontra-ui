import React, { useContext } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import PortalSelectPage from "./pages/PortalSelectPage";
import RequireAuth from "./app/guards/RequireAuth";
import RequireRole from "./app/guards/RequireRole";
import SaasDashboard from "./pages/SaasDashboard";
import InvestorPortal from "./portals/investor/InvestorPortal";
import BorrowerPortal from "./portals/borrower/BorrowerPortal";
import ServicerPortal from "./portals/servicer/ServicerPortal";
import { OrgProvider } from "./lib/OrgProvider";
import { AuthContext } from "./lib/authContext";
import { usePortalRouter } from "./lib/usePortalRouter";

function AuthedOrgProvider({ children }) {
  const { session } = useContext(AuthContext);
  const apiBase = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";
  return (
    <OrgProvider
      accessToken={session?.access_token ?? null}
      userId={session?.user?.id ?? null}
      apiBase={apiBase}
    >
      {children}
    </OrgProvider>
  );
}

/**
 * Root router that enforces authentication AND authorization:
 *   authentication = Supabase session (RequireAuth)
 *   authorization  = JWT app_role → portal access (RequireRole)
 *
 * After login, bare "/" is caught by usePortalRouter and redirected:
 *   investor / borrower  → directly to their portal (no selection screen)
 *   lender_admin / platform_admin → /select-portal (choose workspace)
 *   servicer / asset_manager → /servicer/overview (single-purpose role)
 *
 * Cross-portal access is blocked: a borrower navigating to /dashboard
 * is silently redirected to /borrower, etc.
 */
function AuthedApp() {
  usePortalRouter();

  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />

      {/* ── Post-login portal selection (neutral, no portal chrome) */}
      <Route
        path="/select-portal"
        element={
          <RequireAuth>
            <PortalSelectPage />
          </RequireAuth>
        }
      />

      {/* ── Investor portal ── role: investor, platform_admin ── */}
      <Route
        path="/investor/*"
        element={
          <RequireAuth>
            <RequireRole portal="investor">
              <InvestorPortal />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* ── Borrower portal ── role: borrower, platform_admin ── */}
      <Route
        path="/borrower/*"
        element={
          <RequireAuth>
            <RequireRole portal="borrower">
              <BorrowerPortal />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* ── Servicer portal ── role: servicer, lender_admin, asset_manager, platform_admin ── */}
      <Route
        path="/servicer/*"
        element={
          <RequireAuth>
            <RequireRole portal="servicer">
              <ServicerPortal />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* ── Lender workspace ── role: lender_admin, asset_manager, platform_admin ── */}
      <Route
        path="/*"
        element={
          <RequireAuth>
            <RequireRole portal="lender">
              <SaasDashboard />
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthedOrgProvider>
      <AuthedApp />
    </AuthedOrgProvider>
  );
}
