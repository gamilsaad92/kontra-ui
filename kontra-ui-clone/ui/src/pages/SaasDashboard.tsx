import { useCallback, useContext, useMemo, useState, type ComponentType } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { resolveApiBase } from "../lib/api";
import useFeatureUsage from "../lib/useFeatureUsage";
import { lenderNavRoutes } from "../routes";
import { AuthContext } from "../lib/authContext";
import SaasDashboardHome from "../components/SaasDashboardHome";
import AiInsightsPage from "../features/ai-insights/page/AiInsightsPage";
import OnchainDashboard from "../components/OnchainDashboard";
import PortfolioLayout from "./dashboard/portfolio/PortfolioLayout";
import MarketsLayout from "./dashboard/markets/MarketsLayout";
import GovernanceLayout from "./dashboard/governance/GovernanceLayout";
import LoanControlPage from "./dashboard/governance/LoanControlPage";
import InvestorGovernancePage from "./dashboard/governance/InvestorGovernancePage";
import RulesConsolePage from "./dashboard/governance/RulesConsolePage";
import ApiDiagnostics from "./settings/ApiDiagnostics";
import SsoSettingsPage from "./settings/SsoSettingsPage";
import BillingPage from "./settings/BillingPage";
import TeamPage from "./settings/TeamPage";
import WiringCheck from "./dev/WiringCheck";
import WorkflowEnginePage from "./dashboard/WorkflowEnginePage";
import AgentConsolePage from "./dashboard/AgentConsolePage";
import {
  GovernanceComplianceCrudPage,
  GovernanceDocumentCrudPage,
  GovernanceLegalCrudPage,
  GovernanceRegulatoryCrudPage,
  GovernanceRiskCrudPage,
  MarketsPoolsCrudPage,
  MarketsTokensCrudPage,
  MarketsTradesCrudPage,
  PortfolioAssetsPage,
  PortfolioLoansPage,
  ReportsCrudPage,
} from "./dashboard/canonical/pages";

type NavItem = (typeof lenderNavRoutes)[number];

