/**
 * Cash Flow Waterfall — Stage 3
 * Route: /servicer/waterfall
 *
 * The core CRE underwriting engine: shows how income flows from
 * Gross Scheduled Income through Operating Expenses → NOI → Debt Service → DSCR
 * to Distributable Cash Flow for each loan in the portfolio.
 *
 * "Black Knight for CRE" — this is the financial heart of Kontra.
 *
 * Waterfall layers:
 *   GSI  → Gross Scheduled Income (fully occupied rents)
 *   -VCL → Vacancy & Credit Loss
 *   =EGI → Effective Gross Income
 *   -OE  → Operating Expenses (real estate taxes, insurance, maintenance, mgmt, reserves)
 *   =NOI → Net Operating Income
 *   -DS  → Debt Service (principal + interest)
 *   =NCF → Net Cash Flow
 *   DSCR → NOI / DS (must be ≥ covenant floor)
 */

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WaterfallRow {
  label: string;
  sublabel?: string;
  value: number;
  type: "income" | "deduction" | "subtotal" | "result" | "metric";
  indent?: boolean;
  highlight?: boolean;
  covenantFloor?: number;
}

interface LoanWaterfall {
  loan_ref: string;
  borrower: string;
  property: string;
  property_type: string;
  balance: number;
  period: string;
  rows: WaterfallRow[];
  history: { period: string; gsi: number; noi: number; ds: number; dscr: number; ncf: number }[];
}

