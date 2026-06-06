import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../lib/authContext";
import PublicLayout from "./public/PublicLayout";

const WATCHLIST_PREVIEW = [
  { id: "harbor-view", name: "Harbor View Apartments", market: "Miami, FL", type: "Multifamily", occupancy: 97, risk: "Low", riskColor: "#16a34a", score: 93, update: "Inspection passed" },
  { id: "palm-garden", name: "Palm Garden Villas", market: "Las Vegas, NV", type: "Multifamily", occupancy: 95, risk: "Low", riskColor: "#16a34a", score: 90, update: "Occupancy up 2%" },
  { id: "meridian-tower", name: "The Meridian", market: "Dallas, TX", type: "Office", occupancy: 78, risk: "Medium", riskColor: "#d97706", score: 62, update: "Lease rollover risk" },
];

const RECENT_VIEWS = [
  { id: "westside-commons", name: "Westside Commons", location: "Los Angeles, CA", type: "Multifamily" },
  { id: "summit-industrial", name: "Summit Industrial Park", location: "Atlanta, GA", type: "Industrial" },
  { id: "tech-corridor", name: "Tech Corridor Campus", location: "San Jose, CA", type: "Office" },
];

const COMPLIANCE_ALERTS = [
  { label: "Insurance Expiring", property: "Westside Commons", due: "Jun 18", severity: "high" },
  { label: "Financial Report Due", property: "All Properties", due: "Jul 15", severity: "medium" },
  { label: "Inspection Scheduled", property: "Summit Industrial", due: "Sep 1", severity: "low" },
];

const AI_ACTIVITY = [
  { icon: "📄", title: "Rent Roll Analyzed", property: "Westside Commons", time: "2 hours ago", result: "94.2% occupancy confirmed" },
  { icon: "🛡️", title: "Insurance Policy Reviewed", property: "Summit Industrial", time: "Yesterday", result: "No coverage gaps" },
  { icon: "🔍", title: "Inspection Report Parsed", property: "Northgate Retail", time: "3 days ago", result: "2 moderate findings" },
];

const SEVERITY_COLORS = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };

export default function NewDashboard() {
  const { session } = useContext(AuthContext);
  const navigate = useNavigate();
  const userName = session?.user?.email?.split("@")[0] || "there";

  return (
    <PublicLayout hideFooter={false}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#800020" }}>Workspace</p>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back, {userName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Your CRE asset dashboard — properties, documents, compliance, and AI tools.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/properties"
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Browse Marketplace
            </Link>
            <Link to="/app/properties"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              My Properties
            </Link>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: "🏠", label: "My Properties", sub: "3 active", href: "/app/properties", color: "#800020" },
            { icon: "⭐", label: "Watchlist", sub: "3 saved", href: "/app/watchlist", color: "#7c3aed" },
            { icon: "📁", label: "Documents", sub: "4 uploaded", href: "/app/documents", color: "#2563eb" },
            { icon: "⚡", label: "AI Review", sub: "3 analyzed", href: "/app/documents", color: "#16a34a" },
          ].map((item) => (
            <Link key={item.label} to={item.href}
              className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl">{item.icon}</div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Watchlist + Recent */}
          <div className="lg:col-span-2 space-y-6">
            {/* Watchlist preview */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">⭐ Watchlist</h2>
                <Link to="/app/watchlist" className="text-xs font-medium" style={{ color: "#800020" }}>
                  View all →
                </Link>
              </div>
              <div className="space-y-3">
                {WATCHLIST_PREVIEW.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <Link to={`/properties/${p.id}`}
                      className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate hover:text-red-900 transition">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.market} · {p.update}</p>
                    </Link>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold" style={{ color: p.riskColor }}>{p.score}/100</p>
                      <p className="text-xs text-gray-400">{p.occupancy}% occ.</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/properties"
                className="mt-3 block text-center text-xs font-medium text-gray-400 hover:text-gray-600 transition py-2 border-t border-gray-100">
                + Discover more properties on the marketplace
              </Link>
            </div>

            {/* Recently viewed */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">🕐 Recently Viewed</h2>
                <Link to="/properties" className="text-xs font-medium" style={{ color: "#800020" }}>
                  Browse more →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {RECENT_VIEWS.map((p) => (
                  <Link key={p.id} to={`/properties/${p.id}`}
                    className="group rounded-xl border border-gray-200 hover:border-gray-300 p-3 text-center transition">
                    <div className="text-xl mb-1.5">
                      {p.type === "Multifamily" ? "🏠" : p.type === "Industrial" ? "🏭" : "🏢"}
                    </div>
                    <p className="text-xs font-medium text-gray-900 group-hover:text-red-900 transition leading-tight">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.location.split(",")[0]}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* AI Review Activity */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">🤖 AI Review Activity</h2>
                <Link to="/app/documents" className="text-xs font-medium" style={{ color: "#800020" }}>
                  View all →
                </Link>
              </div>
              <div className="space-y-3">
                {AI_ACTIVITY.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="text-lg shrink-0">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-400">{item.property} · {item.time}</p>
                      <p className="text-xs text-green-600 font-medium mt-0.5">→ {item.result}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/app/documents"
                className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Upload a Document for AI Analysis
              </Link>
            </div>
          </div>

          {/* Right: Compliance + Tasks */}
          <div className="space-y-6">
            {/* Compliance alerts */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">✅ Compliance</h2>
                <Link to="/app/compliance" className="text-xs font-medium" style={{ color: "#800020" }}>
                  View all →
                </Link>
              </div>
              <div className="space-y-2.5">
                {COMPLIANCE_ALERTS.map((alert, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: SEVERITY_COLORS[alert.severity] }} />
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{alert.label}</p>
                      <p className="text-xs text-gray-500">{alert.property}</p>
                      <p className="text-xs font-medium mt-0.5" style={{ color: SEVERITY_COLORS[alert.severity] }}>
                        Due {alert.due}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending inspections */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">🔍 Inspections</h2>
                <Link to="/app/inspections" className="text-xs font-medium" style={{ color: "#800020" }}>
                  View all →
                </Link>
              </div>
              <div className="space-y-2.5">
                {[
                  { name: "Northgate Retail Center", status: "Pending", date: "Jun 22", inspector: "National Property Services" },
                  { name: "Summit Industrial Park", status: "Scheduled", date: "Sep 1", inspector: "Cardinal RE Inspections" },
                ].map((ins, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-gray-50">
                    <p className="text-xs font-semibold text-gray-900 truncate">{ins.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{ins.inspector}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-gray-400">{ins.date}</span>
                      <span className={`text-xs font-medium ${ins.status === "Scheduled" ? "text-purple-600" : "text-amber-600"}`}>
                        {ins.status}
                      </span>
                    </div>
                  </div>
                ))}
                <Link to="/service-providers?category=Inspectors"
                  className="block text-center text-xs text-gray-400 hover:text-gray-600 pt-1">
                  + Request new inspection
                </Link>
              </div>
            </div>

            {/* Lender tools CTA */}
            <div className="rounded-2xl p-5 text-white" style={{ background: "#0f1623" }}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Advanced</p>
              <p className="text-sm font-semibold mb-1">Lender Tools</p>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Portfolio analytics, capital markets, covenant tracking, tokenization, and more.
              </p>
              <Link to="/lender/dashboard"
                className="block text-center px-3 py-2 rounded-lg text-xs font-semibold text-white border border-white/20 hover:bg-white/10 transition">
                Open Lender Portal →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
