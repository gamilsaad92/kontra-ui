import { useCallback, useContext, useMemo, useState, type ComponentType } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { isFeatureEnabled } from "../lib/featureFlags";
import { resolveApiBase } from "../lib/api";
import useFeatureUsage from "../lib/useFeatureUsage";
import { lenderNavRoutes } from "../routes";
import { AuthContext } from "../lib/authContext";
import LoginForm from "../components/LoginForm.jsx";
import SignUpForm from "../components/SignUpForm.jsx";
import SaasDashboardHome from "../components/SaasDashboardHome";
import AiInsightsPage from "../features/ai-insights/page/AiInsightsPage";
import DocumentReview from "../components/DocumentReview";
import LoansDashboard from "../components/LoansDashboard";
import OnchainDashboard from "../components/OnchainDashboard";
import OrganizationSettings from "../components/OrganizationSettings";
import ProjectsTable from "../components/ProjectsTable";
import ReportBuilder from "../components/ReportBuilder";
import RiskDashboard from "../components/RiskDashboard";
import ServicingDrawsPage from "./dashboard/servicing/ServicingDrawsPage";
import ServicingBorrowerFinancialsPage from "./dashboard/servicing/ServicingBorrowerFinancialsPage";
import ServicingEscrowPage from "./dashboard/servicing/ServicingEscrowPage";
import ServicingHome from "./dashboard/servicing/ServicingHome";
import ServicingInspectionsPage from "./dashboard/servicing/ServicingInspectionsPage";
import ServicingLoansPage from "./dashboard/servicing/ServicingLoansPage";
import ServicingLayout from "./dashboard/servicing/ServicingLayout";
import ServicingManagementPage from "./dashboard/servicing/ServicingManagementPage";
import ServicingOverviewPage from "./dashboard/servicing/ServicingOverviewPage";
import ServicingPaymentsPage from "./dashboard/servicing/ServicingPaymentsPage";
import ServicingAIValidationPage from "./dashboard/servicing/ServicingAIValidationPage";
import PortfolioOverview from "./lender/PortfolioOverview";
import PortfolioLayout from "./dashboard/portfolio/PortfolioLayout";
import MarketsLayout from "./dashboard/markets/MarketsLayout";
import DistributionLayout from "./dashboard/markets/distribution/DistributionLayout";
import TokenizeLoan from "./dashboard/markets/distribution/TokenizeLoan";
import CreateOffering from "./dashboard/markets/distribution/CreateOffering";
import DistributionMarketplace from "./dashboard/markets/distribution/DistributionMarketplace";
import RfqsTrades from "./dashboard/markets/distribution/RfqsTrades";
import Approvals from "./dashboard/markets/distribution/Approvals";
import GovernanceLayout from "./dashboard/governance/GovernanceLayout";
import ApiDiagnostics from "./settings/ApiDiagnostics";
import PoolingWorkspace from "../routes/PoolingWorkspace";
import Trades from "../routes/Trades";
import Exchange from "../routes/Exchange";
import Compliance from "../routes/Compliance";
import LegalConfiguration from "../routes/LegalConfiguration";

const Placeholder = ({ title }: { title: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    <p className="mt-2 text-slate-600">Placeholder. Connect this when ready.</p>
  </div>
);

function DashboardOverview({ orgId, apiBase }: { orgId?: string | number | null; apiBase: string }) {
  return (
  <SaasDashboardHome apiBase={apiBase} orgId={orgId} />
  );
}

type NavItem = (typeof lenderNavRoutes)[number];
type AuthMode = "login" | "signup";

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

function LegacyServicingRedirect() {
  const location = useLocation();
 const suffix = location.pathname.replace(/^\/dashboard\/servicing/, "");
  return (
    <Navigate
      to={{ pathname: `/servicing${suffix}`, search: location.search }}
      replace
    />
  );
}

export default function SaasDashboard() {
 const { session, supabase, isLoading, signOut } = useContext(AuthContext);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
        <img src="/logo-dark.png" alt="Kontra" className="h-8 w-auto" />
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" />
        <p className="text-sm font-medium tracking-wide text-slate-200">
          Loading your Kontra workspace…
        </p>
      </div>
    );
  }

  if (!supabase) {
    return <SupabaseConfigNotice />;
  }

  if (!session) {
    return <AuthenticationScreen mode={authMode} onModeChange={setAuthMode} />;
  }

  return <AuthenticatedDashboard session={session} signOut={signOut} />;
}

