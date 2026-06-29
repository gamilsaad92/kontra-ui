import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const PARTIES = [
  { icon: "🏦", label: "Lenders",       color: "#800020" },
  { icon: "🏢", label: "Borrowers",     color: "#1e40af" },
  { icon: "📊", label: "Investors",     color: "#6d28d9" },
  { icon: "🔍", label: "Inspectors",    color: "#d97706" },
  { icon: "🛡️", label: "Insurers",      color: "#065f46" },
  { icon: "📐", label: "Underwriters",  color: "#7c3aed" },
  { icon: "🏗️", label: "Engineers",     color: "#0369a1" },
  { icon: "⚙️", label: "Servicers",     color: "#92400e" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: "🏢",
    title: "Owner creates the deal room",
    desc: "Add your property in minutes. Upload documents, financials, inspections — Kontra structures everything automatically.",
    color: "#800020",
  },
  {
    step: "02",
    icon: "🔗",
    title: "Invite every party with one link",
    desc: "Send your lender, inspector, insurer, and underwriter a role-scoped link. Each sees only what's relevant to them — no email chains, no forwarded PDFs.",
    color: "#1e40af",
  },
  {
    step: "03",
    icon: "🤖",
    title: "AI does the heavy lifting",
    desc: "Documents are analyzed instantly. Risk flags surface automatically. Every party gets the data they need to move fast.",
    color: "#065f46",
  },
  {
    step: "04",
    icon: "🏅",
    title: "Property becomes Investment-Ready",
    desc: "All five pillars documented and verified. Ready for financing submission and compliance review.",
    color: "#6d28d9",
  },
];

const PARTY_CARDS = [
  {
    icon: "🏦",
    role: "Lenders & Underwriters",
    color: "#800020",
    gets: ["AI-analyzed inspection reports", "Structured financial statements", "DSCR, LTV, covenant tracking", "Compliance status per property", "Digital Asset Readiness score"],
  },
  {
    icon: "🏢",
    role: "Borrowers & Owners",
    color: "#1e40af",
    gets: ["One workspace per property", "Document upload + AI review", "Deadline and compliance alerts", "Share with any party instantly", "Track deal progress end-to-end"],
  },
  {
    icon: "📊",
    role: "Investors",
    color: "#6d28d9",
    gets: ["Investment Readiness Reports", "Live NAV and occupancy data", "Token holdings and distributions", "Portfolio risk scoring", "Secondary market readiness"],
  },
  {
    icon: "🔍",
    role: "Inspectors & Engineers",
    color: "#d97706",
    gets: ["Submit reports directly to the workspace", "Findings auto-structured by AI", "Deferred maintenance tracking", "Connected to lender review", "Inspection history per property"],
  },
  {
    icon: "🛡️",
    role: "Insurance & Risk",
    color: "#065f46",
    gets: ["Policy upload and AI gap analysis", "Expiration date tracking", "Coverage verification for lenders", "Flood, liability, casualty review", "Endorsement flag alerts"],
  },
  {
    icon: "⚙️",
    role: "Servicers",
    color: "#92400e",
    gets: ["Draw management workflows", "Borrower financial monitoring", "Escrow tracking per property", "Inspection scheduling", "Covenant breach alerts"],
  },
];

const FREE_TOOLS = [
  {
    icon: "🔍",
    title: "Inspection Analyzer",
    desc: "Upload any inspection report. Get life safety findings, deferred maintenance cost estimates, and priority flags — instantly.",
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
    desc: "Upload an insurance policy. AI flags expiration dates, missing coverage types, and endorsement gaps.",
    output: ["Coverage: $12.4M replacement cost — OK", "Gap: Flood rider missing (FEMA Zone AE)", "Expiration: Policy expires in 34 days"],
  },
  {
    icon: "📊",
    title: "Financial Statement Review",
    desc: "Upload an operating statement. Get occupancy analysis, expense variance, and DSCR calculation.",
    output: ["NOI: $2.14M YTD — 6.2% above budget", "Anomaly: Utilities 22% above prior year", "DSCR: 1.28x — Covenant compliant"],
  },
];

const STATS = [
  { value: "2 min",       label: "Average deal room setup" },
  { value: "18 sec",      label: "Average AI review" },
  { value: "Unlimited",   label: "Participants supported" },
  { value: "Unlimited",   label: "Documents per deal" },
  { value: "Included",    label: "90-day access" },
];

