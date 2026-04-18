import { useCallback, useContext, useMemo, useState, type ComponentType } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { servicerNavRoutes } from "../../routes";
import { AuthContext } from "../../lib/authContext";
import useFeatureUsage from "../../lib/useFeatureUsage";
import ServicingLayout from "../../pages/dashboard/servicing/ServicingLayout";
import ServicingOverviewPage from "../../pages/dashboard/servicing/ServicingOverviewPage";
import ServicingPaymentsPage from "../../pages/dashboard/servicing/ServicingPaymentsPage";
import ServicingInspectionsPage from "../../pages/dashboard/servicing/ServicingInspectionsPage";
import ServicingDrawsPage from "../../pages/dashboard/servicing/ServicingDrawsPage";
import ServicingEscrowPage from "../../pages/dashboard/servicing/ServicingEscrowPage";
import ServicingBorrowerFinancialsPage from "../../pages/dashboard/servicing/ServicingBorrowerFinancialsPage";
import ServicingManagementPage from "../../pages/dashboard/servicing/ServicingManagementPage";
import ServicingAIOpsPage from "../../pages/dashboard/servicing/ServicingAIOpsPage";
import ServicingAIValidationPage from "../../pages/dashboard/servicing/ServicingAIValidationPage";
import {
  Bars3Icon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline";

type NavItem = (typeof servicerNavRoutes)[number];

export default function ServicerPortal() {
  const { session, signOut } = useContext(AuthContext) as any;
  const { usage, recordUsage } = useFeatureUsage();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const navItems = useMemo(
    () => servicerNavRoutes.filter((item) => !item.requiresAuth || session?.access_token),
    [session],
  );

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
    () =>
      navItems.find(
        (item) =>
          location.pathname === item.path ||
          location.pathname.startsWith(`${item.path}/`),
      ),
    [location.pathname, navItems],
  );

  const activeLabel = activeItem?.label ?? "Servicer Operations";

  const renderNavItem = useCallback(
    (item: NavItem) => {
      const Icon = item.icon as ComponentType<{ className?: string }>;
      return (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={() => { recordUsage(item.path); setMobileMenuOpen(false); }}
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition ${
              isActive || location.pathname.startsWith(`${item.path}/`)
                ? "bg-amber-500/15 text-amber-300 font-semibold"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </NavLink>
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

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 relative">
      {/* ── Sidebar ── */}
      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileMenuOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 text-slate-100 shrink-0 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo + portal badge */}
        <div className="px-4 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "#800020" }}
            >
              <span
                className="text-sm font-black text-white"
                style={{ letterSpacing: "-0.05em" }}
              >
                K
              </span>
            </div>
            <span
              className="text-base font-bold text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              Kontra
            </span>
            <button className="ml-auto md:hidden p-1 text-slate-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}><XMarkIcon className="h-5 w-5" /></button>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-700/30 px-3 py-2">
            <BuildingLibraryIcon className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-black text-amber-300 uppercase tracking-widest leading-none">
                Servicer
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Operations Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {frequentItems.length > 0 && (
            <div className="mb-2 space-y-1">
              <p className="px-3 text-xs font-bold uppercase tracking-widest text-slate-600 mb-1">
                Recent
              </p>
              {frequentItems.map((item) => renderNavItem(item))}
              <hr className="border-slate-800 my-2" />
            </div>
          )}
          {navItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Switch to Lender portal */}
        <div className="border-t border-slate-800 px-3 py-3">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" />
            <span>Lender Portal</span>
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
          {signOutError && (
            <p className="mt-2 text-xs text-red-400" role="alert">
              {signOutError}
            </p>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Page header strip */}
        <div className="border-b border-slate-200 bg-white px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-0.5">
              Servicer Operations
            </p>
            <h1 className="text-lg font-bold text-slate-900">{activeLabel}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-xs font-semibold text-amber-700">Live Servicing</span>
          </div>
        </div>

        <div className="p-6">
          <Routes>
            <Route index element={<Navigate to="/servicer/overview" replace />} />
            <Route element={<ServicingLayout />}>
              <Route path="overview" element={<ServicingOverviewPage />} />
              <Route path="payments" element={<ServicingPaymentsPage />} />
              <Route path="inspections" element={<ServicingInspectionsPage />} />
              <Route path="draws" element={<ServicingDrawsPage />} />
              <Route path="escrow" element={<ServicingEscrowPage />} />
              <Route path="borrower-financials" element={<ServicingBorrowerFinancialsPage />} />
              <Route path="management" element={<ServicingManagementPage />} />
              <Route path="ai-ops" element={<ServicingAIOpsPage />} />
              <Route path="ai-validation/:reviewId" element={<ServicingAIValidationPage />} />
              <Route path="ai-validation" element={<ServicingAIValidationPage />} />
            </Route>
            <Route
              path="*"
              element={
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Route not found — redirecting to overview…
                  <Navigate to="/servicer/overview" replace />
                </div>
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}
