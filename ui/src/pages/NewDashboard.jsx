import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../lib/authContext";
import PublicLayout from "./public/PublicLayout";
import { useProperties } from "../hooks/useProperties";

const ONBOARDING_STEPS = [
  {
    n: 1, icon: "🗂️", title: "Create a deal room",
    desc: "Choose your workflow — CRE, business acquisition, fundraising, or custom.", href: "/create-deal-room",
    cta: "Create Workspace →",
  },
  {
    n: 2, icon: "📁", title: "Upload documents",
    desc: "Drop in any document — AI analyzes it instantly.", href: "/app/documents",
    cta: "Upload Document →",
  },
  {
    n: 3, icon: "🤖", title: "Run AI analysis",
    desc: "Get instant health scores, risk flags, and action items.", href: "/ai-tools",
    cta: "Try Free Tools →",
  },
];

const COMPLIANCE_ALERTS = [
  { label: "Insurance Expiring", property: "Westside Commons", due: "Jun 18", severity: "high" },
  { label: "Financial Report Due", property: "All Properties", due: "Jul 15", severity: "medium" },
  { label: "Inspection Scheduled", property: "Summit Industrial", due: "Sep 1", severity: "low" },
];

const AI_ACTIVITY = [
  { icon: "📄", title: "Rent Roll Analyzed", property: "Westside Commons", time: "2 hours ago", result: "94.2% occupancy confirmed" },
  { icon: "🛡️", title: "Insurance Policy Reviewed", property: "Summit Industrial", time: "Yesterday", result: "No coverage gaps found" },
  { icon: "🔍", title: "Inspection Report Parsed", property: "Northgate Retail", time: "3 days ago", result: "2 moderate findings" },
];

const SEVERITY_COLORS = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };

