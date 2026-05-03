/**
 * DemoModeGuide — floating step-by-step product tour.
 * Activated by localStorage flag "kontra_demo_mode" = "true".
 * Each step navigates to a route and shows a pitch annotation.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const STEPS = [
  {
    route: "/dashboard",
    title: "Lender Dashboard",
    role: "Lender",
    roleColor: "#800020",
    desc: "$604.7M AUM across 6 CRE loans. Live portfolio health charts, DSCR trend, token market strip, and 2 high-priority covenant alerts — all in one screen.",
    highlight: "The command center every lender wants but nobody has built.",
  },
  {
    route: "/portfolio/loans",
    title: "Loan Portfolio",
    role: "Lender",
    roleColor: "#800020",
    desc: "6 institutional CRE loans — multifamily, industrial, office, mixed-use, retail. DSCR bars, LTV tracking, maturity timeline, token status per loan.",
    highlight: "Full covenant scorecard + ERC-1400 token linkage in a single table.",
  },
  {
    route: "/markets/tokens",
    title: "ERC-1400 Token Registry",
    role: "Lender",
    roleColor: "#800020",
    desc: "$225.4M tokenized across KTRA-2847 and KTRA-5544. Partition table, owner whitelist with KYC/accreditation badges, transfer compliance log, controller audit trail.",
    highlight: "The servicing-to-token bridge is Kontra's core differentiator.",
  },
  {
    route: "/markets/waterfall",
    title: "Cash Flow Waterfall",
    role: "Lender",
    roleColor: "#800020",
    desc: "Gross rent → Servicer fee (3%) → Liquidity reserve (5%) → Distribution pool → Token holder yield. Fully configurable per PSA. Automated on-chain settlement.",
    highlight: "Every dollar accounted for. Every investor paid automatically.",
  },
  {
    route: "/command",
    title: "Command Center",
    role: "Lender",
    roleColor: "#800020",
    desc: "Risk heatmap by loan, delinquency gauges, portfolio concentration chart, DSCR distribution histogram. Real-time monitoring for an entire serviced book.",
    highlight: "Built for the asset manager running a $500M+ portfolio.",
  },
  {
    route: "/investor",
    title: "Investor Portal",
    role: "Investor",
    roleColor: "#6d28d9",
    desc: "10,290 accredited investors see their holdings, NAV pricing, distribution history, and governance proposals. On-chain verified. Self-service Debt Exchange with live order book.",
    highlight: "Investors trade loan participations peer-to-peer — 15 bps platform fee.",
  },
  {
    route: "/ai-copilot",
    title: "AI Copilot",
    role: "Lender",
    roleColor: "#800020",
    desc: "GPT-4 portfolio brief on demand. Risk signals, covenant alerts, underwriting recommendations, watchlist — all sourced from live loan data.",
    highlight: "Your senior analyst available 24/7 at the click of a button.",
  },
  {
    route: "/governance/compliance",
    title: "Reg D / Reg S Compliance",
    role: "Lender",
    roleColor: "#800020",
    desc: "Full securities compliance layer: Form D filings, AML/KYC batch, Reg S offshore compliance periods, covenant certifications. Audit trail for every action.",
    highlight: "Built for institutional capital markets — not crypto-native workarounds.",
  },
];

const STORAGE_KEY = "kontra_demo_mode";
const STEP_KEY    = "kontra_demo_step";

export default function DemoModeGuide() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [active,  setActive]  = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [step,    setStep]    = useState(() => parseInt(localStorage.getItem(STEP_KEY) ?? "0", 10));
  const [visible, setVisible] = useState(true); // minimized vs expanded

  // Sync step index to URL when the user navigates manually
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
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #800020, #6d28d9)",
          color: "#fff",
          boxShadow: "0 4px 24px rgba(128,0,32,0.4), 0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        <span style={{ fontSize: 14 }}>▶</span>
        Start Demo Tour
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
          <span style={{ color: "#6d28d9" }}>◉</span>
          Demo · {step + 1}/{STEPS.length}
        </button>
        <button onClick={exit} className="rounded-full w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white transition" style={{ background: "#1e2a3a", border: "1px solid rgba(255,255,255,0.08)" }}>
          ✕
        </button>
      </div>
    );
  }

  /* ── Active — full panel ──────────────────────────────────────── */
  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[340px] rounded-2xl shadow-2xl overflow-hidden"
      style={{
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {/* Progress bar */}
      <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${current.roleColor}, #6d28d9)` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
            style={{ background: `${current.roleColor}22`, color: current.roleColor }}
          >
            {current.role}
          </span>
          <span className="text-[11px] text-slate-500">Step {step + 1} of {STEPS.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setVisible(false)}
            className="rounded p-1 text-slate-600 hover:text-slate-400 transition text-xs"
            title="Minimize"
          >
            ─
          </button>
          <button
            onClick={exit}
            className="rounded p-1 text-slate-600 hover:text-slate-400 transition text-xs"
            title="Exit demo"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-3">
        <h3 className="text-base font-black text-white" style={{ letterSpacing: "-0.02em" }}>
          {current.title}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          {current.desc}
        </p>
        {/* Highlight callout */}
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ background: `${current.roleColor}14`, border: `1px solid ${current.roleColor}30` }}
        >
          <p className="text-xs font-semibold" style={{ color: current.roleColor }}>
            ✦ {current.highlight}
          </p>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-1.5 pb-3">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => goToStep(i)}
            className="rounded-full transition-all"
            style={{
              width: i === step ? 20 : 6,
              height: 6,
              background: i === step
                ? current.roleColor
                : i < step
                  ? "rgba(255,255,255,0.25)"
                  : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={prev}
          disabled={step === 0}
          className="rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}
        >
          ← Prev
        </button>

        <button
          onClick={exit}
          className="text-xs text-slate-600 hover:text-slate-400 transition px-2"
        >
          Exit tour
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={next}
            className="rounded-lg px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${current.roleColor}, #6d28d9)` }}
          >
            Next →
          </button>
        ) : (
          <button
            onClick={exit}
            className="rounded-lg px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
          >
            ✓ Done
          </button>
        )}
      </div>
    </div>
  );
}
