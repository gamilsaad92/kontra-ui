import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const CHECKLIST = [
  {
    n: 1,
    icon: "🔍",
    title: "Physical Inspection Record",
    required: "Third-party inspection within 12 months. Life safety clearance. Deferred maintenance schedule with cost estimates.",
    kontra: "Inspection Analyzer extracts findings, costs, and priorities from any report in seconds.",
    tool: "/ai-tools",
    cta: "Run Inspection Analyzer →",
  },
  {
    n: 2,
    icon: "🛡️",
    title: "Insurance Documentation",
    required: "Active policy at or above replacement cost. No coverage gaps. Minimum 30 days before expiration.",
    kontra: "Insurance Review checks coverage amounts, flags gaps, and tracks expiration dates automatically.",
    tool: "/ai-tools",
    cta: "Review Insurance Policy →",
  },
  {
    n: 3,
    icon: "📊",
    title: "3-Year Financial History",
    required: "T12 operating statement. Audited or CPA-reviewed. NOI trending stable or upward.",
    kontra: "Financial Statement Review validates NOI, flags anomalies, and checks DSCR against covenant thresholds.",
    tool: "/ai-tools",
    cta: "Analyze Financials →",
  },
  {
    n: 4,
    icon: "✅",
    title: "Compliance Clearance",
    required: "No outstanding code violations. Current on property taxes. Loan covenant compliance confirmed.",
    kontra: "Compliance workspace tracks all due dates, covenant status, and regulatory items across your portfolio.",
    tool: "/app/compliance",
    cta: "Open Compliance Tracker →",
  },
  {
    n: 5,
    icon: "⚖️",
    title: "Legal Entity Structure",
    required: "Clean LLC or entity holding title. Operating agreement on file. No active liens or disputes.",
    kontra: "Document workspace stores entity docs. Title review checklist guides first-time owners.",
    tool: "/app/documents",
    cta: "Upload Entity Docs →",
    comingSoon: false,
  },
];

const PARTNERS = [
  { name: "Securitize", desc: "Institutional tokenization", color: "#1e40af" },
  { name: "Republic", desc: "Retail and accredited investors", color: "#7c3aed" },
  { name: "tZERO", desc: "ATS-licensed secondary market", color: "#065f46" },
  { name: "Ondo Finance", desc: "DeFi yield on real assets", color: "#92400e" },
];

const STEPS = [
  { n: "01", title: "Add your property", desc: "Name, address, type, occupancy. 2 minutes." },
  { n: "02", title: "Upload your documents", desc: "Inspection, insurance, financials. AI extracts and structures everything." },
  { n: "03", title: "Generate your readiness report", desc: "A PDF report showing tokenization readiness status across all 5 pillars — shareable with token issuers." },
];

