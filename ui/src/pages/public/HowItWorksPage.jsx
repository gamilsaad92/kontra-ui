import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const STEPS = [
  {
    step: "01",
    icon: "⚙️",
    color: "#800020",
    title: "Choose your workflow and create the workspace",
    who: "Deal Owner",
    desc: "Select your transaction type — CRE Acquisition, Business Acquisition, or Fundraising. Add deal details and parties. Kontra generates a custom task checklist, document requirements, and role assignments specific to that transaction type.",
    actions: [
      "Select workflow pack: CRE Acquisition, Business Acquisition, or Fundraising",
      "Name the deal and set basic parameters",
      "Kontra builds a custom checklist for your transaction type",
      "Deal room is live in under 60 seconds",
    ],
    visual: [
      { icon: "🏢", text: "CRE Acquisition · 124 Oak St", status: "Workspace created", color: "#16a34a" },
      { icon: "💼", text: "Business Acquisition · Acme Corp", status: "Checklist ready", color: "#16a34a" },
      { icon: "📈", text: "Fundraising · Series A", status: "Roles configured", color: "#f59e0b" },
    ],
  },
  {
    step: "02",
    icon: "🔗",
    color: "#1e40af",
    title: "Invite every party with one link",
    who: "All deal parties",
    desc: "Send each participant a role-scoped invite link — no account required. Each party sees exactly what's relevant to their role. Documents they upload go directly into the right checklist slot. Nothing leaks across roles.",
    actions: [
      "Each party gets a unique, role-scoped link",
      "No sign-up required for participants",
      "Documents land in the right checklist slot automatically",
      "Owner sees everyone's status in real time",
    ],
    visual: [
      { icon: "⚖️", text: "Attorney · Deal Room Link sent", status: "Opened", color: "#16a34a" },
      { icon: "🏦", text: "Lender · Financials requested", status: "Uploading", color: "#f59e0b" },
      { icon: "🔍", text: "CPA · Q3 Statements needed", status: "Pending", color: "#9ca3af" },
      { icon: "📋", text: "Broker · NDA uploaded", status: "Verified ✓", color: "#16a34a" },
    ],
  },
  {
    step: "03",
    icon: "🤖",
    color: "#065f46",
    title: "AI Operations Manager takes over",
    who: "Every party benefits",
    desc: "Every uploaded document is analyzed by GPT-4o in seconds. Tasks are auto-assigned with deadlines. The AI Operations Manager surfaces what's blocking progress, identifies the critical path, and drafts follow-up messages before you have to ask.",
    actions: [
      "Documents analyzed and structured automatically",
      "Tasks assigned to the right party with context",
      "Critical path updated as items complete",
      "Morning Briefing and Daily Standup surface blockers each day",
    ],
    visual: [
      { icon: "⚡", text: "Purchase Agreement analyzed", status: "3 flags", color: "#f59e0b" },
      { icon: "📊", text: "Financials → EBITDA extracted", status: "Reviewed", color: "#16a34a" },
      { icon: "🚨", text: "Attorney signature pending", status: "Day 12 — overdue", color: "#dc2626" },
      { icon: "✅", text: "NDA complete · Next: LOI", status: "On track", color: "#16a34a" },
    ],
  },
  {
    step: "04",
    icon: "🏁",
    color: "#6d28d9",
    title: "Close with confidence",
    who: "Owner + All parties",
    desc: "Every critical-path item tracked. Every party working from the same verified documents. The Operations Manager tells you each morning exactly where the deal stands and what needs to happen today to stay on schedule.",
    actions: [
      "Deal health score shows readiness at a glance",
      "All checklist items verified before closing",
      "Full audit log of every action, AI recommendation, and approval",
      "Documents exported for closing or counsel review",
    ],
    visual: [
      { icon: "🟢", text: "Due Diligence", status: "Complete ✓", color: "#16a34a" },
      { icon: "🟢", text: "Financing", status: "Complete ✓", color: "#16a34a" },
      { icon: "🟢", text: "Legal Review", status: "Complete ✓", color: "#16a34a" },
      { icon: "🟡", text: "Final Signatures", status: "In progress", color: "#f59e0b" },
      { icon: "⏳", text: "Closing", status: "Scheduled", color: "#9ca3af" },
    ],
  },
];

