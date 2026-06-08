import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const FEATURED_PROPERTIES = [
  { id: "westside-commons", name: "Westside Commons", type: "Multifamily", location: "Los Angeles, CA", units: 234, occupancy: 94, risk: "Low", riskColor: "#16a34a", score: 87, inspection: "Passed" },
  { id: "meridian-tower", name: "The Meridian", type: "Office", location: "Dallas, TX", units: null, sf: "185,000", occupancy: 78, risk: "Medium", riskColor: "#d97706", score: 62, inspection: "Due Soon" },
  { id: "summit-industrial", name: "Summit Industrial Park", type: "Industrial", location: "Atlanta, GA", units: null, sf: "420,000", occupancy: 100, risk: "Low", riskColor: "#16a34a", score: 95, inspection: "Passed" },
];

const FREE_TOOLS = [
  {
    icon: "🔍",
    title: "Inspection Analyzer",
    desc: "Upload any inspection report. Get life safety findings, deferred maintenance items, and cost estimates — instantly.",
    output: ["Life Safety: 1 fire suppression deficiency", "Deferred Maintenance: $142K (HVAC + Roof)", "Priority: Roof membrane replacement within 90 days"],
  },
  {
    icon: "⚡",
    title: "Property Health Score",
    desc: "Input occupancy, NOI, age, and inspection findings. Get a 0–100 risk score with peer benchmarking.",
    output: ["Property Score: 87/100 — Low Risk", "Drivers: Occupancy (✓) NOI (✓) Age (→)", "Benchmark: Top 28% of comparable assets"],
  },
  {
    icon: "🛡️",
    title: "Insurance Review",
    desc: "Upload an insurance policy. AI flags expiration dates, missing coverage, and endorsement gaps.",
    output: ["Coverage: $12.4M replacement cost — OK", "Gap: Flood rider missing (FEMA Zone AE)", "Expiration: Policy expires in 34 days"],
  },
  {
    icon: "📊",
    title: "Financial Statement Review",
    desc: "Upload an operating statement. Get occupancy analysis, expense variance, and trend insights.",
    output: ["NOI: $2.14M YTD — 6.2% above budget", "Anomaly: Utilities 22% above prior year", "DSCR: 1.28x — Covenant compliant"],
  },
];

const WHO_ITS_FOR = [
  {
    icon: "🏢",
    role: "Property Owners",
    pain: "Documents everywhere. Inspections everywhere. Vendor tracking in spreadsheets.",
    solution: "One workspace per property — documents, inspections, vendors, compliance, and AI tools.",
    count: "5–50 properties",
  },
  {
    icon: "📊",
    role: "Asset Managers",
    pain: "Portfolio monitoring across dozens of properties in Excel.",
    solution: "Real-time property health scores, compliance alerts, and AI document review across your entire portfolio.",
    count: "Portfolio oversight",
  },
  {
    icon: "🔧",
    role: "Property Managers",
    pain: "Inspections, vendors, compliance deadlines — all in different systems.",
    solution: "Track inspections, manage vendors, stay ahead of compliance, and connect with service providers on one platform.",
    count: "Day-to-day ops",
  },
];

const PROPERTY_TREE = [
  { icon: "📁", label: "Documents", desc: "Rent rolls, financials, leases, insurance" },
  { icon: "💰", label: "Financials", desc: "NOI, DSCR, occupancy, budget vs. actual" },
  { icon: "🔍", label: "Inspections", desc: "Reports, findings, deferred maintenance" },
  { icon: "✅", label: "Compliance", desc: "Insurance, taxes, covenants, deadlines" },
  { icon: "🤝", label: "Service Providers", desc: "Inspectors, engineers, managers, lenders" },
  { icon: "🤖", label: "AI Analysis", desc: "Instant extraction and risk flagging" },
  { icon: "⭐", label: "Watchlist", desc: "Track assets you're evaluating" },
  { icon: "🏦", label: "Loans", desc: "Lender monitoring, covenants, draws" },
];

