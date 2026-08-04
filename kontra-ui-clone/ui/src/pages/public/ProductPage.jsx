import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const CAPABILITIES = [
  {
    icon: "🗂️",
    title: "Transaction Workspaces",
    desc: "Every deal gets its own secure room — documents, participants, approvals, deadlines, and AI review in one coordinated flow. Works for any private transaction type.",
  },
  {
    icon: "🤖",
    title: "AI Operations Manager",
    desc: "Kontra reads every document, scores every risk, and tells you exactly what's missing and what needs attention next. Not generic alerts — deal-specific intelligence.",
  },
  {
    icon: "🔒",
    title: "Asset Readiness Engine",
    desc: "Every completed transaction automatically generates a Tokenization Readiness score across 8 categories — Ownership, Legal, Financial, Identity, Cap Table, Audit, Compliance, Document Integrity.",
  },
  {
    icon: "💸",
    title: "Settlement Layer",
    desc: "After closing, choose how the transaction settles — Wire, Escrow, or future providers (Stripe, Bridge, Stablecoin, CBDC). Kontra orchestrates the handoff; it never holds funds.",
  },
];

const TRANSACTION_TYPES = [
  {
    icon: "🏢",
    label: "Commercial Real Estate",
    items: ["Acquisition & disposition", "Debt & equity transactions", "Sale-leaseback", "1031 exchanges"],
    color: "#800020",
  },
  {
    icon: "💼",
    label: "Business Acquisition",
    items: ["Buy-side & sell-side M&A", "Asset purchases", "Management buyouts", "Earnout structures"],
    color: "#1d4ed8",
  },
  {
    icon: "📈",
    label: "Private Fundraising",
    items: ["Equity raises", "Private placements", "SPV formation", "LP / GP structures"],
    color: "#059669",
  },
  {
    icon: "⚙️",
    label: "Custom Workflows",
    items: ["Define your own roles", "Design your own stages", "Custom document schemas", "Any private transaction"],
    color: "#7c3aed",
  },
];

const ARCHITECTURE = [
  {
    step: "01",
    label: "Transaction",
    desc: "Workspace created with the right roles, stages, and document schema for this transaction type.",
  },
  {
    step: "02",
    label: "Verification",
    desc: "AI reviews every upload. Participants submit KYC. Checklist tracks what's done and what's missing.",
  },
  {
    step: "03",
    label: "Closing",
    desc: "All parties approved. Stage advances to close. AI generates a verified closing summary.",
  },
  {
    step: "04",
    label: "Asset Package",
    desc: "Asset Passport, Readiness Score, structured metadata, and audit trail auto-generated at close.",
  },
  {
    step: "05",
    label: "Settlement",
    desc: "Owner selects Wire, Escrow, or a future settlement provider. Kontra coordinates — it never holds funds.",
  },
  {
    step: "06",
    label: "External Infrastructure",
    desc: "Structured export connects to any future tokenization platform, custodian, transfer agent, or registry.",
  },
];

const ADAPTERS = [
  {
    name: "Settlement Adapter",
    active: ["Wire Transfer", "Escrow"],
    coming: ["Stripe", "Bridge", "Stablecoin", "CBDC"],
    icon: "💸",
  },
  {
    name: "Tokenization Adapter",
    active: [],
    coming: ["XRPL", "Ethereum", "Polygon", "Canton", "Stellar"],
    icon: "🪙",
  },
  {
    name: "Compliance Adapter",
    active: [],
    coming: ["KYC Provider", "AML Screening", "Transfer Agent", "Custodian"],
    icon: "⚖️",
  },
];

