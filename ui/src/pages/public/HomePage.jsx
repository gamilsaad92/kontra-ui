import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const FEATURED_PROPERTIES = [
  { id: "westside-commons", name: "Westside Commons", type: "Multifamily", location: "Los Angeles, CA", units: 234, occupancy: 94, risk: "Low", riskColor: "#16a34a", score: 87, inspection: "Passed" },
  { id: "meridian-tower", name: "The Meridian", type: "Class A Office", location: "Dallas, TX", units: null, sf: "182,000", occupancy: 78, risk: "Medium", riskColor: "#d97706", score: 62, inspection: "Due Soon" },
  { id: "summit-industrial", name: "Summit Industrial Park", type: "Industrial", location: "Atlanta, GA", units: null, sf: "145,000", occupancy: 100, risk: "Low", riskColor: "#16a34a", score: 91, inspection: "Passed" },
];

const AI_TOOLS_PREVIEW = [
  { icon: "📄", title: "AI Document Review", desc: "Extract key terms, clauses, and risks from any CRE document instantly." },
  { icon: "🔍", title: "Inspection Analyzer", desc: "Parse inspection reports and generate prioritized action items." },
  { icon: "📊", title: "Rent Roll Analyzer", desc: "Validate occupancy, identify anomalies, and flag covenant breaches." },
  { icon: "⚖️", title: "Compliance Checker", desc: "Auto-generate compliance checklists from loan documents and regulations." },
];

const STATS = [
  { value: "12,400+", label: "Properties tracked" },
  { value: "840+", label: "Service providers" },
  { value: "$4.2B", label: "Assets under management" },
  { value: "99.7%", label: "Platform uptime" },
];