function EmailCapture() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const base = import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") || "";
      await fetch(`${base}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch (_) {}
    setStatus("done");
    setEmail("");
  };

  return (
    <section className="border-y border-gray-100 bg-gray-50 py-12">
      <div className="max-w-xl mx-auto px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Stay in the loop</p>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Not ready to start a deal room yet?</h3>
        <p className="text-sm text-gray-500 mb-6">Get notified when we add new AI tools, party roles, and platform updates.</p>
        {status === "done" ? (
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-5 py-3 rounded-xl">
            <span>✓</span> You're on the list — we'll be in touch.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800/40"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "#800020" }}>
              {status === "loading" ? "…" : "Notify me"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [expandedTool, setExpandedTool] = useState(0);
  const [activeParty, setActiveParty] = useState(0);

  return (
    <PublicLayout>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/60 text-red-300 text-xs font-medium mb-8 border border-red-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            CRE Deal Infrastructure — Now Live
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
            The deal room where{" "}
            <span style={{ color: "#e8a0a0" }}>every CRE party</span>{" "}
            works together.
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Lenders, borrowers, inspectors, insurers, underwriters, engineers — one AI-powered workspace per property.
            Structured data. No more email chains. Every deal closed faster.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <Link to="/create-deal-room"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Create Your Deal Room — $499
            </Link>
            <Link to="/deal-room/kontra-demo"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
              View Live Demo
            </Link>
          </div>

          {/* Party strip */}
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-3xl mx-auto">
            {PARTIES.map((p) => (
              <div key={p.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-xs font-medium text-gray-300">
                <span>{p.icon}</span>
                {p.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-px bg-gray-100 rounded-2xl overflow-hidden shadow-sm">
          {STATS.map((s, i) => (
            <div key={s.label}
              className="flex flex-col items-center justify-center text-center bg-white px-5 py-6"
              style={{ borderRadius: i === 0 ? "1rem 0 0 1rem" : i === STATS.length - 1 ? "0 1rem 1rem 0" : "0" }}>
              <div className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
                {s.value}
              </div>
              <div className="text-[11px] font-medium text-gray-400 mt-2 leading-snug max-w-[90px]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>How it works</p>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">One deal. Every party. One workspace.</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
            From first document upload to financing-ready — every step happens in one place, shared across all parties in real time.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 relative">
          {/* connecting line on desktop */}
          <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gray-200" />
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="relative text-center">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl relative z-10 bg-white border-2 border-gray-200 shadow-sm">
                {step.icon}
              </div>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: step.color }}>{step.step}</div>
              <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug">{step.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/how-it-works"
            className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition">
            See the full walkthrough →
          </Link>
        </div>
      </section>

      {/* ── Deal room visualization ─────────────────────────────── */}
      <section className="bg-gray-950 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-red-400">The deal room</p>
            <h2 className="text-2xl font-bold text-white mb-3">Every party. One property. Zero email chains.</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Each party gets a role-scoped view of the same underlying data. The lender sees financials and risk. The inspector sees findings. The insurer sees coverage status. Everyone moves faster.
            </p>
          </div>

          {/* Central property card + party orbits */}
          <div className="max-w-3xl mx-auto">
            {/* Center */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-900/50 flex items-center justify-center text-lg">🏢</div>
                <div>
                  <p className="text-sm font-semibold text-white">Westside Commons</p>
                  <p className="text-xs text-gray-400">Los Angeles, CA · Multifamily · 234 units</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-900/50 text-green-400">87/100</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-900/50 text-blue-300">Deal Room Active</span>
                </div>
              </div>

              {/* Parties connected */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { icon: "🏦", label: "First Republic Lending", role: "Lender", status: "Reviewing", statusColor: "#f59e0b" },
                  { icon: "🔍", label: "Meridian Inspection Co.", role: "Inspector", status: "Report Submitted", statusColor: "#16a34a" },
                  { icon: "🛡️", label: "Covanta Insurance", role: "Insurer", status: "Cert Pending", statusColor: "#f59e0b" },
                  { icon: "📐", label: "Atlas Engineering", role: "Engineer", status: "Engaged", statusColor: "#16a34a" },
                ].map((party) => (
                  <div key={party.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-base">{party.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{party.label}</p>
                      <p className="text-[10px] text-gray-500">{party.role} · <span style={{ color: party.statusColor }}>{party.status}</span></p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Document feed */}
              <div className="space-y-1.5">
                {[
                  { icon: "📄", text: "Inspection report analyzed — 3 findings flagged", time: "2m ago", color: "#f59e0b" },
                  { icon: "💰", text: "Q3 Financials reviewed — DSCR 1.28x, compliant", time: "1h ago", color: "#16a34a" },
                  { icon: "🛡️", text: "Insurance cert requested from Covanta Insurance", time: "3h ago", color: "#3b82f6" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/3">
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-xs text-gray-400 flex-1">{item.text}</span>
                    <span className="text-[10px] text-gray-600 shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-gray-600">All parties see real-time updates. No one has to ask for a status update.</p>
          </div>
        </div>
      </section>

      {/* ── Built for every party ──────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Every party in the deal</p>
          <h2 className="text-2xl font-bold text-gray-900">Built for whoever you are in the deal</h2>
          <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto">Every role gets exactly the data they need — nothing more, nothing less.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {PARTY_CARDS.map((p, i) => (
            <button key={p.role}
              onClick={() => setActiveParty(i)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeParty === i
                  ? "text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={activeParty === i ? { background: p.color } : {}}>
              <span>{p.icon}</span>
              {p.role}
            </button>
          ))}
        </div>

        {PARTY_CARDS.map((p, i) => (
          activeParty === i && (
            <div key={p.role}
              className="max-w-2xl mx-auto bg-white rounded-2xl border-2 p-6 shadow-sm transition-all"
              style={{ borderColor: p.color + "40" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: p.color + "12" }}>
                  {p.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{p.role}</h3>
                  <p className="text-xs text-gray-400">What you get in the deal room</p>
                </div>
              </div>
              <ul className="space-y-2">
                {p.gets.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"
                      style={{ color: p.color }}>
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <Link to="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: p.color }}>
                  Start as {p.role.split(" ")[0]} →
                </Link>
              </div>
            </div>
          )
        ))}
      </section>

      {/* ── Free AI Tools ──────────────────────────────────────── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-4 border border-green-200">
              ✓ Free — No account required
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Try the AI tools — free, right now</h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
              Upload a document and get structured AI analysis in seconds. These are the same tools inside every deal room.
            </p>
          </div>

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
                  <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      </div>
                      <span className="text-gray-500 text-xs">AI Output</span>
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
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm transition">
              See all AI tools →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Kontra ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Built for how CRE actually works</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Every party gets exactly what they need — nothing more
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              CRE deals stall because the wrong people can't find the right documents. Kontra gives every party — lender, inspector, insurer, attorney — a private, role-scoped view of the same deal. No more emailing PDFs. No more "who has the latest version?"
            </p>
            <div className="space-y-2.5">
              {[
                "Lender sees financials, DSCR, and risk score",
                "Inspector uploads their report directly into the room",
                "Insurer reviews coverage gaps flagged by AI",
                "Attorney sees compliance checklist and legal docs",
                "Owner tracks everything in one dashboard",
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ background: "#800020" }}>{i + 1}</div>
                  <span className="text-sm text-gray-700">{point}</span>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link to="/create-deal-room"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Create your deal room — $499 →
              </Link>
            </div>
          </div>
          <div className="bg-gray-950 rounded-2xl p-6 text-white">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-4">Investment Readiness Report</p>
            {[
              { icon: "🔍", label: "Physical Condition",   status: "Verified",   color: "#16a34a" },
              { icon: "🛡️", label: "Insurance Coverage",  status: "Verified",   color: "#16a34a" },
              { icon: "💰", label: "Financial Review",     status: "Verified",   color: "#16a34a" },
              { icon: "✅", label: "Compliance Checklist", status: "Verified",   color: "#16a34a" },
              { icon: "📜", label: "Legal Structure",      status: "In Review",  color: "#f59e0b" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 mb-2">
                <span className="text-base w-6">{item.icon}</span>
                <span className="text-xs text-gray-300 flex-1">{item.label}</span>
                <span className="text-xs font-semibold" style={{ color: item.color }}>{item.status}</span>
              </div>
            ))}
            <div className="mt-4 px-3 py-3 rounded-xl" style={{ background: "#800020" + "20", border: "1px solid " + "#800020" + "40" }}>
              <p className="text-xs font-semibold" style={{ color: "#e8a0a0" }}>4/5 pillars complete · Ready for financing submission</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Email capture ──────────────────────────────────────── */}
      <EmailCapture />

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="bg-gray-950 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Your deal room is ready in minutes.<br />
            <span style={{ color: "#e8a0a0" }}>$499. One property. Every party included.</span>
          </h2>
          <p className="text-gray-400 text-sm mb-8 max-w-xl mx-auto leading-relaxed">
            Enter your property, invite your lender, inspector, and insurer — everyone works from the same data, no email chains.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/create-deal-room"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Create Your Deal Room →
            </Link>
            <Link to="/properties"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold border border-white/20 text-white hover:bg-white/10 transition">
              See a Live Demo
            </Link>
          </div>
          <p className="text-xs text-gray-600 mt-5">
            One-time payment · No subscription · All parties included
          </p>
        </div>
      </section>

    </PublicLayout>
  );
}
