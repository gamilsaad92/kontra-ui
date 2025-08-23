import { Routes, Route } from "react-router-dom";
import DashboardShell from "./components/DashboardShell.jsx";
import PortfolioOverview from "./pages/lender/PortfolioOverview.tsx";
import DashboardHome from "./components/DashboardHome.jsx";
import LoanList from "./components/LoanList.jsx";
import LoanApplicationList from "./components/LoanApplicationList.jsx";
import CollectionsTable from "./components/CollectionsTable.jsx";
import ProjectsTable from "./components/ProjectsTable.jsx";
import HospitalityDashboard from "./components/HospitalityDashboard.jsx";
import OrganizationSettings from "./components/OrganizationSettings.jsx";

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
        <Route index element={<DashboardHome />} />
        <Route path="/loans" element={<LoanList />} />
        <Route path="/applications" element={<LoanApplicationList />} />
        <Route path="/servicing" element={<CollectionsTable />} />
        <Route path="/projects" element={<ProjectsTable />} />
        <Route path="/hospitality" element={<HospitalityDashboard />} />
        <Route path="/settings" element={<OrganizationSettings />} />
      </Route>
    </Routes>
  );
}
