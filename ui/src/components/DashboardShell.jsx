import { useEffect, useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import {
  Bell, Search, Settings, LogOut, Building2, Sparkles,
  LayoutDashboard, ShieldCheck, BarChart3, LineChart,
  Users, Store, Layers, FolderTree
} from "lucide-react";
import { useDayNightTheme } from "../hooks/useDayNightTheme";

const nav = [
  { to: "/lender/portfolio",   label: "Loan Applications",  icon: LayoutDashboard },
  { to: "/lender/underwriting",label: "Underwriting",       icon: ShieldCheck },
  { to: "/lender/escrow",      label: "Escrow",             icon: Building2 },
  { to: "/lender/servicing",   label: "Servicing",          icon: Users },
  { to: "/lender/risk",        label: "Risk Monitoring",    icon: LineChart },
  { to: "/lender/investor",    label: "Investor Reporting", icon: BarChart3 },
  { to: "/lender/collections", label: "Collections",        icon: Layers },
  { to: "/lender/trading",     label: "Trading",            icon: FolderTree },
  { to: "/hospitality",        label: "Hospitality",        icon: Store },
  { to: "/analytics",          label: "Analytics",          icon: Sparkles },
  { to: "/settings",           label: "Settings",           icon: Settings },
];

export default function DashboardShell() {
  useDayNightTheme();
  const { pathname } = useLocation();
  const [q, setQ] = useState("");

  useEffect(() => {}, [pathname]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 grid place-items-center font-bold">K</div>
              <span className="font-semibold">SaaS</span>
            </Link>
            <div className="hidden md:flex items-center gap-2 ml-4">
              {["Lender/Servicer","Investor","Borrower","Contractor","Admin"].map((t) => (
                <span key={t} className="px-2 py-1 rounded-md text-xs border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full max-w-xl mx-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70" />
              <input
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder="Search loans, borrowers, docs…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 ring-slate-300 dark:ring-slate-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500" />
            </button>
            <div className="group relative">
              <button className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center font-semibold">G</button>
              <div className="hidden group-hover:block absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-3">
                <div className="px-2 py-1.5 text-sm font-medium">Olivia</div>
                <ul className="text-sm">
                  <li><a className="block px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">Profile</a></li>
                  <li><a className="block px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">Organization Settings</a></li>
                  <li>
                    <button className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-6 grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <nav className="sticky top-20 space-y-1">
            {nav.map(({to,label,icon:Icon}) => (
              <NavLink
                key={to}
                to={to}
                className={({isActive}) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg border text-sm
                   ${isActive
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"}`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
