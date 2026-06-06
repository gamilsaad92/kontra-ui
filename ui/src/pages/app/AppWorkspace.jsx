import React from "react";
import { Link, Route, Routes, useLocation, Navigate } from "react-router-dom";
import PublicLayout from "../public/PublicLayout";
import MyPropertiesPage from "../dashboard/MyPropertiesPage";
import DocumentsPage from "../dashboard/DocumentsPage";
import WatchlistPage from "../dashboard/WatchlistPage";
import TasksPage from "../dashboard/TasksPage";
import MarketplacePage from "../dashboard/MarketplacePage";

const WORKSPACE_NAV = [
  { label: "My Properties", href: "/app/properties" },
  { label: "Documents", href: "/app/documents" },
  { label: "Watchlist", href: "/app/watchlist" },
  { label: "Inspections", href: "/app/inspections" },
  { label: "Compliance", href: "/app/compliance" },
  { label: "Tasks", href: "/app/tasks" },
];

function AppInspectionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inspections</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track inspection requests, findings, and remediation status.</p>
        </div>
        <Link to="/service-providers"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "#800020" }}>
          + Request Inspection
        </Link>
      </div>
      <div className="space-y-3">
        {[
          { property: "Westside Commons", type: "Annual Physical", inspector: "Cardinal RE Inspections", date: "Mar 15, 2025", status: "Passed", findings: 2 },
          { property: "Northgate Retail Center", type: "Annual Physical", inspector: "National Property Services", date: "Jun 22, 2025", status: "Pending", findings: null },
          { property: "Summit Industrial Park", type: "Annual Physical", inspector: "Cardinal RE Inspections", date: "Sep 1, 2025", status: "Scheduled", findings: null },
        ].map((ins, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{ins.property}</p>
                <p className="text-xs text-gray-400 mt-0.5">{ins.type} · {ins.inspector}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                ins.status === "Passed" ? "bg-green-50 text-green-700" :
                ins.status === "Pending" ? "bg-amber-50 text-amber-700" :
                "bg-purple-50 text-purple-700"
              }`}>{ins.status}</span>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
              <span>{ins.date}</span>
              {ins.findings !== null && <span>{ins.findings === 0 ? "No findings" : `${ins.findings} findings`}</span>}
            </div>
          </div>
        ))}
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400">
          <p className="text-sm font-medium">Need an inspection?</p>
          <p className="text-xs mt-1 mb-3">Connect with vetted inspectors from our marketplace.</p>
          <Link to="/service-providers"
            className="text-sm font-medium" style={{ color: "#800020" }}>
            Find Inspectors →
          </Link>
        </div>
      </div>
    </div>
  );
}

function AppCompliancePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Compliance</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track insurance, taxes, occupancy covenants, and regulatory items.</p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { title: "Insurance Expiration", property: "Westside Commons", status: "Expiring Jun 18", severity: "high", category: "Insurance" },
          { title: "Tax Payment Due", property: "Summit Industrial Park", status: "Due Jul 15", severity: "medium", category: "Tax" },
          { title: "Occupancy Covenant", property: "Westside Commons", status: "94% — Compliant", severity: "low", category: "Covenant" },
          { title: "Deferred Maintenance", property: "Northgate Retail Center", status: "3 items open", severity: "medium", category: "Maintenance" },
          { title: "Financial Reporting", property: "All Properties", status: "Due Jul 15", severity: "medium", category: "Reporting" },
          { title: "HVAC Maintenance", property: "Northgate Retail Center", status: "Scheduled Jul 1", severity: "low", category: "Maintenance" },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                item.severity === "high" ? "bg-red-500" : item.severity === "medium" ? "bg-amber-500" : "bg-green-500"
              }`} />
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.property}</p>
                <p className={`text-xs font-medium mt-1 ${
                  item.severity === "high" ? "text-red-600" : item.severity === "medium" ? "text-amber-600" : "text-green-600"
                }`}>{item.status}</p>
              </div>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 shrink-0">{item.category}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceSideBar() {
  const location = useLocation();
  return (
    <aside className="lg:w-52 shrink-0">
      <nav className="space-y-0.5">
        {WORKSPACE_NAV.map((item) => (
          <Link key={item.href} to={item.href}
            className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              location.pathname === item.href || location.pathname.startsWith(item.href + "/")
                ? "font-semibold text-red-900 bg-red-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}>
            {item.label}
          </Link>
        ))}
        <div className="pt-3 mt-3 border-t border-gray-100">
          <Link to="/properties"
            className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
            Marketplace ↗
          </Link>
          <Link to="/lender/dashboard"
            className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
            Lender Tools ↗
          </Link>
        </div>
      </nav>
    </aside>
  );
}

export default function AppWorkspace() {
  return (
    <PublicLayout hideFooter={false}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <WorkspaceSideBar />
          <div className="flex-1 min-w-0">
            <Routes>
              <Route index element={<Navigate to="/app/properties" replace />} />
              <Route path="properties" element={<MyPropertiesPage />} />
              <Route path="properties/:id" element={<MyPropertiesPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="watchlist" element={<WatchlistPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="marketplace" element={<MarketplacePage />} />
              <Route path="inspections" element={<AppInspectionsPage />} />
              <Route path="compliance" element={<AppCompliancePage />} />
              <Route path="*" element={<Navigate to="/app/properties" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
