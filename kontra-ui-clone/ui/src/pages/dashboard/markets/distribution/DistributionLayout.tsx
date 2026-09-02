import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { label: "Tokenize Loan", path: "/markets/distribution/tokenize" },
  { label: "Create Offering", path: "/markets/distribution/offering" },
  { label: "Marketplace", path: "/markets/distribution/marketplace" },
  { label: "RFQs & Trades", path: "/markets/distribution/rfqs" },
  { label: "Approvals", path: "/markets/distribution/approvals" },
];

export default function DistributionLayout() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
          Private Credit Distribution
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Permissioned Private Credit Distribution
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Tokenize loans, build whitelisted RFQ offerings, and route approvals through compliance
          before anything is listed. This module is private-only (no public order book).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              [
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              ].join(" ")
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
