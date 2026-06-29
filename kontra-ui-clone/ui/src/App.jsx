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
import DealSummaryPage from "./pages/public/DealSummaryPage";
import CreateDealRoomPage from "./pages/public/CreateDealRoomPage";
import MyDealRoomsPage from "./pages/public/MyDealRoomsPage";
import CheckoutSuccessPage from "./pages/public/CheckoutSuccessPage";
import CheckoutCancelPage from "./pages/public/CheckoutCancelPage";
import PrivacyPage from "./pages/public/PrivacyPage";
import TermsPage from "./pages/public/TermsPage";
import AboutPage from "./pages/public/AboutPage";

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
        <Route path="/deal-room/:propertyId/summary" element={<DealSummaryPage />} />
        <Route path="/create-deal-room" element={<CreateDealRoomPage />} />
        <Route path="/my-deal-rooms" element={<MyDealRoomsPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/about" element={<AboutPage />} />
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
