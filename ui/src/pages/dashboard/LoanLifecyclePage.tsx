/**
 * Loan Lifecycle — End-to-end loan stage tracker
 * Route: /loan-lifecycle (Lender portal)
 *
 * Visualizes every loan across its full lifecycle:
 * Origination → Underwriting → Commitment → Closing → Servicing → Maturity
 * Includes a Kanban-style pipeline view + activity feed.
 */

import { useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

const STAGES = [
  { id: "origination",  label: "Origination",  color: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "underwriting", label: "Underwriting", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "commitment",   label: "Commitment",   color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "closing",      label: "Closing",      color: "bg-violet-50 text-violet-700 border-violet-200" },
  { id: "active",       label: "Active",       color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "matured",      label: "Matured",      color: "bg-slate-100 text-slate-500 border-slate-200" },
];

const LOANS = [
  { id: "LN-2847", borrower: "Cedar Grove Partners",    amount: 4200000,  stage: "active",       property: "412 Meridian Blvd, Austin TX",       rate: 8.75, maturity: "2026-09-01" },
  { id: "LN-3012", borrower: "Harbor View Holdings",    amount: 7800000,  stage: "active",       property: "789 Harbor View Dr, Miami FL",       rate: 7.50, maturity: "2027-02-01" },
  { id: "LN-3145", borrower: "Redwood Capital Group",   amount: 12500000, stage: "closing",      property: "2200 Oak Street, Denver CO",          rate: 7.25, maturity: "2028-01-01" },
  { id: "LN-3201", borrower: "Metro Development LLC",   amount: 5600000,  stage: "commitment",   property: "55 Commerce Blvd, Phoenix AZ",        rate: 7.85, maturity: "2027-06-01" },
  { id: "LN-3310", borrower: "Sunrise Realty Partners", amount: 3200000,  stage: "underwriting", property: "901 Sunrise Ave, Nashville TN",       rate: null, maturity: null },
  { id: "LN-3402", borrower: "Bayfront Investments",    amount: 9100000,  stage: "origination",  property: "120 Bayfront Plaza, Tampa FL",        rate: null, maturity: null },
  { id: "LN-2691", borrower: "Stonegate Properties",    amount: 6400000,  stage: "matured",      property: "333 Stonegate Rd, Charlotte NC",      rate: 6.90, maturity: "2024-12-01" },
];

const ACTIVITY = [
  { id: "a1", type: "stage",     loan: "LN-3145", text: "Advanced to Closing stage",                ts: "2 hours ago" },
  { id: "a2", type: "document",  loan: "LN-3201", text: "Commitment letter executed by borrower",   ts: "5 hours ago" },
  { id: "a3", type: "payment",   loan: "LN-2847", text: "April debt service payment received",      ts: "1 day ago" },
  { id: "a4", type: "stage",     loan: "LN-3310", text: "Moved from Origination to Underwriting",  ts: "2 days ago" },
  { id: "a5", type: "document",  loan: "LN-3012", text: "Q1 2026 Rent Roll approved",              ts: "3 days ago" },
  { id: "a6", type: "covenant",  loan: "LN-2847", text: "DSCR covenant passed: 1.42x vs 1.25x floor", ts: "4 days ago" },
];

const fmt = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
  : `$${(n / 1e3).toFixed(0)}K`;

export default function LoanLifecyclePage() {
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const byStage = (stageId: string) => LOANS.filter(l => l.stage === stageId);

  const displayLoans = selectedStage
    ? LOANS.filter(l => l.stage === selectedStage)
    : LOANS;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Loans",     value: LOANS.length,                                  color: "text-slate-900" },
          { label: "Active",          value: LOANS.filter(l => l.stage === "active").length, color: "text-emerald-600" },
          { label: "In Pipeline",     value: LOANS.filter(l => !["active","matured"].includes(l.stage)).length, color: "text-blue-600" },
          { label: "Total Exposure",  value: fmt(LOANS.reduce((s,l) => s + l.amount, 0)),   color: "text-slate-900", isString: true },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView("pipeline")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === "pipeline" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Pipeline View
        </button>
        <button
          onClick={() => setView("list")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === "list" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          List View
        </button>
      </div>

      {view === "pipeline" ? (
        /* Pipeline / Kanban view */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES.map(stage => {
            const loans = byStage(stage.id);
            return (
              <div key={stage.id} className="space-y-2">
                <div className={`rounded-full border px-3 py-1 text-center text-xs font-semibold ${stage.color}`}>
                  {stage.label} ({loans.length})
                </div>
                {loans.map(loan => (
                  <div key={loan.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-1">
                    <p className="text-xs font-bold text-slate-700">{loan.id}</p>
                    <p className="text-xs text-slate-500 leading-tight">{loan.borrower}</p>
                    <p className="text-xs font-semibold text-slate-900">{fmt(loan.amount)}</p>
                    {loan.rate && <p className="text-xs text-slate-400">{loan.rate}%</p>}
                  </div>
                ))}
                {loans.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                    Empty
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {/* Stage filter pills */}
          <div className="flex flex-wrap gap-2 pb-2">
            <button
              onClick={() => setSelectedStage(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${!selectedStage ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              All ({LOANS.length})
            </button>
            {STAGES.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStage(selectedStage === s.id ? null : s.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition border ${selectedStage === s.id ? "bg-slate-900 text-white border-slate-900" : `${s.color} hover:opacity-80`}`}
              >
                {s.label} ({byStage(s.id).length})
              </button>
            ))}
          </div>

          {displayLoans.map(loan => {
            const stageCfg = STAGES.find(s => s.id === loan.stage)!;
            return (
              <div key={loan.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <BanknotesIcon className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-500">{loan.id}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${stageCfg.color}`}>{stageCfg.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 truncate">{loan.borrower}</p>
                  <p className="text-xs text-slate-400 truncate">{loan.property}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-slate-900">{fmt(loan.amount)}</p>
                  {loan.rate && <p className="text-xs text-slate-400">{loan.rate}% · {loan.maturity ? new Date(loan.maturity).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity Feed */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Activity</p>
        <div className="space-y-2">
          {ACTIVITY.map(event => (
            <div key={event.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
              {event.type === "stage"    && <ArrowRightIcon    className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />}
              {event.type === "document" && <DocumentTextIcon   className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
              {event.type === "payment"  && <BanknotesIcon      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
              {event.type === "covenant" && <CheckCircleIcon    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-500">{event.loan} </span>
                <span className="text-sm text-slate-700">{event.text}</span>
              </div>
              <p className="shrink-0 text-xs text-slate-400">{event.ts}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
