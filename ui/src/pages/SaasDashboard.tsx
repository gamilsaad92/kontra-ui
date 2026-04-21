import { useCallback, useContext, useMemo, useState, type ComponentType } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { resolveApiBase } from "../lib/api";
import useFeatureUsage from "../lib/useFeatureUsage";
import { lenderNavRoutes } from "../routes";
import { AuthContext } from "../lib/authContext";
import SaasDashboardHome from "../components/SaasDashboardHome";
import AiInsightsPage from "../features/ai-insights/page/AiInsightsPage";
import OnchainDashboard from "../components/OnchainDashboard";
import PortfolioLayout from "./dashboard/portfolio/PortfolioLayout";
import PortfolioLoansPage from "./dashboard/portfolio/PortfolioLoansPage";
import PortfolioOverviewPage from "./dashboard/portfolio/PortfolioOverviewPage";
import LoanOriginationWizard from "./dashboard/portfolio/LoanOriginationWizard";
import LoanSyndicationPage from "./dashboard/portfolio/LoanSyndicationPage";
import AIUnderwritingPage from "./dashboard/portfolio/AIUnderwritingPage";
import MarketsLayout from "./dashboard/markets/MarketsLayout";
import SecondaryMarketPage from "./dashboard/markets/SecondaryMarketPage";
import ReportingEnginePage from "./dashboard/reports/ReportingEnginePage";
import GovernanceLayout from "./dashboard/governance/GovernanceLayout";
import CureWorkflowPage from "./dashboard/governance/CureWorkflowPage";
import AlertCenterPage from "./dashboard/AlertCenterPage";
import CommandCenterPage from "./dashboard/CommandCenterPage";
import PortfolioForecastPage from "./dashboard/PortfolioForecastPage";
import LoanControlPage from "./dashboard/governance/LoanControlPage";
import InvestorGovernancePage from "./dashboard/governance/InvestorGovernancePage";
import RulesConsolePage from "./dashboard/governance/RulesConsolePage";
import ApiDiagnostics from "./settings/ApiDiagnostics";
import SsoSettingsPage from "./settings/SsoSettingsPage";
import BillingPage from "./settings/BillingPage";
import TeamPage from "./settings/TeamPage";
import WiringCheck from "./dev/WiringCheck";
import WorkflowEnginePage from "./dashboard/WorkflowEnginePage";
import PolicyEnginePage from "./dashboard/PolicyEnginePage";
import IntegrationHubPage from "./dashboard/IntegrationHubPage";
import EnterpriseApiPage from "./dashboard/EnterpriseApiPage";
import TokenizationPage from "./dashboard/TokenizationPage";
import CostGovernancePage from "./dashboard/CostGovernancePage";
import ServicingOperationsCenter from "./dashboard/ServicingOperationsCenter";
import InspectionIntelligenceCenter from "./dashboard/InspectionIntelligenceCenter";
import HazardLossRecoveryCenter from "./dashboard/HazardLossRecoveryCenter";
import ComplianceCovenantCenter from "./dashboard/ComplianceCovenantCenter";
import TokenizationExchangeCenter from "./dashboard/TokenizationExchangeCenter";
import AdminPolicyCommandCenter from "./dashboard/AdminPolicyCommandCenter";
import AgentConsolePage from "./dashboard/AgentConsolePage";
import AICopilotPage from "./dashboard/AICopilotPage";
import DocumentVaultPage from "./dashboard/DocumentVaultPage";
import LoanLifecyclePage from "./dashboard/LoanLifecyclePage";
import MarketplacePage from "./dashboard/MarketplacePage";
import UnifiedCommandCenter from "./dashboard/UnifiedCommandCenter";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    location.pathname.startsWith("/command") ||
    location.pathname.startsWith("/forecast") ||
    location.pathname.startsWith("/alerts") ||
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
        <Route index element={<Navigate to="/portfolio/overview" replace />} />
        <Route path="overview" element={<PortfolioOverviewPage />} />
        <Route path="assets" element={<PortfolioAssetsPage />} />
        <Route path="loans" element={<PortfolioLoansPage />} />
        <Route path="covenants" element={<ComplianceCovenantCenter />} />
        <Route path="syndication" element={<LoanSyndicationPage />} />
        <Route path="underwriting" element={<AIUnderwritingPage />} />
        <Route path="originate" element={<LoanOriginationWizard />} />
      </Route>
      {/* Servicing moved to /servicer — legacy redirects */}
      <Route path="/servicing" element={<Navigate to="/servicer/overview" replace />} />
      <Route path="/servicing/*" element={<LegacyServicingRedirect />} />
      <Route path="/markets" element={<MarketsLayout />}>
        <Route index element={<Navigate to="/markets/pools" replace />} />
        <Route path="pools" element={<MarketsPoolsCrudPage />} />
        <Route path="tokens" element={<MarketsTokensCrudPage />} />
        <Route path="secondary" element={<SecondaryMarketPage />} />
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
        <Route path="cure-workflows" element={<CureWorkflowPage />} />
      </Route>
      <Route path="/alerts" element={<AlertCenterPage />} />
      <Route path="/command" element={<CommandCenterPage />} />
      <Route path="/forecast" element={<PortfolioForecastPage />} />
      <Route path="/analytics" element={<AiInsightsPage />} />
      <Route path="/reports" element={<ReportsCrudPage />} />
      <Route path="/reports/engine" element={<ReportingEnginePage />} />
      <Route path="/workflow" element={<WorkflowEnginePage />} />
      <Route path="/policy" element={<PolicyEnginePage />} />
      <Route path="/integration" element={<IntegrationHubPage />} />
      <Route path="/enterprise-api" element={<EnterpriseApiPage />} />
      <Route path="/tokenization" element={<TokenizationPage />} />
      <Route path="/cost-governance" element={<CostGovernancePage />} />
      {/* Unified Command Center — replaces 6 separate pages */}
      <Route path="/command-center" element={<UnifiedCommandCenter />} />
      {/* Redirects from old individual command center paths */}
      <Route path="/servicing-ops" element={<Navigate to="/command-center" replace />} />
      <Route path="/inspection" element={<Navigate to="/command-center" replace />} />
      <Route path="/hazard-recovery" element={<Navigate to="/command-center" replace />} />
      <Route path="/compliance-center" element={<Navigate to="/command-center" replace />} />
      <Route path="/policy-command" element={<Navigate to="/command-center" replace />} />
      {/* AI Copilot — replaces Agent Console */}
      <Route path="/ai-copilot" element={<AICopilotPage />} />
      <Route path="/document-vault" element={<DocumentVaultPage />} />
      <Route path="/loan-lifecycle" element={<LoanLifecyclePage />} />
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/agents" element={<Navigate to="/ai-copilot" replace />} />
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
    <div className="relative flex min-h-screen bg-slate-100 text-slate-900">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-slate-950 text-slate-100 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#800020' }}>
              <span className="text-sm font-black text-white" style={{ letterSpacing: '-0.05em' }}>K</span>
            </div>
            <span className="text-base font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Kontra</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <XMarkIcon className="h-5 w-5" />
          </button>
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
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition">
            <Bars3Icon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-black text-white" style={{ background: '#800020' }}>K</div>
            <span className="text-sm font-bold text-slate-900">Kontra <span className="text-brand-600">Lender</span></span>
          </div>
        </div>
        <div className="flex-1 p-3 md:p-6">
        {!isDashboardRoute && !isServicingRoute && !sectionHasOwnHeader && (
          <header className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{activeLabel}</h1>
            <p className="text-sm text-slate-500">
              Structured loan data infrastructure for servicing, compliance, and capital markets.
            </p>
          </header>
        )}
        {isDashboardRoute || isServicingRoute ? content : <div className="space-y-6">{content}</div>}
        </div>
      </main>
    </div>
  );
}