function AuthenticationScreen({
  mode,
  onModeChange,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-xl space-y-6">
               <div className="flex justify-start">
          <img src="/logo-dark.png" alt="Kontra" className="h-8 w-auto" />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Access your Kontra workspace</h1>
          <p className="text-sm text-slate-300">
            Sign in with your Supabase credentials to manage lending, trading, and servicing tools.
          </p>
        </div>
        <div className="flex justify-center gap-2 text-sm font-medium">
          <button
            type="button"
            onClick={() => onModeChange("login")}
            className={`rounded-full px-4 py-1 transition ${
              mode === "login"
                ? "bg-white text-slate-900 shadow"
                : "bg-slate-900 text-slate-200 hover:bg-slate-800"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => onModeChange("signup")}
            className={`rounded-full px-4 py-1 transition ${
              mode === "signup"
                ? "bg-white text-slate-900 shadow"
                : "bg-slate-900 text-slate-200 hover:bg-slate-800"
            }`}
          >
            Create account
          </button>
        </div>
      <div className="rounded-2xl bg-white p-6 shadow-xl text-slate-900">
          {mode === "login" ? (
            <LoginForm className="w-full" onSwitch={() => onModeChange("signup")} />
          ) : (
            <SignUpForm className="w-full" onSwitch={() => onModeChange("login")} />
          )}
        </div>
      </div>
    </div>
  );
}

function SupabaseConfigNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Connect Supabase to enable authentication</h1>
        <p className="text-sm text-slate-300">
          Provide <code className="rounded bg-slate-900 px-1">VITE_SUPABASE_URL</code> and
          <code className="ml-1 rounded bg-slate-900 px-1">VITE_SUPABASE_ANON_KEY</code> in your environment to
          turn on secure sign-in. Once configured, reload this page to access the dashboard.
        </p>
      </div>
    </div>
  );
}

function AuthenticatedDashboard({
  session,
  signOut,
}: {
  session: Session;
 signOut: () => Promise<{ error: Error | null }>;
}) {
  const apiBase = resolveApiBase();
  const { usage, recordUsage } = useFeatureUsage();
  const userRole = session.user?.user_metadata?.role;
   const location = useLocation();
 const orgId = session.user?.user_metadata?.organization_id ?? null;
    const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const isServicingRoute =
    location.pathname.startsWith("/servicing") ||
    location.pathname.startsWith("/dashboard/servicing");
  
  const navItems = useMemo(
    () =>
      lenderNavRoutes
        .filter(
          (item) =>
            (!item.flag || isFeatureEnabled(item.flag)) &&
            (!item.roles || (userRole && item.roles.includes(userRole)))
        )
        .map((item) => {
          if (!item.children) {
            return item;
          }
          const children = item.children.filter(
            (child) =>
              (!child.flag || isFeatureEnabled(child.flag)) &&
              (!child.roles || (userRole && child.roles.includes(userRole)))
          );
          return { ...item, children };
        }),
    [isFeatureEnabled, userRole]
  );

  const activeItem = useMemo(() => {
    return (
      navItems.find(
        (item) =>
          item.path &&
          (location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`))
      ) ?? navItems[0]
    );
  }, [location.pathname, navItems]);

  const activeLabel = activeItem?.label ?? "Dashboard";
  
  const frequentItems = useMemo(() => {
    return navItems
      .filter((item) => usage[item.label])
      .sort((a, b) => (usage[b.label] ?? 0) - (usage[a.label] ?? 0))
      .slice(0, 3);
  }, [navItems, usage]);

  const handleSelectNavItem = useCallback(
    (item: NavItem) => {
      recordUsage(item.label);
    },
    [recordUsage]
  );

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon as ComponentType<{ className?: string }> | undefined;
      const active = item.path
      ? location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
      : item.label === activeLabel;
    const base = "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium";
    const state = active
      ? "bg-slate-800 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white active:bg-slate-900";
      const content = (
      <>
        {Icon && <Icon className="h-5 w-5 shrink-0" />}
        <span className="truncate">{item.label}</span>
      </>
    );

    return (
      <div key={item.label} className="space-y-1">
        {item.path ? (
          <NavLink
            to={item.path}
            className={`${base} ${state}`}
            title={item.label}
            onClick={() => handleSelectNavItem(item)}
          >
            {content}
          </NavLink>
        ) : (
          <button
            type="button"
            className={`${base} ${state}`}
            title={item.label}
            onClick={() => handleSelectNavItem(item)}
          >
            {content}
          </button>
        )}
        {item.children && item.children.length > 0 ? (
          <div className="ml-8 space-y-1">
            {item.children.map((child) => (
              <NavLink
                key={child.label}
                to={child.path ?? "#"}
                className={({ isActive }) =>
                  [
                    "block rounded-md px-3 py-1.5 text-xs font-medium transition",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white",
                  ].join(" ")
                }
                onClick={() => recordUsage(child.label)}
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

   const isDashboardRoute = location.pathname === "/dashboard";
  const content = (
    <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
     element={<DashboardOverview orgId={orgId} apiBase={apiBase} />}
      />
      <Route path="/portfolio" element={<PortfolioLayout />}>
        <Route index element={<PortfolioOverview />} />
        <Route path="loans" element={<LoansDashboard />} />
        <Route path="projects" element={<ProjectsTable />} />
      </Route>
     <Route path="/servicing" element={<ServicingLayout orgId={orgId} />}>
        <Route index element={<ServicingHome />} />
       <Route path="overview" element={<ServicingOverviewPage />} />
        <Route path="loans" element={<ServicingLoansPage />} />
        <Route path="draws" element={<ServicingDrawsPage />} />
        <Route path="inspections" element={<ServicingInspectionsPage />} />
        <Route
          path="borrower-financials"
          element={<ServicingBorrowerFinancialsPage />}
        />
        <Route path="escrow" element={<ServicingEscrowPage />} />
        <Route path="management" element={<ServicingManagementPage />} />
        <Route path="ai-validation" element={<ServicingAIValidationPage />} />
        <Route path="ai-validation/:reviewId" element={<ServicingAIValidationPage />} />
        <Route path="payments" element={<ServicingPaymentsPage />} />
      </Route>
      <Route path="/markets" element={<MarketsLayout />}>
        <Route index element={<Navigate to="/markets/pools" replace />} />
        <Route path="pools" element={<PoolingWorkspace />} />
        <Route path="tokens" element={<Placeholder title="Tokens" />} />
        <Route path="trades" element={<Trades />} />
        <Route path="exchange" element={<Exchange />} />
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
        <Route index element={<Navigate to="/governance/compliance" replace />} />
        <Route path="compliance" element={<Compliance />} />
        <Route path="legal" element={<LegalConfiguration />} />
        <Route path="document-review" element={<DocumentReview />} />
        <Route path="risk" element={<RiskDashboard />} />
      </Route>
      <Route path="/organizations" element={<OrganizationSettings />} />
    <Route path="/analytics" element={<AiInsightsPage />} />
      <Route path="/reports" element={<ReportBuilder />} />
      <Route path="/settings" element={<Navigate to="/settings/sso" replace />} />
      <Route path="/settings/sso" element={<Placeholder title="SSO" />} />
      <Route path="/settings/api-diagnostics" element={<ApiDiagnostics />} />
      <Route path="/loans" element={<LegacyRedirect to="/portfolio/loans" />} />
      <Route path="/projects" element={<LegacyRedirect to="/portfolio/projects" />} />
      <Route path="/pools" element={<LegacyRedirect to="/markets/pools" />} />
      <Route path="/pools-and-tokens" element={<LegacyRedirect to="/markets/pools" />} />
      <Route path="/tokens" element={<LegacyRedirect to="/markets/tokens" />} />
      <Route path="/trades" element={<LegacyRedirect to="/markets/trades" />} />
      <Route path="/exchange" element={<LegacyRedirect to="/markets/exchange" />} />
      <Route path="/legal" element={<LegacyRedirect to="/governance/legal" />} />
      <Route path="/compliance" element={<LegacyRedirect to="/governance/compliance" />} />
      <Route
        path="/document-review"
        element={<LegacyRedirect to="/governance/document-review" />}
      />
      <Route path="/risk" element={<LegacyRedirect to="/governance/risk" />} />
      <Route path="/applications" element={<LegacyRedirect to="/portfolio" />} />
      <Route path="/applications/*" element={<LegacyRedirect to="/portfolio" />} />
      <Route path="/application/*" element={<LegacyRedirect to="/portfolio" />} />
      <Route path="/dashboard/servicing/*" element={<LegacyServicingRedirect />} />
      <Route
        path="/dashboard/draws"
        element={<LegacyRedirect to="/servicing/draws" />}
      />
      <Route
        path="/dashboard/inspections"
        element={<LegacyRedirect to="/servicing/inspections" />}
      />
      <Route
        path="/dashboard/payments"
        element={<LegacyRedirect to="/servicing/payments" />}
      />
      <Route
        path="/dashboard/assets"
        element={<LegacyRedirect to="/servicing/loans" />}      />
      <Route path="/dashboard/payments" element={<LegacyRedirect to="/dashboard/servicing/payments" />} />
       <Route path="/assets" element={<LegacyRedirect to="/servicing/loans" />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
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
    navigate("/", { replace: true });
  };

  return (
    <>
      <div className="flex min-h-screen bg-slate-100 text-slate-900">
        <aside className="flex w-64 flex-col bg-slate-950 text-slate-100">
          <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold tracking-tight">
              <img src="/logo-dark.png" alt="Kontra" className="h-6 w-auto" />
            <span className="leading-tight text-slate-100">Control</span>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
            {frequentItems.length > 0 && (
              <div className="mb-2 space-y-1">
                {frequentItems.map((item) => renderNavItem(item))}
                <hr className="border-slate-800" />
              </div>
            )}
            {navItems.map((item) => renderNavItem(item))}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleSignOut}
                  className="w-full rounded-lg border border-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSigningOut}
              >
              {isSigningOut ? "Logging out..." : "Log Out"}
              </button>
                          {signOutError && (
                <p className="mt-2 text-xs text-rose-200" role="alert">
                  {signOutError}
                </p>
              )}
            </div>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
         {!isDashboardRoute && !isServicingRoute && (
            <header className="mb-6 space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">{activeLabel}</h1>
              <p className="text-sm text-slate-500">
                Connected lending, trading, and servicing workspaces for your active SaaS tenant.
              </p>
            </header>
          )}
           {isDashboardRoute || isServicingRoute ? content : <div className="space-y-6">{content}</div>}
        </main>
      </div>
    </>
  );
}
