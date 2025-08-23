import { Routes, Route, Navigate } from "react-router-dom";
import DashboardShell from "./layouts/DashboardShell";
import PortfolioOverview from "./pages/Lender/PortfolioOverview";

function Placeholder({ title }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900">
      {title}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardShell />}>
        <Route index element={<Navigate to="/lender/portfolio" replace />} />
        <Route path="/lender/portfolio" element={<PortfolioOverview />} />
        <Route path="/lender/underwriting" element={<Placeholder title="Underwriting" />} />
        <Route path="/lender/escrow" element={<Placeholder title="Escrow" />} />
        <Route path="/lender/servicing" element={<Placeholder title="Servicing" />} />
        <Route path="/lender/risk" element={<Placeholder title="Risk Monitoring" />} />
        <Route path="/lender/investor" element={<Placeholder title="Investor Reporting" />} />
        <Route path="/lender/collections" element={<Placeholder title="Collections" />} />
        <Route path="/lender/trading" element={<Placeholder title="Trading" />} />
        <Route path="/hospitality" element={<Placeholder title="Hospitality" />} />
        <Route path="/analytics" element={<Placeholder title="Analytics" />} />
        <Route path="/settings" element={<Placeholder title="Settings" />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
