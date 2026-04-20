/**
 * Reporting Engine — Stage 5
 * Route: /reports/engine
 *
 * The "Black Knight" automated report generation layer. Kontra produces four
 * classes of regulated financial statements on a monthly cadence:
 *
 *   1. Servicer Monthly Package  — CREFC-formatted P&I, reserves, escrow
 *   2. Investor Distribution     — Per-tranche income + token ledger
 *   3. Borrower Statement        — Loan account + covenant dashboard
 *   4. Regulatory Package        — HMDA call report data (lender-ready)
 *
 * Reports are auto-generated from the live servicing ledger on the 1st of each
 * month and delivered via encrypted SFTP, email, or in-app viewer.
 */

import { useState } from "react";
import {
  DocumentArrowDownIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ClockIcon,
  BuildingLibraryIcon,
  UserGroupIcon,
  HomeIcon,
  ChartBarIcon,
  PrinterIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
type ReportType = "servicer" | "investor" | "borrower" | "regulatory";

interface ReportMeta {
  id: string;
  type: ReportType;
  period: string;
  loan_ref: string;
  borrower: string;
  generated_at: string;
  delivered: boolean;
  pages: number;
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const REPORTS: ReportMeta[] = [
  { id:"RPT-001", type:"servicer",    period:"Apr 2026", loan_ref:"LN-2847", borrower:"Cedar Grove Partners",   generated_at:"2026-04-01T06:00:00Z", delivered:true,  pages:12 },
  { id:"RPT-002", type:"servicer",    period:"Apr 2026", loan_ref:"LN-3201", borrower:"Metro Development LLC",  generated_at:"2026-04-01T06:00:00Z", delivered:true,  pages:11 },
  { id:"RPT-003", type:"investor",    period:"Apr 2026", loan_ref:"LN-2847", borrower:"Cedar Grove Partners",   generated_at:"2026-04-01T06:00:00Z", delivered:true,  pages: 4 },
  { id:"RPT-004", type:"investor",    period:"Apr 2026", loan_ref:"LN-3201", borrower:"Metro Development LLC",  generated_at:"2026-04-01T06:00:00Z", delivered:true,  pages: 4 },
  { id:"RPT-005", type:"borrower",    period:"Apr 2026", loan_ref:"LN-2847", borrower:"Cedar Grove Partners",   generated_at:"2026-04-01T06:03:00Z", delivered:true,  pages: 3 },
  { id:"RPT-006", type:"borrower",    period:"Apr 2026", loan_ref:"LN-3201", borrower:"Metro Development LLC",  generated_at:"2026-04-01T06:03:00Z", delivered:true,  pages: 3 },
  { id:"RPT-007", type:"regulatory",  period:"Q1 2026",  loan_ref:"ALL",     borrower:"Portfolio-Wide",         generated_at:"2026-04-01T06:10:00Z", delivered:false, pages:28 },
  { id:"RPT-008", type:"servicer",    period:"Mar 2026", loan_ref:"LN-2847", borrower:"Cedar Grove Partners",   generated_at:"2026-03-01T06:00:00Z", delivered:true,  pages:12 },
  { id:"RPT-009", type:"servicer",    period:"Mar 2026", loan_ref:"LN-3201", borrower:"Metro Development LLC",  generated_at:"2026-03-01T06:00:00Z", delivered:true,  pages:11 },
];

// ── Report data snapshots ─────────────────────────────────────────────────────
const SERVICER_DATA = {
  "LN-2847": {
    loan_ref: "LN-2847", borrower: "Cedar Grove Partners", property: "412 Meridian Blvd — Multifamily 24U",
    period: "April 2026", original_balance: 4_112_500, beg_balance: 4_112_500, scheduled_payment: 29_987,
    interest_paid: 29_987, principal_paid: 0, end_balance: 4_112_500, payment_status: "Current",
    payment_date: "Apr 1, 2026", payment_type: "Interest Only",
    reserves: [
      { name:"Real Estate Tax Reserve",    beg:48_200,  deposits:4_020, disbursements:0,     end:52_220 },
      { name:"Insurance Reserve",          beg:12_800,  deposits:1_067, disbursements:0,     end:13_867 },
      { name:"Replacement Reserve",        beg:22_000,  deposits:2_000, disbursements:0,     end:24_000 },
      { name:"Debt Service Reserve",       beg:89_961,  deposits:0,     disbursements:0,     end:89_961 },
    ],
    covenants: [
      { name:"DSCR (quarterly)",  required:"≥ 1.25x", actual:"1.138x", status:"breach" },
      { name:"LTV (annual)",      required:"≤ 75%",   actual:"70.0%",  status:"pass"   },
      { name:"Occupancy",         required:"≥ 85%",   actual:"92%",    status:"pass"   },
      { name:"Min. Liquidity",    required:"3 mo DS", actual:"3.0 mo", status:"pass"   },
    ],
    distributions: [
      { tranche:"Senior A", amount:12_426, rate:7.25, balance:2_057_000 },
      { tranche:"Senior B", amount:8_744,  rate:8.50, balance:1_234_500 },
      { tranche:"Mezzanine",amount:5_656,  rate:11.0, balance:617_000   },
    ],
  },
  "LN-3201": {
    loan_ref: "LN-3201", borrower: "Metro Development LLC", property: "55 Commerce Blvd — Industrial 48,000 SF",
    period: "April 2026", original_balance: 5_520_000, beg_balance: 5_520_000, scheduled_payment: 41_270,
    interest_paid: 41_270, principal_paid: 0, end_balance: 5_520_000, payment_status: "Current",
    payment_date: "Apr 1, 2026", payment_type: "Interest Only",
    reserves: [
      { name:"Real Estate Tax Reserve",    beg:72_000,  deposits:6_000, disbursements:0,     end:78_000 },
      { name:"Insurance Reserve",          beg:18_500,  deposits:1_542, disbursements:0,     end:20_042 },
      { name:"Replacement Reserve",        beg:36_000,  deposits:3_000, disbursements:0,     end:39_000 },
      { name:"Debt Service Reserve",       beg:123_810, deposits:0,     disbursements:0,     end:123_810 },
    ],
    covenants: [
      { name:"DSCR (quarterly)",  required:"≥ 1.25x", actual:"1.189x", status:"breach" },
      { name:"LTV (annual)",      required:"≤ 75%",   actual:"77.7%",  status:"watch"  },
      { name:"Occupancy",         required:"≥ 85%",   actual:"96%",    status:"pass"   },
      { name:"Min. Liquidity",    required:"3 mo DS", actual:"3.0 mo", status:"pass"   },
    ],
    distributions: [
      { tranche:"Senior A", amount:17_500, rate:7.00, balance:3_000_000 },
      { tranche:"Senior B", amount:12_542, rate:8.75, balance:1_720_000 },
      { tranche:"Mezzanine",amount:8_333,  rate:12.5, balance:800_000   },
    ],
  },
};

const INVESTOR_DATA = {
  "LN-2847": [
    { investor:"Apex Institutional Fund I",     tranche:"Senior A", allocation:1_200_000, rate:7.25, interest:7_250, ytd:28_999, tokens:1_200_000, next_dist:"May 1, 2026"   },
    { investor:"Meridian Life Insurance Co.",   tranche:"Senior A", allocation:857_000,   rate:7.25, interest:5_176, ytd:20_703, tokens:857_000,   next_dist:"May 1, 2026"   },
    { investor:"Cornerstone Capital Partners", tranche:"Senior B", allocation:750_000,   rate:8.50, interest:5_313, ytd:21_250, tokens:750_000,   next_dist:"May 1, 2026"   },
    { investor:"Harbor Bridge Credit Fund",    tranche:"Senior B", allocation:484_500,   rate:8.50, interest:3_431, ytd:13_723, tokens:484_500,   next_dist:"May 1, 2026"   },
    { investor:"Redwood Mezz Capital LLC",     tranche:"Mezzanine",allocation:617_000,   rate:11.0, interest:5_656, ytd:22_624, tokens:617_000,   next_dist:"May 1, 2026"   },
  ],
  "LN-3201": [
    { investor:"National Bank of Commerce",    tranche:"Senior A", allocation:3_000_000, rate:7.00, interest:17_500, ytd:70_000, tokens:3_000_000, next_dist:"May 1, 2026"  },
    { investor:"Titan Credit Opportunities",   tranche:"Senior B", allocation:1_000_000, rate:8.75, interest:7_292,  ytd:29_167, tokens:1_000_000, next_dist:"May 1, 2026"  },
    { investor:"Summit Yield Fund",            tranche:"Senior B", allocation:720_000,   rate:8.75, interest:5_250,  ytd:21_000, tokens:720_000,   next_dist:"May 1, 2026"  },
    { investor:"Bluestone Mezz Partners",      tranche:"Mezzanine",allocation:500_000,   rate:12.5, interest:5_208,  ytd:20_833, tokens:500_000,   next_dist:"May 1, 2026"  },
  ],
};

const BORROWER_DATA = {
  "LN-2847": {
    property: "412 Meridian Blvd — Multifamily 24 Units", period: "April 2026",
    payment_due: 29_987, payment_received: 29_987, payment_date: "Apr 1, 2026",
    outstanding_balance: 4_112_500, interest_rate: "Blended 8.84%", maturity: "Jun 2028",
    escrow_balance: 180_048,
    escrow_items: [
      { name:"Real Estate Tax Reserve", balance:52_220 },
      { name:"Insurance Reserve",       balance:13_867 },
      { name:"Replacement Reserve",     balance:24_000 },
      { name:"Debt Service Reserve",    balance:89_961 },
    ],
    covenant_summary: "1 DSCR breach — enhanced monitoring active. All other covenants in compliance.",
    next_payment: "May 1, 2026",
    notices: ["DSCR Covenant Waiver — approved through Q2 2026 per Amendment #1 dated Feb 14, 2026"],
  },
  "LN-3201": {
    property: "55 Commerce Blvd — Industrial 48,000 SF", period: "April 2026",
    payment_due: 41_270, payment_received: 41_270, payment_date: "Apr 1, 2026",
    outstanding_balance: 5_520_000, interest_rate: "Blended 8.68%", maturity: "Sep 2028",
    escrow_balance: 260_852,
    escrow_items: [
      { name:"Real Estate Tax Reserve", balance:78_000 },
      { name:"Insurance Reserve",       balance:20_042 },
      { name:"Replacement Reserve",     balance:39_000 },
      { name:"Debt Service Reserve",    balance:123_810 },
    ],
    covenant_summary: "1 DSCR breach, 1 LTV watch — enhanced monitoring active. All other covenants in compliance.",
    next_payment: "May 1, 2026",
    notices: [],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
const fmtM = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(3)}M` : `$${n.toLocaleString()}`;

const REPORT_TYPE_CONFIG: Record<ReportType, { label: string; icon: typeof DocumentTextIcon; color: string; desc: string }> = {
  servicer:   { label:"Servicer Package",        icon: BuildingLibraryIcon, color:"text-slate-700  bg-slate-100",  desc:"CREFC P&I, reserve, covenant, distribution detail" },
  investor:   { label:"Investor Statement",      icon: UserGroupIcon,       color:"text-violet-700 bg-violet-100", desc:"Per-tranche interest, YTD, token ledger" },
  borrower:   { label:"Borrower Statement",      icon: HomeIcon,            color:"text-emerald-700 bg-emerald-100",desc:"Loan account, escrow, covenant summary" },
  regulatory: { label:"Regulatory Package",      icon: ChartBarIcon,        color:"text-amber-700 bg-amber-100",  desc:"HMDA, call report data, portfolio analytics" },
};

const COVENANT_COLOR: Record<string, string> = {
  pass:   "text-emerald-700 bg-emerald-100",
  breach: "text-red-700 bg-red-100",
  watch:  "text-amber-700 bg-amber-100",
};

export default function ReportingEnginePage() {
  const [activeType, setActiveType] = useState<ReportType>("servicer");
  const [selectedLoan, setSelectedLoan] = useState<"LN-2847" | "LN-3201">("LN-2847");
  const [selectedPeriod, setSelectedPeriod] = useState("Apr 2026");

  const filteredReports = REPORTS.filter(r =>
    r.type === activeType &&
    (r.loan_ref === selectedLoan || r.loan_ref === "ALL") &&
    r.period === selectedPeriod
  );

  const TypeIcon = REPORT_TYPE_CONFIG[activeType].icon;

  return (
    <div className="space-y-5">
      {/* Report type selector */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.entries(REPORT_TYPE_CONFIG) as [ReportType, typeof REPORT_TYPE_CONFIG[ReportType]][]).map(([type, cfg]) => {
          const Icon = cfg.icon;
          const active = activeType === type;
          return (
            <button key={type} onClick={() => setActiveType(type)}
              className={`rounded-xl border p-3 text-left transition ${active ? "border-slate-900 bg-slate-900" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <div className={`mb-2 inline-flex rounded-lg p-1.5 ${active ? "bg-white/10" : cfg.color}`}>
                <Icon className={`h-4 w-4 ${active ? "text-white" : ""}`} />
              </div>
              <p className={`text-xs font-bold ${active ? "text-white" : "text-slate-900"}`}>{cfg.label}</p>
              <p className={`text-[10px] mt-0.5 leading-snug ${active ? "text-slate-400" : "text-slate-500"}`}>{cfg.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Loan</label>
          <select value={selectedLoan} onChange={e => setSelectedLoan(e.target.value as "LN-2847"|"LN-3201")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none">
            <option value="LN-2847">LN-2847 — Cedar Grove Partners</option>
            <option value="LN-3201">LN-3201 — Metro Development LLC</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Period</label>
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none">
            {["Apr 2026","Mar 2026","Feb 2026","Jan 2026","Q1 2026"].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <PrinterIcon className="h-4 w-4" />
            Print
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <ShareIcon className="h-4 w-4" />
            Share
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm">
            <DocumentArrowDownIcon className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Report header strip */}
      {filteredReports.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className={`rounded-lg p-2 ${REPORT_TYPE_CONFIG[activeType].color}`}>
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">{REPORT_TYPE_CONFIG[activeType].label} — {selectedPeriod}</p>
            <p className="text-xs text-slate-500">{filteredReports[0].id} · {filteredReports[0].pages} pages · Auto-generated {new Date(filteredReports[0].generated_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</p>
          </div>
          <div className="flex items-center gap-2">
            {filteredReports[0].delivered ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircleIcon className="h-3.5 w-3.5" />Delivered
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <ClockIcon className="h-3.5 w-3.5" />Pending Delivery
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── SERVICER PACKAGE ─────────────────────────────────────────────────── */}
      {activeType === "servicer" && (
        <ServicerReport loan_ref={selectedLoan} period={selectedPeriod} />
      )}

      {/* ── INVESTOR STATEMENT ───────────────────────────────────────────────── */}
      {activeType === "investor" && (
        <InvestorStatement loan_ref={selectedLoan} period={selectedPeriod} />
      )}

      {/* ── BORROWER STATEMENT ───────────────────────────────────────────────── */}
      {activeType === "borrower" && (
        <BorrowerStatement loan_ref={selectedLoan} period={selectedPeriod} />
      )}

      {/* ── REGULATORY PACKAGE ───────────────────────────────────────────────── */}
      {activeType === "regulatory" && (
        <RegulatoryPackage />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ServicerReport({ loan_ref, period }: { loan_ref: "LN-2847"|"LN-3201"; period: string }) {
  const d = SERVICER_DATA[loan_ref];
  if (!d) return null;
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

  return (
    <div className="space-y-4">
      {/* Watermark header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">KONTRA LOAN SERVICING — CONFIDENTIAL</p>
            <p className="text-lg font-black text-slate-900 mt-1">Monthly Servicer Report — {period}</p>
            <p className="text-sm text-slate-600">{d.property}</p>
            <p className="text-xs text-slate-400 mt-1">{d.loan_ref} · Borrower: {d.borrower}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Payment Date</p>
            <p className="text-sm font-bold text-slate-900">{d.payment_date}</p>
            <p className="text-[10px] text-slate-400 mt-1">Payment Type</p>
            <p className="text-sm font-bold text-slate-900">{d.payment_type}</p>
          </div>
        </div>

        {/* P&I Summary */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Principal & Interest Summary</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 mb-5">
          {[
            { label:"Beginning Balance",   value: fmt(d.beg_balance) },
            { label:"Scheduled Payment",   value: fmt(d.scheduled_payment) },
            { label:"Interest Paid",       value: fmt(d.interest_paid) },
            { label:"Principal Paid",      value: fmt(d.principal_paid) },
            { label:"Ending Balance",      value: fmt(d.end_balance) },
          ].map(m => (
            <div key={m.label} className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="text-[10px] text-slate-400">{m.label}</p>
              <p className="text-sm font-black text-slate-900 tabular-nums">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Payment status */}
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold mb-5 ${d.payment_status === "Current" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          <CheckCircleIcon className="h-4 w-4" />
          Payment Status: {d.payment_status} — Received {d.payment_date}
        </div>

        {/* Reserve accounts */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Reserve & Escrow Accounts</p>
        <table className="w-full text-sm mb-5">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50">
              <th className="px-4 py-2 text-left rounded-tl-lg">Account</th>
              <th className="px-4 py-2 text-right">Beginning</th>
              <th className="px-4 py-2 text-right">Deposits</th>
              <th className="px-4 py-2 text-right">Disbursements</th>
              <th className="px-4 py-2 text-right rounded-tr-lg">Ending</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.reserves.map(r => (
              <tr key={r.name}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{r.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmt(r.beg)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">+{fmt(r.deposits)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-red-700">{r.disbursements > 0 ? `-${fmt(r.disbursements)}` : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">{fmt(r.end)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-bold">
              <td className="px-4 py-2.5 text-slate-900">Total Reserves</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(d.reserves.reduce((s,r)=>s+r.beg,0))}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">+{fmt(d.reserves.reduce((s,r)=>s+r.deposits,0))}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">—</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{fmt(d.reserves.reduce((s,r)=>s+r.end,0))}</td>
            </tr>
          </tbody>
        </table>

        {/* Covenant status */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Covenant Status</p>
        <div className="grid grid-cols-2 gap-2 mb-5 sm:grid-cols-4">
          {d.covenants.map(c => (
            <div key={c.name} className="rounded-lg border border-slate-100 p-3">
              <p className="text-[10px] text-slate-400">{c.name}</p>
              <p className="text-xs font-bold text-slate-900">{c.actual}</p>
              <p className="text-[10px] text-slate-400">Required: {c.required}</p>
              <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${COVENANT_COLOR[c.status]}`}>{c.status}</span>
            </div>
          ))}
        </div>

        {/* Distribution detail */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Investor Distribution Detail</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50">
              <th className="px-4 py-2 text-left">Tranche</th>
              <th className="px-4 py-2 text-right">Balance</th>
              <th className="px-4 py-2 text-right">Rate</th>
              <th className="px-4 py-2 text-right">Distribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.distributions.map((dist, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{dist.tranche}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmt(dist.balance)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{dist.rate.toFixed(2)}%</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">{fmt(dist.amount)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-bold">
              <td className="px-4 py-2.5" colSpan={3}>Total Distributed</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmt(d.distributions.reduce((s,d)=>s+d.amount,0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvestorStatement({ loan_ref, period }: { loan_ref: "LN-2847"|"LN-3201"; period: string }) {
  const investors = INVESTOR_DATA[loan_ref];
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
  const totalInterest = investors.reduce((s,i)=>s+i.interest,0);
  const totalYTD = investors.reduce((s,i)=>s+i.ytd,0);
  const totalAlloc = investors.reduce((s,i)=>s+i.allocation,0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">KONTRA LOAN SERVICING — CONFIDENTIAL</p>
        <p className="text-lg font-black text-slate-900 mt-1">Investor Distribution Statement — {period}</p>
        <p className="text-xs text-slate-500">{loan_ref} · Distribution Date: May 1, 2026 · Settlement: USDC (ERC-20)</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        {[
          { label:"Total Committed",      value: fmt(totalAlloc) },
          { label:"This Period Interest", value: fmt(totalInterest) },
          { label:"YTD Distributed",      value: fmt(totalYTD) },
        ].map(m => (
          <div key={m.label} className="px-5 py-4">
            <p className="text-[10px] text-slate-400">{m.label}</p>
            <p className="text-base font-black text-slate-900 tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Per-investor table */}
      <table className="w-full text-xs">
        <thead className="bg-slate-50">
          <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-5 py-2.5 text-left">Investor</th>
            <th className="px-4 py-2.5 text-left">Tranche</th>
            <th className="px-4 py-2.5 text-right">Allocation</th>
            <th className="px-4 py-2.5 text-right">Rate</th>
            <th className="px-4 py-2.5 text-right">This Month</th>
            <th className="px-4 py-2.5 text-right">YTD</th>
            <th className="px-4 py-2.5 text-right">Token Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {investors.map((inv, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-semibold text-slate-900">{inv.investor}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  inv.tranche.includes("A") ? "bg-slate-100 text-slate-700" :
                  inv.tranche.includes("B") ? "bg-blue-100 text-blue-700" :
                  "bg-violet-100 text-violet-700"
                }`}>{inv.tranche}</span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmt(inv.allocation)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{inv.rate.toFixed(2)}%</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{fmt(inv.interest)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmt(inv.ytd)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-violet-700 font-semibold">{inv.tokens.toLocaleString()} tkn</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 font-bold text-slate-900">
          <tr>
            <td className="px-5 py-3" colSpan={2}>Totals</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmt(totalAlloc)}</td>
            <td className="px-4 py-3 text-right">—</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmt(totalInterest)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmt(totalYTD)}</td>
            <td className="px-4 py-3 text-right tabular-nums text-violet-700">{investors.reduce((s,i)=>s+i.tokens,0).toLocaleString()} tkn</td>
          </tr>
        </tfoot>
      </table>

      <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
        <p className="text-[10px] text-slate-400">Distribution will be processed via USDC stablecoin transfer to registered wallet addresses on record. Kontra token ledger will be updated upon confirmation. This statement constitutes an official notice under the applicable participation agreement.</p>
      </div>
    </div>
  );
}

function BorrowerStatement({ loan_ref, period }: { loan_ref: "LN-2847"|"LN-3201"; period: string }) {
  const d = BORROWER_DATA[loan_ref];
  if (!d) return null;
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="border-b border-slate-100 pb-4 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">KONTRA LOAN SERVICING — BORROWER STATEMENT</p>
          <p className="text-lg font-black text-slate-900 mt-1">Loan Account Statement — {period}</p>
          <p className="text-sm text-slate-600">{d.property}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-5">
          {/* Payment summary */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">This Period</p>
            <div className="space-y-2">
              {[
                { label:"Payment Due",          value: fmt(d.payment_due) },
                { label:"Payment Received",     value: fmt(d.payment_received) },
                { label:"Payment Date",         value: d.payment_date },
                { label:"Outstanding Balance",  value: fmt(d.outstanding_balance) },
                { label:"Interest Rate",        value: d.interest_rate },
                { label:"Loan Maturity",        value: d.maturity },
                { label:"Next Payment Due",     value: d.next_payment },
              ].map(m => (
                <div key={m.label} className="flex justify-between border-b border-slate-50 pb-1.5 text-sm">
                  <span className="text-slate-500">{m.label}</span>
                  <span className="font-bold text-slate-900">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Escrow summary */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3">Escrow & Reserve Balances</p>
            <div className="space-y-2 mb-3">
              {d.escrow_items.map(e => (
                <div key={e.name} className="flex justify-between border-b border-slate-50 pb-1.5 text-sm">
                  <span className="text-slate-600 text-xs">{e.name}</span>
                  <span className="font-bold text-slate-900 tabular-nums">{fmt(e.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 text-sm font-bold">
                <span className="text-slate-900">Total Escrow Held</span>
                <span className="text-slate-900 tabular-nums">{fmt(d.escrow_balance)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment confirmation */}
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm font-bold text-emerald-800 mb-4">
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          Payment of {fmt(d.payment_received)} received on {d.payment_date} — Thank you.
        </div>

        {/* Covenant summary */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Covenant Summary</p>
          <p className="text-xs text-slate-700">{d.covenant_summary}</p>
        </div>

        {/* Notices */}
        {d.notices.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Notices & Amendments</p>
            {d.notices.map((n, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <EnvelopeIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                {n}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RegulatoryPackage() {
  const portfolioLoans = [
    { ref:"LN-2847", type:"Multifamily", city:"Miami",  state:"FL", amount:4_112_500, rate:8.84, ltv:70.0, race:"N/A (Commercial)", purpose:"Refinance", originated:"Jun 2025" },
    { ref:"LN-3201", type:"Industrial",  city:"Denver", state:"CO", amount:5_520_000, rate:8.68, ltv:77.7, race:"N/A (Commercial)", purpose:"Refinance", originated:"Sep 2025" },
    { ref:"LN-4108", type:"Retail",      city:"Chicago",state:"IL", amount:3_200_000, rate:9.50, ltv:72.0, race:"N/A (Commercial)", purpose:"Acquisition",originated:"Nov 2025" },
    { ref:"LN-5593", type:"Office",      city:"Dallas", state:"TX", amount:6_800_000, rate:8.25, ltv:58.0, race:"N/A (Commercial)", purpose:"Refinance", originated:"Dec 2025" },
  ];
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
  const totalVol = portfolioLoans.reduce((s,l)=>s+l.amount,0);
  const avgLTV = portfolioLoans.reduce((s,l)=>s+l.ltv,0)/portfolioLoans.length;
  const avgRate = portfolioLoans.reduce((s,l)=>s+l.rate,0)/portfolioLoans.length;

  return (
    <div className="space-y-4">
      {/* Portfolio summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Total Portfolio Volume", value:`$${(totalVol/1_000_000).toFixed(2)}M` },
          { label:"Loan Count",             value:`${portfolioLoans.length}` },
          { label:"Avg LTV",                value:`${avgLTV.toFixed(1)}%` },
          { label:"Avg Rate",               value:`${avgRate.toFixed(2)}%` },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className="text-xl font-black text-slate-900">{m.value}</p>
          </div>
        ))}
      </div>

      {/* HMDA-style loan register */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Q1 2026 Loan Activity Register</p>
          <p className="text-xs text-slate-400 mt-0.5">CREFC / HMDA-compatible format for regulatory submission</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 text-left">Loan Ref</th>
                <th className="px-4 py-2.5 text-left">Property Type</th>
                <th className="px-4 py-2.5 text-left">Location</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Rate</th>
                <th className="px-4 py-2.5 text-right">LTV</th>
                <th className="px-4 py-2.5 text-left">Purpose</th>
                <th className="px-4 py-2.5 text-left">Originated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {portfolioLoans.map(l => (
                <tr key={l.ref} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{l.ref}</td>
                  <td className="px-4 py-2.5 text-slate-700">{l.type}</td>
                  <td className="px-4 py-2.5 text-slate-700">{l.city}, {l.state}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">{fmt(l.amount)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{l.rate.toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{l.ltv.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-slate-700">{l.purpose}</td>
                  <td className="px-4 py-2.5 text-slate-500">{l.originated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
          <p className="text-[10px] text-slate-400">Report generated by Kontra Reporting Engine · Q1 2026 · For regulatory submission. Lender should validate against internal records before filing.</p>
        </div>
      </div>
    </div>
  );
}
