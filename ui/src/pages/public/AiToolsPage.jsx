import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const TOOLS = [
  {
    icon: "📄",
    title: "AI Document Review",
    category: "General",
    desc: "Upload any CRE document — leases, loan agreements, service contracts — and get an instant AI summary with key terms, obligations, and risk flags.",
    output: ["Extracted: 14 key terms", "Risk Flag: Tenant termination clause (Section 12.4)", "Summary: 5-year NNN lease with annual 3% escalations and 6-month early termination window"],
    uploadLabel: "Upload Document (PDF, DOCX)",
  },
  {
    icon: "🔍",
    title: "Inspection Report Analyzer",
    category: "Inspections",
    desc: "Parse physical inspection reports to surface life safety issues, deferred maintenance items, and recommended remediation timelines — automatically.",
    output: ["Life Safety: 1 fire suppression deficiency", "Deferred Maintenance: $142,000 estimated (HVAC, Roof, Parking)", "Priority: Roof membrane replacement within 90 days"],
    uploadLabel: "Upload Inspection Report",
  },
  {
    icon: "🛡️",
    title: "Insurance Policy Review",
    category: "Insurance",
    desc: "Analyze property insurance policies for coverage gaps, endorsement requirements, and expiration risks against your loan covenants.",
    output: ["Coverage: $12.4M replacement cost — matches appraisal ✓", "Gap Detected: Flood rider missing (FEMA Zone AE)", "Expiration: Policy expires in 34 days"],
    uploadLabel: "Upload Insurance Policy",
  },
  {
    icon: "📊",
    title: "Rent Roll Analyzer",
    category: "Financial",
    desc: "Validate rent roll accuracy, identify occupancy discrepancies, flag covenant breaches, and generate pro forma summaries.",
    output: ["Occupancy: 94.2% (234 units / 248 total)", "Flag: 3 units showing rent below market by >15%", "Covenant Status: Compliant (min 85% threshold)"],
    uploadLabel: "Upload Rent Roll (Excel, CSV)",
  },
  {
    icon: "💰",
    title: "Financial Statement Analyzer",
    category: "Financial",
    desc: "Review operating statements, balance sheets, and cash flow reports for anomalies, trends, and loan covenant compliance.",
    output: ["NOI: $2.14M (YTD — 6.2% above budget)", "DSCR: 1.28x — Covenant compliant", "Anomaly: Utilities expense 22% above prior year"],
    uploadLabel: "Upload Financial Statement",
  },
  {
    icon: "🔨",
    title: "Deferred Maintenance Tracker",
    category: "Inspections",
    desc: "Organize and prioritize deferred maintenance items from multiple inspection reports into a unified action plan with cost estimates.",
    output: ["Open Items: 7 (3 Critical, 2 Moderate, 2 Minor)", "Est. Cost: $287,000", "Highest Priority: Boiler replacement (life safety)"],
    uploadLabel: "Upload Inspection Reports",
  },
  {
    icon: "✅",
    title: "Compliance Checklist Generator",
    category: "Compliance",
    desc: "Automatically generate compliance checklists from loan documents, lease agreements, and regulatory requirements.",
    output: ["Generated: 18 compliance items", "Upcoming: Insurance renewal (32 days), Tax payment (61 days)", "Overdue: Annual financial reporting (2 weeks late)"],
    uploadLabel: "Upload Loan Agreement",
  },
  {
    icon: "⚡",
    title: "Property Risk Score Generator",
    category: "Analytics",
    desc: "Aggregate data from inspections, financials, occupancy, and market conditions to produce a composite risk score with benchmarking.",
    output: ["Risk Score: 78/100 (Low-Medium)", "Drivers: Occupancy (↑), Inspection (↑), Market (→)", "Peer Benchmark: Top 35% of comparable assets"],
    uploadLabel: "Upload Property Documents",
  },
];

const CATEGORIES = ["All", "General", "Financial", "Inspections", "Insurance", "Compliance", "Analytics"];

export default function AiToolsPage() {
  const [category, setCategory] = useState("All");
  const [expandedTool, setExpandedTool] = useState(null);

  const filtered = category === "All" ? TOOLS : TOOLS.filter((t) => t.category === category);

  return (
    <PublicLayout>
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-950 to-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-red-400">AI-Powered</p>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">CRE Document Intelligence</h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
            Upload any CRE document and let Kontra's AI extract key terms, flag risks, and generate actionable summaries — in seconds, not hours.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${category === cat ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              style={category === cat ? { background: "#800020" } : {}}>
              {cat}
            </button>
          ))}
        </div>

        {/* Tools grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-5">
          {filtered.map((tool, i) => (
            <div key={tool.title}
              className={`bg-white rounded-2xl border transition-all overflow-hidden ${expandedTool === i ? "border-red-200 shadow-md" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}>
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-3xl">{tool.icon}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900">{tool.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{tool.category}</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{tool.desc}</p>
                  </div>
                </div>

                {/* Sample output preview */}
                <button onClick={() => setExpandedTool(expandedTool === i ? null : i)}
                  className="w-full text-left">
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
                </button>

                <div className="mt-4 flex items-center gap-3">
                  <Link to="/login"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: "#800020" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {tool.uploadLabel}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 rounded-2xl text-white px-8 py-12 text-center" style={{ background: "#800020" }}>
          <h2 className="text-xl font-bold mb-3">Ready to run AI on your documents?</h2>
          <p className="text-red-200 text-sm mb-6 max-w-sm mx-auto">
            Create a free account and upload your first document. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login"
              className="px-6 py-3 rounded-xl bg-white text-sm font-semibold transition hover:bg-gray-100"
              style={{ color: "#800020" }}>
              Create Free Account
            </Link>
            <Link to="/waitlist"
              className="px-6 py-3 rounded-xl border border-red-300/50 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 transition">
              Join Waitlist
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
