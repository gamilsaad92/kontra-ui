import { NavLink, Outlet } from "react-router-dom";

export default function GovernanceLayout() {
  const tabs = [
    { label: "Regulatory Scan", to: "/governance/compliance", tone: "alert" },
    { label: "Policy Packs", to: "/governance/policy/packs" },
    { label: "Rule Builder", to: "/governance/policy/rules" },
    { label: "Findings", to: "/governance/policy/findings" },
    { label: "Legal Configuration", to: "/governance/legal" },
    { label: "Document Review", to: "/governance/document-review" },
    { label: "Risk Dashboard", to: "/governance/risk" },
  ] as const;

  const baseClasses =
    "rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100";
  const standardClasses = "bg-slate-100 text-slate-600 hover:bg-slate-200";
  const standardActive = "bg-slate-900 text-white";
  const alertClasses =
    "border border-red-300 bg-red-50 text-red-700 hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-400";
  const alertActive =
    "border border-red-600 bg-red-600 text-white hover:bg-red-600 hover:text-white focus-visible:ring-red-400";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Compliance & Legal</h1>
        <p className="text-sm text-slate-500">
          Monitor regulatory scans, legal controls, and evidence workflows in one workspace.
        </p>
      </header>
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            className={({ isActive }) =>
              [
                baseClasses,
                tab.tone === "alert"
                  ? isActive
                    ? alertActive
                    : alertClasses
                  : isActive
                  ? standardActive
                  : standardClasses,
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
