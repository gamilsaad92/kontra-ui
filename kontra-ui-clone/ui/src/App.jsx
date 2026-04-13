import React, { useContext } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import PortalSelectPage from "./pages/PortalSelectPage";
import RequireAuth from "./app/guards/RequireAuth";
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
 * Root router that enforces the authentication / authorization split:
 *   authentication = Supabase session
 *   authorization  = JWT app_role → portal redirect
 *
 * After login, bare "/" is caught by usePortalRouter and redirected:
 *   investor / borrower  → directly to their portal (no selection screen)
 *   lender_admin / platform_admin → /select-portal (choose workspace)
 *   servicer / asset_manager → /dashboard (single-purpose role)
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

      {/* ── Investor portal ────────────────────────────────── */}
      <Route
        path="/investor/*"
        element={
          <RequireAuth>
            <InvestorPortal />
          </RequireAuth>
        }
      />

      {/* ── Borrower portal ────────────────────────────────── */}
      <Route
        path="/borrower/*"
        element={
          <RequireAuth>
            <BorrowerPortal />
          </RequireAuth>
        }
      />

      {/* ── Servicer portal ────────────────────────────────── */}
      <Route
        path="/servicer/*"
        element={
          <RequireAuth>
            <ServicerPortal />
          </RequireAuth>
        }
      />

      {/* ── Lender workspace ───────────────────────────────── */}
      <Route
        path="/*"
        element={
          <RequireAuth>
            <SaasDashboard />
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
