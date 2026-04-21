/**
 * Portfolio Forecast Engine — Stage 7
 * Route: /forecast
 *
 * The predictive analytics layer that makes Kontra smarter than Black Knight.
 * Instead of just reporting what happened, Kontra forecasts what will happen:
 *
 *   - 8-quarter DSCR trajectory under base / mild stress / severe stress
 *   - Interest rate sensitivity: SOFR +0 / +100 / +200 / +300bps impact on DSCR
 *   - NOI trend forecast: quarterly actuals + model projection
 *   - Cash flow waterfall: 12-month projected P&I, reserves, and net distribution
 *   - Lease maturity schedule: tenant lease expirations and re-leasing risk
 *
 * Model assumptions:
 *   Base:         NOI flat to +3% growth, SOFR unchanged
 *   Mild Stress:  NOI -8%, SOFR +100bps
 *   Severe Stress: NOI -18%, SOFR +250bps
 */

import { useState } from "react";
import {
  SparklesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
interface LoanForecast {
  ref: string;
  borrower: string;
  type: string;
  amount: number;
  current_dscr: number;
  current_noi: number;
  rate: number;
  rate_type: "fixed" | "floating";
  sofr_spread?: number;
  quarters: { q: string; base: number; mild: number; severe: number; actual?: number }[];
  noi_forecast: { q: string; actual?: number; projected: number }[];
  rate_sensitivity: { scenario: string; sofr_delta: number; new_rate: number; dscr: number }[];
  leases: { tenant: string; sf: number; rent_psf: number; expiry: string; months_away: number; pct_of_rent: number }[];
  monthly_cf: { month: string; noi: number; debt_service: number; reserves: number; net: number; forecast: boolean }[];
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const LOANS: LoanForecast[] = [
  {
    ref:"LN-2847", borrower:"Cedar Grove Partners", type:"Multifamily",
    amount:4_112_500, current_dscr:1.138, current_noi:409_336, rate:8.84, rate_type:"fixed",
    quarters:[
      { q:"Q4'25", actual:1.138, base:1.138, mild:1.138, severe:1.138 },
      { q:"Q1'26", actual:1.151, base:1.151, mild:1.151, severe:1.151 },
      { q:"Q2'26",           base:1.189, mild:1.064, severe:0.942 },
      { q:"Q3'26",           base:1.228, mild:1.098, severe:0.972 },
      { q:"Q4'26",           base:1.267, mild:1.133, severe:1.002 },
      { q:"Q1'27",           base:1.307, mild:1.169, severe:1.033 },
      { q:"Q2'27",           base:1.348, mild:1.206, severe:1.065 },
      { q:"Q3'27",           base:1.390, mild:1.244, severe:1.098 },
    ],
    noi_forecast:[
      { q:"Q2'25", actual:98_834,  projected:98_834  },
      { q:"Q3'25", actual:101_200, projected:101_200 },
      { q:"Q4'25", actual:102_334, projected:102_334 },
      { q:"Q1'26", actual:103_500, projected:103_500 },
      { q:"Q2'26",               projected:107_600 },
      { q:"Q3'26",               projected:111_000 },
      { q:"Q4'26",               projected:114_550 },
      { q:"Q1'27",               projected:118_200 },
    ],
    rate_sensitivity:[
      { scenario:"Current (SOFR flat)",   sofr_delta:0,   new_rate:8.84,  dscr:1.138 },
      { scenario:"SOFR +100bps",          sofr_delta:100, new_rate:9.84,  dscr:1.021 },
      { scenario:"SOFR +200bps",          sofr_delta:200, new_rate:10.84, dscr:0.928 },
      { scenario:"SOFR +300bps",          sofr_delta:300, new_rate:11.84, dscr:0.851 },
    ],
    leases:[
      { tenant:"Unit Portfolio (22/24 occ.)", sf:22_800, rent_psf:18.4, expiry:"Rolling monthly",  months_away:0,  pct_of_rent:100 },
    ],
    monthly_cf:[
      { month:"May", noi:34_200, debt_service:30_368, reserves:5_087, net:-1_255, forecast:true  },
      { month:"Jun", noi:34_200, debt_service:30_368, reserves:5_087, net:-1_255, forecast:true  },
      { month:"Jul", noi:34_800, debt_service:30_368, reserves:5_087, net:  -655, forecast:true  },
      { month:"Aug", noi:35_400, debt_service:30_368, reserves:5_087, net:   -55, forecast:true  },
      { month:"Sep", noi:35_400, debt_service:30_368, reserves:5_087, net:   -55, forecast:true  },
      { month:"Oct", noi:36_000, debt_service:30_368, reserves:5_087, net:   545, forecast:true  },
      { month:"Nov", noi:36_000, debt_service:30_368, reserves:5_087, net:   545, forecast:true  },
      { month:"Dec", noi:36_600, debt_service:30_368, reserves:5_087, net: 1_145, forecast:true  },
    ],
  },
  {
    ref:"LN-3201", borrower:"Metro Development LLC", type:"Industrial",
    amount:5_520_000, current_dscr:1.189, current_noi:585_057, rate:8.68, rate_type:"fixed",
    quarters:[
      { q:"Q4'25", actual:1.189, base:1.189, mild:1.189, severe:1.189 },
      { q:"Q1'26", actual:1.195, base:1.195, mild:1.195, severe:1.195 },
      { q:"Q2'26",           base:1.240, mild:1.105, severe:0.972 },
      { q:"Q3'26",           base:1.288, mild:1.148, severe:1.011 },
      { q:"Q4'26",           base:1.338, mild:1.192, severe:1.050 },
      { q:"Q1'27",           base:1.389, mild:1.238, severe:1.090 },
      { q:"Q2'27",           base:1.443, mild:1.286, severe:1.133 },
      { q:"Q3'27",           base:1.498, mild:1.335, severe:1.177 },
    ],
    noi_forecast:[
      { q:"Q2'25", actual:142_500, projected:142_500 },
      { q:"Q3'25", actual:145_800, projected:145_800 },
      { q:"Q4'25", actual:146_264, projected:146_264 },
      { q:"Q1'26", actual:147_800, projected:147_800 },
      { q:"Q2'26",               projected:157_200 },
      { q:"Q3'26",               projected:163_200 },
      { q:"Q4'26",               projected:169_400 },
      { q:"Q1'27",               projected:175_900 },
    ],
    rate_sensitivity:[
      { scenario:"Current (SOFR flat)",   sofr_delta:0,   new_rate:8.68,  dscr:1.189 },
      { scenario:"SOFR +100bps",          sofr_delta:100, new_rate:9.68,  dscr:1.067 },
      { scenario:"SOFR +200bps",          sofr_delta:200, new_rate:10.68, dscr:0.968 },
      { scenario:"SOFR +300bps",          sofr_delta:300, new_rate:11.68, dscr:0.885 },
    ],
    leases:[
      { tenant:"Metro Logistics Inc. (Primary)", sf:32_000, rent_psf:14.50, expiry:"Mar 2031", months_away:59, pct_of_rent:67 },
      { tenant:"Cascade Fulfillment Co.",        sf:13_800, rent_psf:15.25, expiry:"Jun 2027", months_away:26, pct_of_rent:29 },
      { tenant:"Spec Suite (Vacant)",            sf: 2_200, rent_psf:0,     expiry:"Vacant",   months_away:0,  pct_of_rent:0  },
    ],
    monthly_cf:[
      { month:"May", noi:49_000, debt_service:39_930, reserves:10_542, net:-1_472, forecast:true  },
      { month:"Jun", noi:49_000, debt_service:39_930, reserves:10_542, net:-1_472, forecast:true  },
      { month:"Jul", noi:50_500, debt_service:39_930, reserves:10_542, net:   28,  forecast:true  },
      { month:"Aug", noi:50_500, debt_service:39_930, reserves:10_542, net:   28,  forecast:true  },
      { month:"Sep", noi:52_000, debt_service:39_930, reserves:10_542, net: 1_528, forecast:true  },
      { month:"Oct", noi:52_000, debt_service:39_930, reserves:10_542, net: 1_528, forecast:true  },
      { month:"Nov", noi:53_500, debt_service:39_930, reserves:10_542, net: 3_028, forecast:true  },
      { month:"Dec", noi:53_500, debt_service:39_930, reserves:10_542, net: 3_028, forecast:true  },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n: number) => `$${n.toLocaleString("en-US")}`;
const fmtK = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;

function dscrBadge(v: number) {
  if (v >= 1.25) return "text-emerald-700 font-bold";
  if (v >= 1.10) return "text-amber-700 font-bold";
  if (v >= 1.00) return "text-orange-700 font-bold";
  return "text-red-700 font-black";
}

// ── SVG Line Chart for DSCR Projection ───────────────────────────────────────
function DSCRLineChart({ quarters }: { quarters: LoanForecast["quarters"] }) {
  const W = 480; const H = 140; const PAD = { t:20, r:20, b:30, l:40 };
  const cW = W - PAD.l - PAD.r; const cH = H - PAD.t - PAD.b;
  const n = quarters.length;
  const xScale = (i: number) => PAD.l + (i / (n-1)) * cW;
  const minY = 0.75; const maxY = 1.60;
  const yScale = (v: number) => PAD.t + cH - ((v - minY) / (maxY - minY)) * cH;

  const makePath = (key: "base" | "mild" | "severe" | "actual") =>
    quarters
      .filter(q => q[key] !== undefined)
      .map((q, _, arr) => {
        const globalIdx = quarters.indexOf(q);
        return `${globalIdx === 0 ? "M" : "L"} ${xScale(globalIdx)} ${yScale(q[key]!)}`;
      }).join(" ");

  const floorY = yScale(1.25);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px]">
        {/* Grid */}
        {[0.80, 1.00, 1.25, 1.50].map(v => (
          <g key={v}>
            <line x1={PAD.l} y1={yScale(v)} x2={W - PAD.r} y2={yScale(v)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD.l - 4} y={yScale(v)+4} textAnchor="end" fontSize="8" fill="#94a3b8">{v.toFixed(2)}</text>
          </g>
        ))}
        {/* 1.25x floor line */}
        <line x1={PAD.l} y1={floorY} x2={W - PAD.r} y2={floorY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={W - PAD.r + 2} y={floorY + 4} fontSize="8" fill="#f59e0b" fontWeight="700">1.25x</text>

        {/* Actual (dashed) */}
        <path d={makePath("actual")} fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
        {/* Base */}
        <path d={makePath("base")} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Mild Stress */}
        <path d={makePath("mild")} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Severe Stress */}
        <path d={makePath("severe")} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points - base */}
        {quarters.map((q, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(q.base)} r="3" fill="#10b981" />
        ))}

        {/* X axis labels */}
        {quarters.map((q, i) => (
          <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">
            {q.q}
          </text>
        ))}

        {/* Legend */}
        <line x1="50" y1={H - 28} x2="64" y2={H - 28} stroke="#1e293b" strokeWidth="2" strokeDasharray="4 2" />
        <text x="68" y={H - 24} fontSize="8" fill="#64748b">Actual</text>
        <line x1="105" y1={H - 28} x2="119" y2={H - 28} stroke="#10b981" strokeWidth="2" />
        <text x="123" y={H - 24} fontSize="8" fill="#64748b">Base</text>
        <line x1="150" y1={H - 28} x2="164" y2={H - 28} stroke="#f59e0b" strokeWidth="2" />
        <text x="168" y={H - 24} fontSize="8" fill="#64748b">Mild −8% NOI</text>
        <line x1="230" y1={H - 28} x2="244" y2={H - 28} stroke="#ef4444" strokeWidth="2" />
        <text x="248" y={H - 24} fontSize="8" fill="#64748b">Severe −18% NOI</text>
      </svg>
    </div>
  );
}