export default function TokenizationPage() {
  const [activeStep, setActiveStep] = useState(null);

  return (
    <PublicLayout>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #800020 0%, transparent 60%), radial-gradient(circle at 80% 20%, #1d4ed8 0%, transparent 50%)" }} />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-900/40 text-amber-400 text-xs font-semibold mb-6 border border-amber-800/40">
              🔗 Real World Asset (RWA) tokenization is live — $15B+ in assets tokenized in 2025
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
              Get Your Property<br />
              <span style={{ color: "#c8a45a" }}>Tokenization-Ready</span>
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed mb-8">
              Before any property can be tokenized on a regulated platform, it needs a clean documentation stack: inspection records, insurance, financials, compliance, and legal structure.
              <br /><br />
              Kontra builds that stack automatically — using AI to extract, verify, and organize every document your property needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/login?redirect=/app/properties&action=tokenization"
                className="px-6 py-3.5 rounded-xl text-sm font-semibold text-white text-center transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Start Building Your Profile — Free
              </Link>
              <Link to="/ai-tools"
                className="px-6 py-3.5 rounded-xl border border-white/20 text-sm font-semibold text-white text-center hover:bg-white/10 transition">
                Try Free AI Tools First
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16">

        {/* ── What tokenization requires ────────────────────────── */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">The 5-Pillar Checklist</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">What Token Issuers Require</h2>
          <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
            Every major tokenization platform (Securitize, Republic, tZERO) runs due diligence against the same five categories.
            Most properties fail on at least two. Kontra closes every gap.
          </p>
        </div>

        <div className="space-y-4 mb-16">
          {CHECKLIST.map((item) => (
            <div key={item.n}
              className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Left */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-gray-50">
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-400">Pillar {item.n}</span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{item.required}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden md:block w-px bg-gray-100 self-stretch mx-4" />

                  {/* Right — Kontra's answer */}
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>
                      Kontra covers this
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed mb-3">{item.kontra}</p>
                    <Link to={item.tool}
                      className="inline-flex items-center gap-1 text-xs font-semibold transition"
                      style={{ color: "#800020" }}>
                      {item.cta}
                      {item.comingSoon && <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-600">Coming soon</span>}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── How it works ──────────────────────────────────────── */}
        <div className="rounded-2xl p-10 mb-16" style={{ background: "#0f1623" }}>
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">How It Works</p>
            <h2 className="text-2xl font-bold text-white">From Property to Tokenization-Ready in 3 Steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <div key={step.n} className="text-center">
                <div className="text-4xl font-bold mb-3" style={{ color: "#c8a45a", opacity: 0.4 }}>{step.n}</div>
                <h3 className="text-sm font-bold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Create Free Account →
            </Link>
          </div>
        </div>

        {/* ── Partner ecosystem ─────────────────────────────────── */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Partner Ecosystem</p>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Connect With Tokenization Platforms</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
              Kontra-verified properties can submit their readiness reports directly to our tokenization platform partners for expedited review.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {PARTNERS.map((p) => (
              <div key={p.name} className="bg-white rounded-xl border border-gray-200 p-5 text-center hover:shadow-sm transition">
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: p.color }}>
                  {p.name[0]}
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-0.5">{p.name}</p>
                <p className="text-xs text-gray-400">{p.desc}</p>
                <span className="inline-block mt-3 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-600 font-medium">
                  Integration coming Q3 2026
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Why credibility matters ───────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            <h3 className="text-base font-bold text-gray-900 mb-4">The credibility problem in CRE tokenization</h3>
            <div className="space-y-3">
              {[
                { icon: "❌", text: "Most properties fail tokenization due diligence because their documentation is fragmented, outdated, or missing." },
                { icon: "❌", text: "Issuers spend weeks cleaning up documents before they can even evaluate an asset." },
                { icon: "❌", text: "Property owners often don't know what's missing until the process has already started." },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 text-sm text-gray-600">
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-8">
            <h3 className="text-base font-bold text-gray-900 mb-4">How Kontra solves it</h3>
            <div className="space-y-3">
              {[
                { icon: "✓", text: "AI-extracted and structured documentation from day one — always current, always organized." },
                { icon: "✓", text: "A Tokenization Readiness Report any issuer can review in minutes, not weeks." },
                { icon: "✓", text: "Continuous compliance monitoring means your property stays ready — no scramble at deal time." },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 text-sm text-green-900">
                  <span className="shrink-0 text-green-600 font-bold">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom CTA ────────────────────────────────────────── */}
        <div className="rounded-2xl text-white px-8 py-12 text-center" style={{ background: "#800020" }}>
          <h2 className="text-2xl font-bold mb-3">Start building your tokenization profile today</h2>
          <p className="text-red-200 text-sm mb-6 max-w-md mx-auto leading-relaxed">
            Free to start. Add your first property, upload your documents, and see your readiness score. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login"
              className="px-6 py-3 rounded-xl bg-white text-sm font-semibold transition hover:bg-gray-100"
              style={{ color: "#800020" }}>
              Create Free Account
            </Link>
            <Link to="/ai-tools"
              className="px-6 py-3 rounded-xl border border-red-300/50 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 transition">
              Try AI Tools First
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
