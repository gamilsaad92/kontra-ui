import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const FREE_TOOLS = [
  {
    icon: "🔍",
    title: "Inspection Analyzer",
    category: "Inspections",
    free: true,
    desc: "Upload any physical inspection report. Get life safety findings, deferred maintenance items, cost estimates, and a prioritized action plan — instantly.",
    output: ["Life Safety: 1 fire suppression deficiency (Section 4.2)", "Deferred Maintenance: $142K estimated (HVAC + Roof + Parking)", "Priority: Roof membrane replacement within 90 days"],
    uploadLabel: "Upload Inspection Report",
    hint: "Accepts PDF, DOCX — results in under 30 seconds",
  },
  {
    icon: "⚡",
    title: "Property Health Score",
    category: "Analytics",
    free: true,
    desc: "Input occupancy rate, NOI, year built, and any inspection findings. Get a 0–100 composite risk score with peer benchmarking against comparable assets.",
    output: ["Property Score: 87/100 — Low Risk", "Drivers: Occupancy (↑ Strong), NOI (↑ Above market), Age (→ Neutral)", "Benchmark: Top 28% of comparable multifamily assets"],
    uploadLabel: "Enter Property Data",
    hint: "No document upload needed — just fill in the form",
  },
  {
    icon: "🛡️",
    title: "Insurance Policy Review",
    category: "Insurance",
    free: true,
    desc: "Upload a property insurance policy. AI reviews coverage amounts, flags endorsement gaps, identifies expiration dates, and checks against common lender requirements.",
    output: ["Coverage: $12.4M replacement cost — matches appraisal ✓", "Gap Detected: Flood rider missing (property is FEMA Zone AE)", "Expiration: Policy expires in 34 days — renew immediately"],
    uploadLabel: "Upload Insurance Policy",
    hint: "Works with any standard property insurance declaration page",
  },
  {
    icon: "📊",
    title: "Financial Statement Review",
    category: "Financial",
    free: true,
    desc: "Upload an operating statement, T12, or budget vs. actual report. Get occupancy analysis, expense variance flags, year-over-year trends, and NOI validation.",
    output: ["NOI: $2.14M YTD — 6.2% above budget ✓", "Anomaly: Utilities expense 22% above prior year (investigate)", "Occupancy: 94.2% — trending up from 91% prior quarter"],
    uploadLabel: "Upload Financial Statement",
    hint: "Accepts Excel (.xlsx), PDF, or CSV format",
  },
];

const MORE_TOOLS = [
  {
    icon: "📄",
    title: "Lease Abstraction",
    category: "Documents",
    desc: "Extract key lease terms, tenant obligations, renewal options, rent escalations, and termination clauses from any commercial lease.",
    output: ["Term: 5-year NNN with two 5-year renewal options", "Escalations: 3% annually on base rent", "Termination: Tenant may exit with 6-month notice after Year 3"],
    uploadLabel: "Upload Lease Agreement",
  },
  {
    icon: "📋",
    title: "Rent Roll Analyzer",
    category: "Financial",
    desc: "Validate rent roll accuracy, identify occupancy discrepancies, flag below-market units, and check covenant compliance thresholds.",
    output: ["Occupancy: 94.2% (234 units / 248 total)", "Below-Market: 3 units renting 15%+ below market rate", "Covenant Status: Compliant — minimum 85% threshold met"],
    uploadLabel: "Upload Rent Roll (Excel, CSV)",
  },
  {
    icon: "🔨",
    title: "Deferred Maintenance Tracker",
    category: "Inspections",
    desc: "Combine multiple inspection reports into a single prioritized maintenance plan with cost estimates and remediation timelines.",
    output: ["Open Items: 7 (3 Critical, 2 Moderate, 2 Minor)", "Total Estimated Cost: $287,000", "Highest Priority: Boiler replacement — life safety risk"],
    uploadLabel: "Upload Inspection Reports",
  },
  {
    icon: "✅",
    title: "Compliance Checklist Generator",
    category: "Compliance",
    desc: "Extract compliance requirements from loan documents, leases, and regulatory filings and generate a live checklist with due dates.",
    output: ["Generated: 18 compliance items across 4 categories", "Upcoming: Insurance renewal (32 days), Tax payment (61 days)", "Overdue: Annual financial reporting — 2 weeks past due"],
    uploadLabel: "Upload Loan Agreement",
  },
];

