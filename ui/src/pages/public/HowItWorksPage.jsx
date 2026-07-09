import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const STEPS = [
  {
    step: "01",
    icon: "🏢",
    color: "#800020",
    title: "Owner creates the deal room",
    who: "Borrower / Property Owner",
    desc: "Add your property address, type, and basic details. Kontra creates a dedicated workspace for that asset — a structured deal room where everything lives.",
    actions: [
      "Upload inspection reports, financials, leases, insurance certs",
      "AI analyzes every document in seconds",
      "Property Health Score calculated automatically",
      "Compliance checklist generated from document data",
    ],
    visual: [
      { icon: "📄", text: "Inspection Report uploaded", status: "Analyzed", color: "#16a34a" },
      { icon: "💰", text: "Q3 Operating Statement", status: "Analyzed", color: "#16a34a" },
      { icon: "🛡️", text: "Insurance Certificate", status: "Processing", color: "#f59e0b" },
    ],
  },
  {
    step: "02",
    icon: "🔗",
    color: "#1e40af",
    title: "Invite every party with one link",
    who: "All deal parties",
    desc: "Share the workspace with your lender, inspector, insurance broker, engineer, or underwriter. Each gets a role-scoped view — they see exactly what's relevant to them, nothing more.",
    actions: [
      "Lender sees financials, risk score, compliance status",
      "Inspector submits and updates their report directly",
      "Insurer reviews coverage gaps flagged by AI",
      "Underwriter accesses structured data package",
    ],
    visual: [
      { icon: "🏦", text: "First Republic Lending", status: "Reviewing", color: "#f59e0b" },
      { icon: "🔍", text: "Meridian Inspections", status: "Report Submitted", color: "#16a34a" },
      { icon: "🛡️", text: "Covanta Insurance", status: "Cert Pending", color: "#f59e0b" },
      { icon: "📐", text: "Atlas Engineering", status: "Engaged", color: "#16a34a" },
    ],
  },
  {
    step: "03",
    icon: "🤖",
    color: "#065f46",
    title: "AI does the heavy lifting",
    who: "Every party benefits",
    desc: "Every uploaded document is analyzed by GPT-4o. Risk flags surface automatically. Parties get structured summaries instead of raw PDFs. Everyone moves faster because nobody has to read 80-page reports.",
    actions: [
      "Inspection: life safety findings, deferred maintenance costs, priority items",
      "Financials: NOI, DSCR, expense anomalies, covenant compliance",
      "Insurance: coverage gaps, expiration dates, endorsement issues",
      "Leases: key terms, expiration schedule, rent roll summary",
    ],
    visual: [
      { icon: "⚡", text: "Inspection analyzed in 8 seconds", status: "3 findings", color: "#f59e0b" },
      { icon: "✅", text: "DSCR calculated: 1.28x", status: "Compliant", color: "#16a34a" },
      { icon: "🚨", text: "Flood rider missing", status: "Action needed", color: "#dc2626" },
    ],
  },
  {
    step: "04",
    icon: "🏅",
    color: "#6d28d9",
    title: "Property becomes Investment-Ready",
    who: "Owner + Lender + Investor",
    desc: "When all five pillars are verified — physical, insurance, financial, compliance, legal — Kontra issues an Investment Readiness Report. The property is ready for financing, institutional investment, or tokenization.",
    actions: [
      "Investment Readiness Report generated automatically",
      "Submit directly to lenders or tokenization platforms",
      "Report shared with all parties in the deal room",
      "Property listed as Investment-Ready in the registry",
    ],
    visual: [
      { icon: "🔍", text: "Physical Condition", status: "Verified ✓", color: "#16a34a" },
      { icon: "🛡️", text: "Insurance Coverage", status: "Verified ✓", color: "#16a34a" },
      { icon: "💰", text: "Financial Review", status: "Verified ✓", color: "#16a34a" },
      { icon: "✅", text: "Compliance", status: "Verified ✓", color: "#16a34a" },
      { icon: "📜", text: "Legal Structure", status: "Verified ✓", color: "#16a34a" },
    ],
  },
];

