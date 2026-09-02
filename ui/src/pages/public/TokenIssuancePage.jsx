import { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

// ── Stage progress bar ─────────────────────────────────────────────────────
const STAGES = [
  { key: "structuring",  label: "Preparation",        done: true  },
  { key: "onboarding",   label: "Participant Review",  done: true  },
  { key: "subscription", label: "Counsel Review",      done: false, active: true },
  { key: "issuance",     label: "External Process",    done: false },
  { key: "secondary",    label: "Future Follow-up",    done: false },
];

function StageBar() {
  return (
    <div className="flex items-center gap-1 mb-4">
      {STAGES.map((s) => (
        <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
          <div className={`h-1.5 w-full rounded-full ${
            s.done ? "bg-purple-400" : s.active ? "bg-blue-400" : "bg-gray-700"
          }`} />
          <span className={`text-[9px] font-bold ${
            s.done ? "text-purple-300" : s.active ? "text-blue-300" : "text-gray-600"
          }`}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Checklist items ────────────────────────────────────────────────────────
const CHECKLIST = [
  { label: "Offering materials",                  role: "Issuer / Sponsor",       status: "done",    time: "Day 3"     },
  { label: "Participant compliance documents",   role: "Compliance Adviser",     status: "done",    time: "Day 8"     },
  { label: "Subscription materials",             role: "Participant",            status: "active",  time: "In review" },
  { label: "Jurisdiction-specific counsel review", role: "Legal Counsel",         status: "overdue", time: "5d ago"    },
  { label: "Ownership and allocation record",    role: "External administrator",  status: "pending", time: "Pending"   },
  { label: "Participant information",            role: "Participant",             status: "done",    time: "Day 11"    },
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
    { icon: "🏛️", label: "Illustrative sponsor",       role: "Issuer / Sponsor",          status: "Active",         color: "#7c3aed" },
    { icon: "🏦", label: "Illustrative participant",   role: "Participant",               status: "Active",         color: "#1e40af" },
    { icon: "⚖️", label: "Qualified counsel",          role: "Legal Counsel",             status: "Reviewing",      color: "#dc2626" },
    { icon: "🛡️", label: "External adviser",           role: "Compliance Adviser",       status: "Reviewing",      color: "#d97706" },
    { icon: "📋", label: "Future service provider",    role: "External administrator",    status: "Not connected",   color: "#6b7280" },
  ];

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
      {/* Top bar */}
      <div className="bg-gray-950 border-b border-gray-800 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-900/60 flex items-center justify-center text-base">🪙</div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Illustrative Digital Asset Readiness Room</p>
            <p className="text-[10px] text-gray-400">Preparation workflow · Jurisdiction notes · External review</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-900/50 text-purple-300">Illustrative</span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-900/50 text-red-400">1 Review Item Open</span>
        </div>
      </div>

      {/* Stage bar */}
      <div className="px-5 pt-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Readiness Progress</p>
        <StageBar />
      </div>

      {/* Tabs */}
      <div className="px-5 pb-1 flex gap-1">
        {["checklist", "parties"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg capitalize transition-all ${
              activeTab === t ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
            }`}>
            {t === "checklist" ? "Preparation Checklist" : "Participants"}
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
            <div className="mt-3 bg-purple-950/60 border border-purple-800/40 rounded-xl px-3 py-2.5 flex items-start gap-2.5">
              <span className="text-sm shrink-0 mt-0.5">🤖</span>
              <p className="text-[10px] text-purple-300 leading-relaxed">
                <strong className="text-purple-200">AI Operations Manager:</strong> A jurisdiction-specific review item is open. A follow-up draft is ready for coordinator approval.
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
                  style={{ color: p.status.includes("Overdue") ? "#f87171" : p.status === "Reviewing" ? "#fbbf24" : p.status === "Active" ? "#4ade80" : "#9ca3af" }}>
                  {p.status}
                </span>
              </div>
            ))}
            <p className="text-[10px] text-gray-600 text-center pt-1.5">
              Each participant sees only the responsibilities configured for their role. Access remains subject to the deal room permissions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Outcomes ───────────────────────────────────────────────────────────────
const OUTCOMES = [
  {
    icon: "🛡️",
    title: "Participant documents in one place",
    desc: "Deal teams can collect and track participant-provided identity and compliance materials in the deal room. Kontra does not perform KYC or certify AML compliance.",
    color: "#7c3aed",
  },
  {
    icon: "📋",
    title: "Preparation items tracked clearly",
    desc: "Offering materials, participant documents, counsel review items, and other records can be assigned and tracked. AI can flag open items; it does not determine whether an external process may proceed.",
    color: "#800020",
  },
  {
    icon: "📜",
    title: "Review history for external handoff",
    desc: "Material document submissions, review notes, and approvals can be recorded for a later professional or provider review. Kontra does not issue assets or certify a regulatory record.",
    color: "#065f46",
  },
];

// ── Pain points ────────────────────────────────────────────────────────────
const PAINS = [
  {
    pain: "You're chasing participants for identity and compliance documents over email while counsel is waiting to review",
    fix:  "Kontra gives each participant a role-scoped checklist. Progress is visible in the deal room, while qualified professionals perform the actual review.",
  },
  {
    pain: "Your adviser is working from a spreadsheet that's already out of date",
    fix:  "Document submissions, review notes, and status changes can be recorded in the deal room so the working checklist is easier to coordinate.",
  },
  {
    pain: "An external provider needs a clear view of what has been reviewed and what remains open",
    fix:  "Role-specific visibility keeps the preparation record organized for qualified counsel and any future external provider.",
  },
  {
    pain: "A participant changes and you're not sure which documents need to be collected again",
    fix:  "The deal room tracks each participant's document status individually so the coordinator can identify the affected items.",
  },
];

// ── Steps ──────────────────────────────────────────────────────────────────
const STEPS = [
  {
    step: "01",
    icon: "🪙",
    title: "Describe your readiness workflow",
    desc: "Enter the transaction context and proposed jurisdiction. Kontra can start a preparation workflow with configurable roles, stages, and a document checklist for review.",
    color: "#7c3aed",
  },
  {
    step: "02",
    icon: "🔗",
    title: "Invite counsel, advisers, and participants",
    desc: "Each party gets a role-specific link. Counsel, advisers, and participants see the responsibilities configured for their role, subject to the deal room's access controls.",
    color: "#1e40af",
  },
  {
    step: "03",
    icon: "🤖",
    title: "Kontra coordinates preparation",
    desc: "The AI Operations Manager tracks documents, follows up on open items, and surfaces what may be blocking the next review step. External issuance, custody, trading, and settlement remain outside Kontra.",
    color: "#065f46",
  },
];

// ── Jurisdiction cards ─────────────────────────────────────────────────────
const JURISDICTIONS = [
  {
    flag: "🇦🇪",
    name: "UAE — ADGM / DFSA",
     desc: "Use this example jurisdiction card to organize questions for qualified local counsel. Kontra can help track the resulting review items, but it does not determine licensing, eligibility, or compliance obligations.",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
     tag: "Example only",
    tagColor: "#1d4ed8",
    tagBg: "#dbeafe",
  },
  {
    flag: "🇪🇺",
    name: "EU — MiCA",
     desc: "Use this example jurisdiction card to organize questions for qualified EU counsel. Kontra can help track the resulting review items, but it does not determine which framework or disclosures apply.",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
     tag: "Example only",
    tagColor: "#0369a1",
    tagBg: "#e0f2fe",
  },
  {
    flag: "🇸🇬",
    name: "Singapore — MAS",
     desc: "Use this example jurisdiction card to organize questions for qualified Singapore counsel. Kontra can help track the resulting review items, but it does not determine exemptions, CDD requirements, or filing obligations.",
    color: "#0f766e",
    bg: "#f0fdfa",
    border: "#99f6e4",
     tag: "Example only",
    tagColor: "#0f766e",
    tagBg: "#ccfbf1",
  },
];

// ── Main page ──────────────────────────────────────────────────────────────
export default function TokenIssuancePage() {
  return (
    <PublicLayout>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-0">
          {/* Segment badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
               Digital Asset Readiness preparation — UAE, EU, Singapore
            </div>
          </div>

          <div className="text-center max-w-4xl mx-auto mb-8">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
              Prepare the record for{" "}
              <span style={{ color: "#c084fc" }}>a future digital-asset review.</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-5 leading-relaxed">
              Kontra coordinates participants, documents, review items, and approvals in a configurable deal room. It helps teams prepare an evidence trail for qualified counsel or future external providers; it does not perform KYC, issue assets, or make regulatory determinations.
            </p>
            <p className="text-sm text-gray-500 mb-10">
              For sponsors and transaction teams preparing digital-asset documentation. Jurisdiction-specific requirements must be confirmed with qualified counsel.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
              <Link to="/create-deal-room?template=tokenization"
                className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#7c3aed" }}>
                Create a readiness deal room →
              </Link>
              <Link to="/deal-room/kontra-demo"
                className="px-7 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition">
                See an illustrative deal room
              </Link>
            </div>
            <p className="text-xs text-gray-600">$499 per deal room · All parties included · No subscription</p>
          </div>

          {/* Workspace preview hero image */}
          <div className="max-w-3xl mx-auto pb-0 relative">
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-gray-950 to-transparent z-10 rounded-b-2xl" />
            <WorkspacePreview />
          </div>
        </div>
      </section>

      {/* ── Already regulated in your market ─────────────────────── */}
      <section className="bg-gray-950 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-purple-400">Global from day one</p>
            <h2 className="text-2xl font-bold text-white mb-3">Coordinate jurisdiction-aware preparation.</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
              Start with jurisdiction notes and configurable review items. Treat the examples below as planning prompts, not legal or regulatory guidance.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {JURISDICTIONS.map(j => (
              <div key={j.name} className="rounded-2xl border p-6" style={{ background: j.bg, borderColor: j.border }}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{j.flag}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: j.tagBg, color: j.tagColor }}>
                    {j.tag}
                  </span>
                </div>
                <h3 className="text-sm font-bold mb-2" style={{ color: j.color }}>{j.name}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{j.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-600 mt-6">
            Other jurisdictions can be recorded in a deal room. Ask qualified counsel which requirements apply to your transaction.
          </p>
        </div>
      </section>

      {/* ── Pain → Fix section ────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-14">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7c3aed" }}>Sound familiar?</p>
            <h2 className="text-2xl font-bold text-gray-900">Coordinating a token issuance is harder than it should be.</h2>
            <p className="text-sm text-gray-500 max-w-xl mx-auto mt-2 leading-relaxed">
              Participants, advisers, documents, and a long review timeline can be difficult to coordinate over email. Kontra gives the team one place to organize that work.
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
                    <span className="shrink-0 mt-0.5" style={{ color: "#7c3aed" }}>✓</span>
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
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7c3aed" }}>Why issuers use Kontra</p>
          <h2 className="text-2xl font-bold text-gray-900">Three ways preparation can become clearer.</h2>
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
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-purple-400">Setup in minutes</p>
            <h2 className="text-2xl font-bold text-white mb-3">Your readiness deal room, configured in minutes.</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
              Describe the preparation workflow, invite the parties, and start organizing the record. Professional review remains the responsibility of qualified advisers.
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

      {/* ── Compliance checklist close-up ────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7c3aed" }}>The preparation checklist</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-snug">
              Key review items and participant documents — tracked in one place.
            </h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Kontra can help organize a checklist from your transaction context — offering materials, participant documents, counsel review items, and other records — and assign items to the configured roles. When something is overdue, AI can draft a follow-up for your approval.
            </p>
            <ul className="space-y-2.5 mb-7">
              {[
                "Configurable starting checklist for digital-asset preparation",
                "AI-assisted organization of transaction documents and review items",
                "Each document assigned to the responsible role",
                "Open items surfaced for coordinator review",
                "Material activity recorded for a potential external handoff",
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: "#7c3aed" }}>
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
              { value: "5 roles",   label: "Illustrative starting roles" },
              { value: "5 stages",  label: "Illustrative preparation flow" },
              { value: "$499",      label: "Flat fee, any raise size" },
              { value: "Minutes",  label: "Deal room setup" },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl font-extrabold mb-0.5" style={{ color: "#7c3aed" }}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Common questions from token issuers</h2>
        </div>
        <div className="space-y-4">
          {[
            {
              q: "How should I use the jurisdiction examples?",
              a: "Use them as prompts for organizing questions and review items in a deal room. Kontra does not determine which laws, exemptions, filings, licensing steps, or disclosures apply. Ask qualified counsel to confirm the requirements for your transaction.",
            },
            {
              q: "Does Kontra perform KYC or AML screening?",
              a: "No. Kontra can support the collection and organization of participant-provided documents and review status. It does not verify identity, perform KYC or AML screening, determine investor eligibility, or replace qualified counsel or compliance professionals.",
            },
            {
              q: "Can I manage multiple participants in the same deal room?",
              a: "Yes. Participants can receive role-scoped invitations and have their document and review status tracked separately. Access depends on the configured deal-room permissions, and professional review remains outside Kontra.",
            },
            {
              q: "We have a bespoke structure. Can we customize the roles and stages?",
              a: "Yes. A preparation workflow can be customized with roles, stages, and document requirements to match the transaction. The resulting record remains subject to human and professional review.",
            },
            {
              q: "Do you integrate with smart contracts or token issuance platforms?",
              a: "Not at this stage. Kontra is a provider-neutral coordination and preparation layer. It does not issue, sell, custody, trade, or settle digital assets, and no future integration should be treated as committed until announced.",
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
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-purple-400">Ready to prepare the record?</p>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Create a Digital Asset Readiness deal room.
          </h2>
          <p className="text-gray-400 text-sm mb-8 max-w-lg mx-auto leading-relaxed">
            Choose a preparation workflow, add the relevant jurisdiction notes, and invite the parties responsible for review. Kontra coordinates the record; qualified professionals and future external providers handle any regulated activity.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/create-deal-room?template=tokenization"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#7c3aed" }}>
              Create a readiness deal room →
            </Link>
            <a href="mailto:hello@kontraplatform.com?subject=Token Issuance Workspace"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition">
              Talk to us first
            </a>
          </div>
          <p className="text-xs text-gray-600 mt-5">
              $499 · One-time · No subscription · All parties included
          </p>
        </div>
      </section>

    </PublicLayout>
  );
}
