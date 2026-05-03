/**
 * DemoModeGuide — floating step-by-step product tour.
 * Covers all 4 portals: Lender · Servicer · Borrower · Investor
 * + AI Copilot + Capital Markets.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const STEPS = [
  /* ── PLATFORM OVERVIEW ─────────────────────────────────────── */
  {
    route: "/dashboard",
    title: "Welcome to Kontra",
    role: "PLATFORM",
    roleColor: "#800020",
    desc: "Kontra is the data infrastructure layer for CRE loan servicing — connecting lenders, servicers, investors, and borrowers on one platform. $623.5M AUM. 10,290 investors. 4 role-based portals.",
    highlight: "Every participant. Every workflow. One source of truth.",
  },
  /* ── LENDER ─────────────────────────────────────────────────── */
  {
    route: "/dashboard",
    title: "Lender: Portfolio Dashboard",
    role: "LENDER",
    roleColor: "#800020",
    desc: "$604.7M AUM across 6 institutional CRE loans. Live DSCR trend, portfolio health breakdown, token market strip, and 2 high-priority covenant alerts — all in one screen.",
    highlight: "The command center every lender wants but nobody has built.",
  },
  {
    route: "/portfolio/loans",
    title: "Lender: Loan Portfolio",
    role: "LENDER",
    roleColor: "#800020",
    desc: "6 loans — multifamily, industrial, office, mixed-use, retail. DSCR bars, LTV tracking, maturity timeline, and ERC-1400 token linkage per loan. Watchlist loans flagged in real time.",
    highlight: "Full covenant scorecard + tokenization status in a single table.",
  },
  {
    route: "/governance/compliance",
    title: "Lender: Compliance & Reg D",
    role: "LENDER",
    roleColor: "#800020",
    desc: "Full securities compliance: Form D filings, AML/KYC batch review, Reg S offshore compliance periods, covenant certifications. Immutable audit trail for every action taken.",
    highlight: "Built for institutional capital markets — not crypto workarounds.",
  },
  /* ── SERVICER ────────────────────────────────────────────────── */
  {
    route: "/servicer/overview",
    title: "Servicer: Operations Center",
    role: "SERVICER",
    roleColor: "#92400E",
    desc: "The servicer's command center: 12 draws pending ($4.1M queue), 4 inspections due, $1.82M escrow balance across all loans. Every action timestamped and audit-logged.",
    highlight: "Payment processing, draw approvals, inspections — one queue.",
  },
  {
    route: "/servicer/draws",
    title: "Servicer: Draw Queue",
    role: "SERVICER",
    roleColor: "#92400E",
    desc: "Construction and capex draw requests arrive with supporting documents attached. Approve, reject, or request additional docs. Each approval triggers an automated ledger entry and borrower notification.",
    highlight: "No more email chains for draw approvals — it's all in the queue.",
  },
  {
    route: "/servicer/inspections",
    title: "Servicer: Inspections & Escrow",
    role: "SERVICER",
    roleColor: "#92400E",
    desc: "Schedule property inspections, upload AI-powered site condition reports, and flag deficiencies. Escrow tracking covers tax reserves, insurance, and capex reserves per loan.",
    highlight: "AI-generated inspection summaries replace manual report writing.",
  },
  {
    route: "/servicer/payments",
    title: "Servicer: Payment Processing",
    role: "SERVICER",
    roleColor: "#92400E",
    desc: "SOFR-linked monthly debt service payments are tracked, confirmed, and reconciled automatically. Late payments trigger servicer alerts. Every transaction flows to the investor distribution waterfall.",
    highlight: "From borrower payment to investor distribution — fully automated.",
  },
  /* ── BORROWER ────────────────────────────────────────────────── */
  {
    route: "/borrower",
    title: "Borrower: Loan Dashboard",
    role: "BORROWER",
    roleColor: "#065F46",
    desc: "LN-2847 · The Meridian Apartments · $45.2M balance. Real-time DSCR (1.42×), LTV (68.2%), and occupancy gauges vs. loan thresholds. Next payment due Jun 1: $187,500.",
    highlight: "Borrowers see exactly what their lender sees — no information gap.",
  },
  {
    route: "/borrower",
    title: "Borrower: Draws & Documents",
    role: "BORROWER",
    roleColor: "#065F46",
    desc: "Submit draw requests with supporting docs, track approval status (Submitted → Servicer Review → Lender Approval → Funded). Upload rent rolls, financials, and insurance certificates to the document vault.",
    highlight: "Draw requests and document delivery — handled without email.",
  },
  /* ── INVESTOR ────────────────────────────────────────────────── */
  {
    route: "/investor",
    title: "Investor: Holdings & Distributions",
    role: "INVESTOR",
    roleColor: "#6D28D9",
    desc: "10,290 accredited investors see live NAV pricing, monthly on-chain distributions ($264,500 paid May 1), and full transparency into the underlying loans. On-chain verified. Self-service.",
    highlight: "Investors trade loan participations peer-to-peer — 15 bps fee.",
  },
  {
    route: "/investor",
    title: "Investor: Governance & Secondary",
    role: "INVESTOR",
    roleColor: "#6D28D9",
    desc: "Vote on covenant waivers and loan modifications through on-chain governance proposals. Access the peer-to-peer Debt Exchange: post bids and offers, settle in under 60 seconds.",
    highlight: "$124.2M settled on the secondary market year-to-date.",
  },
  /* ── AI + CAPITAL MARKETS ────────────────────────────────────── */
  {
    route: "/ai-copilot",
    title: "AI Copilot",
    role: "AI",
    roleColor: "#5B21B6",
    desc: "6 specialist agents: Portfolio Analyst, Compliance Monitor, Risk Scorer, Market Intel, Regulatory Scanner, and Underwriter. Ask anything about your portfolio in plain English — response in under 2 seconds.",
    highlight: "Your senior analyst available 24/7 — sourced from live loan data.",
  },
  {
    route: "/markets/tokens",
    title: "Capital Markets: Tokenization",
    role: "MARKETS",
    roleColor: "#1E40AF",
    desc: "$225.4M tokenized across KTRA-2847 and KTRA-5544. ERC-1400 compliant partitions, KYC/accreditation whitelist, transfer compliance log, and Reg D/S controller audit trail.",
    highlight: "Illiquid CRE loans become tradeable digital securities in hours.",
  },
  {
    route: "/markets/waterfall",
    title: "Capital Markets: Cash Flow Waterfall",
    role: "MARKETS",
    roleColor: "#1E40AF",
    desc: "Gross rent → Servicer fee (3%) → Liquidity reserve (5%) → Distribution pool → Token holder yield. Fully configurable per PSA. Automated on-chain settlement with real-time reconciliation.",
    highlight: "Every dollar accounted for. Every investor paid automatically.",
  },
];

