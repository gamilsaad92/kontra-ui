// ui/src/components/DashboardShell.jsx
import { useEffect, useMemo, useState } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { Bell, Settings, Search } from "lucide-react"
import { useDayNightTheme } from "../hooks/useDayNightTheme"

// Top tabs (plain JS; no TS `as const`)
const topTabs = ["Lender/Servicer", "Investor", "Borrower", "Contractor", "Admin"]

// Only Lender routes are wired right now; others point to "/" until implemented
const topTabRoutes = {
  "Lender/Servicer": "/lender/portfolio",
  Investor: "/",
  Borrower: "/",
  Contractor: "/",
  Admin: "/",
}

const lenderSubTabs = [
  { to: "/lender/portfolio", label: "Portfolio Overview" },
  { to: "/lender/pipeline", label: "Loan Pipeline" },
  { to: "/lender/servicing", label: "Servicing Center" },
  { to: "/lender/draws", label: "Draw Requests" },
  { to: "/lender/analytics", label: "Reports & Analytics" },
]

export default function DashboardShell() {
  useDayNightTheme() // auto day/night
  const { pathname } = useLocation()
  const [activeTop, setActiveTop] = useState("Lender/Servicer")

  useEffect(() => {
    if (pathname.startsWith("/investor")) setActiveTop("Investor")
    else if (pathname.startsWith("/borrower")) setActiveTop("Borrower")
    else if (pathname.startsWith("/contractor")) setActiveTop("Contractor")
    else if (pathname.startsWith("/admin")) setActiveTop("Admin")
    else setActiveTop("Lender/Servicer")
  }, [pathname])

  const subTabs = useMemo(() => {
    switch (activeTop) {
      case "Lender/Servicer":
        return lenderSubTabs
      default:
        return []
    }
  }, [activeTop])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[rgb(8,12,20)] to-[rgb(6,8,14)] text-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-600 grid place-items-center font-semibold">K</div>
          <nav className="flex items-center gap-2">
            {topTabs.map((t) => {
              const to = topTabRoutes[t] || "/"
              const isActive = t === activeTop
              return (
                <Link
                  key={t}
                  to={to}
                  className={`px-3 py-1.5 rounded-full text-sm ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
                  title={to === "/" && t !== "Lender/Servicer" ? "Coming soon" : undefined}
                >
                  {t}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-white/10" aria-label="Search">
            <Search size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-white/10" aria-label="Settings">
            <Settings size={18} />
          </button>
          <button className="relative p-2 rounded-full hover:bg-white/10" aria-label="Notifications">
            <Bell size={18} />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500" />
          </button>
          <div className="ml-1 w-9 h-9 rounded-full bg-slate-700 grid place-items-center">G</div>
        </div>
      </header>

      {/* Sub-tabs (only for Lender for now) */}
      <div className="px-5 border-b border-white/10">
        <nav className="flex gap-5 text-sm overflow-x-auto">
          {subTabs.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                `py-3 border-b-2 -mb-px ${
                  isActive ? "border-indigo-500" : "border-transparent hover:border-white/20"
                }`
              }
              end
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Content + right rail */}
      <main className="grid lg:grid-cols-[1fr,360px] gap-6 p-5">
        <section className="min-w-0">
          <Outlet />
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur p-4">
            <h3 className="font-semibold mb-3">Notifications</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 bg-green-500 rounded-full" />
                <div>
                  <b>Report generated</b>
                  <div className="text-xs opacity-60">2 minutes ago</div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 bg-yellow-400 rounded-full" />
                <div>
                  <b>Loan LN-1021 at risk</b>
                  <div className="text-xs opacity-60">1 hour ago</div>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur p-4">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-3">
              <button className="rounded-xl border border-white/10 px-4 py-3 hover:bg-white/10 text-left">Create Loan</button>
              <button className="rounded-xl border border-white/10 px-4 py-3 hover:bg-white/10 text-left">Approve Draw</button>
              <button className="rounded-xl border border-white/10 px-4 py-3 hover:bg-white/10 text-left">Send Payoff Quote</button>
              <button className="rounded-xl border border-white/10 px-4 py-3 hover:bg-white/10 text-left">Generate Report</button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur p-4 text-center text-sm opacity-70">
            5 draw requests pending
          </div>
        </aside>
      </main>
    </div>
  )
}