// ── Demo data ──────────────────────────────────────────────────────────────────
const LOANS: LoanWaterfall[] = [
  {
    loan_ref: "LN-2847", borrower: "Cedar Grove Partners",
    property: "412 Meridian Blvd — Multifamily 24 Units", property_type: "Multifamily",
    balance: 4_112_500, period: "Q1 2026",
    rows: [
      { label: "Gross Scheduled Income",        sublabel:"24 units × $2,050/mo × 12",        value:  590_400, type:"income"   },
      { label: "Vacancy & Credit Loss",          sublabel:"8.3% vacancy allowance",           value:  -49_003, type:"deduction", indent:true },
      { label: "Effective Gross Income",                                                       value:  541_397, type:"subtotal" },
      { label: "Real Estate Taxes",              sublabel:"2025 assessment",                  value:  -48_200, type:"deduction", indent:true },
      { label: "Property Insurance",             sublabel:"Annual premium",                   value:  -18_400, type:"deduction", indent:true },
      { label: "Maintenance & Repairs",          sublabel:"$68/unit/month",                   value:  -19_584, type:"deduction", indent:true },
      { label: "Property Management",            sublabel:"5.5% of EGI",                      value:  -29_777, type:"deduction", indent:true },
      { label: "Replacement Reserves",           sublabel:"$300/unit/year",                   value:   -7_200, type:"deduction", indent:true },
      { label: "Utilities & Other",              sublabel:"Common area + misc",               value:   -8_900, type:"deduction", indent:true },
      { label: "Net Operating Income",                                                         value:  409_336, type:"result",   highlight:true },
      { label: "Debt Service — Interest",        sublabel:"$4.11M × 8.75% I/O",              value: -359_844, type:"deduction", indent:true },
      { label: "Debt Service — Principal",       sublabel:"Interest-only period",             value:        0, type:"deduction", indent:true },
      { label: "Total Debt Service",                                                           value: -359_844, type:"subtotal" },
      { label: "Net Cash Flow",                                                                value:   49_492, type:"result",   highlight:true },
      { label: "DSCR (NOI / DS)",                sublabel:"Covenant floor: 1.25x",            value:    1.138, type:"metric",   covenantFloor:1.25 },
      { label: "Replacement Reserve Deposit",    sublabel:"Funded from NCF",                  value:   -7_200, type:"deduction", indent:true },
      { label: "Distributable Cash Flow",                                                      value:   42_292, type:"result",   highlight:true },
    ],
    history: [
      { period:"Q1 2026", gsi:590_400, noi:409_336, ds:359_844, dscr:1.138, ncf:49_492 },
      { period:"Q4 2025", gsi:584_600, noi:403_120, ds:359_844, dscr:1.120, ncf:43_276 },
      { period:"Q3 2025", gsi:579_200, noi:398_640, ds:359_844, dscr:1.108, ncf:38_796 },
      { period:"Q2 2025", gsi:572_800, noi:391_580, ds:359_844, dscr:1.088, ncf:31_736 },
    ],
  },
  {
    loan_ref: "LN-3012", borrower: "Harbor View Holdings",
    property: "789 Harbor View Dr — Retail 28,000 SF", property_type: "Retail",
    balance: 7_640_000, period: "Q1 2026",
    rows: [
      { label: "Gross Scheduled Income",        sublabel:"28,000 SF × $28.50/SF NNN",        value:  798_000, type:"income"   },
      { label: "Vacancy & Credit Loss",          sublabel:"10.8% (2 vacant units)",           value:  -86_184, type:"deduction", indent:true },
      { label: "Effective Gross Income",                                                       value:  711_816, type:"subtotal" },
      { label: "Real Estate Taxes",              sublabel:"Triple net — paid by tenants",     value:        0, type:"deduction", indent:true },
      { label: "Property Insurance",             sublabel:"Landlord policy",                  value:  -24_600, type:"deduction", indent:true },
      { label: "Maintenance & Repairs",          sublabel:"Common area maintenance",          value:  -18_200, type:"deduction", indent:true },
      { label: "Property Management",            sublabel:"4% of EGI",                        value:  -28_473, type:"deduction", indent:true },
      { label: "Replacement Reserves",           sublabel:"$0.30/SF/year",                    value:   -8_400, type:"deduction", indent:true },
      { label: "Other Operating Expenses",       sublabel:"Admin, legal, accounting",         value:  -11_200, type:"deduction", indent:true },
      { label: "Net Operating Income",                                                         value:  620_943, type:"result",   highlight:true },
      { label: "Debt Service — Interest",        sublabel:"$7.64M × 7.50%",                  value: -573_000, type:"deduction", indent:true },
      { label: "Debt Service — Principal",       sublabel:"30-year amortization schedule",    value:  -55_200, type:"deduction", indent:true },
      { label: "Total Debt Service",                                                           value: -628_200, type:"subtotal" },
      { label: "Net Cash Flow",                                                                value:   -7_257, type:"result",   highlight:true },
      { label: "DSCR (NOI / DS)",                sublabel:"Covenant floor: 1.25x",            value:    0.989, type:"metric",   covenantFloor:1.25 },
      { label: "Replacement Reserve Deposit",    sublabel:"Funded from NCF — INSUFFICIENT",   value:        0, type:"deduction", indent:true },
      { label: "Distributable Cash Flow",                                                      value:   -7_257, type:"result",   highlight:true },
    ],
    history: [
      { period:"Q1 2026", gsi:798_000, noi:620_943, ds:628_200, dscr:0.989, ncf:-7_257 },
      { period:"Q4 2025", gsi:812_400, noi:634_870, ds:628_200, dscr:1.011, ncf:6_670 },
      { period:"Q3 2025", gsi:818_000, noi:641_520, ds:628_200, dscr:1.021, ncf:13_320 },
      { period:"Q2 2025", gsi:821_600, noi:644_680, ds:628_200, dscr:1.026, ncf:16_480 },
    ],
  },
  {
    loan_ref: "LN-3201", borrower: "Metro Development LLC",
    property: "55 Commerce Blvd — Industrial 48,000 SF", property_type: "Industrial",
    balance: 5_520_000, period: "Q1 2026",
    rows: [
      { label: "Gross Scheduled Income",        sublabel:"48,000 SF × $14.20/SF NNN",        value:  681_600, type:"income"   },
      { label: "Vacancy & Credit Loss",          sublabel:"5.0% stabilized assumption",       value:  -34_080, type:"deduction", indent:true },
      { label: "Effective Gross Income",                                                       value:  647_520, type:"subtotal" },
      { label: "Property Insurance",             sublabel:"Annual premium",                   value:  -14_200, type:"deduction", indent:true },
      { label: "Maintenance & Repairs",          sublabel:"Roof, dock, mechanical",           value:   -9_600, type:"deduction", indent:true },
      { label: "Property Management",            sublabel:"3.5% of EGI",                      value:  -22_663, type:"deduction", indent:true },
      { label: "Replacement Reserves",           sublabel:"$0.20/SF/year",                    value:   -9_600, type:"deduction", indent:true },
      { label: "Other Operating Expenses",       sublabel:"Admin",                            value:   -6_400, type:"deduction", indent:true },
      { label: "Net Operating Income",                                                         value:  585_057, type:"result",   highlight:true },
      { label: "Debt Service — Interest",        sublabel:"$5.52M × 7.85%",                  value: -433_320, type:"deduction", indent:true },
      { label: "Debt Service — Principal",       sublabel:"25-year amortization",             value:  -58_800, type:"deduction", indent:true },
      { label: "Total Debt Service",                                                           value: -492_120, type:"subtotal" },
      { label: "Net Cash Flow",                                                                value:   92_937, type:"result",   highlight:true },
      { label: "DSCR (NOI / DS)",                sublabel:"Covenant floor: 1.25x",            value:    1.189, type:"metric",   covenantFloor:1.25 },
      { label: "Replacement Reserve Deposit",    sublabel:"Funded from NCF",                  value:   -9_600, type:"deduction", indent:true },
      { label: "Distributable Cash Flow",                                                      value:   83_337, type:"result",   highlight:true },
    ],
    history: [
      { period:"Q1 2026", gsi:681_600, noi:585_057, ds:492_120, dscr:1.189, ncf:92_937 },
      { period:"Q4 2025", gsi:681_600, noi:583_200, ds:492_120, dscr:1.185, ncf:91_080 },
      { period:"Q3 2025", gsi:675_000, noi:578_400, ds:492_120, dscr:1.176, ncf:86_280 },
      { period:"Q2 2025", gsi:675_000, noi:576_900, ds:492_120, dscr:1.173, ncf:84_780 },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => {
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  const s = abs >= 1_000_000
    ? `$${(abs / 1_000_000).toFixed(3)}M`
    : `$${abs.toLocaleString("en-US")}`;
  return n < 0 ? `(${s})` : s;
};

const dscrColor = (dscr: number, floor = 1.25) =>
  dscr < floor       ? "text-red-700"
  : dscr < floor * 1.05 ? "text-amber-700"
  : "text-emerald-700";

const dscrBg = (dscr: number, floor = 1.25) =>
  dscr < floor       ? "bg-red-50 border-red-200"
  : dscr < floor * 1.05 ? "bg-amber-50 border-amber-200"
  : "bg-emerald-50 border-emerald-200";

function DscrGauge({ dscr, floor = 1.25 }: { dscr: number; floor?: number }) {
  const max = 2.0;
  const pct = Math.min(100, (dscr / max) * 100);
  const floorPct = (floor / max) * 100;
  const color = dscr < floor ? "#dc2626" : dscr < floor * 1.05 ? "#d97706" : "#059669";
  return (
    <div className="mt-4 space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>0x</span><span>{floor}x floor</span><span>2.0x</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-slate-200">
        <div className="absolute left-0 top-0 h-3 rounded-full transition-all" style={{ width:`${pct}%`, background: color }} />
        <div className="absolute top-0 h-3 w-px bg-slate-600" style={{ left:`${floorPct}%` }} />
      </div>
      <p className={`text-2xl font-black ${dscrColor(dscr, floor)}`}>{dscr.toFixed(3)}x DSCR</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ServicingWaterfallPage() {
  const [selectedRef, setSelectedRef] = useState(LOANS[0].loan_ref);
  const [showHistory, setShowHistory] = useState(false);

  const loan = LOANS.find(l => l.loan_ref === selectedRef) ?? LOANS[0];
  const noi = loan.rows.find(r => r.label === "Net Operating Income")?.value ?? 0;
  const ds  = loan.rows.find(r => r.label === "Total Debt Service")?.value ?? 0;
  const ncf = loan.rows.find(r => r.label === "Net Cash Flow")?.value ?? 0;
  const dcf = loan.rows.find(r => r.label === "Distributable Cash Flow")?.value ?? 0;
  const dscr = loan.rows.find(r => r.type === "metric")?.value ?? 0;
  const dscrFloor = loan.rows.find(r => r.type === "metric")?.covenantFloor ?? 1.25;

  const gsi = loan.rows.find(r => r.label === "Gross Scheduled Income")?.value ?? 0;

  // Bar chart bars: each bar as % of GSI
  const bars = [
    { label:"GSI",  value: gsi,             pct: 100,                           color:"#64748b" },
    { label:"EGI",  value: loan.rows.find(r=>r.label==="Effective Gross Income")?.value??0,
                           pct: ((loan.rows.find(r=>r.label==="Effective Gross Income")?.value??0)/gsi)*100, color:"#475569" },
    { label:"NOI",  value: noi,             pct: (noi/gsi)*100,                color: noi < 0 ? "#dc2626" : "#0369a1" },
    { label:"DS",   value: Math.abs(ds),   pct: (Math.abs(ds)/gsi)*100,        color:"#9333ea" },
    { label:"NCF",  value: ncf,             pct: Math.abs(ncf/gsi)*100,        color: ncf < 0 ? "#dc2626" : "#059669" },
  ];

  return (
    <div className="space-y-6">
      {/* Loan selector */}
      <div className="flex flex-wrap gap-2">
        {LOANS.map(l => (
          <button key={l.loan_ref} onClick={() => { setSelectedRef(l.loan_ref); setShowHistory(false); }}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${selectedRef === l.loan_ref ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}
          >
            {l.loan_ref} — {l.property_type}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{loan.borrower}</h2>
          <p className="text-sm text-slate-500">{loan.property} · {loan.period}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <ArrowPathIcon className="h-4 w-4" />
            {showHistory ? "Hide History" : "Show History"}
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <DocumentArrowDownIcon className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Waterfall table */}
        <div className="space-y-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Line Item</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Annual</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">% of GSI</th>
                </tr>
              </thead>
              <tbody>
                {loan.rows.map((row, i) => {
                  if (row.type === "metric") {
                    const covenantBreached = row.value < (row.covenantFloor ?? 1.25);
                    const covenantWatch = !covenantBreached && row.value < (row.covenantFloor ?? 1.25) * 1.05;
                    return (
                      <tr key={i} className={`border-t-2 ${covenantBreached ? "border-red-200 bg-red-50" : covenantWatch ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                        <td className="px-4 py-3 font-bold" colSpan={2}>
                          <div className="flex items-center gap-2">
                            {covenantBreached ? <XCircleIcon className="h-4 w-4 text-red-600" /> : covenantWatch ? <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" /> : <CheckCircleIcon className="h-4 w-4 text-emerald-600" />}
                            <span className={covenantBreached ? "text-red-900" : covenantWatch ? "text-amber-900" : "text-emerald-900"}>{row.label}</span>
                            {row.sublabel && <span className="text-xs font-normal text-slate-500">{row.sublabel}</span>}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right text-xl font-black ${dscrColor(row.value, row.covenantFloor)}`} colSpan={2}>
                          {row.value.toFixed(3)}x
                        </td>
                      </tr>
                    );
                  }

                  const isSubtotal = row.type === "subtotal" || row.type === "result";
                  const isPositive = row.value >= 0;

                  return (
                    <tr key={i} className={`border-t border-slate-100 ${isSubtotal ? "bg-slate-50 font-semibold" : ""} ${row.highlight ? "bg-blue-50 border-t-2 border-blue-200" : ""}`}>
                      <td className={`px-4 py-2.5 ${row.indent ? "pl-8" : ""}`}>
                        <p className={`text-slate-${isSubtotal ? "900" : row.indent ? "600" : "800"} ${row.highlight ? "font-bold text-blue-900" : ""}`}>{row.label}</p>
                        {row.sublabel && <p className="text-xs text-slate-400">{row.sublabel}</p>}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${isPositive ? "text-slate-900" : "text-red-700"} ${row.highlight ? "font-bold text-blue-900" : ""}`}>
                        {fmt(row.value)}
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums text-slate-500 ${row.highlight ? "font-semibold" : ""}`}>
                        {fmt(Math.round(row.value / 12))}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">
                        {row.type !== "deduction" || !row.indent ? "" :
                          `${((Math.abs(row.value) / gsi) * 100).toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Historical trend */}
          {showHistory && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historical Waterfall — Quarter over Quarter</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 text-left">Period</th>
                    <th className="px-4 py-2 text-right">GSI</th>
                    <th className="px-4 py-2 text-right">NOI</th>
                    <th className="px-4 py-2 text-right">Debt Service</th>
                    <th className="px-4 py-2 text-right">DSCR</th>
                    <th className="px-4 py-2 text-right">Net CF</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.history.map((h, i) => (
                    <tr key={i} className={`border-t border-slate-100 ${i === 0 ? "bg-blue-50 font-semibold" : ""}`}>
                      <td className="px-4 py-2.5 text-slate-900">{h.period}{i === 0 && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Current</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmt(h.gsi)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmt(h.noi)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmt(h.ds)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${dscrColor(h.dscr, dscrFloor)}`}>{h.dscr.toFixed(3)}x</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${h.ncf < 0 ? "text-red-700" : "text-emerald-700"}`}>{fmt(h.ncf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right panel — summary + visual */}
        <div className="space-y-4">
          {/* DSCR summary card */}
          <div className={`rounded-xl border p-5 shadow-sm ${dscrBg(dscr, dscrFloor)}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Debt Service Coverage Ratio</p>
            <DscrGauge dscr={dscr} floor={dscrFloor} />
            <p className="mt-2 text-xs text-slate-500">
              {dscr < dscrFloor
                ? `⚠ Below ${dscrFloor}x covenant floor — breach active`
                : dscr < dscrFloor * 1.05
                ? `Near ${dscrFloor}x floor — enhanced monitoring`
                : `Comfortably above ${dscrFloor}x covenant floor`}
            </p>
          </div>

          {/* Income bar chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Cash Flow Cascade</p>
            <div className="space-y-3">
              {bars.map(bar => (
                <div key={bar.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{bar.label}</span>
                    <span className={`tabular-nums font-semibold ${bar.value < 0 ? "text-red-700" : "text-slate-900"}`}>{fmt(bar.value)}</span>
                  </div>
                  <div className="h-6 w-full rounded bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-500"
                      style={{ width:`${Math.max(0, Math.min(100, bar.pct))}%`, background: bar.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key metrics */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Key Metrics</p>
            <div className="space-y-2">
              {[
                { label:"UPB", value:`$${(loan.balance/1e6).toFixed(3)}M` },
                { label:"NOI Yield (cap rate equiv)", value:`${((noi/loan.balance)*100).toFixed(2)}%` },
                { label:"Debt Yield", value:`${((noi/loan.balance)*100).toFixed(2)}%` },
                { label:"NOI / Month", value:fmt(Math.round(noi/12)) },
                { label:"DS / Month", value:fmt(Math.round(Math.abs(ds)/12)) },
                { label:"Net CF / Month", value:fmt(Math.round(ncf/12)) },
                { label:"Distributable CF (annual)", value:fmt(dcf) },
              ].map(m => (
                <div key={m.label} className="flex justify-between border-b border-slate-50 pb-1.5 last:border-0">
                  <span className="text-xs text-slate-500">{m.label}</span>
                  <span className="text-xs font-semibold text-slate-900 tabular-nums">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
