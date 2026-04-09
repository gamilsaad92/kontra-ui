import React, { useContext } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RequireAuth from "./app/guards/RequireAuth";
import SaasDashboard from "./pages/SaasDashboard";
import InvestorPortal from "./portals/investor/InvestorPortal";
import BorrowerPortal from "./portals/borrower/BorrowerPortal";
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
 * Mounts the portal router hook inside the React Router context.
 * When an authenticated user hits "/", they are redirected to the
 * portal matching their JWT app_role:
 *   lender_admin | servicer | asset_manager → /dashboard
 *   investor → /investor
 *   borrower → /borrower
 */
function AuthedApp() {
  usePortalRouter();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Investor portal — separate product, read-only servicing, governance + distributions */}
      <Route
        path="/investor/*"
        element={
          <RequireAuth>
            <InvestorPortal />
          </RequireAuth>
        }
      />

      {/* Borrower portal — separate product, operational + communication-driven */}
      <Route
        path="/borrower/*"
        element={
          <RequireAuth>
            <BorrowerPortal />
          </RequireAuth>
        }
      />

      {/* Lender / Servicer portal — main execution layer, full servicing control */}
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
