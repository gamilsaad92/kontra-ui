// ui/src/components/DashboardShell.jsx
import { useMemo } from "react"
import { NavLink, Outlet } from "react-router-dom"
import {
  Bell,
  Search,
  Settings as SettingsIcon,
  LayoutDashboard,
  FileText,
  Wallet,
  Wrench,
  Folder,
} from "lucide-react"

function SideItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
          isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60",
        ].join(" ")
      }
      end
    >
      <Icon size={18} />
      <span className="text-sm">{label}</span>
    </NavLink>
  )
}

export default function DashboardShell() {
  const items = useMemo(
    () => [
      { to: "/lender/portfolio", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/loans", icon: Wallet, label: "Loans" },
      { to: "/lender/underwriting", icon: FileText, label: "Applications" },
      { to: "/lender/servicing", icon: Wrench, label: "Servicing" },
      { to: "/lender/escrow", icon: Folder, label: "Projects" },
    ],
    []
  )

  return (
    <div className="min-h-screen bg-slate-950 p-5">
      {/* Outer shell with rounded corners */}
      <div className="mx-auto max-w-[1200px] rounded-2xl shadow-xl overflow-hidden ring-1 ring-black/10">
        <div className="flex">
          {/* Left Sidebar (dark) */}
          <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 p-5 space-y-6">
            <div className="text-2xl font-semibold">SaaS</div>
            <nav className="space-y-1">
              {items.map((it) => (
                <SideItem key={it.label} {...it} />
              ))}
            </nav>
          </aside>

          {/* Main column (light) */}
          <div className="flex-1 bg-slate-100">
            {/* Top bar */}
            <header className="h-16 px-6 flex items-center justify-between bg-slate-100 border-b border-slate-200/80">
              <div className="relative w-[420px] max-w-[60vw]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search..."
                  className="w-full h-9 pl-9 pr-3 rounded-md bg-white border border-slate-200 outline-none text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="flex items-center gap-3">
                <button className="p-2 rounded-full hover:bg-slate-200 text-slate-700" aria-label="Notifications">
                  <Bell size={18} />
                </button>
                <button className="p-2 rounded-full hover:bg-slate-200 text-slate-700" aria-label="Settings">
                  <SettingsIcon size={18} />
                </button>
                <div className="flex items-center gap-2 pl-2">
                  <div className="h-8 w-8 rounded-full bg-slate-300 grid place-items-center text-slate-700 text-sm">
                    O
                  </div>
                  <span className="text-sm text-slate-700">Olivia</span>
                </div>
              </div>
            </header>

            {/* Page content */}
            <main className="p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
