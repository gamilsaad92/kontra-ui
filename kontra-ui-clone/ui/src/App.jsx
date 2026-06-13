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

// Public marketplace pages — no auth required
import HomePage from "./pages/public/HomePage";
import PropertiesPage from "./pages/public/PropertiesPage";
import PropertyDetailPage from "./pages/public/PropertyDetailPage";
import ServiceProvidersPage from "./pages/public/ServiceProvidersPage";
import AiToolsPage from "./pages/public/AiToolsPage";
import PricingPage from "./pages/public/PricingPage";
import TokenizationPage from "./pages/public/TokenizationPage";
import HowItWorksPage from "./pages/public/HowItWorksPage";
import DealRoomPage from "./pages/public/DealRoomPage";
import PrivacyPage from "./pages/public/PrivacyPage";
import TermsPage from "./pages/public/TermsPage";

// Unified workspace — any authenticated user
import NewDashboard from "./pages/NewDashboard";
import AppWorkspace from "./pages/app/AppWorkspace";

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
 * Unified routing — one seamless product from public marketplace to workspace.
 *
 * PUBLIC (no auth):        /  /properties  /properties/:id  /service-providers  /ai-tools  /pricing
 * WORKSPACE (any auth):    /dashboard  /app/*
 * ADVANCED PORTALS:        /lender-tools/*  /investor/*  /borrower/*  /servicer/*
 *
 * After login → always /dashboard (unified hub, not the old role-specific portals).
 * Lender tools accessible at /lender-tools/* for those who need the advanced platform.
 */
function AuthedApp() {
  usePortalRouter();
  useVisitorTracking();

  return (
    <>
      <DemoModeGuide />
      <Routes>
        {/* ── Public marketplace ── no auth required ──────────── */}
        <Route path="/" element={<HomePage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:id" element={<PropertyDetailPage />} />
        <Route path="/service-providers" element={<ServiceProvidersPage />} />
        <Route path="/ai-tools" element={<AiToolsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/tokenization" element={<TokenizationPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/deal-room/:propertyId" element={<DealRoomPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminVisitorsPage />} />

        {/* ── Unified workspace ── any authenticated user ─────── */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <NewDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              <AppWorkspace />
            </RequireAuth>
          }
        />

        {/* ── Portal selection (legacy — redirect to dashboard) ── */}
        <Route
          path="/select-portal"
          element={<RequireAuth><Navigate to="/dashboard" replace /></RequireAuth>}
        />

        {/* ── Investor portal ─────────────────────────────────── */}
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

        {/* ── Borrower portal ─────────────────────────────────── */}
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

        {/* ── Servicer portal ─────────────────────────────────── */}
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

        {/*
         * ── Advanced lender tools ── /lender-tools/* ──────────
         * All advanced portfolio/market/compliance tools live here.
         * Accessible from the "Lender Tools" button in the nav.
         * Not the default landing after login.
         */}
        <Route
          path="/lender-tools/*"
          element={
            <RequireAuth>
              <RequireRole portal="lender">
                <SaasDashboard />
              </RequireRole>
            </RequireAuth>
          }
        />

        {/*
         * ── Legacy lender routes ── still accessible ───────────
         * /portfolio, /markets, /governance, etc. were the old default
         * lender portal routes. Keep them working so existing bookmarks
         * and demo links don't break. SaasDashboard handles them
         * internally with its own Routes block.
         */}
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
