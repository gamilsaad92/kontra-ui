import { useCallback, useContext, useMemo, useState, type ComponentType } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Bars3Icon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline";
import { resolveApiBase } from "../lib/api";
import useFeatureUsage from "../lib/useFeatureUsage";
import { lenderNavRoutes } from "../routes";
import { AuthContext } from "../lib/authContext";
import SaasDashboardHome from "../components/SaasDashboardHome";
import AiInsightsPage from "../features/ai-insights/page/AiInsightsPage";
import OnchainDashboard from "../components/OnchainDashboard";
import OnchainLayout from "./dashboard/onchain/OnchainLayout";
import OnchainInvestorRegistryPage from "./dashboard/onchain/OnchainInvestorRegistryPage";
import OnchainCapTablePage from "./dashboard/onchain/OnchainCapTablePage";
import OnchainCompliancePage from "./dashboard/onchain/OnchainCompliancePage";
import OnchainDistributionsPage from "./dashboard/onchain/OnchainDistributionsPage";
import OnchainGovernancePage from "./dashboard/onchain/OnchainGovernancePage";
import OnchainAuditPage from "./dashboard/onchain/OnchainAuditPage";
import OnchainTokenGatePage from "./dashboard/onchain/OnchainTokenGatePage";
import PortfolioLayout from "./dashboard/portfolio/PortfolioLayout";
import PortfolioLoansCustomPage from "./dashboard/portfolio/PortfolioLoansPage";
import PortfolioOverviewPage from "./dashboard/portfolio/PortfolioOverviewPage";
import PortfolioCovenantWatchPage from "./dashboard/portfolio/PortfolioCovenantWatchPage";
import LoanOriginationWizard from "./dashboard/portfolio/LoanOriginationWizard";
import MarketsLayout from "./dashboard/markets/MarketsLayout";
import SecondaryMarketPage from "./dashboard/markets/SecondaryMarketPage";
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
            onClick={() => { recordUsage(item.path); setSidebarOpen(false); }}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition ${
                isActive || location.pathname.startsWith(`${item.path}/`)
                  ? "bg-[#800020]/20 text-rose-300 font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
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
        <Route path="loans" element={<PortfolioLoansCustomPage />} />
        <Route path="assets" element={<PortfolioAssetsPage />} />
        <Route path="covenants" element={<PortfolioCovenantWatchPage />} />
        <Route path="originate" element={<LoanOriginationWizard />} />
      </Route>
      {/* Servicing moved to /servicer — legacy redirects */}
      <Route path="/servicing" element={<Navigate to="/servicer/overview" replace />} />
      <Route path="/servicing/*" element={<LegacyServicingRedirect />} />
      <Route path="/markets" element={<MarketsLayout />}>
        <Route index element={<Navigate to="/markets/pools" replace />} />
        <Route path="pools" element={<MarketsPoolsCrudPage />} />
        <Route path="secondary" element={<SecondaryMarketPage />} />
        <Route path="trades" element={<MarketsTradesCrudPage />} />
        <Route path="tokens" element={<Navigate to="/onchain" replace />} />
        <Route path="exchange" element={<Navigate to="/onchain" replace />} />
      </Route>
      <Route path="/onchain" element={<OnchainLayout />}>
        <Route index element={<Navigate to="/onchain/gate" replace />} />
        <Route path="gate" element={<OnchainTokenGatePage />} />
        <Route path="tokens" element={<OnchainDashboard />} />
        <Route path="investors" element={<OnchainInvestorRegistryPage />} />
        <Route path="cap-table" element={<OnchainCapTablePage />} />
        <Route path="compliance" element={<OnchainCompliancePage />} />
        <Route path="distributions" element={<OnchainDistributionsPage />} />
        <Route path="governance" element={<OnchainGovernancePage />} />
        <Route path="audit" element={<OnchainAuditPage />} />
      </Route>
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
      <Route path="/policy" element={<PolicyEnginePage />} />
      <Route path="/integration" element={<IntegrationHubPage />} />
      <Route path="/enterprise-api" element={<EnterpriseApiPage />} />
      <Route path="/tokenization" element={<TokenizationPage />} />
      <Route path="/cost-governance" element={<CostGovernancePage />} />
      <Route path="/servicing-ops" element={<ServicingOperationsCenter />} />
      <Route path="/inspection" element={<InspectionIntelligenceCenter />} />
      <Route path="/hazard-recovery" element={<HazardLossRecoveryCenter />} />
      <Route path="/compliance-center" element={<ComplianceCovenantCenter />} />
      <Route path="/exchange" element={<TokenizationExchangeCenter />} />
      <Route path="/policy-command" element={<AdminPolicyCommandCenter />} />
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
    <div className="relative flex min-h-screen bg-slate-100 text-slate-900">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-slate-950 text-slate-100 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo + portal badge */}
        <div className="px-4 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#800020" }}>
                <span className="text-sm font-black text-white" style={{ letterSpacing: "-0.05em" }}>K</span>
              </div>
              <span className="text-base font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Kontra</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          {/* Lender portal badge */}
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ background: "rgba(128,0,32,0.12)", borderColor: "rgba(128,0,32,0.35)" }}>
            <BuildingLibraryIcon className="h-4 w-4 shrink-0" style={{ color: "#e07080" }} />
            <div>
              <p className="text-xs font-black uppercase tracking-widest leading-none" style={{ color: "#e07080" }}>Lender</p>
              <p className="text-xs text-slate-500 mt-0.5">Capital Markets Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {frequentItems.length > 0 && (
            <div className="mb-2 space-y-1">
              <p className="px-3 text-xs font-bold uppercase tracking-widest text-slate-600 mb-1">Recent</p>
              {frequentItems.map((item) => renderNavItem(item))}
              <hr className="border-slate-800 my-2" />
            </div>
          )}
          {navItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Switch to Servicer portal */}
        <div className="border-t border-slate-800 px-3 py-3">
          <NavLink
            to="/servicer/cases"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" />
            <span>Servicer Portal</span>
          </NavLink>
        </div>

        {/* Sign out */}
        <div className="border-t border-slate-800 px-3 py-3">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full rounded-lg border border-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "Logging out…" : "Log Out"}
          </button>
          {signOutError && <p className="mt-2 text-xs text-red-400" role="alert">{signOutError}</p>}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition">
            <Bars3Icon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-black text-white" style={{ background: "#800020" }}>K</div>
            <span className="text-sm font-bold text-slate-900">Kontra <span style={{ color: "#800020" }}>Lender</span></span>
          </div>
        </div>

        {/* Page header strip — desktop */}
        {!isDashboardRoute && !sectionHasOwnHeader && (
          <div className="hidden border-b border-slate-200 bg-white px-8 py-4 md:flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "#800020" }}>
                Lender Portal
              </p>
              <h1 className="text-lg font-bold text-slate-900">{activeLabel}</h1>
            </div>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5" style={{ background: "rgba(128,0,32,0.06)", borderColor: "rgba(128,0,32,0.25)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: "#800020" }} />
              <span className="text-xs font-semibold" style={{ color: "#800020" }}>Live Portfolio</span>
            </div>
          </div>
        )}

        <div className="p-3 md:p-6">
          {isDashboardRoute || isServicingRoute ? content : <div className="space-y-6">{content}</div>}
        </div>
      </main>
    </div>
  );
}