const PARTY_FLOWS = [
  {
    icon: "🏢",
    role: "Borrower / Owner",
    color: "#800020",
    entry: "Creates the deal room",
    journey: ["Adds property details", "Uploads all documents", "AI analyzes everything", "Invites all parties", "Tracks deal progress"],
  },
  {
    icon: "🏦",
    role: "Lender",
    color: "#1e40af",
    entry: "Receives invite link",
    journey: ["Gets role-scoped access", "Reviews AI-analyzed financials", "Checks compliance status", "Downloads data package", "Issues term sheet"],
  },
  {
    icon: "🔍",
    role: "Inspector",
    color: "#d97706",
    entry: "Receives invite link",
    journey: ["Submits inspection report", "AI structures findings", "Lender sees summary", "Deferred maintenance tracked", "Follow-up items logged"],
  },
  {
    icon: "🛡️",
    role: "Insurer / Broker",
    color: "#065f46",
    entry: "Receives invite link",
    journey: ["Reviews coverage gaps flagged by AI", "Uploads insurance cert", "Expiration auto-tracked", "Lender sees coverage status", "Cert stored in registry"],
  },
  {
    icon: "📊",
    role: "Investor",
    color: "#6d28d9",
    entry: "Invited to Investment-Ready property",
    journey: ["Reviews Readiness Report", "Sees 5-pillar verification", "Accesses financial summaries", "Token structure reviewed", "Participates in deal"],
  },
];

export default function HowItWorksPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeParty, setActiveParty] = useState(0);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-red-400">How Kontra works</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
            One deal. Every party.<br />
            <span style={{ color: "#e8a0a0" }}>Zero email chains.</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            From first document to closing-ready — see exactly how a deal flows through Kontra, who does what, and what each party gets.
          </p>
        </div>
      </section>

      {/* Step-by-step */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900">The 4-step deal flow</h2>
          <p className="text-gray-500 text-sm mt-2">Click each step to see what happens and who's involved.</p>
        </div>

        {/* Step selector */}
        <div className="flex flex-col md:flex-row gap-3 mb-10">
          {STEPS.map((s, i) => (
            <button key={s.step}
              onClick={() => setActiveStep(i)}
              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                activeStep === i ? "shadow-md" : "border-gray-200 bg-white hover:border-gray-300"
              }`}
              style={activeStep === i ? { borderColor: s.color, background: s.color + "08" } : {}}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: activeStep === i ? s.color + "15" : "#f3f4f6" }}>
                {s.icon}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: activeStep === i ? s.color : "#9ca3af" }}>Step {s.step}</p>
                <p className={`text-sm font-semibold leading-snug ${activeStep === i ? "text-gray-900" : "text-gray-500"}`}>{s.title}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Active step detail */}
        {STEPS.map((s, i) => (
          activeStep === i && (
            <div key={s.step} className="grid lg:grid-cols-2 gap-10 items-start">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: s.color + "15" }}>
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: s.color }}>
                      Step {s.step} · {s.who}
                    </p>
                    <h3 className="text-xl font-bold text-gray-900">{s.title}</h3>
                  </div>
                </div>
                <p className="text-gray-600 leading-relaxed mb-5">{s.desc}</p>
                <ul className="space-y-2.5">
                  {s.actions.map((a) => (
                    <li key={a} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"
                        style={{ color: s.color }}>
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gray-950 rounded-2xl p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-4">Live in the deal room</p>
                <div className="space-y-2">
                  {s.visual.map((v) => (
                    <div key={v.text} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5">
                      <span className="text-base">{v.icon}</span>
                      <span className="text-xs text-gray-300 flex-1">{v.text}</span>
                      <span className="text-xs font-semibold" style={{ color: v.color }}>{v.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        ))}
      </section>

      {/* Party flows */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Every role explained</p>
            <h2 className="text-2xl font-bold text-gray-900">What does each party actually do?</h2>
            <p className="text-gray-500 text-sm mt-2">Select your role to see your exact journey through a deal.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {PARTY_FLOWS.map((p, i) => (
              <button key={p.role}
                onClick={() => setActiveParty(i)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeParty === i ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                style={activeParty === i ? { background: p.color } : {}}>
                <span>{p.icon}</span> {p.role}
              </button>
            ))}
          </div>

          {PARTY_FLOWS.map((p, i) => (
            activeParty === i && (
              <div key={p.role} className="max-w-2xl mx-auto bg-white rounded-2xl border-2 p-8"
                style={{ borderColor: p.color + "30" }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ background: p.color + "12" }}>
                    {p.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{p.role}</h3>
                    <p className="text-sm text-gray-400">Entry point: <span className="font-medium text-gray-600">{p.entry}</span></p>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-3 bottom-3 w-px" style={{ background: p.color + "30" }} />
                  <div className="space-y-4 pl-8">
                    {p.journey.map((step, j) => (
                      <div key={j} className="relative">
                        <div className="absolute -left-5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center"
                          style={{ borderColor: p.color }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                        </div>
                        <p className="text-sm text-gray-700">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <Link to="/deal-room/kontra-demo"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: p.color }}>
                    See {p.role} view →
                  </Link>
                </div>
              </div>
            )
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-950 py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to run your first deal?</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Create a deal room for $499. Invite your lender, inspector, and insurer. See everyone working from the same data — no accounts needed for any party.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/create-deal-room"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Create Your Workspace →
            </Link>
            <Link to="/pricing"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold border border-white/20 text-white hover:bg-white/10 transition">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