const SERVICE_CATEGORIES = [
  { icon: "🔧", label: "Inspectors", count: 142 },
  { icon: "🏗️", label: "Engineers", count: 89 },
  { icon: "🏠", label: "Property Managers", count: 215 },
  { icon: "🛡️", label: "Insurance", count: 67 },
  { icon: "🌿", label: "Environmental", count: 54 },
  { icon: "📐", label: "Appraisers", count: 98 },
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/properties?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/60 text-red-300 text-xs font-medium mb-8 border border-red-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Now in early access — join 400+ CRE professionals
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
            The CRE marketplace and operating system for{" "}
            <span style={{ color: "#e8a0a0" }}>smarter asset decisions.</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Discover commercial real estate assets, manage property data, review inspections, track compliance, and connect with service providers — all in one AI-powered workspace.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex max-w-2xl mx-auto bg-white/10 rounded-xl border border-white/20 overflow-hidden backdrop-blur mb-6">
            <div className="flex items-center px-4 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
              placeholder="Search by city, property type, or address..."
              className="flex-1 bg-transparent py-4 text-sm text-white placeholder-gray-500 outline-none"
            />
            <button type="submit"
              className="m-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#800020" }}>
              Explore Properties
            </button>
          </form>

          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            {["Multifamily", "Office", "Industrial", "Retail", "Mixed-Use"].map((t) => (
              <Link key={t} to={`/properties?type=${t.toLowerCase()}`}
                className="hover:text-gray-300 transition">{t}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Properties */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#800020" }}>
              Featured
            </p>
            <h2 className="text-2xl font-bold text-gray-900">Properties on Kontra</h2>
          </div>
          <Link to="/properties"
            className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1">
            View all
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {FEATURED_PROPERTIES.map((p) => (
            <Link key={p.id} to={`/properties/${p.id}`}
              className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all overflow-hidden">
              <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-5xl opacity-20">🏢</div>
                </div>
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-1 rounded-md bg-white/90 text-xs font-medium text-gray-700">
                    {p.type}
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-1 rounded-md text-xs font-semibold"
                    style={{ background: p.riskColor + "22", color: p.riskColor }}>
                    {p.risk} Risk
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-red-900 transition">{p.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{p.location}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{p.units ? `${p.units}u` : p.sf + " SF"}</div>
                    <div className="text-xs text-gray-400">{p.units ? "Units" : "Sq Ft"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{p.occupancy}%</div>
                    <div className="text-xs text-gray-400">Occupancy</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{p.score}/100</div>
                    <div className="text-xs text-gray-400">Score</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Inspection: {p.inspection}</span>
                  <span className="text-xs font-medium" style={{ color: "#800020" }}>View →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Service Provider Marketplace */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Marketplace</p>
            <h2 className="text-2xl font-bold text-gray-900">Find vetted CRE service providers</h2>
            <p className="text-gray-500 mt-2 text-sm">Inspectors, engineers, property managers, and more — verified and ready to work.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {SERVICE_CATEGORIES.map((cat) => (
              <Link key={cat.label} to="/service-providers"
                className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm p-4 text-center transition-all group">
                <div className="text-2xl mb-2">{cat.icon}</div>
                <div className="text-sm font-medium text-gray-800 group-hover:text-red-900 transition">{cat.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{cat.count} providers</div>
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link to="/service-providers"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm transition">
              Browse all service providers
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* AI Tools Preview */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>AI-Powered</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Review any CRE document in seconds</h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Upload rent rolls, inspection reports, insurance policies, and financial statements. Kontra's AI extracts key terms, flags risks, and generates action-ready summaries.
            </p>
            <Link to="/ai-tools"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#800020" }}>
              Explore AI Tools
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {AI_TOOLS_PREVIEW.map((tool) => (
              <div key={tool.title}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
                <div className="text-xl mb-2">{tool.icon}</div>
                <div className="text-sm font-semibold text-gray-900 mb-1">{tool.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{tool.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workspace Preview */}
      <section className="bg-gray-950 py-16 text-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-red-400">Property Workspace</p>
          <h2 className="text-2xl font-bold mb-4">Your entire asset stack, in one place</h2>
          <p className="text-gray-400 text-sm max-w-xl mx-auto mb-10 leading-relaxed">
            After login, manage documents, track inspections, monitor compliance, and run AI analysis on every property — from one unified workspace.
          </p>
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto text-left">
            {[
              { icon: "📁", title: "Documents", desc: "Upload rent rolls, financials, insurance, and more. AI extracts and summarizes instantly." },
              { icon: "🔍", title: "Inspections", desc: "Track inspection history, findings, deferred maintenance, and remediation timelines." },
              { icon: "✅", title: "Compliance", desc: "Never miss a deadline. Insurance renewals, tax dates, occupancy thresholds — all monitored." },
              { icon: "⚡", title: "Tasks", desc: "Assign action items from inspections, documents, and compliance reviews to your team." },
              { icon: "📈", title: "Watchlist", desc: "Follow properties before investing, lending, buying, or servicing." },
              { icon: "🤝", title: "Service Providers", desc: "Request quotes, track vendor history, and manage contractor relationships per property." },
            ].map((item) => (
              <div key={item.title} className="bg-white/5 rounded-xl border border-white/10 p-4">
                <div className="text-xl mb-2">{item.icon}</div>
                <div className="text-sm font-semibold mb-1">{item.title}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#800020" }}>
              Launch Workspace
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Compliance / Risk section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Insurance Expiration", status: "Expiring in 12 days", color: "#dc2626" },
              { label: "Tax Payment Due", status: "Due in 28 days", color: "#d97706" },
              { label: "Occupancy Covenant", status: "94% — Compliant", color: "#16a34a" },
              { label: "Deferred Maintenance", status: "3 items open", color: "#d97706" },
              { label: "Financial Reporting", status: "On track", color: "#16a34a" },
              { label: "Open Violations", status: "None", color: "#16a34a" },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                <div className="text-xs font-semibold" style={{ color: item.color }}>{item.status}</div>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Compliance</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Monitor every risk across your portfolio</h2>
            <p className="text-gray-500 leading-relaxed">
              Kontra automatically tracks insurance expirations, tax deadlines, occupancy thresholds, deferred maintenance, and regulatory requirements — and alerts you before anything becomes a problem.
            </p>
          </div>
        </div>
      </section>

      {/* Watchlist / Investor teaser */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Watchlist</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Track assets before you invest, lend, buy, or service</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto mb-8 leading-relaxed">
            Save properties to your watchlist to monitor occupancy changes, inspection updates, compliance status, and market conditions — before you make a move.
          </p>
          <Link to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:shadow-sm transition">
            Create free account
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="rounded-2xl text-white px-8 py-14 text-center" style={{ background: "#800020" }}>
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to see Kontra in action?</h2>
          <p className="text-red-200 text-sm mb-8 max-w-md mx-auto">
            Explore properties, review AI tools, or launch the full workspace demo — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/properties"
              className="px-6 py-3 rounded-xl bg-white text-sm font-semibold transition hover:bg-gray-100"
              style={{ color: "#800020" }}>
              Explore Properties
            </Link>
            <Link to="/login"
              className="px-6 py-3 rounded-xl border border-red-300/50 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 transition">
              Launch Demo Workspace
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