const STORAGE_KEY = "kontra_demo_mode";
const STEP_KEY    = "kontra_demo_step";

// Role-to-section grouping for the progress bar
const ROLE_ORDER = ["PLATFORM", "LENDER", "SERVICER", "BORROWER", "INVESTOR", "AI", "MARKETS"];
const ROLE_LABELS = {
  PLATFORM: "Overview",
  LENDER: "Lender",
  SERVICER: "Servicer",
  BORROWER: "Borrower",
  INVESTOR: "Investor",
  AI: "AI",
  MARKETS: "Markets",
};

export default function DemoModeGuide() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [active,  setActive]  = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [step,    setStep]    = useState(() => parseInt(localStorage.getItem(STEP_KEY) ?? "0", 10));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active) return;
    const matched = STEPS.findIndex((s) => location.pathname.startsWith(s.route));
    if (matched >= 0 && matched !== step) setStep(matched);
  }, [location.pathname, active]); // eslint-disable-line

  const goToStep = useCallback((idx) => {
    const s = STEPS[idx];
    setStep(idx);
    localStorage.setItem(STEP_KEY, String(idx));
    navigate(s.route);
  }, [navigate]);

  const start = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(true);
    setVisible(true);
    goToStep(0);
  };

  const exit = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STEP_KEY);
    setActive(false);
    setStep(0);
  };

  const next = () => { if (step < STEPS.length - 1) goToStep(step + 1); };
  const prev = () => { if (step > 0) goToStep(step - 1); };

  const current = STEPS[step] ?? STEPS[0];
  const pct     = ((step + 1) / STEPS.length) * 100;

  /* ── Inactive — floating "Demo" pill ─────────────────────────── */
  if (!active) {
    return (
      <button
        onClick={start}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full px-5 py-3 text-sm font-bold shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #800020, #6d28d9)",
          color: "#fff",
          letterSpacing: "-0.01em",
          boxShadow: "0 4px 24px rgba(128,0,32,0.4), 0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M8 5.14v14l11-7-11-7z" />
        </svg>
        Start Platform Tour
      </button>
    );
  }

  /* ── Active — minimized pill ──────────────────────────────────── */
  if (!visible) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setVisible(true)}
          className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-xl transition-all hover:scale-105"
          style={{ background: "#1e2a3a", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <span style={{ color: current.roleColor }}>◉</span>
          {current.role} · {step + 1}/{STEPS.length}
        </button>
        <button onClick={exit} className="rounded-full w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white transition text-xs" style={{ background: "#1e2a3a", border: "1px solid rgba(255,255,255,0.08)" }}>
          ✕
        </button>
      </div>
    );
  }

  /* ── Active — full panel ──────────────────────────────────────── */
  return (
    <div
      className="fixed bottom-6 right-6 z-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      style={{
        width: 400,
        background: "#0f1623",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {/* Top accent bar */}
      <div
        className="h-1 w-full transition-all duration-500"
        style={{ background: `linear-gradient(90deg, ${current.roleColor}, #6d28d9)` }}
      />

      {/* Role section tabs */}
      <div
        className="flex items-center gap-1 px-4 py-2.5 overflow-x-auto scrollbar-none"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {ROLE_ORDER.map((role) => {
          const isActive = current.role === role;
          const color = STEPS.find(s => s.role === role)?.roleColor ?? "#94a3b8";
          return (
            <div
              key={role}
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-all"
              style={{
                background: isActive ? `${color}22` : "transparent",
                color: isActive ? color : "rgba(255,255,255,0.2)",
                border: isActive ? `1px solid ${color}40` : "1px solid transparent",
              }}
            >
              {ROLE_LABELS[role]}
            </div>
          );
        })}
        <div className="ml-auto shrink-0 flex items-center gap-1">
          <button
            onClick={() => setVisible(false)}
            className="rounded p-1.5 text-slate-600 hover:text-slate-300 transition"
            title="Minimize"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
            </svg>
          </button>
          <button
            onClick={exit}
            className="rounded p-1.5 text-slate-600 hover:text-slate-300 transition"
            title="Exit tour"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Header: role badge + step count */}
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <span
          className="rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-widest"
          style={{ background: `${current.roleColor}22`, color: current.roleColor, border: `1px solid ${current.roleColor}33` }}
        >
          {current.role}
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          {step + 1} of {STEPS.length}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 pb-2 pt-2 space-y-3">
        <h3
          className="text-[17px] font-black text-white leading-snug"
          style={{ letterSpacing: "-0.025em" }}
        >
          {current.title}
        </h3>
        <p className="text-[13px] text-slate-300 leading-relaxed">
          {current.desc}
        </p>
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: `${current.roleColor}18`,
            border: `1px solid ${current.roleColor}35`,
          }}
        >
          <p className="text-[13px] font-semibold leading-snug" style={{ color: current.roleColor }}>
            ✦ {current.highlight}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 py-3">
        <div className="h-1 w-full rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${current.roleColor}, #6d28d9)` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex items-center justify-center gap-1 mt-3">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 18 : 5,
                height: 5,
                background: i === step
                  ? current.roleColor
                  : i < step
                    ? "rgba(255,255,255,0.3)"
                    : "rgba(255,255,255,0.08)",
              }}
              title={STEPS[i].title}
            />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={prev}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition disabled:opacity-25"
          style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Prev
        </button>

        <button
          onClick={exit}
          className="text-[12px] text-slate-600 hover:text-slate-400 transition px-2"
        >
          Exit tour
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={next}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${current.roleColor}, #6d28d9)` }}
          >
            Next
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ) : (
          <button
            onClick={exit}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
