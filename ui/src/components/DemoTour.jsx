import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const STEPS = [
  {
    path: "/dashboard",
    title: "Portfolio Command Center",
    subtitle: "Step 1 of 6",
    body: "Your entire CRE loan portfolio — KPIs, risk alerts, and AI insights — in a single view. Lenders see every loan, every covenant, every flag in real time.",
    highlight: "The top cards show live DSCR, LTV, and delinquency across your whole book.",
    icon: "🏦",
  },
  {
    path: "/document-extraction",
    title: "AI Document Extraction",
    subtitle: "Step 2 of 6",
    body: "Drop any rent roll, operating statement, or appraisal. Ocrolus AI extracts every field with 99%+ accuracy — no manual data entry.",
    highlight: "Try uploading a PDF below to see it populate a loan model in seconds.",
    icon: "📄",
  },
  {
    path: "/covenant-agent",
    title: "Autonomous Covenant Monitor",
    subtitle: "Step 3 of 6",
    body: "Four AI agents work in sequence — parser, compliance checker, risk assessor, report writer — to review every covenant on every loan. Zero manual review.",
    highlight: "Click 'Run Agent' to watch the pipeline execute live.",
    icon: "🤖",
  },
  {
    path: "/portfolio/overview",
    title: "Portfolio Intelligence",
    subtitle: "Step 4 of 6",
    body: "Drill into any loan — financials, covenant history, draw schedule, inspection reports. AI surfaces risks before they become problems.",
    highlight: "Click any loan to see its full data room.",
    icon: "📊",
  },
  {
    path: "/onchain",
    title: "Tokenization Hub",
    subtitle: "Step 5 of 6",
    body: "Tokenize any CRE loan on Ethereum. Distribute fractional interests to investors. Enable secondary trading on Solana. Compliance baked in.",
    highlight: "The $4.5T CRE debt market is 0% tokenized today — Kontra changes that.",
    icon: "⛓️",
  },
  {
    path: "/markets/distribution/tokenize",
    title: "Distribute & Trade",
    subtitle: "Step 6 of 6",
    body: "Investors get real-time NAV, distribution history, and secondary market access — fully transparent, fully programmable. This is the Kontra network effect.",
    highlight: "Every portal — lender, servicer, investor, borrower — shares one data layer.",
    icon: "🌐",
  },
];

const PORTAL_COLORS = { bg: "#800020" };

export default function DemoTour() {
  const navigate = useNavigate();
  const [open, setOpen]   = useState(false);
  const [step, setStep]   = useState(0);
  const [exiting, setExiting] = useState(false);

  const current = STEPS[step];

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= STEPS.length) return;
    setStep(idx);
    navigate(STEPS[idx].path);
  }, [navigate]);

  const close = useCallback(() => {
    setExiting(true);
    setTimeout(() => { setOpen(false); setExiting(false); setStep(0); }, 300);
  }, []);

  const start = useCallback(() => {
    setStep(0);
    setOpen(true);
    navigate(STEPS[0].path);
  }, [navigate]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') goTo(step + 1);
      if (e.key === 'ArrowLeft') goTo(step - 1);
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, goTo, close]);

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={start}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold shadow-2xl shadow-black/40 transition hover:scale-105 active:scale-95"
          style={{ background: "#800020" }}
        >
          <span className="text-base">▶</span>
          Start Demo Tour
        </button>
      )}

      {/* Tour panel */}
      {open && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-[380px] bg-[#0D1117] border border-slate-700 rounded-2xl shadow-2xl shadow-black/60
                      transition-all duration-300 ${exiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
        >
          {/* Progress bar */}
          <div className="h-1 rounded-t-2xl bg-slate-800 overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "#800020" }}
            />
          </div>

          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl shrink-0">
                  {current.icon}
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">{current.subtitle}</p>
                  <p className="text-white font-semibold text-sm leading-tight">{current.title}</p>
                </div>
              </div>
              <button onClick={close} className="text-slate-600 hover:text-slate-400 transition text-lg leading-none">✕</button>
            </div>

            {/* Body */}
            <p className="text-slate-300 text-sm leading-relaxed mb-3">{current.body}</p>

            {/* Highlight callout */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-amber-400 shrink-0 mt-0.5">→</span>
                {current.highlight}
              </p>
            </div>

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-all duration-200 ${
                    i === step ? 'w-5 h-2' : 'w-2 h-2 hover:bg-slate-500'
                  }`}
                  style={{ background: i === step ? "#800020" : "#334155" }}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={() => goTo(step - 1)}
                  className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:border-slate-500 transition"
                >
                  ← Back
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => goTo(step + 1)}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
                  style={{ background: "#800020" }}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={close}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
                  style={{ background: "#059669" }}
                >
                  ✓ Tour Complete
                </button>
              )}
            </div>

            <p className="text-center text-xs text-slate-600 mt-3">Use ← → arrows or Esc to navigate</p>
          </div>
        </div>
      )}
    </>
  );
}
