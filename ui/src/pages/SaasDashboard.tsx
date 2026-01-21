import { useCallback, useContext, useEffect, useMemo, useState, type ComponentType } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { isFeatureEnabled } from "../lib/featureFlags";
import { resolveApiBase } from "../lib/api";
import useFeatureUsage from "../lib/useFeatureUsage";
import { lenderNavRoutes } from "../routes";
import { AuthContext } from "../lib/authContext";
import LoginForm from "../components/LoginForm.jsx";
import SignUpForm from "../components/SignUpForm.jsx";
import DashboardPage from "../components/DashboardPage";
import SaasDashboardHome from "../components/SaasDashboardHome";

const Placeholder = ({ title }: { title: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    <p className="mt-2 text-slate-600">Placeholder. Connect this when ready.</p>
  </div>
);

type NavItem = (typeof lenderNavRoutes)[number];
type AuthMode = "login" | "signup";

export default function SaasDashboard() {
  const { session, supabase, isLoading } = useContext(AuthContext);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Loading authentication…
      </div>
    );
  }

  if (!supabase) {
    return <SupabaseConfigNotice />;
  }

  if (!session) {
    return <AuthenticationScreen mode={authMode} onModeChange={setAuthMode} />;
  }

  return <AuthenticatedDashboard session={session} supabase={supabase} />;
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
  supabase,
}: {
  session: Session;
  supabase: SupabaseClient;
}) {
  const apiBase = resolveApiBase();
  const { usage, recordUsage } = useFeatureUsage();
  const userRole = session.user?.user_metadata?.role;

  const navItems = useMemo(
    () =>
      lenderNavRoutes.filter(
        (item) =>
          (!item.flag || isFeatureEnabled(item.flag)) &&
          (!item.roles || (userRole && item.roles.includes(userRole)))
      ),
    [isFeatureEnabled, userRole]
  );

  const [activeLabel, setActiveLabel] = useState<string>(() => navItems[0]?.label ?? "Dashboard");

  useEffect(() => {
    if (!navItems.some((item) => item.label === activeLabel)) {
      const fallback = navItems[0];
      if (fallback) {
        setActiveLabel(fallback.label);
      }
    }
  }, [activeLabel, navItems]);

  const activeItem = useMemo(() => {
    return navItems.find((item) => item.label === activeLabel);
  }, [navItems, activeLabel]);

  const frequentItems = useMemo(() => {
    return navItems
      .filter((item) => usage[item.label])
      .sort((a, b) => (usage[b.label] ?? 0) - (usage[a.label] ?? 0))
      .slice(0, 3);
  }, [navItems, usage]);

  const handleSelectNavItem = useCallback(
    (item: NavItem) => {
      setActiveLabel(item.label);
      recordUsage(item.label);
    },
    [recordUsage]
  );

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon as ComponentType<{ className?: string }> | undefined;
    const active = item.label === activeLabel;
    const base = "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium";
    const state = active
      ? "bg-slate-800 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white active:bg-slate-900";

    return (
      <button
        key={item.label}
        type="button"
        className={`${base} ${state}`}
        title={item.label}
        onClick={() => handleSelectNavItem(item)}
      >
        {Icon && <Icon className="h-5 w-5 shrink-0" />}
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  const renderContent = () => {
       if (activeLabel === "Dashboard") {
      return (
        <div className="space-y-6">
          <DashboardPage orgId={session.user?.id} />
          <SaasDashboardHome apiBase={apiBase} />
        </div>
      );
    }

    if (activeItem?.component) {
      const Component = activeItem.component as ComponentType<any>;
      return <Component />;
    }
    return <Placeholder title={activeLabel} />;
  };

  const isDashboard = activeLabel === "Dashboard";
  const content = renderContent();

  const handleSignOut = () => {
    void supabase.auth.signOut();
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
                className="w-full rounded-lg border border-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
              >
                Log Out
              </button>
            </div>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          {!isDashboard && (
            <header className="mb-6 space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">{activeLabel}</h1>
              <p className="text-sm text-slate-500">
                Connected lending, trading, and servicing workspaces for your active SaaS tenant.
              </p>
            </header>
          )}
          {isDashboard ? content : <div className="space-y-6">{content}</div>}
        </main>
      </div>
    </>
  );
}
