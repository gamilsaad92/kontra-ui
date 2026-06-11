import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const HIERARCHY = [
  { n: "01", label: "Property", desc: "The physical asset — address, type, units, financials, condition.", icon: "🏢", active: true },
  { n: "02", label: "Workspace", desc: "Documents, inspections, compliance, tasks, and AI analysis all in one place.", icon: "💼", active: true },
  { n: "03", label: "Digital Registry", desc: "A verified, tamper-evident record of the property's data history, ownership, and document trail.", icon: "🔗", active: true },
  { n: "04", label: "Financing", desc: "Loan terms, covenant tracking, and lender access — built on top of verified data.", icon: "🏦", active: false },
  { n: "05", label: "Tokenization", desc: "Digital investment listing, investor onboarding, cap table, and distributions — once the asset is Investment-Ready.", icon: "⭐", active: false },
];

const PILLARS = [
  {
    n: 1, icon: "🔍", title: "Physical Inspection Record",
    required: "Third-party inspection within 12 months. Life safety clearance. Deferred maintenance schedule.",
    kontra: "Inspection Analyzer extracts findings, costs, and priorities from any report instantly.",
    href: "/ai-tools", cta: "Run Inspection Analyzer →",
  },
  {
    n: 2, icon: "🛡️", title: "Insurance Documentation",
    required: "Active policy at or above replacement cost. No coverage gaps. Minimum 30 days before expiration.",
    kontra: "Insurance Review checks coverage amounts, flags gaps, and tracks expiration dates automatically.",
    href: "/ai-tools", cta: "Review Insurance Policy →",
  },
  {
    n: 3, icon: "📊", title: "3-Year Financial History",
    required: "T12 operating statement. NOI trending stable or upward. DSCR meets covenant thresholds.",
    kontra: "Financial Statement Review validates NOI, flags anomalies, and checks covenant compliance.",
    href: "/ai-tools", cta: "Analyze Financials →",
  },
  {
    n: 4, icon: "✅", title: "Compliance Clearance",
    required: "No outstanding code violations. Current on property taxes. No covenant breaches.",
    kontra: "Compliance workspace tracks all due dates, covenant status, and regulatory items.",
    href: "/app/compliance", cta: "Open Compliance Tracker →",
  },
  {
    n: 5, icon: "⚖️", title: "Legal Entity Structure",
    required: "Clean LLC or entity holding title. Operating agreement on file. No active liens.",
    kontra: "Document workspace stores entity docs. Title checklist guides owners through requirements.",
    href: "/app/documents", cta: "Upload Entity Docs →",
  },
];

const DIGITAL_STATUS_LEGEND = [
  { status: "Unclaimed", color: "#6b7280", bg: "#f9fafb", desc: "No digital record yet" },
  { status: "Claimed",   color: "#1e3a8a", bg: "#eff6ff", desc: "Added to Kontra workspace" },
  { status: "Verified",  color: "#065f46", bg: "#f0fdf4", desc: "Documents verified by AI" },
  { status: "Investment-Ready", color: "#92400e", bg: "#fffbeb", desc: "All 5 pillars complete" },
];

