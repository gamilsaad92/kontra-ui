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
import PortfolioOverviewPage from "./dashboard/portfolio/PortfolioOverviewPage";
import LoanSyndicationPage from "./dashboard/portfolio/LoanSyndicationPage";
import AIUnderwritingPage from "./dashboard/portfolio/AIUnderwritingPage";
import LoanOriginationWizard from "./dashboard/portfolio/LoanOriginationWizard";
import MarketsLayout from "./dashboard/markets/MarketsLayout";
import GovernanceLayout from "./dashboard/governance/GovernanceLayout";
import LoanControlPage from "./dashboard/governance/LoanControlPage";
import InvestorGovernancePage from "./dashboard/governance/InvestorGovernancePage";
import RulesConsolePage from "./dashboard/governance/RulesConsolePage";
import CureWorkflowPage from "./dashboard/governance/CureWorkflowPage";
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
import CommandCenterPage from "./dashboard/CommandCenterPage";
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
import CashFlowWaterfallPage from "./dashboard/markets/CashFlowWaterfallPage";
import ServicingTokenBridgePage from "./dashboard/markets/ServicingTokenBridgePage";
import SecondaryMarketPage from "./dashboard/markets/SecondaryMarketPage";
import TokensPage from "./dashboard/markets/TokensPage";
import DistributionLayout from "./dashboard/markets/distribution/DistributionLayout";
import TokenizeLoan from "./dashboard/markets/distribution/TokenizeLoan";
import CreateOffering from "./dashboard/markets/distribution/CreateOffering";
import DistributionMarketplace from "./dashboard/markets/distribution/DistributionMarketplace";
import RfqsTrades from "./dashboard/markets/distribution/RfqsTrades";
import Approvals from "./dashboard/markets/distribution/Approvals";

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

  const activeItem = useMemo(
    () => navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
    [location.pathname, navItems],
  );

  const activeLabel = activeItem?.label ?? "Dashboard";
  const isDashboardRoute = location.pathname === "/dashboard";
  const isServicingRoute = location.pathname.startsWith("/servicing");
  const sectionHasOwnHeader =
    location.pathname.startsWith("/portfolio") ||
    location.pathname.startsWith("/markets") ||
    location.pathname.startsWith("/governance") ||
    location.pathname.startsWith("/analytics") ||
    location.pathname.startsWith("/onchain") ||
    location.pathname.startsWith("/workflow");

  // Grouped sidebar sections — core features first, platform/ops after
  const NAV_SECTIONS: { label: string | null; paths: string[] }[] = [
    { label: null, paths: ["/dashboard", "/ai-copilot", "/command"] },
    { label: "Portfolio", paths: ["/portfolio", "/analytics", "/reports"] },
    { label: "Compliance", paths: ["/governance", "/compliance-center", "/policy"] },
    { label: "Capital Markets", paths: ["/markets", "/onchain", "/exchange"] },
    { label: "Platform", paths: ["/workflow", "/integration", "/enterprise-api", "/agents"] },
    { label: "Operations", paths: ["/servicing-ops", "/inspection", "/hazard-recovery", "/cost-governance", "/policy-command", "/tokenization"] },
  ];

  const SETTINGS_PATHS = ["/settings/team", "/settings/billing", "/settings/sso"];

  const renderNavItem = useCallback(
    (item: NavItem) => {
      const Icon = item.icon as ComponentType<{ className?: string }>;
      const children = Array.isArray(item.children) ? item.children : [];
      const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

      return (
        <div key={item.path} className="space-y-0.5">
          <NavLink
            to={item.path}
            onClick={() => recordUsage(item.path)}
            className={() =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${
                isActive
                  ? "bg-white/10 text-white font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`
            }
          >
            <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
            <span className="truncate">{item.label}</span>
            {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rose-800 shrink-0" />}
          </NavLink>
          {children.length > 0 && location.pathname.startsWith(item.path) && (
            <div className="ml-7 space-y-0.5">
              {children.map((child) => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  onClick={() => recordUsage(child.path)}
                  className={({ isActive }) =>
                    `block rounded px-2 py-1 text-xs ${
                      isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
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
        <Route path="loans" element={<PortfolioLoansPage />} />
        <Route path="assets" element={<PortfolioAssetsPage />} />
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
        <Route path="tokens" element={<TokensPage />} />
        <Route path="waterfall" element={<CashFlowWaterfallPage />} />
        <Route path="bridge" element={<ServicingTokenBridgePage />} />
        <Route path="secondary" element={<SecondaryMarketPage />} />
        <Route path="trades" element={<MarketsTradesCrudPage />} />
        <Route path="exchange" element={<Navigate to="/markets/pools" replace />} />
        <Route path="distribution" element={<DistributionLayout />}>
          <Route index element={<Navigate to="/markets/distribution/tokenize" replace />} />
          <Route path="tokenize" element={<TokenizeLoan />} />
          <Route path="offering" element={<CreateOffering />} />
          <Route path="marketplace" element={<DistributionMarketplace />} />
          <Route path="rfqs" element={<RfqsTrades />} />
          <Route path="approvals" element={<Approvals />} />
        </Route>
      </Route>
      <Route path="/onchain" element={<OnchainDashboard />} />
      <Route path="/governance" element={<GovernanceLayout />}>
        <Route index element={<Navigate to="/governance/loan-control" replace />} />
        <Route path="loan-control" element={<LoanControlPage />} />
        <Route path="proposals" element={<InvestorGovernancePage />} />
        <Route path="rules" element={<RulesConsolePage />} />
        <Route path="cure-workflows" element={<CureWorkflowPage />} />
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
      <Route path="/ai-copilot" element={<AICopilotPage />} />
      <Route path="/command" element={<CommandCenterPage />} />
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
    <div className="flex min-h-screen bg-slate-950 text-slate-900">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="flex w-60 shrink-0 flex-col bg-[#0d0d14] border-r border-white/5 text-slate-100">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
            style={{ background: "#800020", boxShadow: "0 0 16px rgba(128,0,32,0.4)" }}
          >
            <span className="text-sm font-black text-white" style={{ letterSpacing: "-0.05em" }}>K</span>
          </div>
          <span className="text-sm font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Kontra</span>
          <span
            className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(128,0,32,0.25)", color: "#d4687a", letterSpacing: "0.04em" }}
          >
            LENDER
          </span>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {NAV_SECTIONS.map((section, si) => {
            const sectionItems = navItems.filter((item) => section.paths.includes(item.path));
            if (sectionItems.length === 0) return null;
            return (
              <div key={si} className="space-y-0.5">
                {section.label && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                    {section.label}
                  </p>
                )}
                {sectionItems.map((item) => renderNavItem(item))}
              </div>
            );
          })}

          {/* Settings section */}
          <div className="space-y-0.5">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              Settings
            </p>
            {navItems
              .filter((item) => SETTINGS_PATHS.includes(item.path))
              .map((item) => renderNavItem(item))}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-2 pb-3 pt-2 border-t border-white/5 space-y-1">
          <NavLink
            to="/servicer/overview"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition ${
                isActive ? "bg-amber-500/15 text-amber-300" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
              }`
            }
          >
            <span>⚙</span>
            <span>Servicer Portal</span>
          </NavLink>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-white/5 hover:text-slate-300 disabled:opacity-50 text-left"
          >
            {isSigningOut ? "Logging out…" : "Sign Out"}
          </button>
          {signOutError && <p className="text-xs text-red-400 px-3">{signOutError}</p>}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {!isDashboardRoute && !isServicingRoute && !sectionHasOwnHeader && (
          <header className="px-6 py-5 border-b border-slate-200 bg-white">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">{activeLabel}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Structured loan data infrastructure for servicing, compliance, and capital markets.
            </p>
          </header>
        )}
        <div className={isDashboardRoute || isServicingRoute ? "" : "p-6"}>
          {content}
        </div>
      </main>
    </div>
  );
}