function DashboardOverview({ apiBase }: { apiBase: string }) {
  return <SaasDashboardHome apiBase={apiBase} />;
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

function LegacyServicingRedirect() {
  const location = useLocation();
  const suffix = location.pathname.replace(/^\/dashboard\/servicing/, "").replace(/^\/servicing/, "");
  return <Navigate to={{ pathname: `/servicer${suffix || "/overview"}`, search: location.search }} replace />;
}

export default function SaasDashboard() {
  const apiBase = resolveApiBase();
  const { usage, recordUsage } = useFeatureUsage();
  const { session, signOut } = useContext(AuthContext) as any;
  const location = useLocation();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const navItems = useMemo(() => lenderNavRoutes.filter((item) => !item.requiresAuth || session?.access_token), [session]);
    
  const frequentItems = useMemo(() => {
     const byUsage = [...navItems]
      .map((item) => ({ item, count: usage[item.path] ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .filter((entry) => entry.count > 0)
      .slice(0, 3)
      .map((entry) => entry.item);

    return byUsage;
  }, [navItems, usage]);

 const activeItem = useMemo(
    () => navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
    [location.pathname, navItems],
);
  
  const activeLabel = activeItem?.label ?? "Dashboard";
  const isDashboardRoute = location.pathname === "/dashboard";
  const isServicingRoute = location.pathname.startsWith("/servicing");
  // Sections that render their own header inside the layout — skip the generic one
  const sectionHasOwnHeader =
    location.pathname.startsWith("/portfolio") ||
    location.pathname.startsWith("/markets") ||
    location.pathname.startsWith("/governance") ||
    location.pathname.startsWith("/analytics") ||
    location.pathname.startsWith("/onchain") ||
    location.pathname.startsWith("/workflow");

  const renderNavItem = useCallback(
    (item: NavItem) => {
      const Icon = item.icon as ComponentType<{ className?: string }>;
      const children = Array.isArray(item.children) ? item.children : [];

       return (
        <div key={item.path} className="space-y-1">
          <NavLink
            to={item.path}
             onClick={() => recordUsage(item.path)}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                isActive || location.pathname.startsWith(`${item.path}/`)
                  ? "bg-white text-slate-900"
                  : "text-slate-200 hover:bg-slate-900"
              }`
            }
          >
                 <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
         {children.length > 0 && location.pathname.startsWith(item.path) && (
            <div className="ml-7 space-y-1">
              {children.map((child) => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  onClick={() => recordUsage(child.path)}
                  className={({ isActive }) =>
                    `block rounded px-2 py-1 text-xs ${
                      isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-900"
                    }`
                  }
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    },
    [location.pathname, recordUsage],
  );

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError(null);
    const { error } = await signOut();
    if (error) {
      setIsSigningOut(false);
      setSignOutError("Unable to log out. Please try again.");
      return;
    }
    navigate("/login", { replace: true });
  };

   const content = (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardOverview apiBase={apiBase} />} />
      <Route path="/portfolio" element={<PortfolioLayout />}>
        <Route index element={<Navigate to="/portfolio/assets" replace />} />
        <Route path="assets" element={<PortfolioAssetsPage />} />
        <Route path="loans" element={<PortfolioLoansPage />} />
      </Route>
      {/* Servicing moved to /servicer — legacy redirects */}
      <Route path="/servicing" element={<Navigate to="/servicer/overview" replace />} />
      <Route path="/servicing/*" element={<LegacyServicingRedirect />} />
      <Route path="/markets" element={<MarketsLayout />}>
        <Route index element={<Navigate to="/markets/pools" replace />} />
        <Route path="pools" element={<MarketsPoolsCrudPage />} />
        <Route path="tokens" element={<MarketsTokensCrudPage />} />
        <Route path="trades" element={<MarketsTradesCrudPage />} />
        <Route path="exchange" element={<Navigate to="/markets/pools" replace />} />
      </Route>
      <Route path="/onchain" element={<OnchainDashboard />} />
      <Route path="/governance" element={<GovernanceLayout />}>
        <Route index element={<Navigate to="/governance/loan-control" replace />} />
        <Route path="loan-control" element={<LoanControlPage />} />
        <Route path="proposals" element={<InvestorGovernancePage />} />
        <Route path="rules" element={<RulesConsolePage />} />
        <Route path="compliance" element={<GovernanceComplianceCrudPage />} />
        <Route path="legal" element={<GovernanceLegalCrudPage />} />
        <Route path="regulatory-scans" element={<GovernanceRegulatoryCrudPage />} />
        <Route path="document-review" element={<GovernanceDocumentCrudPage />} />
        <Route path="risk" element={<GovernanceRiskCrudPage />} />
      </Route>
      <Route path="/analytics" element={<AiInsightsPage />} />
      <Route path="/reports" element={<ReportsCrudPage />} />
      <Route path="/workflow" element={<WorkflowEnginePage />} />
      <Route path="/agents" element={<AgentConsolePage />} />
      <Route path="/settings" element={<Navigate to="/settings/billing" replace />} />
      <Route path="/settings/billing" element={<BillingPage />} />
      <Route path="/settings/sso" element={<SsoSettingsPage />} />
      <Route path="/settings/team" element={<TeamPage />} />
      <Route path="/settings/api-diagnostics" element={<ApiDiagnostics />} />
      <Route path="/dev/wiring-check" element={<WiringCheck />} />
      <Route path="/projects" element={<LegacyRedirect to="/portfolio/assets" />} />
      <Route path="/pools" element={<LegacyRedirect to="/markets/pools" />} />
      <Route path="/pools-and-tokens" element={<LegacyRedirect to="/markets/pools" />} />
      <Route path="/tokens" element={<LegacyRedirect to="/markets/tokens" />} />
      <Route path="/trades" element={<LegacyRedirect to="/markets/trades" />} />
      <Route path="/exchange" element={<LegacyRedirect to="/markets/exchange" />} />
      <Route path="/legal" element={<LegacyRedirect to="/governance/legal" />} />
      <Route path="/compliance" element={<LegacyRedirect to="/governance/compliance" />} />
      <Route path="/document-review" element={<LegacyRedirect to="/governance/document-review" />} />
      <Route path="/risk" element={<LegacyRedirect to="/governance/risk" />} />
      <Route path="/applications" element={<LegacyRedirect to="/portfolio" />} />
      <Route path="/applications/*" element={<LegacyRedirect to="/portfolio" />} />
      <Route path="/application/*" element={<LegacyRedirect to="/portfolio" />} />
      <Route path="/dashboard/servicing/*" element={<LegacyServicingRedirect />} />
      <Route path="/dashboard/draws" element={<LegacyRedirect to="/servicing/draws" />} />
      <Route path="/dashboard/inspections" element={<LegacyRedirect to="/servicing/inspections" />} />
      <Route path="/dashboard/payments" element={<LegacyRedirect to="/servicing/payments" />} />
      <Route path="/dashboard/assets" element={<LegacyRedirect to="/portfolio/assets" />} />
      <Route path="/assets" element={<LegacyRedirect to="/portfolio/assets" />} />
      <Route
        path="*"
        element={
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Route not found. Redirecting to dashboard...
          </div>
        }
      />
    </Routes>
  );

  return (
     <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-64 flex-col bg-slate-950 text-slate-100">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#800020' }}>
            <span className="text-sm font-black text-white" style={{ letterSpacing: '-0.05em' }}>K</span>
          </div>
          <span className="text-base font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Kontra</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {frequentItems.length > 0 && (
            <div className="mb-2 space-y-1">
              {frequentItems.map((item) => renderNavItem(item))}
              <hr className="border-slate-800" />
            </div>
          )}
            {navItems.map((item) => renderNavItem(item))}

          <div className="pt-4 space-y-2">
            <NavLink
              to="/servicer/overview"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-amber-500/15 text-amber-300 font-semibold"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <span className="text-xs">⚙</span>
              <span>Servicer Portal</span>
            </NavLink>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-lg border border-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSigningOut}
            >
              {isSigningOut ? "Logging out..." : "Log Out"}
            </button>
            {signOutError && (
              <p className="mt-2 text-xs text-brand-200" role="alert">
                {signOutError}
              </p>
            )}
          </div>
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        {!isDashboardRoute && !isServicingRoute && !sectionHasOwnHeader && (
          <header className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{activeLabel}</h1>
            <p className="text-sm text-slate-500">
              Structured loan data infrastructure for servicing, compliance, and capital markets.
            </p>
          </header>
        )}
        {isDashboardRoute || isServicingRoute ? content : <div className="space-y-6">{content}</div>}
      </main>
    </div>
  );
}
