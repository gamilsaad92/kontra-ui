/**
 * Executive Command Center — Stage 7
 * Route: /command
 *
 * The Bloomberg-terminal–style C-suite view of the entire Kontra portfolio.
 * A single dense page that surfaces every mission-critical signal across:
 *   - Portfolio health score & risk grade
 *   - Loan-level risk heatmap (DSCR / LTV / Occupancy / Payment)
 *   - 12-month P&I income projection (SVG bar chart)
 *   - Loan maturity wall
 *   - Capital markets pulse (secondary market + distributions)
 *   - Recent critical events
 *
 * This is the slide you show investors and the tab you pin open every morning.
 */

import { useState, useEffect } from "react";
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  BellAlertIcon,
  ArrowsRightLeftIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

// ── Portfolio data ────────────────────────────────────────────────────────────
const PORTFOLIO = {
  total_aum:    18_632_500,
  loan_count:   6,
  ytd_distributions: 834_221,
  active_cure_workflows: 4,
  unread_alerts: 5,
  secondary_market_volume: 8_550_000,
  health_score: 71,
  risk_grade: "B+",
};

const LOANS = [
  { ref:"LN-2847", borrower:"Cedar Grove Partners",  type:"Multifamily", city:"Miami, FL",   amount:4_112_500, dscr:1.138, ltv:70.0, occ:92,  status:"Current",         cure:true,  rate:8.84 },
  { ref:"LN-3201", borrower:"Metro Development",     type:"Industrial",  city:"Denver, CO",  amount:5_520_000, dscr:1.189, ltv:77.7, occ:96,  status:"Current",         cure:true,  rate:8.68 },
  { ref:"LN-4108", borrower:"Oakfield Group",        type:"Retail",      city:"Chicago, IL", amount:3_200_000, dscr:1.050, ltv:72.0, occ:78,  status:"Cash Trap",       cure:true,  rate:9.50 },
  { ref:"LN-5593", borrower:"Westridge Capital",     type:"Office",      city:"Dallas, TX",  amount:6_800_000, dscr:1.310, ltv:58.0, occ:91,  status:"Current",         cure:false, rate:8.25 },
  { ref:"LN-1120", borrower:"Sunrise Holdings",      type:"Hotel",       city:"Tampa, FL",   amount:2_400_000, dscr:0.940, ltv:82.0, occ:67,  status:"Special Servicing",cure:true,  rate:9.75 },
  { ref:"LN-0728", borrower:"Crestwood Logistics",   type:"Industrial",  city:"Nashville, TN",amount:2_100_000,dscr:1.420, ltv:52.0, occ:100, status:"Current",         cure:false, rate:7.50 },
];

// Monthly P&I income for next 12 months
const MONTHLY_INCOME = [
  { month:"May",  projected:127_400, received:0,       forecast:true  },
  { month:"Jun",  projected:127_400, received:0,       forecast:true  },
  { month:"Jul",  projected:121_200, received:0,       forecast:true  },
  { month:"Aug",  projected:121_200, received:0,       forecast:true  },
  { month:"Sep",  projected:121_200, received:0,       forecast:true  },
  { month:"Oct",  projected:115_800, received:0,       forecast:true  },
  { month:"Nov",  projected:115_800, received:0,       forecast:true  },
  { month:"Dec",  projected:115_800, received:0,       forecast:true  },
];
const RECENT_INCOME = [
  { month:"Jan",  projected:112_240, received:112_240, forecast:false },
  { month:"Feb",  projected:112_240, received:112_240, forecast:false },
  { month:"Mar",  projected:115_800, received:115_800, forecast:false },
  { month:"Apr",  projected:115_800, received:115_800, forecast:false },
];
const ALL_INCOME = [...RECENT_INCOME, ...MONTHLY_INCOME];

