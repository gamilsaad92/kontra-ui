import { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

// ── Stage progress bar ─────────────────────────────────────────────────────
const STAGES = [
  { key: "structuring",  label: "Structuring",        done: true  },
  { key: "onboarding",   label: "Investor Onboarding", done: true  },
  { key: "subscription", label: "Subscription",        done: false, active: true },
  { key: "issuance",     label: "Token Issuance",      done: false },
  { key: "secondary",    label: "Secondary Market",    done: false },
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
  { label: "Token Offering Memorandum",   role: "Token Issuer",      status: "done",    time: "Day 3"     },
  { label: "KYC / AML Certification",    role: "Compliance Officer", status: "done",    time: "Day 8"     },
  { label: "Subscription Agreement",     role: "Lead Investor",     status: "active",  time: "In review" },
  { label: "Regulatory Filing (FSRA)",   role: "Legal Counsel",     status: "overdue", time: "5d ago"    },
  { label: "Cap Table (post-issuance)",  role: "Transfer Agent",    status: "pending", time: "Pending"   },
  { label: "Investor Accreditation",     role: "Lead Investor",     status: "done",    time: "Day 11"    },
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
    { icon: "🏛️", label: "Meridian Capital",    role: "Token Issuer",       status: "Active",         color: "#7c3aed" },
    { icon: "🏦", label: "GCC Growth Fund",     role: "Lead Investor",      status: "Active",         color: "#1e40af" },
    { icon: "⚖️", label: "Al Tamimi & Co",      role: "Legal Counsel",      status: "Filing Overdue", color: "#dc2626" },
    { icon: "🛡️", label: "Apex Compliance",    role: "Compliance Officer", status: "Reviewing",      color: "#d97706" },
    { icon: "📋", label: "DTCC Transfer Co",   role: "Transfer Agent",     status: "Pending",        color: "#6b7280" },
  ];

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
      {/* Top bar */}
      <div className="bg-gray-950 border-b border-gray-800 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-900/60 flex items-center justify-center text-base">🪙</div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Meridian Digital Securities STO</p>
            <p className="text-[10px] text-gray-400">Token Issuance · ADGM / DFSA · $22M target raise</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-900/50 text-purple-300">🇦🇪 ADGM</span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-900/50 text-red-400">1 Filing Overdue</span>
        </div>
      </div>

      {/* Stage bar */}
      <div className="px-5 pt-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Issuance Progress</p>
        <StageBar />
      </div>

      {/* Tabs */}
      <div className="px-5 pb-1 flex gap-1">
        {["checklist", "parties"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg capitalize transition-all ${
              activeTab === t ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
            }`}>
            {t === "checklist" ? "Compliance Checklist" : "Participants"}
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
                <strong className="text-purple-200">AI Operations Manager:</strong> FSRA regulatory filing is 5 days overdue. Al Tamimi & Co has been drafted a follow-up — approve in one click to send.
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
              Each party sees only their compliance responsibilities. Investor data stays private.
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
    title: "Every investor's KYC in one place",
    desc: "Compliance Officer collects, reviews, and certifies KYC/AML documentation in the workspace. No email attachments. Full audit trail.",
    color: "#7c3aed",
  },
  {
    icon: "📋",
    title: "Compliance documentation collected automatically",
    desc: "Subscription agreements, accreditation letters, and regulatory filings are assigned to the right party and tracked to completion. AI flags anything overdue before it blocks issuance.",
    color: "#800020",
  },
  {
    icon: "📜",
    title: "Full audit trail from structuring to issuance",
    desc: "Every document submission, legal approval, and investor onboarding event is timestamped and immutable. At issuance, you have a clean record regulators can inspect.",
    color: "#065f46",
  },
];

// ── Pain points ────────────────────────────────────────────────────────────
const PAINS = [
  {
    pain: "You're chasing 40 investors for KYC documents over email while Legal is waiting to file",
    fix:  "Kontra sends each investor their compliance checklist. Progress is visible in real time. Legal sees when KYC is complete — automatically.",
  },
  {
    pain: "Your compliance officer is working from a spreadsheet that's already out of date",
    fix:  "Every document upload, approval, and rejection is reflected in the workspace instantly. The checklist is always current.",
  },
  {
    pain: "Your transfer agent can't confirm the cap table until Legal says the filings are done",
    fix:  "Role-specific visibility means your transfer agent knows exactly where the process stands — without you becoming the middleman.",
  },
  {
    pain: "An investor dropped out and you're not sure which documents need to be re-collected",
    fix:  "The workspace tracks each investor's document status individually. One departure doesn't collapse your entire process.",
  },
];

// ── Steps ──────────────────────────────────────────────────────────────────
const STEPS = [
  {
    step: "01",
    icon: "🪙",
    title: "Describe your token issuance",
    desc: "Enter your raise size, jurisdiction, and target structure. Kontra generates a workspace with the Tokenization pack: five stages, the right roles (Token Issuer, Compliance Officer, Legal Counsel, Transfer Agent), and a pre-configured compliance checklist.",
    color: "#7c3aed",
  },
  {
    step: "02",
    icon: "🔗",
    title: "Invite your legal team, compliance officer, and investors",
    desc: "Each party gets a role-specific link. Legal Counsel sees filings. Compliance sees KYC submissions. Investors see only their onboarding responsibilities. Nothing bleeds across roles.",
    color: "#1e40af",
  },
  {
    step: "03",
    icon: "🤖",
    title: "Kontra coordinates the issuance timeline",
    desc: "The AI Operations Manager tracks every document, follows up on overdue items, and tells you exactly what's blocking the next stage — from structuring through token issuance and into secondary market.",
    color: "#065f46",
  },
];

// ── Jurisdiction cards ─────────────────────────────────────────────────────
const JURISDICTIONS = [
  {
    flag: "🇦🇪",
    name: "UAE — ADGM / DFSA",
    desc: "Abu Dhabi Global Market is one of the most active regulated tokenization hubs globally. FSRA Category 3C/3D licence required. Kontra helps you track FSRA approval steps, KYC obligations under COBS, and financial promotion compliance.",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
    tag: "Active market",
    tagColor: "#1d4ed8",
    tagBg: "#dbeafe",
  },
  {
    flag: "🇪🇺",
    name: "EU — MiCA",
    desc: "Markets in Crypto-Assets regulation came into force in June 2024 across all EU member states. MiCA White Paper is mandatory before publication. Kontra tracks White Paper drafting, ART/EMT reserve requirements, and ongoing disclosure obligations.",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
    tag: "MiCA in force",
    tagColor: "#0369a1",
    tagBg: "#e0f2fe",
  },
  {
    flag: "🇸🇬",
    name: "Singapore — MAS",
    desc: "MAS regulates digital tokens as capital markets products under the SFA. Small-offer exemption available for raises under S$5M/12 months. Kontra helps you structure your offering to meet MAS CDD requirements and track prospectus or exemption documentation.",
    color: "#0f766e",
    bg: "#f0fdfa",
    border: "#99f6e4",
    tag: "Active market",
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
              Built for regulated token issuances — UAE, EU, Singapore
            </div>
          </div>

          <div className="text-center max-w-4xl mx-auto mb-8">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
              Run your regulated token issuance{" "}
              <span style={{ color: "#c084fc" }}>without the compliance chaos.</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-5 leading-relaxed">
              Kontra gives every token issuance its own coordinated workspace — Token Issuer, Legal Counsel, Compliance Officer, Transfer Agent, and investors all in one place. AI tracks every KYC submission, every regulatory filing, and every stage from structuring to secondary market.
            </p>
            <p className="text-sm text-gray-500 mb-10">
              For real estate sponsors, fund managers, and issuers running regulated STOs — UAE ADGM, EU MiCA, Singapore MAS.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
              <Link to="/create-deal-room?template=tokenization"
                className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#7c3aed" }}>
                Create your token issuance workspace →
              </Link>
              <Link to="/deal-room/kontra-demo"
                className="px-7 py-3.5 rounded-xl text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition">
                See a live workspace example
              </Link>
            </div>
            <p className="text-xs text-gray-600">$499 per issuance · All parties included · No subscription</p>
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
            <h2 className="text-2xl font-bold text-white mb-3">Already regulated in your market.</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
              Kontra's tokenization workspace is pre-configured for the three most active regulated markets. Set your jurisdiction at creation and the workspace surfaces the relevant compliance checkpoints automatically.
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
            US (Reg D), UK (FCA), and additional jurisdictions also supported via the jurisdiction selector at workspace creation.
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
              Forty investors, five advisers, two regulators, and a six-month timeline — all managed over email. Kontra replaces that.
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
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-purple-400">Setup in minutes</p>
            <h2 className="text-2xl font-bold text-white mb-3">Your issuance workspace, running in under 5 minutes.</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
              No IT setup, no onboarding call, no compliance consultant required to get started. Describe the issuance, invite the parties, and start.
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
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7c3aed" }}>The compliance checklist</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-snug">
              Every filing, every KYC cert, every investor document — tracked automatically.
            </h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Kontra generates a compliance checklist from your jurisdiction and deal type — Token Offering Memorandum, Subscription Agreement, KYC/AML certifications, regulatory filings — and assigns each item to the right party. When something's overdue, AI sends the follow-up for your approval.
            </p>
            <ul className="space-y-2.5 mb-7">
              {[
                "Pre-configured for STOs: TOM, KYC/AML, Subscription Agreement, Reg Filing",
                "AI generates your Token Offering Memorandum from workspace details",
                "Each document assigned to the responsible role — no manual assignment",
                "Overdue filings flagged before they delay your issuance timeline",
                "Full audit trail — every action timestamped and exportable",
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
              { value: "5 roles",   label: "Pre-configured for STOs" },
              { value: "5 stages",  label: "From structuring to secondary" },
              { value: "$499",      label: "Flat fee, any raise size" },
              { value: "< 5 min",  label: "Workspace setup" },
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
              q: "Which jurisdictions do you support?",
              a: "Kontra surfaces jurisdiction-specific compliance checkpoints for UAE (ADGM / DFSA), EU (MiCA), Singapore (MAS), US (Regulation D), and UK (FCA). You select your jurisdiction at workspace creation and Kontra automatically shows the relevant regulatory requirements — FSRA approval steps for UAE, the MiCA White Paper obligation for EU, MAS prospectus exemption thresholds for Singapore, Form D filing deadlines for the US, and FCA financial promotion rules for the UK. Other jurisdictions can be noted in the workspace; we're adding more checkpoint sets regularly.",
            },
            {
              q: "Is this a compliance tool or a coordination tool?",
              a: "It's a coordination tool — Kontra tracks who has submitted what, flags what's overdue, and keeps every party synchronized. It surfaces regulatory checkpoints as informational guidance only. Your Legal Counsel and Compliance Officer do the actual regulatory work; Kontra makes sure nothing falls through the cracks while they do it.",
            },
            {
              q: "Can I manage multiple investors and their KYC in the same workspace?",
              a: "Yes. Every investor is invited with the Lead Investor or equivalent role. Each sees their own compliance checklist — Subscription Agreement, KYC certification, accreditation evidence. The Compliance Officer has a consolidated view across all submitted documents. Nothing from one investor is visible to another.",
            },
            {
              q: "We have a bespoke issuance structure. Can we customize the roles and stages?",
              a: "Completely. The Tokenization template gives you a working starting point — five stages, five roles, seven core documents. You can rename roles, add new ones (e.g. Co-Lead Investor, Custodian), swap documents, and restructure stages to match your deal. Or describe your structure to Kontra's AI and it will generate a custom workspace in seconds.",
            },
            {
              q: "Do you integrate with smart contracts or token issuance platforms?",
              a: "Not at this stage — Kontra is the coordination and compliance documentation layer that runs before and alongside the technical issuance. We focus on the six months of coordinating documents, parties, and regulatory filings that happen before token generation. We're exploring integrations with issuance platforms for a future release.",
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
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-purple-400">Ready to launch your issuance?</p>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Create your token issuance workspace in 5 minutes.
          </h2>
          <p className="text-gray-400 text-sm mb-8 max-w-lg mx-auto leading-relaxed">
            Choose the Tokenization template. Set your jurisdiction, invite Legal Counsel, Compliance Officer, and your Lead Investor — Kontra configures the issuance stages, compliance checklist, and AI coordination automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/create-deal-room?template=tokenization"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#7c3aed" }}>
              Create your token issuance workspace →
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
