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
import { OrgProvider } from "./lib/OrgProvider";
import { AuthContext } from "./lib/authContext";
import { usePortalRouter } from "./lib/usePortalRouter";
import { useVisitorTracking } from "./hooks/useVisitorTracking";

// Public marketplace pages
import HomePage from "./pages/public/HomePage";
import PropertiesPage from "./pages/public/PropertiesPage";
import PropertyDetailPage from "./pages/public/PropertyDetailPage";
import ServiceProvidersPage from "./pages/public/ServiceProvidersPage";
import AiToolsPage from "./pages/public/AiToolsPage";
import PricingPage from "./pages/public/PricingPage";

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
 * Root router — public marketplace + authenticated portals.
 *
 * Public routes (no auth required):
 *   /               → Homepage (CRE marketplace & OS)
 *   /properties     → Property search & discovery
 *   /properties/:id → Property detail page
 *   /service-providers → Service provider marketplace
 *   /ai-tools       → AI document tools
 *   /pricing        → Pricing page
 *   /waitlist       → Waitlist signup
 *   /login          → Login / Sign Up
 *
 * Authenticated portals:
 *   /dashboard      → Lender workspace (SaasDashboard)
 *   /investor/*     → Investor portal
 *   /borrower/*     → Borrower portal
 *   /servicer/*     → Servicer portal
 */
function AuthedApp() {
  usePortalRouter();
  useVisitorTracking();

  return (
    <>
      <DemoModeGuide />
      <Routes>
        {/* ── Public marketplace (no auth required) ──────────── */}
        <Route path="/" element={<HomePage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:id" element={<PropertyDetailPage />} />
        <Route path="/service-providers" element={<ServiceProvidersPage />} />
        <Route path="/ai-tools" element={<AiToolsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminVisitorsPage />} />

        {/* ── Post-login portal selection ─────────────────────── */}
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

        {/* ── Lender / admin workspace ── all dashboard routes ── */}
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