const WORKFLOW_PACKS = [
  {
    icon: "🏢",
    title: "CRE Acquisition",
    color: "#800020",
    demoSlug: "/deal-room/kontra-demo",
    description: "Commercial real estate acquisitions, refinancing, and lending transactions.",
    parties: [
      { icon: "🏢", role: "Borrower / Owner", desc: "Creates workspace, uploads documents, tracks all parties" },
      { icon: "🏦", role: "Lender / Underwriter", desc: "Reviews AI-analyzed financials, compliance status, risk score" },
      { icon: "🔍", role: "Inspector", desc: "Submits inspection report; AI structures findings for lender" },
      { icon: "🛡️", role: "Insurance Broker", desc: "Uploads cert; AI flags coverage gaps and expiration dates" },
      { icon: "⚖️", role: "Attorney", desc: "Reviews title, legal structure, and closing documents" },
    ],
  },
  {
    icon: "💼",
    title: "Business Acquisition",
    color: "#1e40af",
    demoSlug: "/deal-room/kontra-demo-biz",
    description: "M&A transactions, business purchases, and buy-side / sell-side diligence.",
    parties: [
      { icon: "🤝", role: "Buyer", desc: "Creates workspace, drives diligence checklist, tracks all parties" },
      { icon: "🏢", role: "Seller", desc: "Uploads financials, contracts, and operating documents" },
      { icon: "📊", role: "CPA / Accountant", desc: "Provides audited financials; AI extracts EBITDA and anomalies" },
      { icon: "⚖️", role: "Attorney", desc: "Reviews purchase agreement, reps & warranties, closing docs" },
      { icon: "📋", role: "M&A Broker / Advisor", desc: "Coordinates parties, tracks LOI and deal milestones" },
    ],
  },
  {
    icon: "📈",
    title: "Fundraising",
    color: "#065f46",
    demoSlug: "/deal-room/kontra-demo-fundraising",
    description: "Capital raise processes for founders, fund managers, and deal sponsors.",
    parties: [
      { icon: "🚀", role: "Deal Principal", desc: "Creates workspace, manages investor document requests" },
      { icon: "👥", role: "Investor Relations", desc: "Coordinates LP or investor onboarding and document delivery" },
      { icon: "⚖️", role: "Legal Counsel", desc: "Reviews subscription agreements, term sheets, and compliance docs" },
      { icon: "📊", role: "Financial Advisor", desc: "Prepares financial model, projections, and data room materials" },
    ],
  },
];

export default function HowItWorksPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [activePack, setActivePack] = useState(0);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-red-400">How Kontra works</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
            One AI Operations Manager.<br />
            <span style={{ color: "#e8a0a0" }}>Every complex transaction.</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            CRE acquisitions, business acquisitions, fundraising — Kontra runs the same four-step workflow for every transaction type. See exactly how a deal moves from kickoff to close.
          </p>
        </div>
      </section>

      {/* Step-by-step */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900">The 4-step deal flow</h2>
          <p className="text-gray-500 text-sm mt-2">The same workflow engine runs every transaction type.</p>
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

      {/* Workflow packs */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Workflow Packs</p>
            <h2 className="text-2xl font-bold text-gray-900">Who's in the deal room?</h2>
            <p className="text-gray-500 text-sm mt-2">Each workflow pack configures the right roles, checklist, and tasks for your transaction type.</p>
          </div>

          {/* Pack selector */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {WORKFLOW_PACKS.map((p, i) => (
              <button key={p.title}
                onClick={() => setActivePack(i)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border-2 ${
                  activePack === i ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                style={activePack === i ? { background: p.color } : {}}>
                <span>{p.icon}</span> {p.title}
              </button>
            ))}
          </div>

          {WORKFLOW_PACKS.map((p, i) => (
            activePack === i && (
              <div key={p.title} className="max-w-2xl mx-auto bg-white rounded-2xl border-2 p-8"
                style={{ borderColor: p.color + "30" }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: p.color + "12" }}>
                    {p.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{p.title}</h3>
                    <p className="text-sm text-gray-500">{p.description}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {p.parties.map((party) => (
                    <div key={party.role} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                      <span className="text-xl mt-0.5">{party.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{party.role}</p>
                        <p className="text-xs text-gray-500 leading-snug">{party.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-5 border-t border-gray-100">
                  <Link to={p.demoSlug}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: p.color }}>
                    See a live {p.title} deal room →
                  </Link>
                </div>
              </div>
            )
          ))}
        </div>
      </section>

      {/* AI Operations Manager callout */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="rounded-3xl bg-gray-950 p-10 md:p-14 text-white text-center">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-red-400">The difference</p>
          <h2 className="text-3xl font-bold mb-4">Most deal rooms store documents.<br />Kontra runs the deal.</h2>
          <p className="text-gray-400 text-base max-w-2xl mx-auto mb-10 leading-relaxed">
            The AI Operations Manager tracks every open task, surfaces what's blocking closing, and coordinates each party — so deals don't stall in inboxes. You get a Morning Briefing and Daily Standup every day telling you exactly where the deal stands.
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-left max-w-3xl mx-auto">
            {[
              { icon: "☀️", title: "Morning Briefing", desc: "Daily AI memo: deal health, critical blockers, what needs your attention today." },
              { icon: "📊", title: "Daily Standup", desc: "End-of-day summary of every action taken, task completed, and flag raised across all parties." },
              { icon: "🎯", title: "Critical Path Tracking", desc: "AI identifies what's on the critical path and what's causing schedule risk before it becomes a problem." },
            ].map((f) => (
              <div key={f.title} className="bg-white/5 rounded-2xl p-5">
                <div className="text-2xl mb-3">{f.icon}</div>
                <p className="text-sm font-semibold mb-1">{f.title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-950 py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to run your first deal?</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Create a workspace for $499. Choose your workflow pack. Invite your parties. The AI Operations Manager handles the rest — no accounts needed for any participant.
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
