/**
 * Covenant Cure Workflow Center — Stage 6
 * Route: /governance/cure-workflows
 *
 * When a covenant breach is detected by the servicing engine, Kontra automatically
 * opens a Cure Workflow — a structured state-machine that tracks the breach through
 * resolution. Lenders, servicers, and borrowers each have a role in the cure process.
 *
 * State machine:
 *   Breach Detected → Cure Plan Proposed → Under Lender Review
 *     → Approved → In Monitoring → Cured
 *     → Rejected → Escalated → Workout / Acceleration
 *
 * Cure types:
 *   (A) Waiver — lender grants a time-limited covenant waiver
 *   (B) Reserve Deposit — borrower funds additional reserves to improve DSCR
 *   (C) Equity Injection — sponsor injects equity to reduce LTV
 *   (D) NOI Improvement Plan — operating improvements with quarterly NOI milestones
 *   (E) Loan Modification — rate, term, or structure modification
 */

import { useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  DocumentTextIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
type CureStage =
  | "breach_detected"
  | "cure_proposed"
  | "under_review"
  | "approved"
  | "in_monitoring"
  | "cured"
  | "rejected"
  | "escalated";

type CovenantType = "dscr" | "ltv" | "occupancy" | "liquidity" | "debt_yield";
type CureType = "waiver" | "reserve_deposit" | "equity_injection" | "noi_plan" | "loan_modification";
type Severity = "critical" | "moderate" | "watch";

interface TimelineEvent {
  date: string;
  actor: string;
  role: string;
  action: string;
  note?: string;
}

interface CureMilestone {
  due: string;
  description: string;
  status: "complete" | "pending" | "overdue";
}

interface CureWorkflow {
  id: string;
  loan_ref: string;
  borrower: string;
  property: string;
  property_type: string;
  covenant_type: CovenantType;
  severity: Severity;
  breach_value: string;
  required_value: string;
  cure_type: CureType;
  stage: CureStage;
  detected_date: string;
  cure_deadline: string;
  cure_summary: string;
  lender_note: string;
  timeline: TimelineEvent[];
  milestones: CureMilestone[];
  waiver_expiry?: string;
  deposit_amount?: number;
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const WORKFLOWS: CureWorkflow[] = [
  {
    id: "CW-001",
    loan_ref: "LN-2847",
    borrower: "Cedar Grove Partners",
    property: "412 Meridian Blvd — Multifamily 24U",
    property_type: "Multifamily",
    covenant_type: "dscr",
    severity: "moderate",
    breach_value: "1.138x",
    required_value: "≥ 1.25x",
    cure_type: "waiver",
    stage: "approved",
    detected_date: "2026-03-01",
    cure_deadline: "2026-06-30",
    cure_summary: "90-day DSCR covenant waiver granted through Q2 2026. Borrower must submit updated rent roll and NOI certification by April 30, 2026. Enhanced monitoring: DSCR tested quarterly. Interest reserve escrow ($89,961) to remain funded.",
    lender_note: "Miami multifamily fundamentals remain strong (4.8% vacancy). Waiver is appropriate given market context. Monitor Q2 rent roll closely.",
    waiver_expiry: "Jun 30, 2026",
    timeline: [
      { date:"Mar 1, 2026",  actor:"Kontra Engine",     role:"System",   action:"Breach Detected — DSCR 1.138x vs. 1.25x floor (Q4 2025 test)" },
      { date:"Mar 2, 2026",  actor:"Kontra Engine",     role:"System",   action:"Cure Workflow CW-001 opened. Notification sent to Servicer and Borrower." },
      { date:"Mar 3, 2026",  actor:"Cedar Grove Prtnrs",role:"Borrower", action:"Cure Plan Submitted — Requested 90-day DSCR waiver. Updated rent roll attached.", note:"Borrower cited lease-up of 2 vacant units (Units 8B and 12A) as root cause. Expected occupancy 96% by May." },
      { date:"Mar 5, 2026",  actor:"Apex Servicing",   role:"Servicer", action:"Cure Plan Reviewed — Recommended approval. Miami vacancy 4.8% per CoStar." },
      { date:"Mar 10, 2026", actor:"Kontra Lender",    role:"Lender",   action:"Waiver Approved — 90 days through Jun 30, 2026. Amendment #1 executed.", note:"Conditions: quarterly DSCR testing, interest reserve maintained, updated rent roll by Apr 30." },
      { date:"Apr 1, 2026",  actor:"Kontra Engine",    role:"System",   action:"Monthly check — Waiver active. Reserve balance $89,961 (compliant)." },
      { date:"Apr 18, 2026", actor:"Cedar Grove Prtnrs",role:"Borrower", action:"Updated rent roll submitted — 22/24 units occupied (91.7%)." },
    ],
    milestones: [
      { due:"Apr 30, 2026", description:"Submit updated rent roll and NOI certification", status:"complete" },
      { due:"May 15, 2026", description:"Q2 DSCR test — target ≥ 1.20x (waiver floor)", status:"pending" },
      { due:"Jun 30, 2026", description:"Waiver expiry — DSCR must return to ≥ 1.25x or extension requested", status:"pending" },
    ],
  },
  {
    id: "CW-002",
    loan_ref: "LN-3201",
    borrower: "Metro Development LLC",
    property: "55 Commerce Blvd — Industrial 48,000 SF",
    property_type: "Industrial",
    covenant_type: "dscr",
    severity: "moderate",
    breach_value: "1.189x",
    required_value: "≥ 1.25x",
    cure_type: "noi_plan",
    stage: "under_review",
    detected_date: "2026-03-15",
    cure_deadline: "2026-07-15",
    cure_summary: "Borrower submitted a 6-month NOI Improvement Plan targeting $640,000 NOI (8.5% cap rate) by Q3 2026 through lease renewal of primary tenant at +12% rent increase and filling 2,200 SF of vacant spec suite.",
    lender_note: "Denver industrial market strong. Lease renewal is credible — primary tenant has 7-year history. Spec suite absorption may take longer; monitoring closely.",
    timeline: [
      { date:"Mar 15, 2026", actor:"Kontra Engine",     role:"System",   action:"Breach Detected — DSCR 1.189x vs. 1.25x floor. LTV 77.7% vs. 75% watch threshold." },
      { date:"Mar 16, 2026", actor:"Kontra Engine",     role:"System",   action:"Cure Workflow CW-002 opened. Dual covenant breach (DSCR + LTV watch)." },
      { date:"Mar 22, 2026", actor:"Metro Dev LLC",     role:"Borrower", action:"Cure Plan Submitted — NOI Improvement Plan with 6-month milestones." },
      { date:"Mar 28, 2026", actor:"Apex Servicing",   role:"Servicer", action:"Plan Reviewed — Credible but ambitious. Recommend enhanced monitoring and quarterly reporting." },
      { date:"Apr 10, 2026", actor:"Kontra Lender",    role:"Lender",   action:"Under Review — Requested updated lease term sheet for primary tenant renewal." },
    ],
    milestones: [
      { due:"Apr 30, 2026", description:"Primary tenant lease renewal term sheet executed", status:"pending" },
      { due:"May 31, 2026", description:"Spec suite LOI signed — minimum 2,200 SF at $18/SF NNN", status:"pending" },
      { due:"Jun 30, 2026", description:"Q2 DSCR test — target ≥ 1.20x (NOI plan milestone)", status:"pending" },
      { due:"Jul 15, 2026", description:"Cure deadline — DSCR ≥ 1.25x or escalation triggered", status:"pending" },
    ],
  },
  {
    id: "CW-003",
    loan_ref: "LN-4108",
    borrower: "Oakfield Group",
    property: "810 Grand Ave — Retail",
    property_type: "Retail",
    covenant_type: "occupancy",
    severity: "critical",
    breach_value: "78%",
    required_value: "≥ 85%",
    cure_type: "equity_injection",
    stage: "breach_detected",
    detected_date: "2026-04-15",
    cure_deadline: "2026-05-30",
    cure_summary: "Occupancy dropped to 78% following anchor tenant departure (Anchor: 3,200 SF). Borrower has 45 days to submit cure plan. Critical severity — below 80% triggers cash trap provision.",
    lender_note: "Cash trap activated April 15 per loan agreement §7.4(b). All cash flows now sweeping to Kontra escrow. Borrower notified.",
    timeline: [
      { date:"Apr 12, 2026", actor:"Oakfield Group",   role:"Borrower", action:"Notice of Tenant Departure — Anchor tenant (Salon Luxe, 3,200 SF) vacated April 10." },
      { date:"Apr 15, 2026", actor:"Kontra Engine",    role:"System",   action:"Breach Detected — Occupancy 78% vs. 85% floor. Critical: Cash trap §7.4(b) activated." },
      { date:"Apr 15, 2026", actor:"Kontra Engine",    role:"System",   action:"Cure Workflow CW-003 opened. 45-day cure period. Cure plan due May 30, 2026." },
      { date:"Apr 16, 2026", actor:"Kontra Lender",    role:"Lender",   action:"Cash trap confirmed. All NOI now sweeping to Kontra escrow account." },
    ],
    milestones: [
      { due:"May 1, 2026",  description:"Borrower to submit letter of intent from replacement tenant", status:"pending" },
      { due:"May 30, 2026", description:"Cure plan submitted to lender — equity injection or lease-up plan", status:"pending" },
    ],
  },
  {
    id: "CW-004",
    loan_ref: "LN-1120",
    borrower: "Sunrise Holdings",
    property: "3300 Harbor Blvd — Hotel 112 Keys",
    property_type: "Hotel",
    covenant_type: "dscr",
    severity: "critical",
    breach_value: "0.94x",
    required_value: "≥ 1.20x",
    cure_type: "loan_modification",
    stage: "escalated",
    detected_date: "2026-01-10",
    cure_deadline: "2026-04-10",
    cure_summary: "DSCR fell to 0.94x (below 1.00x hard floor) due to hotel RevPAR decline of 18% YoY. Waiver was denied. Borrower failed to fund equity injection by deadline. Loan escalated to Special Servicer.",
    lender_note: "Escalated to Special Servicing. Considering loan modification (rate reduction + IO extension) or note sale. Legal counsel engaged.",
    timeline: [
      { date:"Jan 10, 2026", actor:"Kontra Engine",    role:"System",   action:"Critical Breach — DSCR 0.94x, below 1.00x hard floor. Escalation notice issued." },
      { date:"Jan 15, 2026", actor:"Sunrise Holdings", role:"Borrower", action:"Waiver Requested — Cited COVID-19 seasonal impact and RevPAR recovery plan." },
      { date:"Jan 25, 2026", actor:"Kontra Lender",    role:"Lender",   action:"Waiver Denied — 0.94x below hard floor; no waiver available per loan docs §9.1." },
      { date:"Feb 1, 2026",  actor:"Kontra Engine",    role:"System",   action:"Equity Injection Required — $480,000 by March 15, 2026." },
      { date:"Mar 15, 2026", actor:"Kontra Engine",    role:"System",   action:"Equity Injection Deadline Missed. Escalation triggered." },
      { date:"Apr 10, 2026", actor:"Kontra Lender",    role:"Lender",   action:"Escalated to Special Servicer. Loan modification analysis in progress." },
    ],
    milestones: [
      { due:"Mar 15, 2026", description:"Equity injection of $480,000 — MISSED", status:"overdue" },
      { due:"Apr 30, 2026", description:"Special Servicer modification proposal to lender", status:"pending" },
      { due:"May 31, 2026", description:"Loan modification executed or note sale initiated", status:"pending" },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

const STAGE_CONFIG: Record<CureStage, { label: string; color: string; dot: string }> = {
  breach_detected: { label:"Breach Detected",   color:"bg-red-100 text-red-700",          dot:"bg-red-500" },
  cure_proposed:   { label:"Cure Proposed",      color:"bg-amber-100 text-amber-700",       dot:"bg-amber-500" },
  under_review:    { label:"Under Review",       color:"bg-blue-100 text-blue-700",         dot:"bg-blue-500" },
  approved:        { label:"Approved",           color:"bg-emerald-100 text-emerald-700",   dot:"bg-emerald-500" },
  in_monitoring:   { label:"In Monitoring",      color:"bg-violet-100 text-violet-700",     dot:"bg-violet-500" },
  cured:           { label:"Cured",              color:"bg-slate-100 text-slate-600",       dot:"bg-slate-400" },
  rejected:        { label:"Rejected",           color:"bg-red-100 text-red-700",           dot:"bg-red-500" },
  escalated:       { label:"Escalated",          color:"bg-red-200 text-red-900 font-bold", dot:"bg-red-700" },
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; icon: typeof ExclamationTriangleIcon }> = {
  critical: { label:"Critical", color:"text-red-700 bg-red-50 border-red-200",    icon:XCircleIcon },
  moderate: { label:"Moderate", color:"text-amber-700 bg-amber-50 border-amber-200", icon:ExclamationTriangleIcon },
  watch:    { label:"Watch",    color:"text-blue-700 bg-blue-50 border-blue-200",  icon:ClockIcon },
};

const COVENANT_LABELS: Record<CovenantType, string> = {
  dscr:        "DSCR", ltv: "LTV", occupancy:"Occupancy", liquidity:"Liquidity", debt_yield:"Debt Yield",
};

const CURE_TYPE_CONFIG: Record<CureType, { label: string; icon: typeof ShieldExclamationIcon; color: string }> = {
  waiver:            { label:"Waiver",            icon:DocumentTextIcon,    color:"text-violet-700 bg-violet-100" },
  reserve_deposit:   { label:"Reserve Deposit",   icon:BanknotesIcon,       color:"text-emerald-700 bg-emerald-100" },
  equity_injection:  { label:"Equity Injection",  icon:ArrowTrendingUpIcon, color:"text-blue-700 bg-blue-100" },
  noi_plan:          { label:"NOI Plan",           icon:ArrowPathIcon,       color:"text-amber-700 bg-amber-100" },
  loan_modification: { label:"Loan Modification", icon:ScaleIcon,           color:"text-red-700 bg-red-100" },
};

const MILESTONE_COLOR = { complete:"text-emerald-700", pending:"text-slate-500", overdue:"text-red-700" };
const MILESTONE_DOT   = { complete:"bg-emerald-500",   pending:"bg-slate-300",   overdue:"bg-red-500" };

const STAGE_ORDER: CureStage[] = ["breach_detected","cure_proposed","under_review","approved","in_monitoring","cured"];

export default function CureWorkflowPage() {
  const [selected, setSelected] = useState<CureWorkflow>(WORKFLOWS[0]);
  const [expandTimeline, setExpandTimeline] = useState(true);
  const [filter, setFilter] = useState<"all" | Severity>("all");

  const filtered = WORKFLOWS.filter(w => filter === "all" || w.severity === filter);
  const activeCount = WORKFLOWS.filter(w => !["cured"].includes(w.stage)).length;
  const criticalCount = WORKFLOWS.filter(w => w.severity === "critical").length;

  const stageIndex = STAGE_ORDER.indexOf(selected.stage);
  const CureIcon = CURE_TYPE_CONFIG[selected.cure_type].icon;
  const SevIcon = SEVERITY_CONFIG[selected.severity].icon;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Active Workflows",   value: activeCount.toString(),   sub:"Requiring attention" },
          { label:"Critical Breaches",  value: criticalCount.toString(), sub:"Below hard floor" },
          { label:"Pending Approval",   value: WORKFLOWS.filter(w=>w.stage==="under_review").length.toString(), sub:"Awaiting lender action" },
          { label:"Escalated",          value: WORKFLOWS.filter(w=>w.stage==="escalated").length.toString(), sub:"Special servicing" },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className="text-2xl font-black text-slate-900">{m.value}</p>
            <p className="text-xs text-slate-400">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Workflow list */}
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap mb-1">
            {(["all","critical","moderate","watch"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${filter===f?"bg-slate-900 text-white":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>

          {filtered.map(wf => {
            const sev = SEVERITY_CONFIG[wf.severity];
            const stage = STAGE_CONFIG[wf.stage];
            const isActive = selected.id === wf.id;
            return (
              <button key={wf.id} onClick={() => setSelected(wf)}
                className={`w-full rounded-xl border p-3.5 text-left transition ${isActive ? "border-slate-900 bg-slate-900" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${isActive?"text-white":"text-slate-900"}`}>{wf.borrower}</p>
                    <p className={`text-[11px] truncate ${isActive?"text-slate-400":"text-slate-500"}`}>{wf.loan_ref} · {wf.property_type}</p>
                  </div>
                  <SevIcon className={`mt-0.5 h-4 w-4 shrink-0 ${isActive?"text-slate-300":wf.severity==="critical"?"text-red-500":"text-amber-500"}`} />
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive?"bg-white/10 text-white":sev.color}`}>
                    {sev.label}
                  </span>
                  <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive?"bg-white/10 text-slate-300":stage.color}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${isActive?"bg-current":stage.dot}`} />
                    {stage.label}
                  </span>
                </div>
                <p className={`mt-1.5 text-[10px] ${isActive?"text-slate-400":"text-slate-400"}`}>
                  {COVENANT_LABELS[wf.covenant_type]} {wf.breach_value} (req. {wf.required_value})
                </p>
                <p className={`text-[10px] ${isActive?"text-red-400":"text-red-600"}`}>
                  Deadline: {new Date(wf.cure_deadline).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                </p>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="space-y-4 min-w-0">
          {/* Header */}
          <div className={`rounded-xl border p-5 ${SEVERITY_CONFIG[selected.severity].color}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <SevIcon className="h-6 w-6 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{selected.id} · Covenant Cure Workflow</p>
                  <p className="text-lg font-black">{selected.borrower}</p>
                  <p className="text-xs opacity-80">{selected.property}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${STAGE_CONFIG[selected.stage].color}`}>
                  <span className={`h-2 w-2 rounded-full ${STAGE_CONFIG[selected.stage].dot}`} />
                  {STAGE_CONFIG[selected.stage].label}
                </span>
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${CURE_TYPE_CONFIG[selected.cure_type].color}`}>
                  <CureIcon className="h-3.5 w-3.5" />
                  {CURE_TYPE_CONFIG[selected.cure_type].label}
                </span>
              </div>
            </div>

            {/* Breach metrics */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label:"Covenant",      value: COVENANT_LABELS[selected.covenant_type] },
                { label:"Breach Value",  value: selected.breach_value },
                { label:"Required",      value: selected.required_value },
                { label:"Cure Deadline", value: new Date(selected.cure_deadline).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) },
              ].map(m => (
                <div key={m.label} className="rounded-lg bg-white/30 p-2.5">
                  <p className="text-[10px] opacity-70">{m.label}</p>
                  <p className="text-sm font-black">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Progress stepper */}
          {!["escalated","rejected"].includes(selected.stage) && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Cure Progress</p>
              <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>
                {STAGE_ORDER.map((s, i) => {
                  const done = i <= stageIndex;
                  const current = i === stageIndex;
                  return (
                    <div key={s} className="flex shrink-0 items-center gap-1">
                      <div className={`flex flex-col items-center gap-1`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition ${current?"border-slate-900 bg-slate-900 text-white":done?"border-emerald-500 bg-emerald-500 text-white":"border-slate-200 bg-white text-slate-400"}`}>
                          {done && !current ? <CheckCircleIcon className="h-4 w-4" /> : i+1}
                        </div>
                        <p className={`text-[9px] font-semibold text-center max-w-[56px] leading-tight ${current?"text-slate-900":done?"text-emerald-700":"text-slate-400"}`}>
                          {STAGE_CONFIG[s].label}
                        </p>
                      </div>
                      {i < STAGE_ORDER.length - 1 && (
                        <div className={`mb-4 h-0.5 w-6 shrink-0 rounded ${i < stageIndex?"bg-emerald-400":"bg-slate-200"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cure summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Cure Plan Summary</p>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">{selected.cure_summary}</p>
            {selected.lender_note && (
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Lender Note</p>
                <p className="text-xs text-slate-600">{selected.lender_note}</p>
              </div>
            )}
            {selected.waiver_expiry && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-100 px-4 py-3">
                <DocumentTextIcon className="h-4 w-4 text-violet-600 shrink-0" />
                <p className="text-xs font-bold text-violet-800">Waiver expires: {selected.waiver_expiry}</p>
              </div>
            )}
          </div>

          {/* Milestones */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Cure Milestones</p>
            <div className="space-y-2">
              {selected.milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${MILESTONE_DOT[m.status]}`} />
                  <div className="flex-1">
                    <p className={`text-xs font-semibold ${MILESTONE_COLOR[m.status]}`}>{m.description}</p>
                    <p className="text-[10px] text-slate-400">Due: {m.due}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    m.status==="complete"?"bg-emerald-100 text-emerald-700":m.status==="overdue"?"bg-red-100 text-red-700":"bg-slate-100 text-slate-500"
                  }`}>{m.status.charAt(0).toUpperCase()+m.status.slice(1)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => setExpandTimeline(t => !t)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Audit Trail ({selected.timeline.length} events)
              </p>
              {expandTimeline ? <ChevronUpIcon className="h-4 w-4 text-slate-400" /> : <ChevronDownIcon className="h-4 w-4 text-slate-400" />}
            </button>
            {expandTimeline && (
              <div className="border-t border-slate-100 px-5 pb-4 pt-2">
                <div className="relative space-y-4 pl-4">
                  <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-100" />
                  {selected.timeline.map((ev, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[11px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-400" />
                      <p className="text-[10px] text-slate-400">{ev.date} · <span className="font-semibold">{ev.actor}</span> <span className="opacity-60">({ev.role})</span></p>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5">{ev.action}</p>
                      {ev.note && <p className="mt-0.5 text-xs text-slate-500 italic">{ev.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {selected.stage === "under_review" && (
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-sm">
                <CheckCircleIcon className="h-4 w-4" />
                Approve Cure Plan
              </button>
              <button className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 transition shadow-sm">
                <XCircleIcon className="h-4 w-4" />
                Reject & Escalate
              </button>
              <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm">
                <DocumentArrowDownIcon className="h-4 w-4" />
                Download Cure Package
              </button>
            </div>
          )}
          {selected.stage === "breach_detected" && (
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm">
                Send Cure Notice to Borrower
              </button>
              <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm">
                <DocumentArrowDownIcon className="h-4 w-4" />
                Download Default Notice
              </button>
            </div>
          )}
          {selected.stage === "approved" && (
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition shadow-sm">
                <ArrowPathIcon className="h-4 w-4" />
                Log Monitoring Update
              </button>
              <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm">
                <DocumentArrowDownIcon className="h-4 w-4" />
                Waiver Amendment PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
