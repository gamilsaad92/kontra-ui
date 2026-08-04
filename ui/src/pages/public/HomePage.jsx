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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-4 pt-3.5 pb-1">Example deal rooms</p>
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

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: "✍️",
    title: "Describe your transaction",
     desc: "Tell Kontra what you're coordinating. AI generates a deal room with the right participants, document checklist, and stages — or start from a template.",
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

export default function HomePage() {
  return (
    <PublicLayout>
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight mb-6 max-w-4xl mx-auto">
            Every transaction gets its own Operations Manager.
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
             Coordinate every participant, document, approval, and deadline from one intelligent deal room.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <Link to="/create-deal-room"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
               Create Deal Room
            </Link>
            <ViewDemoButton />
          </div>
          <p className="text-xs text-gray-600">$499 · One-time · All parties included</p>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>How it works</p>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Up and running in minutes.</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto leading-relaxed">
            Describe your transaction, invite your parties, and let Kontra coordinate everything from there.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-10 relative">
          <div className="hidden md:block absolute top-10 left-[16.5%] right-[16.5%] h-px bg-gray-200" />
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="relative text-center">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center text-3xl relative z-10 bg-white border-2 border-gray-200 shadow-sm">
                {step.icon}
              </div>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: step.color }}>{step.step}</div>
              <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug">{step.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Transaction types ──────────────────────────────────── */}
      <section className="bg-gray-50 border-t border-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Transaction types</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Your deal type. Your rules.</h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto leading-relaxed">
              Start from a template or describe any transaction to AI — Kontra generates the roles, documents, and checklist for your deal room.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            {[
              { icon: "💼", label: "Business Acquisition", desc: "M&A diligence, QoE, LOI, legal review" },
              { icon: "🏢", label: "CRE Acquisition",      desc: "Inspection, financing, title, compliance" },
              { icon: "📈", label: "Fundraising",          desc: "Cap table, term sheet, investor diligence" },
            ].map(item => (
              <div key={item.label} className="rounded-2xl p-5 border border-gray-200 bg-white">
                <span className="text-2xl block mb-3">{item.icon}</span>
                <p className="text-sm font-semibold text-gray-900 mb-1">{item.label}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Build Your Own */}
          <Link to="/create-deal-room"
            className="block rounded-2xl p-6 border-2 bg-white hover:shadow-md transition-shadow group"
            style={{ borderColor: "#80002030" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: "#80002010" }}>⚙️</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-base font-bold text-gray-900">Build Your Own Workflow</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#800020", color: "#fff" }}>Platform</span>
                  </div>
                  <p className="text-sm text-gray-500">Any transaction type — define your own roles, document schema, checklist stages, and approval flow.</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition shrink-0 ml-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────────── */}
      <section className="bg-gray-950 py-16 text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to run your transaction?</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            $499 one-time. Includes every participant, unlimited documents, AI coordination, and a verified audit trail.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/create-deal-room"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
               Create Deal Room
            </Link>
            <Link to="/product"
              className="px-8 py-3.5 rounded-xl text-sm font-semibold text-gray-400 border border-white/10 hover:bg-white/5 transition">
              See how it works →
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
