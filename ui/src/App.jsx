import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignIn } from "@clerk/clerk-react";
import DashboardShell from "./components/DashboardShell.jsx";
import PortfolioOverview from "./pages/lender/PortfolioOverview.tsx";
import LoansDashboard from "./components/LoansDashboard.jsx";
import OlbCouponPage from "./pages/OlbCouponPage.jsx";
import RouteGuard from "./components/RouteGuard";

function Placeholder({ title }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900">
      {title}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<SignIn routing="path" path="/login" />} />
        <Route element={<DashboardShell />}>
          <Route index element={<Navigate to="/lender/portfolio" replace />} />
          <Route
            path="/loans"
            element={
              <RouteGuard roles={["lender", "servicer", "admin"]}>
                <LoansDashboard />
              </RouteGuard>
            }
          />
          <Route
            path="/lender/portfolio"
            element={
              <RouteGuard roles={["lender", "servicer", "admin"]}>
                <PortfolioOverview />
              </RouteGuard>
            }
          />
          <Route
            path="/lender/underwriting"
            element={<RouteGuard roles={["lender", "servicer", "admin"]}>
                <Placeholder title="Underwriting" />
              </RouteGuard>
            }
          />
          <Route
            path="/lender/escrow"
            element={<RouteGuard roles={["lender", "servicer", "admin"]}>
                <Placeholder title="Escrow" />
              </RouteGuard>
            }
          />
          <Route
            path="/lender/servicing"
            element={<RouteGuard roles={["lender", "servicer", "admin"]}>
                <Placeholder title="Servicing" />
              </RouteGuard>
            }
          />
          <Route
            path="/lender/risk"
            element={<RouteGuard roles={["lender", "servicer", "admin"]}>
                <Placeholder title="Risk Monitoring" />
              </RouteGuard>
            }
          />
          <Route
            path="/lender/investor"
            element={<RouteGuard roles={["lender", "servicer", "admin"]}>
                <Placeholder title="Investor Reporting" />
              </RouteGuard>
            }
          />
          <Route
            path="/lender/collections"
            element={<RouteGuard roles={["lender", "servicer", "admin"]}>
                <Placeholder title="Collections" />
              </RouteGuard>
            }
          />
          <Route
            path="/lender/trading"
            element={<RouteGuard roles={["lender", "servicer", "admin"]}>
                <Placeholder title="Trading" />
              </RouteGuard>
            }
          />
          <Route
            path="/investor"
            element={<RouteGuard roles={["investor", "admin"]}>
                <Placeholder title="Investor" />
              </RouteGuard>
            }
          />
          <Route
            path="/borrower"
            element={<RouteGuard roles={["borrower", "admin"]}>
                <Placeholder title="Borrower" />
              </RouteGuard>
            }
          />
          <Route path="/hospitality" element={<Placeholder title="Hospitality" />} />
          <Route path="/analytics" element={<Placeholder title="Analytics" />} />
          <Route path="/olb-coupon" element={<OlbCouponPage />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
          <Route path="*" element={<Placeholder title="Not found" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
