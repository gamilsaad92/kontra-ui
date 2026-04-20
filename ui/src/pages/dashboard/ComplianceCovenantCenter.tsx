/**
 * Compliance & Covenant Center — Stage 2
 * Route: /compliance-center → /command-center (redirected)
 *        Also linked from ServicingLayout
 *
 * Automated covenant monitoring across the entire loan portfolio.
 * Each loan covenant is tested on its defined frequency; results are
 * displayed with traffic-light status, cure-period countdowns, and
 * an audit log of all test events.
 *
 * Covenants monitored:
 *   DSCR floor · LTV cap · Minimum Occupancy · Debt Service Reserve · Insurance
 */

import { useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  BanknotesIcon,
  ChartBarIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  ArrowPathIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────────────────────
type CovenantStatus = "passing" | "watch" | "breach" | "waived" | "untested";

interface CovenantTest {
  name: string;
  floor?: number;
  cap?: number;
  actual: number | null;
  unit: "x" | "%" | "mo";
  status: CovenantStatus;
  last_tested: string;
  next_test: string;
  frequency: "monthly" | "quarterly" | "annual";
  cure_days_remaining?: number;
  cure_deadline?: string;
  waiver_note?: string;
}

interface LoanCovenantRecord {
  loan_ref: string;
  borrower: string;
  property: string;
  property_type: string;
  balance: number;
  overall_status: CovenantStatus;
  covenants: CovenantTest[];
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const PORTFOLIO: LoanCovenantRecord[] = [
  {
    loan_ref: "LN-2847", borrower: "Cedar Grove Partners", property: "412 Meridian Blvd, Austin TX",
    property_type: "Multifamily", balance: 4_112_500, overall_status: "passing",
    covenants: [
      { name:"Minimum DSCR",         floor:1.25, actual:1.42, unit:"x", status:"passing",  last_tested:"2026-04-01", next_test:"2026-05-01", frequency:"monthly" },
      { name:"Maximum LTV",           cap:75,    actual:68.2, unit:"%", status:"passing",  last_tested:"2026-04-01", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Minimum Occupancy",     floor:85,  actual:91.7, unit:"%", status:"passing",  last_tested:"2026-04-01", next_test:"2026-05-01", frequency:"monthly" },
      { name:"Debt Service Reserve",  floor:3,   actual:3.0,  unit:"mo", status:"passing", last_tested:"2026-04-01", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Insurance Coverage",    actual:null, unit:"%", status:"watch", last_tested:"2026-02-01", next_test:"2026-05-31", frequency:"annual", waiver_note:"Policy renewal pending — expires May 31" },
    ],
  },
  {
    loan_ref: "LN-3012", borrower: "Harbor View Holdings", property: "789 Harbor View Dr, Miami FL",
    property_type: "Retail", balance: 7_640_000, overall_status: "watch",
    covenants: [
      { name:"Minimum DSCR",         floor:1.25, actual:1.28, unit:"x", status:"watch",   last_tested:"2026-04-01", next_test:"2026-05-01", frequency:"monthly", waiver_note:"1.28x — within 3pts of floor. Monitoring enhanced." },
      { name:"Maximum LTV",           cap:72,    actual:69.8, unit:"%", status:"passing",  last_tested:"2026-04-01", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Minimum Occupancy",     floor:88,  actual:89.2, unit:"%", status:"watch",   last_tested:"2026-04-01", next_test:"2026-05-01", frequency:"monthly" },
      { name:"Debt Service Reserve",  floor:4,   actual:4.0,  unit:"mo", status:"passing", last_tested:"2026-01-01", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Insurance Coverage",    actual:null, unit:"%", status:"passing", last_tested:"2025-12-01", next_test:"2025-12-01", frequency:"annual" },
    ],
  },
  {
    loan_ref: "LN-3145", borrower: "Redwood Capital Group", property: "2200 Oak Street, Denver CO",
    property_type: "Office", balance: 12_350_000, overall_status: "breach",
    covenants: [
      { name:"Minimum DSCR",         floor:1.20, actual:0.98, unit:"x", status:"breach",  last_tested:"2026-04-01", next_test:"2026-05-01", frequency:"monthly", cure_days_remaining:28, cure_deadline:"2026-05-01" },
      { name:"Maximum LTV",           cap:70,    actual:76.2, unit:"%", status:"breach",  last_tested:"2026-04-01", next_test:"2026-07-01", frequency:"quarterly", cure_days_remaining:60, cure_deadline:"2026-06-19" },
      { name:"Minimum Occupancy",     floor:80,  actual:71.4, unit:"%", status:"breach",  last_tested:"2026-04-01", next_test:"2026-05-01", frequency:"monthly", cure_days_remaining:28, cure_deadline:"2026-05-01" },
      { name:"Debt Service Reserve",  floor:3,   actual:3.0,  unit:"mo", status:"passing", last_tested:"2026-01-01", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Insurance Coverage",    actual:null, unit:"%", status:"passing", last_tested:"2026-01-01", next_test:"2027-01-01", frequency:"annual" },
    ],
  },
  {
    loan_ref: "LN-3201", borrower: "Metro Development LLC", property: "55 Commerce Blvd, Phoenix AZ",
    property_type: "Industrial", balance: 5_520_000, overall_status: "passing",
    covenants: [
      { name:"Minimum DSCR",         floor:1.25, actual:1.61, unit:"x", status:"passing",  last_tested:"2026-04-01", next_test:"2026-05-01", frequency:"monthly" },
      { name:"Maximum LTV",           cap:70,    actual:58.0, unit:"%", status:"passing",  last_tested:"2026-04-01", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Minimum Occupancy",     floor:90,  actual:95.0, unit:"%", status:"passing",  last_tested:"2026-04-01", next_test:"2026-05-01", frequency:"monthly" },
      { name:"Debt Service Reserve",  floor:3,   actual:3.0,  unit:"mo", status:"passing", last_tested:"2026-01-01", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Insurance Coverage",    actual:null, unit:"%", status:"passing", last_tested:"2025-06-01", next_test:"2026-06-01", frequency:"annual" },
    ],
  },
  {
    loan_ref: "LN-3310", borrower: "Sunrise Realty Partners", property: "901 Sunrise Ave, Nashville TN",
    property_type: "Multifamily", balance: 3_180_000, overall_status: "untested",
    covenants: [
      { name:"Minimum DSCR",         floor:1.25, actual:null, unit:"x", status:"untested", last_tested:"—", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Maximum LTV",           cap:75,    actual:null, unit:"%", status:"untested", last_tested:"—", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Minimum Occupancy",     floor:85,  actual:null, unit:"%", status:"untested", last_tested:"—", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Debt Service Reserve",  floor:3,   actual:null, unit:"mo", status:"untested", last_tested:"—", next_test:"2026-07-01", frequency:"quarterly" },
      { name:"Insurance Coverage",    actual:null, unit:"%", status:"untested", last_tested:"—", next_test:"2026-07-01", frequency:"annual" },
    ],
  },
];

const AUDIT_LOG = [
  { ts:"2026-04-01 07:00", loan:"LN-2847", event:"DSCR tested — 1.42x — PASS",        severity:"pass" },
  { ts:"2026-04-01 07:01", loan:"LN-3012", event:"DSCR tested — 1.28x — WATCH (near floor)",    severity:"warn" },
  { ts:"2026-04-01 07:02", loan:"LN-3145", event:"DSCR tested — 0.98x — BREACH. 30-day cure period starts.", severity:"breach" },
  { ts:"2026-04-01 07:03", loan:"LN-3145", event:"LTV tested — 76.2% — BREACH. Exceeds 70% cap.", severity:"breach" },
  { ts:"2026-04-01 07:04", loan:"LN-3145", event:"Occupancy tested — 71.4% — BREACH. Below 80% floor.", severity:"breach" },
  { ts:"2026-04-01 07:05", loan:"LN-2847", event:"Occupancy tested — 91.7% — PASS",   severity:"pass" },
  { ts:"2026-04-01 07:06", loan:"LN-3012", event:"Occupancy tested — 89.2% — WATCH",  severity:"warn" },
  { ts:"2026-04-01 07:07", loan:"LN-3201", event:"DSCR tested — 1.61x — PASS",        severity:"pass" },
  { ts:"2026-03-01 07:00", loan:"LN-2847", event:"DSCR tested — 1.39x — PASS",        severity:"pass" },
  { ts:"2026-03-01 07:01", loan:"LN-3012", event:"DSCR tested — 1.31x — PASS",        severity:"pass" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt_usd = (n: number) =>
  n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${(n/1e3).toFixed(0)}K`;

const STATUS_CFG: Record<CovenantStatus, { label:string; ring:string; bg:string; text:string; icon: typeof CheckCircleIcon }> = {
  passing:  { label:"Passing",  ring:"ring-emerald-200", bg:"bg-emerald-50",  text:"text-emerald-700", icon:CheckCircleIcon },
  watch:    { label:"Watch",    ring:"ring-amber-200",   bg:"bg-amber-50",    text:"text-amber-700",   icon:ExclamationTriangleIcon },
  breach:   { label:"Breach",   ring:"ring-red-300",     bg:"bg-red-50",      text:"text-red-700",     icon:XCircleIcon },
  waived:   { label:"Waived",   ring:"ring-violet-200",  bg:"bg-violet-50",   text:"text-violet-700",  icon:ShieldCheckIcon },
  untested: { label:"Untested", ring:"ring-slate-200",   bg:"bg-slate-50",    text:"text-slate-500",   icon:ClockIcon },
};

const OVERALL_BG: Record<CovenantStatus, string> = {
  passing:  "border-emerald-200 bg-emerald-50/40",
  watch:    "border-amber-200 bg-amber-50/40",
  breach:   "border-red-300 bg-red-50/40",
  waived:   "border-violet-200",
  untested: "border-slate-200",
};

function StatusBadge({ status, size = "sm" }: { status: CovenantStatus; size?: "xs" | "sm" }) {
  const cfg = STATUS_CFG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold ring-1 ${cfg.ring} ${cfg.bg} ${cfg.text} ${size === "xs" ? "text-xs" : "text-xs"}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ActualValue({ c }: { c: CovenantTest }) {
  if (c.actual === null) return <span className="text-slate-400">—</span>;
  const val = c.unit === "x" ? `${c.actual.toFixed(2)}x`
            : c.unit === "%" ? `${c.actual.toFixed(1)}%`
            : `${c.actual} mo`;
  const breach = c.status === "breach" || c.status === "watch";
  return <span className={`font-bold tabular-nums ${breach ? STATUS_CFG[c.status].text : "text-slate-900"}`}>{val}</span>;
}

function ThresholdLabel({ c }: { c: CovenantTest }) {
  if (c.floor != null) return <span className="text-xs text-slate-400">floor: {c.unit === "x" ? `${c.floor}x` : c.unit === "%" ? `${c.floor}%` : `${c.floor} mo`}</span>;
  if (c.cap   != null) return <span className="text-xs text-slate-400">cap: {c.unit === "%" ? `${c.cap}%` : `${c.cap}x`}</span>;
  return null;
}

function CurePill({ days }: { days: number }) {
  const color = days <= 7 ? "bg-red-100 text-red-700" : days <= 14 ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>{days}d cure</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ComplianceCovenantCenter() {
  const [statusFilter, setStatusFilter] = useState<"all" | CovenantStatus>("all");
  const [selectedLoan, setSelectedLoan] = useState<LoanCovenantRecord | null>(null);
  const [view, setView] = useState<"portfolio" | "log">("portfolio");

  const filtered = PORTFOLIO.filter(l => statusFilter === "all" || l.overall_status === statusFilter);

  const totalBreaches = PORTFOLIO.flatMap(l => l.covenants).filter(c => c.status === "breach").length;
  const watchCount    = PORTFOLIO.flatMap(l => l.covenants).filter(c => c.status === "watch").length;
  const passingLoans  = PORTFOLIO.filter(l => l.overall_status === "passing").length;
  const breachLoans   = PORTFOLIO.filter(l => l.overall_status === "breach").length;

  const detail = selectedLoan ?? PORTFOLIO[0];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label:"Loans Monitored",     value: PORTFOLIO.length,   color:"text-slate-900" },
          { label:"All Covenants Passing",value:`${passingLoans}/${PORTFOLIO.length}`,  color:"text-emerald-600" },
          { label:"Watch",               value: watchCount,         color:"text-amber-600" },
          { label:"Active Breaches",     value: totalBreaches,      color:"text-red-700" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Active breach alerts */}
      {breachLoans > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-bold text-red-900">
                {breachLoans} loan{breachLoans > 1 ? "s" : ""} in active covenant breach — cure periods in progress
              </p>
              {PORTFOLIO.filter(l => l.overall_status === "breach").map(l => (
                <p key={l.loan_ref} className="mt-1 text-xs text-red-700">
                  <strong>{l.loan_ref}</strong> — {l.covenants.filter(c => c.status === "breach").map(c => c.name).join(", ")}
                  {l.covenants.find(c => c.cure_days_remaining) && ` · ${l.covenants.find(c => c.cure_days_remaining)!.cure_days_remaining}d remaining`}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View toggle + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
          {(["portfolio", "log"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition capitalize ${view === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >{v === "portfolio" ? "Portfolio View" : "Audit Log"}</button>
          ))}
        </div>
        {view === "portfolio" && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <FunnelIcon className="h-3.5 w-3.5" />
              Filter:
            </div>
            {(["all","passing","watch","breach","untested"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${statusFilter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {s === "all" ? `All (${PORTFOLIO.length})` : `${STATUS_CFG[s].label} (${PORTFOLIO.filter(l => l.overall_status === s).length})`}
              </button>
            ))}
          </>
        )}
        <button className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
          <DocumentArrowDownIcon className="h-4 w-4" />
          Export
        </button>
      </div>

      {view === "log" ? (
        /* Audit log */
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Covenant test history (most recent first)</p>
          {AUDIT_LOG.map((entry, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
              {entry.severity === "pass"   && <CheckCircleIcon      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
              {entry.severity === "warn"   && <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
              {entry.severity === "breach" && <XCircleIcon          className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-500">{entry.loan} </span>
                <span className="text-sm text-slate-700">{entry.event}</span>
              </div>
              <p className="shrink-0 text-xs text-slate-400">{entry.ts}</p>
            </div>
          ))}
        </div>
      ) : (
        /* Portfolio view: list + detail */
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Loan list */}
          <aside className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Loans</p>
            {filtered.map(loan => {
              const cfg = STATUS_CFG[loan.overall_status];
              const Icon = cfg.icon;
              const isActive = detail.loan_ref === loan.loan_ref;
              return (
                <button key={loan.loan_ref} onClick={() => setSelectedLoan(loan)}
                  className={`w-full rounded-xl border p-3 text-left transition ${isActive ? "border-slate-900 bg-slate-900" : `${OVERALL_BG[loan.overall_status]} border hover:border-slate-300`}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold ${isActive ? "text-slate-300" : "text-slate-500"}`}>{loan.loan_ref}</span>
                    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${isActive ? "border-slate-700 bg-slate-800 text-slate-200" : `${cfg.ring} ${cfg.bg} ${cfg.text}`}`}>
                      <Icon className="h-3 w-3" />{cfg.label}
                    </span>
                  </div>
                  <p className={`mt-1 text-sm font-semibold ${isActive ? "text-white" : "text-slate-900"}`}>{loan.borrower}</p>
                  <p className={`mt-0.5 text-xs ${isActive ? "text-slate-400" : "text-slate-500"}`}>{loan.property_type} · {fmt_usd(loan.balance)}</p>
                  {loan.overall_status === "breach" && !isActive && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {loan.covenants.filter(c => c.cure_days_remaining).map(c => (
                        <CurePill key={c.name} days={c.cure_days_remaining!} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Covenant detail */}
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{detail.loan_ref} — {detail.borrower}</h2>
                    <StatusBadge status={detail.overall_status} />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{detail.property}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{fmt_usd(detail.balance)} UPB</p>
              </div>
            </div>

            {/* Covenant grid */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {detail.covenants.map(c => {
                const cfg = STATUS_CFG[c.status];
                const Icon = cfg.icon;
                return (
                  <div key={c.name} className={`rounded-xl border p-4 shadow-sm ${OVERALL_BG[c.status] || "bg-white border-slate-200"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.name}</p>
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.text}`} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <ActualValue c={c} />
                      <ThresholdLabel c={c} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={c.status} size="xs" />
                      {c.cure_days_remaining !== undefined && <CurePill days={c.cure_days_remaining} />}
                    </div>
                    {c.waiver_note && (
                      <p className="mt-2 text-xs italic text-slate-500">{c.waiver_note}</p>
                    )}
                    <div className="mt-3 border-t border-slate-200/60 pt-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Last tested</p>
                        <p className="text-xs text-slate-600">{c.last_tested}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Next test</p>
                        <p className="text-xs text-slate-600">{c.next_test}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Breach detail */}
            {detail.overall_status === "breach" && (
              <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                  <XCircleIcon className="h-4 w-4" />
                  Active Breach — Cure Period Status
                </h3>
                <div className="mt-3 space-y-3">
                  {detail.covenants.filter(c => c.status === "breach").map(c => (
                    <div key={c.name} className="flex items-start justify-between rounded-lg bg-red-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-red-900">{c.name}</p>
                        <p className="text-xs text-red-600">Cure deadline: {c.cure_deadline}</p>
                      </div>
                      {c.cure_days_remaining !== undefined && (
                        <div className="text-right">
                          <p className="text-2xl font-black text-red-700">{c.cure_days_remaining}</p>
                          <p className="text-xs text-red-500">days left</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition">
                    Issue Cure Notice
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                    Grant Waiver
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                    Request Borrower Response
                  </button>
                </div>
              </div>
            )}

            {/* Watch summary */}
            {detail.overall_status === "watch" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Enhanced Monitoring — Approaching Threshold
                </h3>
                <ul className="mt-3 space-y-1">
                  {detail.covenants.filter(c => c.status === "watch").map(c => (
                    <li key={c.name} className="text-xs text-amber-800">
                      <strong>{c.name}:</strong> {c.actual !== null ? (c.unit === "x" ? `${c.actual.toFixed(2)}x` : `${c.actual.toFixed(1)}%`) : "—"}
                      {c.floor && ` vs. ${c.floor}${c.unit} floor`}
                      {c.cap && ` vs. ${c.cap}${c.unit} cap`}
                      {c.waiver_note && ` — ${c.waiver_note}`}
                    </li>
                  ))}
                </ul>
                <button className="mt-3 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 transition">
                  Schedule Borrower Call
                </button>
              </div>
            )}

            {/* Test schedule */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                <ClockIcon className="h-4 w-4" />
                Upcoming Test Schedule
              </h3>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="pb-2 text-left">Covenant</th>
                    <th className="pb-2 text-center">Frequency</th>
                    <th className="pb-2 text-right">Next Test</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.covenants.map(c => (
                    <tr key={c.name}>
                      <td className="py-2 font-medium text-slate-900">{c.name}</td>
                      <td className="py-2 text-center capitalize text-slate-500">{c.frequency}</td>
                      <td className="py-2 text-right text-slate-700">{c.next_test}</td>
                      <td className="py-2 text-right"><StatusBadge status={c.status} size="xs" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
