import { NavLink, Outlet } from "react-router-dom";
import ServicingCommandCenter from "../../../components/ServicingCommandCenter";

const tabs = [
  { label: "Draws", to: "/dashboard/servicing/draws" },
  { label: "Inspections", to: "/dashboard/servicing/inspections" },
  { label: "Payments", to: "/dashboard/servicing/payments" },
];

export default function ServicingLayout() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Servicing</h1>
        <p className="text-sm text-slate-500">
          Manage draws, inspections, and payments for active servicing workflows.
        </p>
      </header>
            <ServicingCommandCenter />
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            className={({ isActive }) =>
              [
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
