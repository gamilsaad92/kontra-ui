import { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

// ── Stage progress bar ─────────────────────────────────────────────────────
const STAGES = [
  { key: "loi",           label: "LOI",          done: true  },
  { key: "due_diligence", label: "Due Diligence", done: true  },
  { key: "financing",     label: "Financing",     done: false, active: true },
  { key: "closing",       label: "Closing",       done: false },
  { key: "closed",        label: "Closed",        done: false },
];

function StageBar() {
  return (
    <div className="flex items-center gap-1 mb-4">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
          <div className={`h-1.5 w-full rounded-full ${s.done ? "bg-green-500" : s.active ? "bg-blue-500" : "bg-gray-700"}`} />
          <span className={`text-[9px] font-bold ${s.done ? "text-green-400" : s.active ? "text-blue-300" : "text-gray-600"}`}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Checklist items ────────────────────────────────────────────────────────
const CHECKLIST = [
  { label: "Confidentiality / NDA",           role: "Buyer",     status: "done",    time: "Day 1"  },
  { label: "3-Year Financial Statements",     role: "Seller",    status: "done",    time: "Day 4"  },
  { label: "Quality of Earnings Report",      role: "CPA",       status: "overdue", time: "10d ago" },
  { label: "Asset Purchase Agreement (draft)",role: "Attorney",  status: "active",  time: "In review" },
  { label: "Lender Pre-Approval Letter",      role: "Buyer",     status: "pending", time: "Pending" },
  { label: "Tax Returns (3 years)",           role: "Seller",    status: "done",    time: "Day 6"  },
];

function statusStyle(s) {
  if (s === "done")    return { dot: "bg-green-400",  text: "text-green-400",  label: "Submitted" };
  if (s === "overdue") return { dot: "bg-red-400",    text: "text-red-400",    label: "Overdue"   };
  if (s === "active")  return { dot: "bg-yellow-400", text: "text-yellow-400", label: "In Review" };
  return                      { dot: "bg-gray-600",   text: "text-gray-500",   label: "Pending"   };
}

// ── Workspace preview ──────────────────────────────────────────────────────
function WorkspacePreview() {
  const [activeTab, setActiveTab] = useState("checklist");

  const parties = [
    { icon: "🏪", label: "Tom Briggs", role: "Seller",       status: "Active",     color: "#0369a1" },
    { icon: "🏢", label: "Capital Group", role: "Buyer",     status: "Active",     color: "#1e40af" },
    { icon: "🧮", label: "Davidson CPA", role: "CPA",        status: "QoE Overdue", color: "#dc2626" },
    { icon: "⚖️", label: "Vance & Co",   role: "M&A Attorney",status: "Reviewing", color: "#d97706" },
  ];

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
      {/* Top bar */}
      <div className="bg-gray-950 border-b border-gray-800 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-900/60 flex items-center justify-center text-base">💼</div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Brightline Services LLC</p>
            <p className="text-[10px] text-gray-400">Business Acquisition · $6.2M · Est. close: Oct 15</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-900/50 text-blue-300">Workspace Active</span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-900/50 text-red-400">1 Item Overdue</span>
        </div>
      </div>

      {/* Stage bar */}
      <div className="px-5 pt-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Transaction Progress</p>
        <StageBar />
      </div>

      {/* Tabs */}
      <div className="px-5 pb-1 flex gap-1">
        {["checklist", "parties"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg capitalize transition-all ${
              activeTab === t ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
            }`}>
            {t === "checklist" ? "Document Checklist" : "Participants"}
          </button>
        ))}
      </div>

      <div className="px-5 pb-5 pt-2">
        {activeTab === "checklist" && (
          <div className="space-y-1.5">
            {CHECKLIST.map((doc, i) => {
              const s = statusStyle(doc.status);
              return (
                <div key={i} className="flex items-center gap-2.5 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{doc.label}</p>
                    <p className="text-[10px] text-gray-500">{doc.role}</p>
                  </div>
                  <span className={`text-[10px] font-bold shrink-0 ${s.text}`}>{s.label}</span>
                  <span className="text-[10px] text-gray-600 shrink-0 ml-1 hidden sm:block">{doc.time}</span>
                </div>
              );
            })}
            <div className="mt-3 bg-red-950/60 border border-red-800/40 rounded-xl px-3 py-2.5 flex items-start gap-2.5">
              <span className="text-sm shrink-0 mt-0.5">🤖</span>
              <p className="text-[10px] text-red-300 leading-relaxed">
                <strong className="text-red-200">AI Operations Manager:</strong> Davidson CPA's QoE report is 10 days overdue. A follow-up email has been drafted for your review — approve in one click to send.
              </p>
            </div>
          </div>
        )}

        {activeTab === "parties" && (
          <div className="space-y-2">
            {parties.map((p, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-800/60 border border-gray-700/60 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: p.color + "25" }}>{p.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{p.label}</p>
                  <p className="text-[10px] text-gray-400">{p.role}</p>
                </div>
                <span className="text-[10px] font-bold shrink-0"
                  style={{ color: p.status.includes("Overdue") ? "#f87171" : p.status === "Reviewing" ? "#fbbf24" : "#4ade80" }}>
                  {p.status}
                </span>
              </div>
            ))}
            <p className="text-[10px] text-gray-600 text-center pt-1.5">
              Each party sees only their role. No one can view the others' private notes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Outcome cards ──────────────────────────────────────────────────────────
const OUTCOMES = [
  {
    icon: "👥",
    title: "Every party in one place",
    desc: "Buyer, seller, CPA, and attorney each get a role-specific view. You stop being the communication hub for the whole deal.",
    color: "#1e40af",
  },
  {
    icon: "📋",
    title: "No more chasing the CPA for documents",
    desc: "The AI Operations Manager sends follow-up reminders automatically. You approve the message — it sends. Your inbox stays clean.",
    color: "#800020",
  },
  {
    icon: "📜",
    title: "Full audit trail from LOI to closing",
    desc: "Every document submission, approval, and stage change is timestamped. At closing, you have a clean record of the entire deal — no reconstruction required.",
    color: "#065f46",
  },
];

// ── Pain points ────────────────────────────────────────────────────────────
const PAINS = [
  {
    pain: "You're emailing the CPA for the same QoE report for the third time",
    fix:  "Kontra sends automatic reminders. You approve the message — it fires.",
  },
  {
    pain: "The buyer is asking you for a status update you don't have yet",
    fix:  "Every party's checklist status is visible in the deal room. No one has to ask.",
  },
  {
    pain: "You're forwarding the purchase agreement to four people and tracking who reviewed it",
    fix:  "Documents land in the right role's checklist. Kontra flags when it's been reviewed.",
  },
  {
    pain: "The deal fell apart because someone dropped the ball on financing documents",
    fix:  "The AI flags overdue items before they become blockers. You see problems coming.",
  },
];

// ── Steps ──────────────────────────────────────────────────────────────────
const STEPS = [
  {
    step: "01",
    icon: "💼",
    title: "Describe your deal",
    desc: "Enter the business name, deal size, and estimated closing date. Kontra generates your deal room with the right participants, document checklist, and deal stages already configured.",
    color: "#800020",
  },
  {
    step: "02",
    icon: "🔗",
    title: "Invite buyer, seller, CPA, and attorney",
    desc: "Send each party a role-specific link. The seller sees their document responsibilities. The buyer sees their review items. No one sees what isn't theirs.",
    color: "#1e40af",
  },
  {
    step: "03",
    icon: "🤖",
    title: "Kontra coordinates the closing process",
    desc: "The AI Operations Manager follows up with overdue parties, surfaces blockers before they delay closing, and tells you exactly what needs your attention next.",
    color: "#065f46",
  },
];

// ── Main page ──────────────────────────────────────────────────────────────
export default function BusinessBrokersPage() {
  return (
    <PublicLayout>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-0">
          {/* Segment badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
              Built for business brokers running M&A
            </div>
          </div>

          <div className="text-center max-w-4xl mx-auto mb-8">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
              Close deals without the{" "}
              <span style={{ color: "#f87171" }}>email chaos.</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-5 leading-relaxed">
              Kontra gives every M&A deal its own coordinated workspace — buyer, seller, CPA, and attorney all in one place. Your AI Operations Manager chases documents, surfaces blockers, and keeps the transaction moving.
            </p>
            <p className="text-sm text-gray-500 mb-10">
              For business brokers running small-to-mid-market deals — $1M to $10M.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
              <Link to="/create-deal-room?template=business_acquisition"
                className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Create your first deal workspace →
              </Link>
              <Link to="/deal-room/kontra-demo-biz"
                className="px-7 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition">
                See a live deal example
              </Link>
            </div>
            <p className="text-xs text-gray-600">$499 per deal · All parties included · No subscription</p>
          </div>

          {/* Workspace preview hero image */}
          <div className="max-w-3xl mx-auto pb-0 relative">
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-gray-950 to-transparent z-10 rounded-b-2xl" />
            <WorkspacePreview />
          </div>
        </div>
      </section>

      {/* ── Pain → Fix section ────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-14">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Sound familiar?</p>
            <h2 className="text-2xl font-bold text-gray-900">The way brokers coordinate deals today is broken.</h2>
            <p className="text-sm text-gray-500 max-w-xl mx-auto mt-2 leading-relaxed">
              Email threads, shared drives, and constant follow-up calls. Kontra replaces all of it.
            </p>
          </div>
          <div className="space-y-3">
            {PAINS.map((p, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                    <span className="leading-relaxed">{p.pain}</span>
                  </p>
                </div>
                <div className="w-px bg-gray-100 shrink-0 self-stretch mx-1 hidden sm:block" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="shrink-0 mt-0.5" style={{ color: "#800020" }}>✓</span>
                    <span className="leading-relaxed">{p.fix}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Outcomes ─────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Why brokers use Kontra</p>
          <h2 className="text-2xl font-bold text-gray-900">Three things that change immediately.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {OUTCOMES.map(o => (
            <div key={o.title} className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: o.color + "12" }}>
                {o.icon}
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug">{o.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{o.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="bg-gray-950 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-red-400">Setup in minutes</p>
            <h2 className="text-2xl font-bold text-white mb-3">Your deal workspace, running in under 5 minutes.</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
              No IT setup, no onboarding call. Describe the deal, invite the parties, and start.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-10 left-[16.5%] right-[16.5%] h-px bg-gray-700" />
            {STEPS.map(s => (
              <div key={s.step} className="relative text-center">
                <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl relative z-10 bg-gray-800 border-2 border-gray-700 shadow-sm">
                  {s.icon}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: s.color }}>{s.step}</div>
                <h3 className="text-sm font-bold text-white mb-2 leading-snug">{s.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Document checklist close-up ───────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>The document checklist</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-snug">
              Every document, every party, every deadline — tracked automatically.
            </h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Kontra generates a checklist from your deal type — QoE report, purchase agreement, tax returns, financing letters — and assigns each item to the right party. When something's overdue, the AI Operations Manager sends the follow-up. You just approve it.
            </p>
            <ul className="space-y-2.5 mb-7">
              {[
                "Pre-configured for business acquisitions: LOI, QoE, APAs, tax returns",
                "Each document assigned to the party responsible for it",
                "Overdue items flagged automatically — no manual tracking",
                "AI analyzes documents as they arrive and surfaces key findings",
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: "#800020" }}>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            {CHECKLIST.map((doc, i) => {
              const s = statusStyle(doc.status);
              return (
                <div key={i} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.label}</p>
                    <p className="text-xs text-gray-400">{doc.role}</p>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${s.text}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: "< 5 min",   label: "Workspace setup" },
              { value: "4 roles",   label: "Pre-configured for M&A" },
              { value: "$499",      label: "Flat fee, any deal size" },
              { value: "90 days",   label: "Access through closing" },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl font-extrabold text-gray-900 mb-0.5" style={{ color: "#800020" }}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Objection handling ────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Common questions from brokers</h2>
        </div>
        <div className="space-y-4">
          {[
            {
              q: "My deals are all different — will a template actually work?",
              a: "The Business Acquisition template is a starting point. You can add or remove roles, rename checklist items, and adjust stages for any deal. Or describe your specific transaction to Kontra's AI and it will generate a custom structure in 30 seconds.",
            },
            {
              q: "I run 8–10 deals at once. Do I need a separate workspace for each?",
              a: "Yes — each deal gets its own deal room. At $499 per deal, the deal room pays for itself the first time it prevents a deal from falling through because someone dropped a document.",
            },
            {
              q: "My clients aren't tech-savvy. Will they be able to use it?",
              a: "Participants just click a link. They see their role-specific checklist — nothing else. The seller sees what they need to upload. The attorney sees what they need to review. No logins, no training.",
            },
            {
              q: "Do you offer volume discounts for brokers closing multiple deals a year?",
              a: "Email us at hello@kontraplatform.com. We work with active brokers on pricing that reflects deal volume.",
            },
          ].map((faq, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-sm font-bold text-gray-900 mb-2">{faq.q}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="bg-gray-950 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-red-400">Ready?</p>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Create your first deal workspace in 5 minutes.
          </h2>
          <p className="text-gray-400 text-sm mb-8 max-w-lg mx-auto leading-relaxed">
            Choose the Business Acquisition template. Add your deal name, invite buyer and seller, and Kontra configures the rest — document checklist, stages, and AI coordination included.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/create-deal-room?template=business_acquisition"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Create your deal workspace →
            </Link>
            <Link to="/deal-room/kontra-demo-biz"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition">
              See a live demo first
            </Link>
          </div>
          <p className="text-xs text-gray-600 mt-5">
            $499 · One-time · No subscription · All parties included
          </p>
        </div>
      </section>

    </PublicLayout>
  );
}