// ── NOI Forecast Bar Chart ────────────────────────────────────────────────────
function NOIChart({ data }: { data: LoanForecast["noi_forecast"] }) {
  const maxV = Math.max(...data.map(d => Math.max(d.actual ?? 0, d.projected)));
  const H = 100; const BAR_W = 30; const GAP = 18;
  const scale = (v: number) => (v / maxV) * H;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${data.length * (BAR_W + GAP) + 20} ${H + 28}`} className="w-full min-w-[300px]">
        {[0.25, 0.5, 0.75, 1.0].map(p => (
          <line key={p} x1="0" y1={H - scale(maxV * p)} x2={data.length * (BAR_W + GAP)} y2={H - scale(maxV * p)}
            stroke="#f8fafc" strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const x = i * (BAR_W + GAP) + 10;
          const val = d.actual ?? d.projected;
          const bH = scale(val);
          const isForecast = d.actual === undefined;
          return (
            <g key={i}>
              <rect x={x} y={H - bH} width={BAR_W} height={bH} fill={isForecast ? "#cbd5e1" : "#1e293b"} rx="3" />
              <text x={x + BAR_W/2} y={H + 14} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">{d.q}</text>
              <text x={x + BAR_W/2} y={H - bH - 4} textAnchor="middle" fontSize="8" fill={isForecast?"#94a3b8":"#475569"}>
                {fmtK(val)}
              </text>
              {isForecast && (
                <text x={x + BAR_W/2} y={H + 24} textAnchor="middle" fontSize="8" fill="#c4b5fd">▲</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PortfolioForecastPage() {
  const [selectedRef, setSelectedRef] = useState<string>(LOANS[0].ref);
  const [activeSection, setActiveSection] = useState<"dscr" | "noi" | "rate" | "cashflow" | "leases">("dscr");

  const loan = LOANS.find(l => l.ref === selectedRef) ?? LOANS[0];
  const finalQ = loan.quarters[loan.quarters.length - 1];
  const isFloating = loan.rate_type === "floating";

  const sections = [
    { id:"dscr",     label:"DSCR Projection" },
    { id:"noi",      label:"NOI Forecast" },
    { id:"rate",     label:"Rate Sensitivity" },
    { id:"cashflow", label:"Cash Flow" },
    { id:"leases",   label:"Lease Schedule" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-slate-400" />
            Portfolio Forecast Engine
          </h2>
          <p className="text-sm text-slate-500">8-quarter forward projections · Rate sensitivity · Cash flow modeling</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <InformationCircleIcon className="h-4 w-4 shrink-0" />
          <span>Model updated: Apr 1, 2026. Scenarios: base +3% NOI / mild −8% / severe −18%</span>
        </div>
      </div>

      {/* Loan selector */}
      <div className="flex flex-wrap gap-2">
        {LOANS.map(l => (
          <button key={l.ref} onClick={() => setSelectedRef(l.ref)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${selectedRef === l.ref ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}>
            {l.ref} — {l.type}
          </button>
        ))}
      </div>

      {/* Loan summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label:"Borrower",       value:loan.borrower },
          { label:"Balance",        value:`$${(loan.amount/1_000_000).toFixed(2)}M` },
          { label:"Current DSCR",   value:`${loan.current_dscr.toFixed(3)}x` },
          { label:"Current NOI",    value:`$${(loan.current_noi/1000).toFixed(0)}K/yr` },
          { label:"8Q DSCR Target", value:`${finalQ.base.toFixed(3)}x` },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <p className="text-[10px] text-slate-400">{m.label}</p>
            <p className="text-sm font-black text-slate-900">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth:"none" }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${activeSection === s.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── DSCR Projection ── */}
      {activeSection === "dscr" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">8-Quarter DSCR Trajectory</p>
            <p className="text-xs text-slate-400 mb-4">
              Dashed = historical actuals · Green = base case (+3% NOI/yr) · Amber = mild stress (−8%) · Red = severe stress (−18%)
            </p>
            <DSCRLineChart quarters={loan.quarters} />
          </div>

          {/* Quarter table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 text-left">Quarter</th>
                  <th className="px-4 py-2.5 text-right">Actual</th>
                  <th className="px-4 py-2.5 text-right">Base Case</th>
                  <th className="px-4 py-2.5 text-right">Mild Stress</th>
                  <th className="px-4 py-2.5 text-right">Severe Stress</th>
                  <th className="px-4 py-2.5 text-right">Covenant (1.25x)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loan.quarters.map((q, i) => (
                  <tr key={i} className={q.actual !== undefined ? "bg-slate-50/50" : ""}>
                    <td className="px-5 py-2.5 font-bold text-slate-900">
                      {q.q} {q.actual !== undefined && <span className="ml-1 text-[10px] font-normal text-slate-400">actual</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {q.actual !== undefined ? <span className={`font-bold ${dscrBadge(q.actual)}`}>{q.actual.toFixed(3)}x</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={dscrBadge(q.base)}>{q.base.toFixed(3)}x</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={dscrBadge(q.mild)}>{q.mild.toFixed(3)}x</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={dscrBadge(q.severe)}>{q.severe.toFixed(3)}x</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {q.severe >= 1.25
                        ? <CheckCircleIcon className="ml-auto h-4 w-4 text-emerald-500" />
                        : q.base >= 1.25
                        ? <ExclamationTriangleIcon className="ml-auto h-4 w-4 text-amber-500" />
                        : <span className="text-xs font-bold text-red-600">Breach risk</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NOI Forecast ── */}
      {activeSection === "noi" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Quarterly NOI — Actual vs. Projected</p>
            <p className="text-xs text-slate-400 mb-4">Dark bars = actual NOI · Gray bars = model projection (base case +3%/yr)</p>
            <NOIChart data={loan.noi_forecast} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 text-left">Quarter</th>
                  <th className="px-4 py-2.5 text-right">Actual NOI</th>
                  <th className="px-4 py-2.5 text-right">Projected NOI</th>
                  <th className="px-4 py-2.5 text-right">vs. Projected</th>
                  <th className="px-4 py-2.5 text-right">Implied DSCR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loan.noi_forecast.map((d, i) => {
                  const annualDS = loan.amount * loan.rate / 100;
                  const impliedDSCR = (d.projected * 4) / annualDS;
                  const variance = d.actual !== undefined ? ((d.actual - d.projected) / d.projected * 100) : null;
                  return (
                    <tr key={i} className={d.actual !== undefined ? "bg-slate-50/50" : ""}>
                      <td className="px-5 py-2.5 font-bold text-slate-900">
                        {d.q} {d.actual === undefined && <span className="ml-1 text-[10px] font-normal text-violet-500">forecast</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                        {d.actual !== undefined ? fmt(d.actual) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmt(d.projected)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {variance !== null ? (
                          <span className={variance >= 0 ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}>
                            {variance >= 0 ? "+" : ""}{variance.toFixed(1)}%
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <span className={dscrBadge(impliedDSCR)}>{impliedDSCR.toFixed(3)}x</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Rate Sensitivity ── */}
      {activeSection === "rate" && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 text-sm ${isFloating ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
            {isFloating
              ? <><ExclamationTriangleIcon className="inline h-4 w-4 mr-1 text-amber-600" />This loan is <strong>floating rate</strong> (SOFR + {loan.sofr_spread}bps). Rate sensitivity is a direct cash flow risk.</>
              : <><CheckCircleIcon className="inline h-4 w-4 mr-1 text-emerald-600" />This loan is <strong>fixed rate</strong> at {loan.rate}%. Rate sensitivity applies only at refinancing/maturity.</>
            }
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">DSCR Impact by SOFR Scenario</p>
              <p className="text-xs text-slate-400 mt-0.5">NOI held constant at current level · Debt service recalculated at new rate</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 text-left">Scenario</th>
                  <th className="px-4 py-3 text-right">SOFR Change</th>
                  <th className="px-4 py-3 text-right">New Rate</th>
                  <th className="px-4 py-3 text-right">Annual DS</th>
                  <th className="px-4 py-3 text-right">DSCR</th>
                  <th className="px-4 py-3 text-right">vs. Floor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loan.rate_sensitivity.map((s, i) => {
                  const annualDS = loan.amount * s.new_rate / 100;
                  const vs1_25 = s.dscr - 1.25;
                  return (
                    <tr key={i} className={i === 0 ? "bg-slate-50/50" : ""}>
                      <td className="px-5 py-3 font-semibold text-slate-900">{s.scenario}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s.sofr_delta === 0 ? "—" : <span className="font-bold text-red-700">+{s.sofr_delta}bps</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{s.new_rate.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmt(Math.round(annualDS))}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-black tabular-nums ${dscrBadge(s.dscr)}`}>{s.dscr.toFixed(3)}x</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-bold ${vs1_25 >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {vs1_25 >= 0 ? "+" : ""}{vs1_25.toFixed(3)}x
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Visual sensitivity bars */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">DSCR Erosion — SOFR Shock Analysis</p>
            {loan.rate_sensitivity.map((s, i) => (
              <div key={i} className="mb-3.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">{s.scenario}</span>
                  <span className={`font-black tabular-nums ${dscrBadge(s.dscr)}`}>{s.dscr.toFixed(3)}x</span>
                </div>
                <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${s.dscr >= 1.25 ? "bg-emerald-500" : s.dscr >= 1.00 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width:`${Math.min(100, (s.dscr / 2.0) * 100)}%` }}
                  />
                  <div className="absolute inset-y-0 w-px bg-slate-600 opacity-50" style={{ left:"62.5%" }} />
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">1.25x floor at 62.5% bar width</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cash Flow Waterfall ── */}
      {activeSection === "cashflow" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">8-Month Cash Flow Waterfall — May–Dec 2026</p>
            <p className="text-xs text-slate-400 mt-0.5">Base case NOI projection · After debt service and reserve contributions</p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 text-left">Month</th>
                <th className="px-4 py-2.5 text-right">Projected NOI</th>
                <th className="px-4 py-2.5 text-right">Debt Service</th>
                <th className="px-4 py-2.5 text-right">Reserves</th>
                <th className="px-4 py-2.5 text-right">Net Cash Flow</th>
                <th className="px-4 py-2.5 text-right">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loan.monthly_cf.map((m, i) => {
                const coverage = m.noi / m.debt_service;
                return (
                  <tr key={i}>
                    <td className="px-5 py-2.5 font-semibold text-slate-900">{m.month} 2026</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmt(m.noi)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">({fmt(m.debt_service)})</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">({fmt(m.reserves)})</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold">
                      <span className={m.net >= 0 ? "text-emerald-700" : "text-red-700"}>
                        {m.net >= 0 ? "+" : ""}{fmt(m.net)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-bold tabular-nums ${dscrBadge(coverage)}`}>{coverage.toFixed(3)}x</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 text-xs font-bold text-slate-900">
              <tr>
                <td className="px-5 py-3">8-Month Total</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(loan.monthly_cf.reduce((s,m)=>s+m.noi,0))}</td>
                <td className="px-4 py-3 text-right tabular-nums">({fmt(loan.monthly_cf.reduce((s,m)=>s+m.debt_service,0))})</td>
                <td className="px-4 py-3 text-right tabular-nums">({fmt(loan.monthly_cf.reduce((s,m)=>s+m.reserves,0))})</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className={loan.monthly_cf.reduce((s,m)=>s+m.net,0) >= 0 ? "text-emerald-700" : "text-red-700"}>
                    {loan.monthly_cf.reduce((s,m)=>s+m.net,0) >= 0 ? "+" : ""}{fmt(loan.monthly_cf.reduce((s,m)=>s+m.net,0))}
                  </span>
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Lease Schedule ── */}
      {activeSection === "leases" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant Lease Schedule</p>
              <p className="text-xs text-slate-400 mt-0.5">Expirations are a primary NOI risk driver — monitor re-leasing activity against projections</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 text-left">Tenant</th>
                  <th className="px-4 py-2.5 text-right">SF</th>
                  <th className="px-4 py-2.5 text-right">Rent/SF</th>
                  <th className="px-4 py-2.5 text-right">% of Rent Roll</th>
                  <th className="px-4 py-2.5 text-right">Expiry</th>
                  <th className="px-4 py-2.5 text-right">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loan.leases.map((l, i) => {
                  const riskColor = l.months_away === 0 ? "bg-slate-100 text-slate-500" :
                    l.months_away <= 12 ? "bg-red-100 text-red-700" :
                    l.months_away <= 24 ? "bg-amber-100 text-amber-700" :
                    "bg-emerald-100 text-emerald-700";
                  const riskLabel = l.months_away === 0 ? "Vacant" :
                    l.months_away <= 12 ? "High" :
                    l.months_away <= 24 ? "Watch" : "Low";
                  return (
                    <tr key={i}>
                      <td className="px-5 py-3 font-semibold text-slate-900">{l.tenant}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{l.sf.toLocaleString()} SF</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">${l.rent_psf.toFixed(2)} NNN</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-slate-700" style={{ width:`${l.pct_of_rent}%` }} />
                          </div>
                          <span className="tabular-nums text-slate-700 font-semibold">{l.pct_of_rent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{l.expiry}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${riskColor}`}>{riskLabel}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {loan.leases.some(l => l.months_away > 0 && l.months_away <= 24) && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-800 flex items-center gap-2 mb-1">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Near-Term Lease Expiration Risk
              </p>
              <p className="text-xs text-amber-700">
                {loan.leases.filter(l => l.months_away > 0 && l.months_away <= 24).map(l =>
                  `${l.tenant} (${l.pct_of_rent}% of rent roll, expires ${l.expiry})`
                ).join("; ")}. Failure to re-lease at projected terms would reduce NOI and may trigger covenant breach under mild stress scenario.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
