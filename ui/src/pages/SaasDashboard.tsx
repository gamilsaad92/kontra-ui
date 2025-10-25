import { useEffect, useMemo, useState, type ComponentType } from "react";
import { isFeatureEnabled } from "../lib/featureFlags";
import useFeatureUsage from "../lib/useFeatureUsage";
import { lenderNavRoutes } from "../routes";

const Placeholder = ({ title }: { title: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    <p className="mt-2 text-slate-600">Placeholder. Connect this when ready.</p>
  </div>
);

type NavItem = (typeof lenderNavRoutes)[number];

export default function SaasDashboard() {
   const apiBase = (import.meta as any)?.env?.VITE_API_URL || "/api";
  const { usage, recordUsage } = useFeatureUsage();

  const navItems = useMemo(
    () => lenderNavRoutes.filter((item) => !item.flag || isFeatureEnabled(item.flag)),
    [isFeatureEnabled]
  );

  const [activeLabel, setActiveLabel] = useState<string>(
    () => navItems[0]?.label ?? "Dashboard"
  );
      
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
        onClick={() => {
          setActiveLabel(item.label);
          recordUsage(item.label);
        }}
      >
        {Icon && <Icon className="h-5 w-5 shrink-0" />}
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  const renderContent = () => {
     if (activeItem?.component) {
      const Component = activeItem.component as ComponentType<any>;
      if (activeLabel === "Dashboard") {
        return <Component apiBase={apiBase} />;
      }
      return <Component />;
    }
    return <Placeholder title={activeLabel} />;
  };

  const isDashboard = activeLabel === "Dashboard";
  const content = renderContent();

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-64 flex-col bg-slate-950 text-slate-100">
        <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold tracking-tight">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800">
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path className="fill-white/90" d="M12 2 3 7v10l9 5 9-5V7zM6 9l6 3 6-3" />
            </svg>
          </span>
           <span className="leading-tight">
            <span className="text-slate-100">SaaS</span> Control
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {frequentItems.length > 0 && (
            <div className="mb-2 space-y-1">
              {frequentItems.map((item) => renderNavItem(item))}
              <hr className="border-slate-800" />
            </div>
          )}
          {navItems.map((item) => renderNavItem(item))}
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
  );
}