// Maturity schedule
const MATURITIES = [
  { ref:"LN-4108", borrower:"Oakfield Group",    amount:3_200_000, date:"Mar 2027", months_away:11, type:"Retail"      },
  { ref:"LN-5593", borrower:"Westridge Capital", amount:6_800_000, date:"Dec 2029", months_away:44, type:"Office"      },
  { ref:"LN-2847", borrower:"Cedar Grove",       amount:4_112_500, date:"Jun 2028", months_away:26, type:"Multifamily" },
  { ref:"LN-1120", borrower:"Sunrise Holdings",  amount:2_400_000, date:"Aug 2026", months_away: 4, type:"Hotel"       },
  { ref:"LN-3201", borrower:"Metro Dev",         amount:5_520_000, date:"Sep 2028", months_away:29, type:"Industrial"  },
  { ref:"LN-0728", borrower:"Crestwood Logis.",  amount:2_100_000, date:"Feb 2030", months_away:46, type:"Industrial"  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n: number) => `$${n.toLocaleString("en-US")}`;
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
const fmtMM= (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${(n/1_000).toFixed(0)}K`;

function dscrColor(v: number) {
  if (v >= 1.25) return "bg-emerald-100 text-emerald-800";
  if (v >= 1.10) return "bg-amber-100 text-amber-800";
  if (v >= 1.00) return "bg-orange-100 text-orange-800";
  return "bg-red-200 text-red-900 font-bold";
}
function ltvColor(v: number) {
  if (v <= 65) return "bg-emerald-100 text-emerald-800";
  if (v <= 75) return "bg-amber-100 text-amber-800";
  if (v <= 80) return "bg-orange-100 text-orange-800";
  return "bg-red-200 text-red-900 font-bold";
}
function occColor(v: number) {
  if (v >= 90) return "bg-emerald-100 text-emerald-800";
  if (v >= 85) return "bg-amber-100 text-amber-800";
  if (v >= 80) return "bg-orange-100 text-orange-800";
  return "bg-red-200 text-red-900 font-bold";
}
function statusColor(s: string) {
  if (s === "Current")           return "bg-emerald-100 text-emerald-700";
  if (s === "Cash Trap")         return "bg-amber-100 text-amber-700";
  if (s === "Special Servicing") return "bg-red-100 text-red-800 font-bold";
  return "bg-slate-100 text-slate-600";
}
function maturityColor(months: number) {
  if (months <= 6)  return "bg-red-200 text-red-900";
  if (months <= 18) return "bg-amber-100 text-amber-800";
  if (months <= 36) return "bg-blue-100 text-blue-800";
  return "bg-emerald-100 text-emerald-800";
}

const RECENT_EVENTS = [
  { time:"Today 2:10pm",  sev:"critical", text:"Occupancy breach — LN-4108 Oakfield Group — Cash trap activated" },
  { time:"Today 7:00am",  sev:"info",     text:"Insurance renewal due in 28 days — LN-3201 Metro Development" },
  { time:"Apr 19 2:22pm", sev:"info",     text:"New bid received on POS-001 — $484,500 Senior B — Summit Yield 8.76%" },
  { time:"Apr 18 8:00am", sev:"warning",  text:"DSCR waiver — LN-2847 Cedar Grove — 73 days remaining" },
  { time:"Apr 10 3:00pm", sev:"critical", text:"LN-1120 Sunrise Holdings escalated to Special Servicing" },
];

const TYPE_COLORS: Record<string, string> = {
  Multifamily:"bg-blue-100 text-blue-700",
  Industrial: "bg-slate-100 text-slate-700",
  Retail:     "bg-amber-100 text-amber-700",
  Office:     "bg-violet-100 text-violet-700",
  Hotel:      "bg-orange-100 text-orange-700",
};

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────
function IncomeBarChart() {
  const maxVal = Math.max(...ALL_INCOME.map(m => Math.max(m.projected, m.received)));
  const W = 520; const H = 120; const BAR_W = 22; const GAP = 18;
  const scale = (v: number) => (v / maxVal) * H;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${ALL_INCOME.length * (BAR_W + GAP) + 20} ${H + 36}`} className="w-full min-w-[360px]">
        {/* Y grid lines */}
        {[0.25, 0.5, 0.75, 1.0].map(pct => (
          <line key={pct} x1="0" y1={H - scale(maxVal * pct)} x2={ALL_INCOME.length * (BAR_W + GAP)} y2={H - scale(maxVal * pct)}
            stroke="#f1f5f9" strokeWidth="1" />
        ))}
        {ALL_INCOME.map((m, i) => {
          const x = i * (BAR_W + GAP) + 10;
          const barH = scale(m.forecast ? m.projected : m.received);
          return (
            <g key={i}>
              {/* Background bar (projected) */}
              {m.forecast && (
                <rect x={x} y={H - scale(m.projected)} width={BAR_W} height={scale(m.projected)}
                  fill="#e2e8f0" rx="3" />
              )}
              {/* Actual / forecast bar */}
              <rect x={x} y={H - barH} width={BAR_W} height={barH}
                fill={m.forecast ? "#94a3b8" : "#1e293b"} rx="3"
                opacity={m.forecast ? 0.7 : 1} />
              {/* Month label */}
              <text x={x + BAR_W / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">
                {m.month}
              </text>
              {/* Value label on top */}
              <text x={x + BAR_W / 2} y={H - barH - 4} textAnchor="middle" fontSize="8" fill={m.forecast ? "#94a3b8" : "#475569"}>
                {(m.forecast ? m.projected : m.received) >= 100000
                  ? `$${((m.forecast ? m.projected : m.received) / 1000).toFixed(0)}K`
                  : ""}
              </text>
            </g>
          );
        })}
        {/* Legend */}
        <rect x="10" y={H + 24} width="10" height="6" fill="#1e293b" rx="2" />
        <text x="24" y={H + 30} fontSize="8" fill="#64748b">Received</text>
        <rect x="80" y={H + 24} width="10" height="6" fill="#94a3b8" rx="2" opacity="0.7" />
        <text x="94" y={H + 30} fontSize="8" fill="#64748b">Projected</text>
      </svg>
    </div>
  );
}

