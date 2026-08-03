import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const DEMOS = [
  { icon: "💼", label: "Business Acquisition", sub: "M&A, business purchases & diligence",             slug: "/deal-room/kontra-demo-biz",         color: "#1e40af" },
  { icon: "📈", label: "Fundraising",          sub: "Capital raises for founders & fund managers",     slug: "/deal-room/kontra-demo-fundraising", color: "#065f46" },
  { icon: "🏢", label: "CRE Acquisition",      sub: "Commercial real estate acquisitions & financing", slug: "/deal-room/kontra-demo",             color: "#800020" },
];

function ViewDemoButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="px-7 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
        View Demo
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 rounded-2xl bg-gray-900 border border-white/10 shadow-2xl z-50 overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-4 pt-3.5 pb-1">Example workspaces</p>
          {DEMOS.map(d => (
            <button
              key={d.slug}
              onClick={() => { setOpen(false); navigate(d.slug); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left group">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: d.color + "33" }}>{d.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">{d.label}</p>
                <p className="text-xs text-gray-400 truncate">{d.sub}</p>
              </div>
              <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PARTIES = [
  { icon: "🏦", label: "Lenders & Investors",  color: "#800020" },
  { icon: "🏢", label: "Buyers & Borrowers",   color: "#1e40af" },
  { icon: "🏪", label: "Sellers",              color: "#0369a1" },
  { icon: "🚀", label: "Founders & CEOs",      color: "#6d28d9" },
  { icon: "🧮", label: "CPAs & Auditors",      color: "#065f46" },
  { icon: "⚖️", label: "Legal Counsel",        color: "#374151" },
  { icon: "🔍", label: "Inspectors",           color: "#d97706" },
  { icon: "🤝", label: "Brokers & Advisors",   color: "#7c3aed" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: "✍️",
    title: "Describe your transaction",
    desc: "Tell Kontra what you're coordinating. AI generates a workspace with the right participants, document checklist, and stages — or start from a template.",
    color: "#800020",
  },
  {
    step: "02",
    icon: "🔗",
    title: "Invite participants and upload documents",
    desc: "Send each party a role-scoped link. Each person sees exactly what they're responsible for. No email chains, no forwarded PDFs.",
    color: "#1e40af",
  },
  {
    step: "03",
    icon: "🤖",
    title: "Kontra coordinates the transaction",
    desc: "The AI Operations Manager follows up with the right people, surfaces blockers, and tells you exactly what needs attention next.",
    color: "#065f46",
  },
];

const THREE_OUTCOMES = [
  {
    icon: "🔍",
    title: "Know what is blocking the transaction",
    desc: "Kontra identifies missing documents, overdue responsibilities, unresolved issues, and stalled participants.",
    color: "#800020",
  },
  {
    icon: "🤝",
    title: "Keep every party coordinated",
    desc: "Each participant receives a role-specific view and knows exactly what they are responsible for.",
    color: "#1e40af",
  },
  {
    icon: "⚡",
    title: "Move the transaction forward",
    desc: "The AI Operations Manager recommends the next action and drafts follow-ups for your approval.",
    color: "#065f46",
  },
];

const PARTY_CARDS = [
  {
    icon: "🏦",
    role: "Lenders & Investors",
    color: "#800020",
    gets: ["AI tells you the moment a deal is diligence-complete", "Financials reviewed and structured the second they arrive", "AI flags risk before it becomes your problem", "Compliance status per deal, always current", "No more chasing the other side for the next document"],
  },
  {
    icon: "🏢",
    role: "Buyers & Borrowers",
    color: "#1e40af",
    gets: ["Your AI Operations Manager coordinates the transaction for you", "It follows up with every party so you don't have to", "It tells you exactly what's blocking closing, and why", "It drafts reminders and nudges — you stay in control", "One dashboard replaces the 700-email inbox"],
  },
  {
    icon: "🏪",
    role: "Sellers",
    color: "#0369a1",
    gets: ["Upload your documents once — AI structures everything", "Know exactly what the buyer still needs from you", "No repeated requests for the same file", "Buyer's progress visible in real time", "Closing stays on track without constant check-ins"],
  },
  {
    icon: "🚀",
    role: "Founders & CEOs",
    color: "#6d28d9",
    gets: ["AI Operations Manager coordinates your entire round", "Investor data room organized and current automatically", "Know which LP is outstanding before your weekly call", "Term sheet and cap table reviewed the moment they land", "Track closing progress — AI surfaces what's blocking each investor"],
  },
  {
    icon: "🧮",
    role: "CPAs & Auditors",
    color: "#065f46",
    gets: ["Upload financials or QoE once — AI extracts the key metrics", "Your findings surface immediately to the right parties", "No reformatting or summary emails required", "Deal principal sees your analysis the moment it's submitted", "Your engagement history across every deal, in one place"],
  },
  {
    icon: "⚖️",
    role: "Counsel & Advisors",
    color: "#374151",
    gets: ["Review only what's been flagged — no document hunting", "AI structures incoming docs so you start with context", "Redlines and comments delivered to the right party instantly", "Know which document is blocking closing before the call", "Role-scoped access — no irrelevant deal noise"],
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
  { value: "2 min",       label: "Average workspace setup" },
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
        <h3 className="text-lg font-bold text-gray-900 mb-1">Not ready to start a transaction yet?</h3>
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
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
            Every transaction gets its own Operations Manager.
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI coordinates every participant, document, approval, deadline, and follow-up —
            keeping private transactions moving from kickoff to completion.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <Link to="/create-deal-room"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Create Workspace
            </Link>
            <ViewDemoButton />
          </div>
          <p className="text-xs text-gray-600">$499 · One-time · All parties included</p>
        </div>
      </section>

      {/* ── Why Kontra? comparison ─────────────────────────────── */}
      <section className="bg-gray-50 border-b border-gray-100 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Why Kontra</p>
            <h2 className="text-2xl font-bold text-gray-900">Why traditional data rooms slow transactions</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-7">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Traditional tools provide</p>
              <ul className="space-y-3">
                {[
                  "File storage only",
                  "Folder permissions",
                  "Email chains for coordination",
                  "Manual follow-ups and reminders",
                  "No ownership or status tracking",
                  "No AI coordination or analysis",
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="text-base shrink-0">❌</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-2 p-7" style={{ borderColor: "#800020", background: "#80002008" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "#800020" }}>Kontra provides</p>
              <ul className="space-y-3">
                {[
                  "AI Operations Manager per transaction",
                  "Role-specific workspaces for every party",
                  "Automated follow-ups and nudges",
                  "Missing document detection",
                  "Transaction health monitoring",
                  "Complete verified audit trail",
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-800 font-medium">
                    <span className="text-base shrink-0">✅</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Deal room visualization ─────────────────────────────── */}
      <section className="bg-gray-950 py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-red-400">The workspace</p>
            <h2 className="text-2xl font-bold text-white mb-3">Every party. One property. Zero email chains.</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Each party gets a role-scoped view of the same underlying data — and the same AI Operations Manager chasing them for what's overdue. No one has to send a follow-up email.
            </p>
          </div>

          {/* Central property card + party orbits */}
          <div className="max-w-3xl mx-auto">
            {/* Center */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 mb-4 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-900/70 flex items-center justify-center text-lg">💼</div>
                <div>
                  <p className="text-sm font-semibold text-white">Brightline Services LLC</p>
                  <p className="text-xs text-gray-300">San Francisco, CA · Business Acquisition · $6.2M</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-900/50 text-amber-400">At Risk</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-900/50 text-blue-300">Workspace Active</span>
                </div>
              </div>

              {/* Parties connected */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { icon: "🏪", label: "Tom Briggs (Seller)", role: "Seller", status: "Docs Pending", statusColor: "#f59e0b" },
                  { icon: "🧮", label: "Davidson Advisory", role: "CPA", status: "QoE Overdue", statusColor: "#ef4444" },
                  { icon: "⚖️", label: "Vance & Partners", role: "Legal Counsel", status: "Reviewing LOI", statusColor: "#f59e0b" },
                  { icon: "🤝", label: "Meridian Advisors", role: "M&A Broker", status: "CIM Submitted", statusColor: "#16a34a" },
                ].map((party) => (
                  <div key={party.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-700/60 border border-gray-600">
                    <span className="text-base">{party.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{party.label}</p>
                      <p className="text-[10px] text-gray-400">{party.role} · <span style={{ color: party.statusColor }}>{party.status}</span></p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Document feed */}
              <div className="space-y-1.5">
                {[
                  { icon: "📊", text: "QoE report is 10 days overdue — follow-up drafted for your approval", time: "2m ago", color: "#ef4444" },
                  { icon: "📄", text: "Letter of Intent analyzed — 2 open items flagged for Legal", time: "1h ago", color: "#f59e0b" },
                  { icon: "💰", text: "3-year financials reviewed — revenue trend and EBITDA margin extracted", time: "3h ago", color: "#16a34a" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-700/40 border border-gray-700/60">
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-xs text-gray-300 flex-1">{item.text}</span>
                    <span className="text-[10px] text-gray-500 shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-gray-600">All parties see real-time updates. No one has to ask for a status update.</p>
          </div>
        </div>
      </section>

      {/* ── Three outcomes ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          {THREE_OUTCOMES.map((item) => (
            <div key={item.title} className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: item.color + "12" }}>
                {item.icon}
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-14">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>How it works</p>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Up and running in minutes.</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
            Describe your transaction, invite your parties, and let Kontra coordinate everything from there.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-10 left-[16.5%] right-[16.5%] h-px bg-gray-200" />
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

      {/* ── Transaction types ──────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Built for any private transaction</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Your deal type. Your roles. Your rules.</h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
              Kontra isn't a fixed CRE tool or an M&amp;A-only platform. You define the workflow — roles, required documents, checklist stages — and Kontra runs it. Start from a template or describe your transaction to AI.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: "💼", label: "Business Acquisition", desc: "M&A diligence, QoE, LOI, legal review", tag: "Template" },
              { icon: "🏢", label: "CRE Acquisition",      desc: "Inspection, financing, title, compliance", tag: "Template" },
              { icon: "📈", label: "Fundraising",          desc: "Cap table, term sheet, investor diligence", tag: "Template" },
              { icon: "⚙️", label: "Build Your Own",       desc: "Any transaction — your roles, your docs, your checklist", tag: "Custom", custom: true },
            ].map(item => (
              <div key={item.label}
                className={`rounded-2xl p-5 border-2 ${item.custom ? "border-dashed border-gray-300 bg-white" : "border-gray-100 bg-white"}`}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.custom ? "bg-gray-100 text-gray-500" : "text-white"}`}
                    style={item.custom ? {} : { background: "#800020" }}>{item.tag}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">{item.label}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
            <p className="text-xs text-gray-400">
              All templates are fully customizable. Add roles, swap documents, adjust checklist stages — or <Link to="/create-deal-room" className="underline text-gray-600 hover:text-gray-900">describe your transaction to AI</Link> and let it suggest a starting point.
            </p>
            <div className="flex items-center gap-4 shrink-0">
              <Link to="/for/business-brokers"
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2 transition whitespace-nowrap">
                For business brokers →
              </Link>
              <Link to="/for/tokenization"
                className="text-xs font-semibold hover:opacity-80 underline underline-offset-2 transition whitespace-nowrap"
                style={{ color: "#7c3aed" }}>
                For token issuers →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-4xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Pricing</p>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">One workspace. One price.</h2>
          <p className="text-gray-500 text-sm max-w-lg mx-auto leading-relaxed">
            No per-seat fees, no subscriptions. One workspace covers your entire transaction from start to close.
          </p>
        </div>
        <div className="max-w-sm mx-auto bg-white rounded-2xl border-2 border-gray-900 p-8 shadow-lg text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Transaction Workspace</p>
          <div className="flex items-baseline justify-center gap-1 mb-1">
            <span className="text-5xl font-extrabold text-gray-900 tracking-tight">$499</span>
          </div>
          <p className="text-sm text-gray-500 mb-6">One-time payment · 90-day access</p>
          <ul className="text-sm text-gray-700 space-y-2.5 mb-8 text-left">
            {[
              "Unlimited participants — all roles included",
              "Unlimited document uploads",
              "AI Operations Manager",
              "Document analysis and cross-checks",
              "Automated follow-ups and reminders",
              "Verified Transaction Package at closing",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: "#800020" }}>
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <Link to="/create-deal-room"
            className="block w-full py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            Create your transaction workspace
          </Link>
          <p className="text-xs text-gray-400 mt-3">No subscription · No per-seat fees · All parties included</p>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="bg-gray-950 py-14">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Create your transaction workspace.
          </h2>
          <p className="text-gray-400 text-sm mb-8 max-w-xl mx-auto leading-relaxed">
            Describe your transaction, invite every party, and let Kontra coordinate from day one. Ready in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/create-deal-room"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Create Workspace
            </Link>
            <ViewDemoButton />
          </div>
          <p className="text-xs text-gray-600 mt-5">
            $499 · One-time payment · No subscription · All parties included
          </p>
        </div>
      </section>

      {/* ── Built for every party ──────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-14">
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
                  <p className="text-xs text-gray-400">What you get in the workspace</p>
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
                <Link to="/create-deal-room"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: p.color }}>
                  Create your workspace →
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
              Upload a document and get structured AI analysis in seconds. These are the same tools inside every transaction workspace.
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
                    <Link to="/create-deal-room"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: "#800020" }}>
                      Use in your workspace →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link to="/create-deal-room"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-sm transition">
              Get all AI tools inside your workspace →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Enterprise Ready ───────────────────────────────────── */}
      <section className="border-t border-gray-100 bg-gray-50 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Enterprise Ready</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Built for organizations that can't afford to get it wrong</h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              Every feature is designed with security, compliance, and auditability in mind — from the first document upload to the final closing.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: "📋", title: "Complete Audit Trail", desc: "Every action, AI recommendation, and approval logged with timestamps." },
              { icon: "🗂️", title: "Version History", desc: "Every document version tracked automatically — no more 'which PDF is current?'" },
              { icon: "🔐", title: "Role-Based Permissions", desc: "Each participant sees only what is relevant to their role. Nothing leaks across parties." },
              { icon: "🔒", title: "Encrypted Storage", desc: "All documents stored encrypted at rest and in transit. Signed-URL access only." },
              { icon: "🤖", title: "AI Activity Logs", desc: "Every AI analysis, flag, and follow-up draft surfaced in the audit record." },
              { icon: "🔔", title: "Automated Notifications", desc: "Every upload, approval, and deadline triggers the right party automatically." },
              { icon: "📧", title: "Secure Invitations", desc: "Role-scoped invite links — no account creation required for any participant." },
              { icon: "🏢", title: "Volume & White-Label", desc: "Multiple workspaces, dedicated support, SSO, and custom branding for teams." },
            ].map(item => (
              <div key={item.title} className="bg-white rounded-xl border border-gray-200 p-5">
                <span className="text-2xl block mb-3">{item.icon}</span>
                <p className="text-sm font-bold text-gray-900 mb-1">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href="mailto:hello@kontraplatform.com?subject=Kontra Enterprise"
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-white hover:shadow-sm transition">
              Talk to us about enterprise →
            </a>
          </div>
        </div>
      </section>

      {/* ── Email capture ──────────────────────────────────────── */}
      <EmailCapture />

    </PublicLayout>
  );
}
