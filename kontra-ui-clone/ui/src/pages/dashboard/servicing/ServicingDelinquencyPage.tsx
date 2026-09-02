/**
 * Delinquency Management — Stage 3
 * Route: /servicer/delinquency
 *
 * Tracks every loan through the delinquency escalation lifecycle:
 *   Current → 30-Day Late → 60-Day Late → 90-Day+ → Special Servicing → Foreclosure/REO
 *
 * Each stage has defined escalation actions, required notifications,
 * cure period timelines, and workout options.
 *
 * Key features:
 * - Portfolio delinquency dashboard with stage summary
 * - Per-loan detail with payment history and escalation log
 * - Workout options: forbearance, modification, deed-in-lieu, foreclosure
 * - Communication log and required notice tracking
 * - Loss mitigation analysis
 */

import { useState } from "react";
import {
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
type DelinquencyStage = "current" | "30day" | "60day" | "90day" | "special" | "foreclosure" | "reo";
type WorkoutType = "forbearance" | "modification" | "dil" | "foreclosure" | "payoff";

interface Payment {
  date: string;
  due: number;
  paid: number;
  shortfall: number;
  late_fee: number;
  status: "paid" | "partial" | "missed";
}

interface EscalationEvent {
  date: string;
  action: string;
  by: string;
  note: string;
}

interface DelinquentLoan {
  loan_ref: string;
  borrower: string;
  property: string;
  property_type: string;
  balance: number;
  rate: number;
  monthly_ds: number;
  stage: DelinquencyStage;
  days_past_due: number;
  total_arrears: number;
  last_payment_date: string;
  last_payment_amount: number;
  maturity: string;
  dscr: number;
  ltv: number;
  workout_status: WorkoutType | null;
  payments: Payment[];
  escalation_log: EscalationEvent[];
  workout_options: { type: WorkoutType; label: string; recommended?: boolean; note: string }[];
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const LOANS: DelinquentLoan[] = [
  {
    loan_ref: "LN-3012", borrower: "Harbor View Holdings",
    property: "789 Harbor View Dr, Miami FL", property_type: "Retail",
    balance: 7_640_000, rate: 7.50, monthly_ds: 52_350,
    stage: "60day", days_past_due: 62, total_arrears: 104_700,
    last_payment_date: "2026-02-01", last_payment_amount: 52_350,
    maturity: "2027-02-01", dscr: 0.989, ltv: 88.5,
    workout_status: null,
    payments: [
      { date:"2026-04-01", due:52_350, paid:0,      shortfall:52_350, late_fee:2_618, status:"missed" },
      { date:"2026-03-01", due:52_350, paid:0,      shortfall:52_350, late_fee:2_618, status:"missed" },
      { date:"2026-02-01", due:52_350, paid:52_350, shortfall:0,      late_fee:0,     status:"paid" },
      { date:"2026-01-01", due:52_350, paid:52_350, shortfall:0,      late_fee:0,     status:"paid" },
      { date:"2025-12-01", due:52_350, paid:52_350, shortfall:0,      late_fee:0,     status:"paid" },
    ],
    escalation_log: [
      { date:"2026-04-06", action:"60-Day Notice Sent",       by:"System",          note:"Automated notice sent to borrower and guarantor per loan agreement §12.4." },
      { date:"2026-04-02", action:"Servicer Call — No Answer", by:"K. Reynolds",   note:"Attempted borrower contact. VM left. Email sent to borrower contact." },
      { date:"2026-03-15", action:"30-Day Notice Sent",        by:"System",         note:"Automated delinquency notice triggered at 30+ DPD." },
      { date:"2026-03-10", action:"Borrower Outreach",         by:"K. Reynolds",   note:"Borrower confirms anchor tenant (32% of rent roll) has not paid March rent." },
      { date:"2026-03-06", action:"Payment Flag Raised",       by:"System",         note:"March payment not received by 5th. AI alert triggered." },
    ],
    workout_options: [
      { type:"forbearance", label:"Forbearance Agreement",  recommended:true, note:"3-month payment deferral while tenant leasing stabilizes. Deferred amounts capitalized at maturity." },
      { type:"modification", label:"Loan Modification",     note:"Reduce rate 50bps for 12 months to improve DSCR. Requires lender approval and updated appraisal." },
      { type:"dil",         label:"Deed-in-Lieu",           note:"Consensual transfer. Avoids foreclosure. Requires clear title and BPO ≥ outstanding balance." },
      { type:"foreclosure", label:"Initiate Foreclosure",   note:"Florida judicial foreclosure. Est. 12–18 months timeline. Legal costs: ~$85,000." },
    ],
  },
  {
    loan_ref: "LN-3145", borrower: "Redwood Capital Group",
    property: "2200 Oak Street, Denver CO", property_type: "Office",
    balance: 12_350_000, rate: 7.25, monthly_ds: 91_800,
    stage: "30day", days_past_due: 31, total_arrears: 91_800,
    last_payment_date: "2026-03-01", last_payment_amount: 91_800,
    maturity: "2028-01-01", dscr: 0.98, ltv: 76.2,
    workout_status: null,
    payments: [
      { date:"2026-04-01", due:91_800, paid:0,      shortfall:91_800, late_fee:4_590, status:"missed" },
      { date:"2026-03-01", due:91_800, paid:91_800, shortfall:0,      late_fee:0,     status:"paid" },
      { date:"2026-02-01", due:91_800, paid:91_800, shortfall:0,      late_fee:0,     status:"paid" },
      { date:"2026-01-01", due:91_800, paid:91_800, shortfall:0,      late_fee:0,     status:"paid" },
      { date:"2025-12-01", due:91_800, paid:91_800, shortfall:0,      late_fee:0,     status:"paid" },
    ],
    escalation_log: [
      { date:"2026-04-08", action:"30-Day Notice Sent",        by:"System",         note:"First delinquency notice. Grace period expired April 6." },
      { date:"2026-04-05", action:"Borrower Contact",          by:"M. Chen",        note:"Borrower reports cash flow shortfall due to 28.6% office vacancy. Requesting forbearance discussion." },
      { date:"2026-04-04", action:"Payment Flag Raised",       by:"System",         note:"April 1 payment not received. AI alert triggered." },
    ],
    workout_options: [
      { type:"forbearance", label:"Forbearance Agreement",  recommended:true, note:"90-day deferral pending occupancy improvement. Borrower must submit leasing pipeline within 30 days." },
      { type:"modification", label:"Loan Modification",     note:"Extension of maturity by 12 months with rate step-down. Aligns with Denver office market recovery timeline." },
      { type:"payoff",      label:"Negotiated Payoff",      note:"Borrower may have identified buyer. Payoff quote to be prepared at discounted payoff amount." },
    ],
  },
];

const STAGE_CONFIG: Record<DelinquencyStage, { label:string; color:string; bg:string; dot:string; order:number }> = {
  current:     { label:"Current",          color:"text-emerald-700", bg:"bg-emerald-50 border-emerald-200",   dot:"bg-emerald-500",  order:0 },
  "30day":     { label:"30-Day",           color:"text-amber-700",   bg:"bg-amber-50 border-amber-200",      dot:"bg-amber-500",    order:1 },
  "60day":     { label:"60-Day",           color:"text-orange-700",  bg:"bg-orange-50 border-orange-200",    dot:"bg-orange-500",   order:2 },
  "90day":     { label:"90-Day+",          color:"text-red-700",     bg:"bg-red-50 border-red-200",          dot:"bg-red-600",      order:3 },
  special:     { label:"Special Servicing",color:"text-red-900",     bg:"bg-red-100 border-red-300",         dot:"bg-red-800",      order:4 },
  foreclosure: { label:"Foreclosure",      color:"text-slate-900",   bg:"bg-slate-200 border-slate-400",     dot:"bg-slate-700",    order:5 },
  reo:         { label:"REO",              color:"text-slate-900",   bg:"bg-slate-300 border-slate-500",     dot:"bg-slate-900",    order:6 },
};

const WORKOUT_LABELS: Record<WorkoutType, string> = {
  forbearance: "Forbearance", modification: "Modification",
  dil: "Deed-in-Lieu", foreclosure: "Foreclosure", payoff: "Payoff",
};

const fmt = (n: number) => n.toLocaleString("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 });

const ESCALATION_TIMELINE: { stage: DelinquencyStage; label: string; trigger: string }[] = [
  { stage:"current",     label:"Current",           trigger:"—" },
  { stage:"30day",       label:"30-Day Notice",     trigger:"Payment missed 5+ days past due" },
  { stage:"60day",       label:"60-Day Notice",     trigger:"Second consecutive missed payment" },
  { stage:"90day",       label:"90-Day / Default",  trigger:"Third missed payment / acceleration trigger" },
  { stage:"special",     label:"Special Servicing", trigger:"Transfer from master servicer" },
  { stage:"foreclosure", label:"Foreclosure",       trigger:"Lender election after failed workout" },
  { stage:"reo",         label:"REO",               trigger:"Property acquired at foreclosure sale" },
];

export default function ServicingDelinquencyPage() {
  const [selectedRef, setSelectedRef] = useState(LOANS[0].loan_ref);
  const [activeTab, setActiveTab] = useState<"detail" | "payments" | "workout" | "log">("detail");
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutType | null>(null);

  const loan = LOANS.find(l => l.loan_ref === selectedRef) ?? LOANS[0];
  const stageCfg = STAGE_CONFIG[loan.stage];
  const stageOrder = stageCfg.order;

  return (
    <div className="space-y-6">
      {/* Portfolio summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label:"Delinquent Loans",   value: LOANS.length,                                         color:"text-red-700" },
          { label:"Total Arrears",      value: fmt(LOANS.reduce((s,l) => s+l.total_arrears, 0)),    color:"text-red-700", isStr:true },
          { label:"30-Day",             value: LOANS.filter(l=>l.stage==="30day").length,            color:"text-amber-700" },
          { label:"60-Day+",            value: LOANS.filter(l=>["60day","90day","special","foreclosure","reo"].includes(l.stage)).length, color:"text-red-700" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Loan selector */}
      <div className="flex flex-wrap gap-2">
        {LOANS.map(l => {
          const cfg = STAGE_CONFIG[l.stage];
          return (
            <button key={l.loan_ref} onClick={() => { setSelectedRef(l.loan_ref); setActiveTab("detail"); }}
              className={`rounded-xl border px-4 py-2.5 text-left transition ${selectedRef === l.loan_ref ? "border-slate-900 bg-slate-900" : `${cfg.bg} border hover:opacity-90`}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${selectedRef === l.loan_ref ? "bg-white" : cfg.dot}`} />
                <span className={`text-sm font-bold ${selectedRef === l.loan_ref ? "text-white" : "text-slate-900"}`}>{l.loan_ref}</span>
                <span className={`text-xs ${selectedRef === l.loan_ref ? "text-slate-300" : cfg.color} font-semibold`}>{cfg.label}</span>
              </div>
              <p className={`mt-1 text-xs ${selectedRef === l.loan_ref ? "text-slate-400" : "text-slate-500"}`}>{l.borrower} · {l.days_past_due} DPD</p>
            </button>
          );
        })}
      </div>

      {/* Escalation timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Delinquency Escalation Timeline</p>
        <div className="flex items-center gap-0 overflow-x-auto">
          {ESCALATION_TIMELINE.map((step, i) => {
            const isActive = STAGE_CONFIG[step.stage].order === stageOrder;
            const isPast = STAGE_CONFIG[step.stage].order < stageOrder;
            const cfg = STAGE_CONFIG[step.stage];
            return (
              <div key={step.stage} className="flex shrink-0 items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${isActive ? "border-slate-900 bg-slate-900" : isPast ? "border-red-400 bg-red-100" : "border-slate-200 bg-slate-50"}`}>
                    {isPast ? <XCircleIcon className="h-4 w-4 text-red-500" /> : isActive ? <FlagIcon className="h-4 w-4 text-white" /> : <span className="h-2 w-2 rounded-full bg-slate-300" />}
                  </div>
                  <p className={`mt-1 text-[10px] font-semibold text-center whitespace-nowrap ${isActive ? "text-slate-900" : isPast ? cfg.color : "text-slate-400"}`}>{step.label}</p>
                </div>
                {i < ESCALATION_TIMELINE.length - 1 && (
                  <div className={`mx-1 h-0.5 w-10 shrink-0 ${isPast || isActive ? "bg-red-300" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Loan detail */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className={`border-b p-5 ${stageCfg.bg}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{loan.loan_ref} — {loan.borrower}</h2>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${stageCfg.bg} ${stageCfg.color}`}>{stageCfg.label}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{loan.property}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-red-700">{loan.days_past_due} DPD</p>
              <p className="text-xs text-slate-500">Arrears: {fmt(loan.total_arrears)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            {[
              { label:"Balance",    value:fmt(loan.balance) },
              { label:"Monthly DS", value:fmt(loan.monthly_ds) },
              { label:"Rate",       value:`${loan.rate}%` },
              { label:"DSCR",       value:`${loan.dscr.toFixed(3)}x`, alert: loan.dscr < 1.0 },
              { label:"LTV",        value:`${loan.ltv}%`, alert: loan.ltv > 80 },
              { label:"Maturity",   value: new Date(loan.maturity).toLocaleDateString("en-US",{month:"short",year:"numeric"}) },
            ].map(m => (
              <div key={m.label}>
                <span className="text-slate-400">{m.label}: </span>
                <span className={`font-semibold ${m.alert ? "text-red-700" : "text-slate-900"}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 border-b border-slate-100 px-4 pt-3">
          {(["detail","payments","workout","log"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium capitalize transition ${activeTab === tab ? "border border-b-white border-slate-200 -mb-px bg-white text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
            >
              {tab === "log" ? "Escalation Log" : tab === "workout" ? "Workout Options" : tab.charAt(0).toUpperCase()+tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "detail" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Last Payment</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{fmt(loan.last_payment_amount)}</p>
                  <p className="text-xs text-slate-500">{new Date(loan.last_payment_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>
                </div>
                <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Total Arrears</p>
                  <p className="mt-1 text-sm font-black text-red-900">{fmt(loan.total_arrears)}</p>
                  <p className="text-xs text-red-600">{loan.days_past_due} days past due</p>
                </div>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-900 mb-2">Required Notifications</p>
                <ul className="space-y-1 text-xs text-amber-800">
                  {loan.days_past_due >= 30 && <li className="flex items-center gap-1.5"><CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />30-day notice sent to borrower and guarantor</li>}
                  {loan.days_past_due >= 60 && <li className="flex items-center gap-1.5"><CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />60-day notice sent. Workout period commenced.</li>}
                  {loan.days_past_due >= 60 && <li className="flex items-center gap-1.5"><ClockIcon className="h-3.5 w-3.5 text-amber-600" />Investor notification required by {new Date(Date.now() + 7*864e5).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</li>}
                  {loan.days_past_due >= 90 && <li className="flex items-center gap-1.5"><XCircleIcon className="h-3.5 w-3.5 text-red-600" />Acceleration notice required — legal review initiated</li>}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="pb-2 text-left">Due Date</th>
                  <th className="pb-2 text-right">Amount Due</th>
                  <th className="pb-2 text-right">Amount Paid</th>
                  <th className="pb-2 text-right">Shortfall</th>
                  <th className="pb-2 text-right">Late Fee</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loan.payments.map((p, i) => (
                  <tr key={i} className={p.status === "missed" ? "bg-red-50" : p.status === "partial" ? "bg-amber-50" : ""}>
                    <td className="py-2.5 font-medium text-slate-900">{new Date(p.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-700">{fmt(p.due)}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-700">{p.paid > 0 ? fmt(p.paid) : "—"}</td>
                    <td className={`py-2.5 text-right tabular-nums font-semibold ${p.shortfall > 0 ? "text-red-700" : "text-emerald-600"}`}>{p.shortfall > 0 ? fmt(p.shortfall) : "—"}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-500">{p.late_fee > 0 ? fmt(p.late_fee) : "—"}</td>
                    <td className="py-2.5 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.status==="paid"?"bg-emerald-100 text-emerald-700":p.status==="partial"?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"}`}>
                        {p.status.charAt(0).toUpperCase()+p.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "workout" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Select a loss mitigation strategy to initiate the workout process. All workout elections require lender authorization.</p>
              {loan.workout_options.map(opt => (
                <div key={opt.type}
                  onClick={() => setSelectedWorkout(selectedWorkout === opt.type ? null : opt.type)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${selectedWorkout === opt.type ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${selectedWorkout === opt.type ? "text-white" : "text-slate-900"}`}>{opt.label}</p>
                        {opt.recommended && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selectedWorkout === opt.type ? "bg-slate-700 text-slate-200" : "bg-emerald-100 text-emerald-700"}`}>Recommended</span>}
                      </div>
                      <p className={`mt-1 text-xs ${selectedWorkout === opt.type ? "text-slate-300" : "text-slate-500"}`}>{opt.note}</p>
                    </div>
                    <ArrowRightIcon className={`mt-0.5 h-4 w-4 shrink-0 ${selectedWorkout === opt.type ? "text-white" : "text-slate-400"}`} />
                  </div>
                </div>
              ))}
              {selectedWorkout && (
                <div className="flex gap-2 pt-2">
                  <button className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition">
                    Initiate {WORKOUT_LABELS[selectedWorkout]}
                  </button>
                  <button onClick={() => setSelectedWorkout(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "log" && (
            <div className="space-y-2">
              {loan.escalation_log.map((event, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-100 px-4 py-3">
                  <DocumentTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{event.action}</p>
                      <span className="text-xs text-slate-400">by {event.by}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{event.note}</p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-400 whitespace-nowrap">{event.date}</p>
                </div>
              ))}
              <div className="pt-3 flex gap-2">
                <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  Add Note
                </button>
                <button className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition">
                  <DocumentTextIcon className="h-4 w-4" />
                  Send Notice
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