const STATS = [
  { value: "12,400+", label: "Properties tracked" },
  { value: "840+", label: "Service providers" },
  { value: "$4.2B", label: "Assets monitored" },
  { value: "Free", label: "AI tools, no credit card" },
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTool, setExpandedTool] = useState(0);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/properties?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <PublicLayout>
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/60 text-red-300 text-xs font-medium mb-8 border border-red-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Now in early access — join 400+ CRE professionals
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
            Commercial Real Estate{" "}
            <span style={{ color: "#e8a0a0" }}>Intelligence, Operations,</span>
            {" "}and Compliance in One Platform
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Track properties, inspections, documents, compliance, vendors, and risk from a single workspace. For property owners, asset managers, and operators.
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link to="/properties"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Explore Properties
            </Link>
            <Link to="/ai-tools"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold border border-white/20 text-white hover:bg-white/10 transition">
              Try AI Tools — Free
            </Link>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex max-w-2xl mx-auto bg-white/10 rounded-xl border border-white/20 overflow-hidden backdrop-blur mb-5">
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
              className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-gray-500 outline-none"
            />
            <button type="submit"
              className="m-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#800020" }}>
              Search
            </button>
          </form>

          <div className="flex items-center justify-center gap-5 text-sm text-gray-500 flex-wrap">
            {["Multifamily", "Office", "Industrial", "Retail", "Mixed-Use"].map((t) => (
              <Link key={t} to={`/properties?type=${t.toLowerCase()}`}
                className="hover:text-gray-300 transition">{t}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
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

      {/* ── Property as the center of everything ───────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Built differently</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              The property is the center of everything
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Not lender portals. Not borrower portals. Not role-based silos. Every piece of data — documents, inspections, financials, compliance, vendors — is organized around the property itself.
            </p>
            <div className="space-y-2">
              {["Stop managing 5 spreadsheets per property", "Never miss an insurance renewal or inspection deadline", "AI reviews documents in seconds, not days", "One workspace for every asset you own or manage"].map((point) => (
                <div key={point} className="flex items-start gap-2.5">
                  <span className="text-green-500 mt-0.5 text-sm">✓</span>
                  <span className="text-sm text-gray-700">{point}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Property tree visualization */}
          <div className="bg-gray-950 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="text-xl">🏢</div>
              <div>
                <p className="text-sm font-semibold">Westside Commons</p>
                <p className="text-xs text-gray-400">Los Angeles, CA · Multifamily · 234 units</p>
              </div>
              <div className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900/50 text-green-400">87/100</div>
            </div>
            <div className="space-y-2">
              {PROPERTY_TREE.map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-default">
                  <span className="text-base w-6 text-center">{item.icon}</span>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-white">{item.label}</span>
                    <span className="ml-2 text-xs text-gray-500">{item.desc}</span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Who it's for ───────────────────────────────────────── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Who uses Kontra</p>
            <h2 className="text-2xl font-bold text-gray-900">Built for the people who run real estate</h2>
            <p className="text-gray-500 mt-2 text-sm">Not banks. Not institutions. The people who actually manage the assets.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {WHO_ITS_FOR.map((who) => (
              <div key={who.role} className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="text-3xl mb-4">{who.icon}</div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base font-bold text-gray-900">{who.role}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{who.count}</span>
                </div>
                <p className="text-sm text-gray-400 mb-3 leading-relaxed italic">"{who.pain}"</p>
                <p className="text-sm text-gray-700 leading-relaxed">{who.solution}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Free AI Tools ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-4 border border-green-200">
            ✓ Free — No account required
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Free AI tools for CRE operators</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
            Upload a document and get AI-powered results in seconds. No credit card, no signup required for the basic tools.
          </p>
        </div>

        {/* Interactive tool cards */}
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          {FREE_TOOLS.map((tool, i) => (
            <div key={tool.title}
              className={`bg-white rounded-2xl border transition-all overflow-hidden cursor-pointer ${
                expandedTool === i ? "border-red-200 shadow-md" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
              onClick={() => setExpandedTool(expandedTool === i ? null : i)}>
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-3xl">{tool.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900">{tool.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Free</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
                  </div>
                </div>

                {/* Sample output terminal */}
                <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    </div>
                    <span className="text-gray-500 text-xs">Sample Output</span>
                  </div>
                  {tool.output.map((line, j) => (
                    <div key={j} className="mb-1">
                      <span className="text-green-400">→ </span>
                      <span className="text-gray-300">{line}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Link to="/ai-tools"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: "#800020" }}>
                    Try {tool.title} →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/ai-tools"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            See all AI tools
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Featured Properties ─────────────────────────────────── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#800020" }}>Marketplace</p>
              <h2 className="text-2xl font-bold text-gray-900">Properties on Kontra</h2>
              <p className="text-sm text-gray-500 mt-1">Browse, analyze, and manage CRE assets — all in one place.</p>
            </div>
            <Link to="/properties" className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1">
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
                    <div className="text-5xl opacity-20">
                      {p.type === "Multifamily" ? "🏠" : p.type === "Industrial" ? "🏭" : "🏢"}
                    </div>
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 rounded-md bg-white/90 text-xs font-medium text-gray-700">{p.type}</span>
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
        </div>
      </section>

      {/* ── Compliance section ──────────────────────────────────── */}
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
              <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-3">
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

      {/* ── Service Providers ──────────────────────────────────── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Marketplace</p>
            <h2 className="text-2xl font-bold text-gray-900">Find vetted CRE service providers</h2>
            <p className="text-gray-500 mt-2 text-sm">Inspectors, engineers, property managers, and more — connected to your properties.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { icon: "🔧", label: "Inspectors", count: 142 },
              { icon: "🏗️", label: "Engineers", count: 89 },
              { icon: "🏠", label: "Property Managers", count: 215 },
              { icon: "🛡️", label: "Insurance", count: 67 },
              { icon: "🌿", label: "Environmental", count: 54 },
              { icon: "📐", label: "Appraisers", count: 98 },
            ].map((cat) => (
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
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="rounded-2xl text-white px-8 py-14 text-center" style={{ background: "#800020" }}>
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Start with one property. Track everything.
          </h2>
          <p className="text-red-200 text-sm mb-8 max-w-lg mx-auto leading-relaxed">
            Upload a document, run AI analysis, or explore properties on the marketplace — no credit card required. When you're ready, create a free account.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/properties"
              className="px-6 py-3 rounded-xl bg-white text-sm font-semibold transition hover:bg-gray-100"
              style={{ color: "#800020" }}>
              Explore Properties
            </Link>
            <Link to="/ai-tools"
              className="px-6 py-3 rounded-xl border border-red-300/50 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 transition">
              Try AI Tools Free
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
