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
import DemoModeGuide from "./components/DemoModeGuide";
import AdminVisitorsPage from "./pages/AdminVisitorsPage";
import WaitlistPage from "./pages/WaitlistPage";
import PublicHomePage from "./pages/PublicHomePage";
import MarketplacePage from "./pages/MarketplacePage";
import PricingPage from "./pages/PricingPage";
import PublicToolPage from "./pages/PublicToolPage";
import OnboardingPage from "./pages/OnboardingPage";
import WorkspacePage from "./pages/WorkspacePage";
import { OrgProvider } from "./lib/OrgProvider";
import { AuthContext } from "./lib/authContext";
import { usePortalRouter } from "./lib/usePortalRouter";
import { useVisitorTracking } from "./hooks/useVisitorTracking";

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

function AuthedApp() {
  usePortalRouter();
  useVisitorTracking();

  return (
    <>
      <DemoModeGuide />
      <Routes>
        {/* ── Fully public (no auth required) ──────────────────── */}
        <Route path="/"            element={<PublicHomePage />} />
        <Route path="/home"        element={<PublicHomePage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/pricing"     element={<PricingPage />} />
        <Route path="/tools/:toolSlug" element={<PublicToolPage />} />
        <Route path="/login"       element={<LoginPage />} />
        <Route path="/waitlist"    element={<WaitlistPage />} />
        <Route path="/admin"       element={<AdminVisitorsPage />} />

        {/* ── Onboarding (auth required, no role required) ──────── */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />

        {/* ── Unified workspace (auth required) ────────────────── */}
        <Route
          path="/workspace/*"
          element={
            <RequireAuth>
              <WorkspacePage />
            </RequireAuth>
          }
        />

        {/* ── Legacy portal selection ───────────────────────────── */}
        <Route
          path="/select-portal"
          element={
            <RequireAuth>
              <PortalSelectPage />
            </RequireAuth>
          }
        />

        {/* ── Investor portal ───────────────────────────────────── */}
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

        {/* ── Borrower portal ───────────────────────────────────── */}
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

        {/* ── Servicer portal ───────────────────────────────────── */}
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

        {/* ── Enterprise / Lender workspace (legacy, still functional) ─ */}
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
    </>
  );
}

export default function App() {
  return (
    <AuthedOrgProvider>
      <AuthedApp />
    </AuthedOrgProvider>
  );
}