function OnboardingEmptyState({ userName }) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Welcome */}
      <div className="text-center mb-12">
        <div className="text-5xl mb-4">👋</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Kontra, {userName}</h1>
        <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
          Your workspace is ready. Create your first deal room — CRE, business acquisition, fundraising, or custom.
        </p>
      </div>

      {/* Onboarding steps */}
      <div className="grid md:grid-cols-3 gap-5 mb-12 max-w-3xl mx-auto">
        {ONBOARDING_STEPS.map((step) => (
          <Link key={step.n} to={step.href}
            className="group bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all p-6 text-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white mx-auto mb-3"
              style={{ background: step.n === 1 ? "#800020" : "#e5e7eb", color: step.n === 1 ? "white" : "#9ca3af" }}>
              {step.n}
            </div>
            <div className="text-3xl mb-3">{step.icon}</div>
            <p className="text-sm font-bold text-gray-900 mb-1 group-hover:text-red-900 transition">{step.title}</p>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">{step.desc}</p>
            <span className="text-xs font-semibold" style={{ color: "#800020" }}>{step.cta}</span>
          </Link>
        ))}
      </div>

      {/* Add property CTA */}
      <div className="text-center mb-16">
        <Link to="/create-deal-room"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "#800020" }}>
          + Create Your First Workspace
        </Link>
        <p className="text-xs text-gray-400 mt-3">$499 one-time · All parties included · Deal room live in minutes</p>
      </div>

      {/* Explore while you wait */}
      <div className="border-t border-gray-100 pt-10">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400 mb-6">
          Or explore the platform first
        </p>
        <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { icon: "🏠", title: "Browse Listings", desc: "Discover deals on the marketplace", href: "/properties" },
            { icon: "🤖", title: "Free AI Tools", desc: "Inspection analyzer, health score, and more", href: "/ai-tools" },
            { icon: "🔧", title: "Service Providers", desc: "Inspectors, appraisers, property managers", href: "/service-providers" },
          ].map((item) => (
            <Link key={item.title} to={item.href}
              className="group bg-gray-50 rounded-xl p-4 text-center hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-xs font-semibold text-gray-900 group-hover:text-red-900 transition mb-1">{item.title}</p>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropertyDashboard({ properties, userName }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#800020" }}>Workspace</p>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {userName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{properties.length} {properties.length === 1 ? "property" : "properties"} in your workspace</p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/add-property"
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            + Add Property
          </Link>
          <Link to="/properties"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            Browse Marketplace
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: "🏢", label: "My Properties", sub: `${properties.length} active`, href: "/app/properties", color: "#800020" },
          { icon: "⭐", label: "Watchlist", sub: "0 saved", href: "/app/watchlist", color: "#7c3aed" },
          { icon: "📁", label: "Documents", sub: "Upload docs", href: "/app/documents", color: "#2563eb" },
          { icon: "🤖", label: "AI Review", sub: "Free tools", href: "/ai-tools", color: "#16a34a" },
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
        {/* Left: Properties + AI tools */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Properties */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">🏢 My Properties</h2>
              <Link to="/app/properties" className="text-xs font-medium" style={{ color: "#800020" }}>
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {properties.slice(0, 3).map((p) => (
                <Link key={p.id} to="/app/properties"
                  className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-gray-100 shrink-0">
                    {p.type === "Multifamily" ? "🏠" : p.type === "Industrial" ? "🏭" : p.type === "Retail" ? "🏪" : "🏢"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.city}, {p.state} · {p.type}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{p.occupancy ? `${p.occupancy}%` : "—"}</p>
                    <p className="text-xs text-gray-400">occupancy</p>
                  </div>
                </Link>
              ))}
            </div>
            <Link to="/app/add-property"
              className="mt-3 block text-center text-xs font-medium text-gray-400 hover:text-gray-600 transition py-2 border-t border-gray-100">
              + Add another property
            </Link>
          </div>

          {/* AI tools nudge */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">🤖 AI Tools — Free</h2>
              <Link to="/ai-tools" className="text-xs font-medium" style={{ color: "#800020" }}>
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "🔍", title: "Inspection Analyzer", desc: "Upload report → get findings + cost estimates" },
                { icon: "⚡", title: "Property Health Score", desc: "Get a 0–100 risk score in seconds" },
                { icon: "🛡️", title: "Insurance Review", desc: "Find coverage gaps and expiration risks" },
                { icon: "📊", title: "Financial Review", desc: "Upload P&L → get AI analysis" },
              ].map((tool) => (
                <Link key={tool.title} to="/ai-tools"
                  className="group rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm transition p-3">
                  <div className="text-xl mb-1.5">{tool.icon}</div>
                  <p className="text-xs font-semibold text-gray-900 group-hover:text-red-900 transition">{tool.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">{tool.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Compliance + Next steps */}
        <div className="space-y-6">
          {/* Compliance */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">✅ Compliance</h2>
              <Link to="/app/compliance" className="text-xs font-medium" style={{ color: "#800020" }}>View all →</Link>
            </div>
            <div className="space-y-2.5">
              {COMPLIANCE_ALERTS.slice(0, 3).map((alert, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: SEVERITY_COLORS[alert.severity] }} />
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{alert.label}</p>
                    <p className="text-xs text-gray-500">{alert.property}</p>
                    <p className="text-xs font-medium mt-0.5" style={{ color: SEVERITY_COLORS[alert.severity] }}>Due {alert.due}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Next steps */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">📋 Next Steps</h2>
            <div className="space-y-2.5">
              {[
                { label: "Upload a document", desc: "Rent roll, inspection, insurance", href: "/app/documents", done: false },
                { label: "Run AI analysis", desc: "Free — no account needed", href: "/ai-tools", done: false },
                { label: "Request an inspection", desc: "Find inspectors in marketplace", href: "/service-providers", done: false },
              ].map((item, i) => (
                <Link key={i} to={item.href}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 transition">
                  <div className="w-4 h-4 rounded border border-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Digital Asset Registry */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">🔗 Digital Asset Registry</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100">
                Off-chain
              </span>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { label: "Properties in registry", value: properties.length },
                { label: "Verified", value: 0 },
                { label: "Investment-Ready", value: 0 },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-semibold text-gray-900">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-lg bg-gray-50 mb-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                Upload documents, complete inspections, and clear compliance to advance your properties toward Investment-Ready status.
              </p>
            </div>
            <Link to="/app/properties"
              className="block text-center text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-700">
              Open Property Registry →
            </Link>
          </div>

          {/* Lender tools */}
          <div className="rounded-2xl p-5 text-white" style={{ background: "#0f1623" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Advanced</p>
            <p className="text-sm font-semibold mb-1">Lender Tools</p>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Portfolio analytics, capital markets, covenant tracking, and more.
            </p>
            <Link to="/lender-tools"
              className="block text-center px-3 py-2 rounded-lg text-xs font-semibold text-white border border-white/20 hover:bg-white/10 transition">
              Open Lender Portal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewDashboard() {
  const { session } = useContext(AuthContext);
  const { properties, isFirstVisit } = useProperties();
  const userName = session?.user?.email?.split("@")[0] || "there";
  const showOnboarding = isFirstVisit || properties.length === 0;

  return (
    <PublicLayout hideFooter={false}>
      {showOnboarding
        ? <OnboardingEmptyState userName={userName} />
        : <PropertyDashboard properties={properties} userName={userName} />}
    </PublicLayout>
  );
}