const ALL_TOOLS = [...FREE_TOOLS, ...MORE_TOOLS];
const CATEGORIES = ["All", "Inspections", "Financial", "Insurance", "Analytics", "Documents", "Compliance"];

export default function AiToolsPage() {
  const [category, setCategory] = useState("All");
  const [expandedTool, setExpandedTool] = useState(null);
  const showFreeOnly = category === "All";

  const filtered = category === "All" ? ALL_TOOLS : ALL_TOOLS.filter((t) => t.category === category);

  return (
    <PublicLayout>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-gray-950 to-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-900/40 text-green-400 text-xs font-semibold mb-5 border border-green-800/40">
            ✓ 4 tools free — no account required
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">AI Tools for CRE Operators</h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
            Upload a document. Get results in seconds. Inspection analysis, health scores, insurance review, financial statement review — all free. No credit card, no login for the basics.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* ── Free tools hero section ─────────────────────────── */}
        {showFreeOnly && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Free — No Account Required</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {FREE_TOOLS.map((tool, i) => (
                <div key={tool.title}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden ${expandedTool === i ? "border-red-200 shadow-md" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}>
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="text-3xl">{tool.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-bold text-gray-900">{tool.title}</h3>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Free</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{tool.category}</span>
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
                      </div>
                    </div>

                    {/* Terminal output */}
                    <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs mb-4">
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

                    <p className="text-xs text-gray-400 mb-3">{tool.hint}</p>

                    <Link to="/login"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: "#800020" }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {tool.uploadLabel}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Category filter ─────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${category === cat ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              style={category === cat ? { background: "#800020" } : {}}>
              {cat}
            </button>
          ))}
        </div>

        {/* ── All tools grid ──────────────────────────────────── */}
        {!showFreeOnly && (
          <div className="grid md:grid-cols-2 gap-5">
            {filtered.map((tool, i) => (
              <div key={tool.title}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${expandedTool === i ? "border-red-200 shadow-md" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}>
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="text-3xl">{tool.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900">{tool.title}</h3>
                        {tool.free && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Free</span>}
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{tool.category}</span>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
                    </div>
                  </div>
                  <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs mb-4">
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
                  <Link to="/login"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: "#800020" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {tool.uploadLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── More tools (when showing All) ───────────────────── */}
        {showFreeOnly && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">More Tools — Workspace Required</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {MORE_TOOLS.map((tool, i) => (
                <div key={tool.title} className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="text-3xl">{tool.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-gray-900">{tool.title}</h3>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{tool.category}</span>
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
                      </div>
                    </div>
                    <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs mb-4">
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
                    <Link to="/login"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                      {tool.uploadLabel} →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom CTA ──────────────────────────────────────── */}
        <div className="mt-14 rounded-2xl text-white px-8 py-12 text-center" style={{ background: "#800020" }}>
          <h2 className="text-xl font-bold mb-2">Ready to run AI on your properties?</h2>
          <p className="text-red-200 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Start with the free tools. When you're ready, create a free account and connect tools to your property workspace — inspections, documents, compliance, all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login"
              className="px-6 py-3 rounded-xl bg-white text-sm font-semibold transition hover:bg-gray-100"
              style={{ color: "#800020" }}>
              Create Free Account
            </Link>
            <Link to="/properties"
              className="px-6 py-3 rounded-xl border border-red-300/50 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 transition">
              Explore Properties
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