export default function ProductPage() {
  return (
    <PublicLayout>
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="bg-[#0f1117] text-white pt-24 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#800020] mb-4">
            Transaction Operating System
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-5">
            Every private transaction,<br />
            <span style={{ color: "#c0392b" }}>coordinated and verifiable.</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            Kontra is not a document tool, a blockchain platform, or a marketplace.
            It is the operating layer that takes a transaction from creation to completion —
            with AI coordination, verified closing, and structured export into any future financial infrastructure.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/deal-room/kontra-demo"
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              View live demo →
            </Link>
            <Link to="/create-deal-room"
              className="px-6 py-3 rounded-xl text-sm font-bold text-white border border-white/20 hover:border-white/50 transition">
              Create a workspace
            </Link>
          </div>
        </div>
      </section>

      {/* ── Architecture flow ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mb-2">Architecture</p>
          <h2 className="text-2xl font-black text-gray-900 text-center mb-3">
            Transaction → Asset Package → Settlement
          </h2>
          <p className="text-sm text-gray-400 text-center mb-12 max-w-xl mx-auto">
            One continuous workflow. No switching platforms at closing.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ARCHITECTURE.map((a, i) => (
              <div key={a.step} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black text-gray-300 tabular-nums">{a.step}</span>
                  <div className="h-px flex-1 bg-gray-100" />
                  {i === ARCHITECTURE.length - 1 && (
                    <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wider">Future</span>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-900 mb-1.5">{a.label}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Core capabilities ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mb-2">Capabilities</p>
          <h2 className="text-2xl font-black text-gray-900 text-center mb-12">
            Built for the full transaction lifecycle
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {CAPABILITIES.map(c => (
              <div key={c.title} className="flex gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50">
                <span className="text-2xl shrink-0 mt-0.5">{c.icon}</span>
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-1">{c.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Transaction types ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mb-2">Transaction Types</p>
          <h2 className="text-2xl font-black text-gray-900 text-center mb-12">
            Any private transaction. One platform.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TRANSACTION_TYPES.map(t => (
              <div key={t.label} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
                  style={{ background: t.color + "12" }}>
                  {t.icon}
                </div>
                <p className="text-sm font-bold text-gray-900 mb-3">{t.label}</p>
                <ul className="space-y-1.5">
                  {t.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: t.color }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Adapter interfaces ───────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center mb-2">
            Adapter Interfaces
          </p>
          <h2 className="text-2xl font-black text-gray-900 text-center mb-3">
            Blockchain-neutral. Infrastructure-ready.
          </h2>
          <p className="text-sm text-gray-400 text-center mb-12 max-w-2xl mx-auto leading-relaxed">
            Kontra never becomes a bank, exchange, blockchain, or custodian.
            It orchestrates the handoff. Adapter interfaces are designed so new providers
            plug in without rebuilding the platform.
          </p>
          <div className="grid sm:grid-cols-3 gap-5">
            {ADAPTERS.map(adapter => (
              <div key={adapter.name} className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <span className="text-lg">{adapter.icon}</span>
                  <p className="text-xs font-bold text-gray-900">{adapter.name}</p>
                </div>
                <div className="px-5 py-4 space-y-2">
                  {adapter.active.map(p => (
                    <div key={p} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-xs text-gray-700 font-medium">{p}</span>
                      <span className="text-[9px] font-bold text-green-600 ml-auto">Active</span>
                    </div>
                  ))}
                  {adapter.coming.map(p => (
                    <div key={p} className="flex items-center gap-2 opacity-50">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                      <span className="text-xs text-gray-500">{p}</span>
                      <span className="text-[9px] text-gray-400 ml-auto">Soon</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-300 text-center mt-8">
            Future connections: DTCC · Euroclear · Circle · Ripple · Custodians · Government Registries
          </p>
        </div>
      </section>

      {/* ── Asset Readiness callout ──────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#0f1117] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#c0392b" }}>
            Tokenization Readiness
          </p>
          <h2 className="text-3xl font-black mb-4 leading-tight">
            Every completed transaction produces<br />a tokenization-ready digital asset package.
          </h2>
          <p className="text-gray-300 text-sm max-w-xl mx-auto mb-10 leading-relaxed">
            Kontra scores every workspace across 8 categories at closing — Ownership Structure,
            Legal Documentation, Financial Completeness, Identity Verification, Cap Table,
            Audit Trail, Compliance, and Document Integrity. The Asset Passport and structured metadata
            are ready for any future issuance platform or transfer agent.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {["Ownership", "Legal", "Financial", "Identity", "Cap Table", "Audit Trail", "Compliance", "Doc Integrity"].map(c => (
              <span key={c} className="text-xs px-3 py-1 rounded-full border border-white/20 text-white/70">
                {c}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/deal-room/kontra-demo"
              className="px-6 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              See it in the demo →
            </Link>
            <Link to="/pricing"
              className="px-6 py-3 rounded-xl text-sm font-bold text-white border border-white/20 hover:border-white/50 transition">
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
