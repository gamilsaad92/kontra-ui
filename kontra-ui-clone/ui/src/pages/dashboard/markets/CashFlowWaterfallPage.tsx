/**
 * Cash Flow Waterfall Page
 * Visualizes the full chain: Rent Receipt → Servicer Fee → Reserve → Distribution → Token Holders
 * Shows per-loan breakdown, NAV per token, and next distribution date
 */
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface WaterfallLoan {
  ref: string;
  name: string;
  type: string;
  upb: number;
  grossRent: number;
  servicerFee: number;
  reserveContrib: number;
  availableForDist: number;
  tokenSupply: number;
  navPerToken: number;
  nextDistDate: string;
  dscr: number;
  status: "current" | "watchlist" | "hold";
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const WATERFALL_LOANS: WaterfallLoan[] = [
  {
    ref: "LN-2847", name: "Meridian Apartments", type: "Multifamily",
    upb: 31400000, grossRent: 287500, servicerFee: 8625, reserveContrib: 14375,
    availableForDist: 264500, tokenSupply: 314000, navPerToken: 102.73,
    nextDistDate: "2026-05-01", dscr: 1.42, status: "current",
  },
  {
    ref: "LN-2741", name: "Westgate Industrial Park", type: "Industrial",
    upb: 22800000, grossRent: 198400, servicerFee: 5952, reserveContrib: 9920,
    availableForDist: 182528, tokenSupply: 228000, navPerToken: 101.35,
    nextDistDate: "2026-05-01", dscr: 1.68, status: "current",
  },
  {
    ref: "LN-3204", name: "Riverview Office Tower", type: "Office",
    upb: 18200000, grossRent: 148000, servicerFee: 4440, reserveContrib: 14800,
    availableForDist: 0, tokenSupply: 182000, navPerToken: 99.82,
    nextDistDate: "HOLD — covenant breach", dscr: 1.18, status: "hold",
  },
  {
    ref: "LN-3011", name: "Harbor Point Mixed-Use", type: "Mixed-Use",
    upb: 24700000, grossRent: 0, servicerFee: 0, reserveContrib: 0,
    availableForDist: 0, tokenSupply: 247000, navPerToken: 79.25,
    nextDistDate: "HOLD — 45d delinquent", dscr: 0.94, status: "watchlist",
  },
];

const PORTFOLIO_TOTALS = {
  grossRent: WATERFALL_LOANS.reduce((s, l) => s + l.grossRent, 0),
  servicerFee: WATERFALL_LOANS.reduce((s, l) => s + l.servicerFee, 0),
  reserveContrib: WATERFALL_LOANS.reduce((s, l) => s + l.reserveContrib, 0),
  availableForDist: WATERFALL_LOANS.reduce((s, l) => s + l.availableForDist, 0),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtUsd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
const fmtFull = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function pct(val: number, total: number) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

// ── Waterfall bar ─────────────────────────────────────────────────────────────
function WaterfallBar({ loan }: { loan: WaterfallLoan }) {
  const total = loan.grossRent || 1;
  const isHeld = loan.status !== "current";
  const steps = [
    { label: "Gross Rent", amount: loan.grossRent, color: "bg-slate-600", pct: 100 },
    { label: "Servicer Fee (3%)", amount: loan.servicerFee, color: "bg-amber-400", pct: pct(loan.servicerFee, total) },
    { label: "Reserve (5%)", amount: loan.reserveContrib, color: "bg-blue-400", pct: pct(loan.reserveContrib, total) },
    { label: "→ Token Holders", amount: loan.availableForDist, color: isHeld ? "bg-red-400" : "bg-emerald-400", pct: pct(loan.availableForDist, total) },
  ];

  return (
    <div className={`rounded-xl border p-5 ${loan.status === "watchlist" ? "border-red-200 bg-red-50/40" : loan.status === "hold" ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"} shadow-sm`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black font-mono text-slate-500">{loan.ref}</span>
            <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${loan.status === "current" ? "bg-emerald-100 text-emerald-700" : loan.status === "hold" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
              {loan.status === "current" ? "Distributing" : loan.status === "hold" ? "On Hold" : "Watchlist"}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{loan.name}</p>
          <p className="text-xs text-slate-500">{loan.type} · UPB {fmtUsd(loan.upb)} · DSCR {loan.dscr}×</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">NAV / token</p>
          <p className={`text-lg font-black tabular-nums ${loan.navPerToken >= 100 ? "text-emerald-700" : "text-red-600"}`}>${loan.navPerToken.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Next dist: <span className="font-medium text-slate-600">{loan.nextDistDate}</span></p>
        </div>
      </div>

      {loan.grossRent === 0 ? (
        <div className="rounded-lg bg-red-100 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
          ⛔ Rent collection suspended — 45 days delinquent. Cash trap active. No waterfall flows until cure.
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <div className="w-36 text-xs text-right text-slate-500 shrink-0">
                {i > 0 && <span className="text-slate-300 mr-1">−</span>}{step.label}
              </div>
              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${step.color}`}
                  style={{ width: `${step.pct}%` }}
                />
              </div>
              <div className="w-24 text-right text-xs font-semibold tabular-nums text-slate-700">
                {fmtFull(step.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Waterfall flow diagram ─────────────────────────────────────────────────────
function FlowDiagram() {
  const steps = [
    { label: "Rent Receipt", sub: "Tenant payments collected", color: "bg-slate-700 text-white", arrow: true },
    { label: "Servicer Fee", sub: "3% of gross rent", color: "bg-amber-100 text-amber-800 border border-amber-200", arrow: true },
    { label: "Reserve Fund", sub: "5% liquid buffer", color: "bg-blue-100 text-blue-800 border border-blue-200", arrow: true },
    { label: "Distribution Pool", sub: "Remaining net cash flow", color: "bg-indigo-100 text-indigo-800 border border-indigo-200", arrow: true },
    { label: "Token Holders", sub: "Pro-rata by token balance", color: "bg-emerald-100 text-emerald-800 border border-emerald-200", arrow: false },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Cash Flow Waterfall — Priority Stack</h3>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <div className={`rounded-xl px-4 py-3 text-center min-w-[120px] ${step.color}`}>
              <p className="text-xs font-bold">{step.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{step.sub}</p>
            </div>
            {step.arrow && <span className="text-slate-400 font-bold text-lg">→</span>}
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-slate-400 flex items-center gap-2">
        <span className="rounded bg-red-100 text-red-600 px-2 py-0.5 font-semibold">⛔ DSCR Breach</span>
        <span>→ Cash trap activated → all flows suspended → no distribution until cure</span>
      </div>
    </div>
  );
}

// ── Summary row ───────────────────────────────────────────────────────────────
function PortfolioSummary() {
  const stats = [
    { label: "Gross Rent (Monthly)", value: fmtFull(PORTFOLIO_TOTALS.grossRent), color: "text-slate-900" },
    { label: "Servicer Fees", value: fmtFull(PORTFOLIO_TOTALS.servicerFee), color: "text-amber-700" },
    { label: "Reserve Contributions", value: fmtFull(PORTFOLIO_TOTALS.reserveContrib), color: "text-blue-700" },
    { label: "Available for Distribution", value: fmtFull(PORTFOLIO_TOTALS.availableForDist), color: "text-emerald-700" },
    { label: "Distribution Efficiency", value: `${pct(PORTFOLIO_TOTALS.availableForDist, PORTFOLIO_TOTALS.grossRent)}%`, color: "text-indigo-700" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{s.label}</p>
          <p className={`mt-1 text-lg font-black tabular-nums ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CashFlowWaterfallPage() {
  const [filter, setFilter] = useState<"all" | "current" | "hold">("all");

  const filtered = WATERFALL_LOANS.filter(l => {
    if (filter === "current") return l.status === "current";
    if (filter === "hold") return l.status !== "current";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Real-Time Cash Flow</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Distribution Waterfall</h1>
            <p className="mt-1 text-sm text-slate-500">
              Rent receipts flow through the priority waterfall — servicer fee → reserve → token holders. 
              Loans with covenant breaches are automatically held; no distributions leave a non-compliant loan.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {(["all", "current", "hold"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {f === "all" ? "All Loans" : f === "current" ? "Distributing" : "On Hold"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PortfolioSummary />
      <FlowDiagram />

      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Per-Loan Waterfall Breakdown</h2>
        {filtered.map(loan => <WaterfallBar key={loan.ref} loan={loan} />)}
      </div>

      {/* Freddie Mac note */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-700">Waterfall priority</span> per PSA §4.01 and Freddie Mac Multifamily Servicing Guide §22.1: (1) Servicer advances and fees, (2) Liquidity reserve replenishment, (3) Net interest distribution to token holders, (4) Principal pro-rata. Distributions are blocked automatically when DSCR &lt; 1.20× or any payment is 30+ days delinquent, per covenant §7.4(b) cash trap provisions.
        </p>
      </div>
    </div>
  );
}