export default function TokenizationPage() {
  return (
    <PublicLayout>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #800020 0%, transparent 60%), radial-gradient(circle at 80% 20%, #1d4ed8 0%, transparent 50%)" }} />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/40 text-blue-300 text-xs font-semibold mb-6 border border-blue-800/40">
              🔗 Investment Readiness Infrastructure — Part of the Kontra Platform
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
              Build the Foundation.<br />
              <span style={{ color: "#c8a45a" }}>Then Go Further.</span>
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Tokenization isn't a product you bolt onto a property. It's what happens <em>after</em> you've built a complete, verified, trustworthy data record.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Kontra is the operating system that builds that record — document by document, inspection by inspection, compliance item by compliance item. When the asset is ready, so is the infrastructure underneath it.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/login?redirect=/app/properties"
                className="px-6 py-3.5 rounded-xl text-sm font-semibold text-white text-center transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Start With Your Properties
              </Link>
              <Link to="/ai-tools"
                className="px-6 py-3.5 rounded-xl border border-white/20 text-sm font-semibold text-white text-center hover:bg-white/10 transition">
                Try Free AI Tools
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16">

        {/* ── The Hierarchy ─────────────────────────────────────── */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">The Product Hierarchy</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Property → Workspace → Digital Registry → Financing → Tokenization</h2>
          <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
            Tokenization is the final layer — but most properties never get there because the foundation is missing. Kontra builds the foundation first.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-16">
          {HIERARCHY.map((step, i) => (
            <div key={step.n} className="flex-1 relative">
              <div className={`h-full rounded-2xl border p-5 ${step.active ? "bg-white border-gray-200" : "bg-gray-50 border-dashed border-gray-200"}`}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{step.icon}</span>
                  <span className={`text-xs font-bold ${step.active ? "text-gray-400" : "text-gray-300"}`}>{step.n}</span>
                </div>
                <p className={`text-sm font-bold mb-1.5 ${step.active ? "text-gray-900" : "text-gray-400"}`}>{step.label}</p>
                <p className={`text-xs leading-relaxed ${step.active ? "text-gray-500" : "text-gray-400"}`}>{step.desc}</p>
                {!step.active && (
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-100">In Roadmap</span>
                )}
              </div>
              {i < HIERARCHY.length - 1 && (
                <div className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-4 h-4 items-center justify-center">
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Digital Asset Status ──────────────────────────────── */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 mb-16">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">How We Track Progress</p>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Digital Asset Status</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Every property in the Kontra marketplace has a Digital Asset Status — a simple indicator of how far along it is toward investment readiness. You'll see it on property listings and inside your workspace.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                The goal isn't to rush toward tokenization. It's to build a property record clean enough that financing, investment, and eventually tokenization become natural — not scrambled.
              </p>
            </div>
            <div className="space-y-2">
              {DIGITAL_STATUS_LEGEND.map((s) => (
                <div key={s.status} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
                    style={{ background: s.bg, color: s.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                    {s.status}
                  </span>
                  <p className="text-xs text-gray-600">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Investment Readiness Checklist ────────────────────── */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">The 5-Pillar Checklist</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">What Investment-Ready Actually Means</h2>
          <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
            Every financing source, institutional investor, and tokenization platform checks the same five things. Kontra fills each gap automatically.
          </p>
        </div>

        <div className="space-y-3 mb-16">
          {PILLARS.map((item) => (
            <div key={item.n} className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-gray-50">
                      {item.icon}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-400">Pillar {item.n}</span>
                      <h3 className="text-sm font-bold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{item.required}</p>
                    </div>
                  </div>
                  <div className="hidden md:block w-px bg-gray-100 self-stretch mx-4" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>
                      Kontra covers this
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-3">{item.kontra}</p>
                    <Link to={item.href} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "#800020" }}>
                      {item.cta}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── What tokenization is (and isn't) ─────────────────── */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-7">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Tokenization isn't a starting point</h3>
            <div className="space-y-3">
              {[
                "Platforms like Securitize, Republic, and tZERO require months of due diligence before listing any property.",
                "Properties with incomplete inspection records, stale financials, or compliance gaps are rejected outright.",
                "Most owners don't discover what's missing until the deal is already in motion — costing time and money.",
                "The technology is ready. The data isn't. That's the gap Kontra fills.",
              ].map((text, i) => (
                <div key={i} className="flex gap-2.5 text-xs text-red-900 leading-relaxed">
                  <span className="shrink-0 mt-0.5 text-red-400">—</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-7">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Kontra makes the foundation inevitable</h3>
            <div className="space-y-3">
              {[
                "Every document upload, inspection run, and compliance check builds toward Investment-Ready status.",
                "AI extracts and structures data from the moment you upload — nothing needs to be re-assembled later.",
                "The Digital Registry captures a tamper-evident audit trail across the entire property history.",
                "When the asset is ready, you have everything tokenization platforms need — already organized.",
              ].map((text, i) => (
                <div key={i} className="flex gap-2.5 text-xs text-green-900 leading-relaxed">
                  <span className="shrink-0 mt-0.5 text-green-500 font-bold">✓</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Future: Partner platforms ─────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 mb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">Coming Q4 2026</p>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Tokenization Platform Integrations</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed mb-6">
            Kontra-verified properties will submit their Investment Readiness Reports directly to regulated tokenization platforms — all five pillars already documented and structured for immediate onboarding.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            {["Securitize", "Republic", "tZERO", "Ondo Finance"].map((name) => (
              <span key={name} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600">
                {name}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">Integration partnerships in progress · Early access for Investment-Ready properties</p>
        </div>

        {/* ── Bottom CTA ────────────────────────────────────────── */}
        <div className="rounded-2xl text-white px-8 py-12 text-center" style={{ background: "#800020" }}>
          <h2 className="text-2xl font-bold mb-3">Start with your properties. The rest follows.</h2>
          <p className="text-red-200 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Add your first property, upload your documents, and let Kontra build your digital record — one step at a time. Free to start.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login"
              className="px-6 py-3 rounded-xl bg-white text-sm font-semibold transition hover:bg-gray-100"
              style={{ color: "#800020" }}>
              Create Free Account
            </Link>
            <Link to="/properties"
              className="px-6 py-3 rounded-xl border border-red-300/50 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 transition">
              Browse Properties
            </Link>
          </div>
          <p className="text-xs text-red-300 mt-4">
            Already have an account? <Link to="/dashboard" className="underline hover:text-white">Go to your workspace</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