// ── Health Score Gauge ────────────────────────────────────────────────────────
function HealthGauge({ score }: { score: number }) {
  const r = 54; const cx = 70; const cy = 70;
  const circumference = Math.PI * r;
  const arc = (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const grade = score >= 85 ? "A" : score >= 75 ? "B+" : score >= 65 ? "B" : score >= 55 ? "C+" : "C";

  return (
    <svg viewBox="0 0 140 90" className="w-full max-w-[160px]">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${arc} ${circumference}`} />
      <text x={cx} y={cy - 8}  textAnchor="middle" fontSize="22" fontWeight="900" fill="#0f172a">{score}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{grade}</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="8"  fill="#94a3b8">Health Score</text>
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const totalAUM = LOANS.reduce((s, l) => s + l.amount, 0);
  const breachCount = LOANS.filter(l => l.dscr < 1.25 || l.ltv > 75 || l.occ < 85).length;
  const currentCount = LOANS.filter(l => l.status === "Current").length;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-slate-500" />
            Executive Command Center
          </h1>
          <p className="text-sm text-slate-500">Live portfolio intelligence — {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">Live · Synced 2m ago</span>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label:"Total AUM",          value: fmtM(totalAUM),                       sub:"6 active loans",        icon:BanknotesIcon,         up:true  },
          { label:"YTD Distributions",  value: fmtMM(PORTFOLIO.ytd_distributions),   sub:"To investors",          icon:ArrowsRightLeftIcon,   up:true  },
          { label:"Loans Current",      value: `${currentCount}/${LOANS.length}`,    sub:"Payment performing",    icon:CheckCircleIcon,       up:true  },
          { label:"Covenant Breaches",  value: `${breachCount}`,                     sub:"Requiring attention",   icon:ShieldExclamationIcon, up:false },
          { label:"Active Workflows",   value: `${PORTFOLIO.active_cure_workflows}`, sub:"Cure plans open",       icon:ClockIcon,             up:false },
          { label:"Unread Alerts",      value: `${PORTFOLIO.unread_alerts}`,         sub:"Since last login",      icon:BellAlertIcon,         up:false },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-4 w-4 text-slate-400" />
                {kpi.up
                  ? <ArrowTrendingUpIcon className="h-3.5 w-3.5 text-emerald-500" />
                  : <ArrowTrendingDownIcon className="h-3.5 w-3.5 text-red-500" />
                }
              </div>
              <p className="text-xl font-black text-slate-900 tabular-nums">{kpi.value}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{kpi.label}</p>
              <p className="text-[10px] text-slate-400">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_220px]">
        <div className="space-y-5">
          {/* ── Loan Risk Heatmap ── */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loan Risk Heatmap</p>
              <p className="text-[10px] text-slate-400">Color = covenant threshold breach</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5 text-left">Loan</th>
                    <th className="px-3 py-2.5 text-left">Type</th>
                    <th className="px-3 py-2.5 text-right">Balance</th>
                    <th className="px-3 py-2.5 text-center">DSCR</th>
                    <th className="px-3 py-2.5 text-center">LTV</th>
                    <th className="px-3 py-2.5 text-center">Occ.</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-center">Cure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {LOANS.map(loan => (
                    <tr key={loan.ref} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{loan.ref}</p>
                        <p className="text-[10px] text-slate-500">{loan.borrower}</p>
                        <p className="text-[10px] text-slate-400">{loan.city}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[loan.type] ?? "bg-slate-100 text-slate-600"}`}>{loan.type}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{fmtM(loan.amount)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`rounded-md px-2 py-1 text-xs font-black tabular-nums ${dscrColor(loan.dscr)}`}>{loan.dscr.toFixed(3)}x</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${ltvColor(loan.ltv)}`}>{loan.ltv.toFixed(1)}%</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`rounded-md px-2 py-1 text-xs font-bold tabular-nums ${occColor(loan.occ)}`}>{loan.occ}%</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(loan.status)}`}>{loan.status}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {loan.cure
                          ? <ExclamationTriangleIcon className="mx-auto h-4 w-4 text-amber-500" />
                          : <CheckCircleIcon className="mx-auto h-4 w-4 text-emerald-500" />
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Legend */}
              <div className="border-t border-slate-100 px-5 py-2.5 flex flex-wrap gap-3 text-[10px] text-slate-400">
                {[
                  { color:"bg-emerald-100", label:"≥ threshold" },
                  { color:"bg-amber-100",   label:"watch zone" },
                  { color:"bg-orange-100",  label:"near breach" },
                  { color:"bg-red-200",     label:"breach / hard floor" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <span className={`h-2.5 w-2.5 rounded-sm ${l.color}`} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Income Chart ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly P&I Income — 8-Month Projection</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Jan–Apr 2026 actual · May–Dec 2026 projected at current loan balances</p>
              </div>
              <p className="text-sm font-black text-slate-900 tabular-nums">{fmtM(ALL_INCOME.reduce((s,m)=>s+(m.forecast?m.projected:m.received),0))}<span className="text-xs font-normal text-slate-400 ml-1">12mo est.</span></p>
            </div>
            <IncomeBarChart />
          </div>

          {/* ── Maturity Wall ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Loan Maturity Wall</p>
            <div className="space-y-2.5">
              {[...MATURITIES].sort((a,b) => a.months_away - b.months_away).map(m => {
                const maxMonths = 48;
                const pct = Math.min(100, (m.months_away / maxMonths) * 100);
                return (
                  <div key={m.ref}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 w-16">{m.ref}</span>
                        <span className="text-slate-500 text-[11px]">{m.borrower}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${TYPE_COLORS[m.type]??""}`}>{m.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-slate-600">{fmtM(m.amount)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${maturityColor(m.months_away)}`}>{m.date}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full transition-all ${
                        m.months_away <= 6 ? "bg-red-500" :
                        m.months_away <= 18 ? "bg-amber-400" :
                        m.months_away <= 36 ? "bg-blue-500" :
                        "bg-emerald-500"
                      }`} style={{ width:`${pct}%` }} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">{m.months_away} months to maturity</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-4">
          {/* Portfolio Health */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Portfolio Health</p>
            <HealthGauge score={PORTFOLIO.health_score} />
            <div className="mt-3 space-y-1.5 text-xs text-left">
              {[
                { label:"Payment Performance", score:95, color:"bg-emerald-500" },
                { label:"Covenant Compliance",  score:58, color:"bg-amber-500"  },
                { label:"LTV Safety Margin",    score:72, color:"bg-blue-500"   },
                { label:"Cash Flow Coverage",   score:64, color:"bg-violet-500" },
              ].map(c => (
                <div key={c.label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-slate-600">{c.label}</span>
                    <span className="font-bold text-slate-900">{c.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${c.color}`} style={{ width:`${c.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Concentration Risk */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Concentration Risk</p>
            {[
              { type:"Industrial",  pct:40.4, color:"bg-slate-700" },
              { type:"Office",      pct:36.5, color:"bg-violet-500" },
              { type:"Retail",      pct:17.2, color:"bg-amber-500"  },
              { type:"Multifamily", pct:22.1, color:"bg-blue-500"   },
              { type:"Hotel",       pct:12.9, color:"bg-orange-500" },
            ].sort((a,b)=>b.pct-a.pct).map(c => (
              <div key={c.type} className="mb-2.5">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-600">{c.type}</span>
                  <span className="font-bold text-slate-900">{c.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${c.color}`} style={{ width:`${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Recent Events */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Recent Events</p>
            <div className="space-y-2.5">
              {RECENT_EVENTS.map((ev, i) => {
                const Icon = ev.sev === "critical" ? XCircleIcon : ev.sev === "warning" ? ExclamationTriangleIcon : CheckCircleIcon;
                return (
                  <div key={i} className="flex items-start gap-2">
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${ev.sev==="critical"?"text-red-500":ev.sev==="warning"?"text-amber-500":"text-emerald-500"}`} />
                    <div>
                      <p className="text-[10px] text-slate-400">{ev.time}</p>
                      <p className="text-[11px] font-semibold text-slate-800 leading-snug">{ev.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capital Markets Pulse */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Capital Markets Pulse</p>
            <div className="space-y-2 text-xs">
              {[
                { label:"Sec. Market Volume (MTD)", value:"$8.55M",  color:"text-slate-900" },
                { label:"Active Listings",           value:"4",       color:"text-slate-900" },
                { label:"Avg Cleared Yield",         value:"8.14%",   color:"text-emerald-700" },
                { label:"YTD Distributions",         value:fmtMM(PORTFOLIO.ytd_distributions), color:"text-violet-700" },
                { label:"Tokens Issued",             value:"58,490",  color:"text-slate-900" },
                { label:"Settlement Method",         value:"USDC T+1", color:"text-slate-600" },
              ].map(m => (
                <div key={m.label} className="flex justify-between border-b border-slate-50 pb-1.5 last:border-0">
                  <span className="text-slate-500">{m.label}</span>
                  <span className={`font-bold tabular-nums ${m.color}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
