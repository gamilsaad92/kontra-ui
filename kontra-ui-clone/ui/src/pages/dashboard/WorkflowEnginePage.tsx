/**
 * Shared Workflow Engine — Lender View
 *
 * Visualizes the three-way action routing between Borrower, Lender, and Investor portals.
 * All three portals share one backend data model; this page shows how actions flow through it.
 *
 * Workflow rules:
 * 1. Borrower uploads/submits → routes to Lender review queue
 * 2. Lender approves major economic action → triggers investor reporting / governance vote if threshold met
 * 3. Investor vote result flows back → unlocks lender execution (approve/enforce)
 */

import { useState } from "react";
import {
  ArrowRightIcon,
  ArrowDownIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  BuildingOffice2Icon,
  BriefcaseIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

// ── Live workflow queue (demo) ─────────────────────────────────
const WORKFLOW_ITEMS = [
  {
    id:"wf1",
    stage:"lender_review",
    type:"document_upload",
    title:"Monthly Operating Statement — LN-2847",
    description:"Borrower submitted April 2026 Operating Statement. Awaiting lender review.",
    from_portal:"borrower",
    to_portal:"lender",
    submitted:"2026-04-08",
    priority:"normal",
    action_label:"Review Document",
  },
  {
    id:"wf2",
    stage:"pending_investor_vote",
    type:"major_economic_action",
    title:"Maturity Extension — LN-2847 (18 months)",
    description:"Lender recommended extension. Investor vote threshold: 66.7%. Currently 78.3% in favor. Quorum met.",
    from_portal:"lender",
    to_portal:"investor",
    submitted:"2026-04-05",
    priority:"high",
    action_label:"View Proposal GV-051",
  },
  {
    id:"wf3",
    stage:"awaiting_execution",
    type:"vote_result",
    title:"REO Disposition — Harbor Blvd (GV-050)",
    description:"Investor vote closed. Result: 62.1% in favor — threshold 75% not met. Action: lender retains enforcement authority.",
    from_portal:"investor",
    to_portal:"lender",
    submitted:"2026-04-07",
    priority:"high",
    action_label:"Execute Servicer Decision",
  },
  {
    id:"wf4",
    stage:"pending_inspection",
    type:"draw_request",
    title:"Draw #5 Request — LN-2847 ($310,000)",
    description:"Borrower submitted draw request for Phase 3 construction. Inspection scheduled April 22. Lender review blocked until inspection complete.",
    from_portal:"borrower",
    to_portal:"lender",
    submitted:"2026-04-05",
    priority:"normal",
    action_label:"View Inspection Status",
  },
];

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  lender_review:        { label:"Lender Review",       color:"text-blue-700",   bg:"bg-blue-50",   border:"border-blue-200" },
  pending_investor_vote:{ label:"Investor Vote Active", color:"text-violet-700", bg:"bg-violet-50", border:"border-violet-200" },
  awaiting_execution:   { label:"Execution Required",  color:"text-amber-700",  bg:"bg-amber-50",  border:"border-amber-200" },
  pending_inspection:   { label:"Inspection Pending",  color:"text-slate-700",  bg:"bg-slate-50",  border:"border-slate-200" },
  completed:            { label:"Completed",            color:"text-emerald-700",bg:"bg-emerald-50",border:"border-emerald-200" },
};

const PORTAL_CONFIG = {
  borrower: { label:"Borrower", color:"text-slate-700", bg:"bg-slate-100", icon:BuildingOffice2Icon },
  lender:   { label:"Lender / Servicer", color:"text-brand-700", bg:"bg-brand-50", icon:BriefcaseIcon },
  investor: { label:"Investor", color:"text-violet-700", bg:"bg-violet-50", icon:UserGroupIcon },
};

const PRIORITY_ICON: Record<string, typeof ClockIcon> = {
  high:   ExclamationTriangleIcon,
  normal: ClockIcon,
};

type Tab = "queue" | "diagram" | "rules";

export default function WorkflowEnginePage() {
  const [tab, setTab] = useState<Tab>("queue");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BoltIcon className="h-5 w-5 text-brand-500" />
            <h1 className="text-xl font-black text-slate-900">Shared Workflow Engine</h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Actions submitted in the Borrower or Investor portals route here for lender review or execution. This is the single command layer across all three products.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
            Engine Active
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label:"Pending Review",   value:2, color:"text-blue-700",   bg:"bg-blue-50",   border:"border-blue-200" },
          { label:"Investor Votes",   value:1, color:"text-violet-700", bg:"bg-violet-50", border:"border-violet-200" },
          { label:"Awaiting Execution",value:1,color:"text-amber-700",  bg:"bg-amber-50",  border:"border-amber-200" },
          { label:"Completed (30d)",  value:14,color:"text-emerald-700",bg:"bg-emerald-50",border:"border-emerald-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-5 py-4`}>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-black tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0">
          {([["queue","Action Queue"],["diagram","Flow Diagram"],["rules","Routing Rules"]] as [Tab,string][]).map(([key,label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── ACTION QUEUE ── */}
      {tab === "queue" && (
        <div className="space-y-3">
          {WORKFLOW_ITEMS.map((item) => {
            const stage = STAGE_CONFIG[item.stage];
            const PriorityIcon = PRIORITY_ICON[item.priority] ?? ClockIcon;
            const FromPortal = PORTAL_CONFIG[item.from_portal as keyof typeof PORTAL_CONFIG];
            const ToPortal = PORTAL_CONFIG[item.to_portal as keyof typeof PORTAL_CONFIG];
            const selected = selectedItem === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all ${selected ? "ring-2 ring-slate-900" : ""}`}
              >
                <button
                  className="w-full text-left"
                  onClick={() => setSelectedItem(selected ? null : item.id)}
                >
                  <div className="flex items-center gap-4 px-6 py-4">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${item.priority === "high" ? "bg-amber-100" : "bg-slate-100"}`}>
                      <PriorityIcon className={`h-4 w-4 ${item.priority === "high" ? "text-amber-600" : "text-slate-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${stage.color} ${stage.bg} ${stage.border} border`}>
                          {stage.label}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">{item.type.replace(/_/g," ")}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 truncate">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${FromPortal.color} ${FromPortal.bg}`}>
                          {FromPortal.label}
                        </span>
                        <ArrowRightIcon className="h-3 w-3 text-slate-400" />
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ToPortal.color} ${ToPortal.bg}`}>
                          {ToPortal.label}
                        </span>
                      </div>
                      <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition-colors whitespace-nowrap">
                        {item.action_label}
                      </button>
                    </div>
                  </div>
                </button>
                {selected && (
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <p className="text-sm text-slate-700">{item.description}</p>
                    <p className="text-xs text-slate-400 mt-2">Submitted: {item.submitted}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── FLOW DIAGRAM ── */}
      {tab === "diagram" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Three-Portal Action Routing</h2>

            <div className="flex items-start gap-4">

              {/* Borrower column */}
              <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BuildingOffice2Icon className="h-5 w-5 text-slate-500" />
                  <p className="text-sm font-black text-slate-700">Borrower Portal</p>
                </div>
                <div className="space-y-2 text-xs text-slate-600">
                  {["Monthly operating statements","Rent rolls & financial uploads","Draw requests (construction)","Covenant documentation","Property inspection responses","Messages to servicer"].map((a) => (
                    <div key={a} className="flex items-start gap-1.5">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center gap-1 pt-8">
                <ArrowRightIcon className="h-5 w-5 text-slate-400" />
                <p className="text-xs text-slate-400 whitespace-nowrap">routes to</p>
              </div>

              {/* Lender column */}
              <div className="flex-1 rounded-xl border border-brand-200 bg-brand-50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BriefcaseIcon className="h-5 w-5 text-brand-600" />
                  <p className="text-sm font-black text-brand-700">Lender / Servicer</p>
                  <span className="rounded-full bg-brand-100 border border-brand-200 px-2 py-0.5 text-xs font-bold text-brand-700">Execution Layer</span>
                </div>
                <div className="space-y-2 text-xs text-brand-700">
                  {["Review & approve borrower submissions","Fund or deny draw requests","Approve extensions, modifications, forbearance","Trigger investor governance proposals","Execute enforcement (special servicing)","Manage reserves, escrows, covenants","Record all actions to audit trail"].map((a) => (
                    <div key={a} className="flex items-start gap-1.5">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bidirectional arrows */}
              <div className="flex flex-col items-center gap-1 pt-8">
                <ArrowRightIcon className="h-5 w-5 text-slate-400" />
                <p className="text-xs text-slate-400 whitespace-nowrap">triggers / reports</p>
                <ArrowRightIcon className="h-5 w-5 text-slate-400 rotate-180" />
                <p className="text-xs text-slate-400 whitespace-nowrap">vote result</p>
              </div>

              {/* Investor column */}
              <div className="flex-1 rounded-xl border border-violet-200 bg-violet-50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <UserGroupIcon className="h-5 w-5 text-violet-500" />
                  <p className="text-sm font-black text-violet-700">Investor Portal</p>
                </div>
                <div className="space-y-2 text-xs text-violet-700">
                  {["View portfolio holdings & distributions","Monitor loan performance (read-only)","Vote on governance proposals","Review risk alerts","Access quarterly reports","No servicing authority"].map((a) => (
                    <div key={a} className="flex items-start gap-1.5">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Flow rules */}
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Routing Conditions</h3>
              <div className="grid grid-cols-3 gap-4 text-xs text-slate-700">
                <div>
                  <p className="font-bold text-slate-900 mb-2">Borrower → Lender</p>
                  <p className="text-slate-600">All borrower submissions route to the lender review queue. Lender can approve, request changes, or reject.</p>
                </div>
                <div>
                  <p className="font-bold text-slate-900 mb-2">Lender → Investor (Conditional)</p>
                  <p className="text-slate-600">Actions that exceed the economic threshold defined in the PSA (e.g. extensions, modifications &gt;15%, dispositions) automatically trigger a governance proposal to investors.</p>
                </div>
                <div>
                  <p className="font-bold text-slate-900 mb-2">Investor Vote → Lender Execution</p>
                  <p className="text-slate-600">When quorum is met and threshold is reached, vote result unlocks lender execution. If threshold fails, lender retains discretionary enforcement authority.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ROUTING RULES ── */}
      {tab === "rules" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">Workflow Trigger Rules</h2>
              <p className="text-xs text-slate-500 mt-0.5">Defines when an action routes to the next portal</p>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                {
                  trigger:"Borrower uploads any document",
                  action:"Creates pending review item in lender queue",
                  portal:"Borrower → Lender",
                  requires_vote:false,
                },
                {
                  trigger:"Borrower submits draw request",
                  action:"Triggers inspection scheduling → Lender review after inspection approval",
                  portal:"Borrower → Lender",
                  requires_vote:false,
                },
                {
                  trigger:"Lender approves maturity extension (any duration)",
                  action:"Creates governance proposal. Vote required before execution.",
                  portal:"Lender → Investor → Lender",
                  requires_vote:true,
                },
                {
                  trigger:"Lender approves loan modification > 15% of UPB",
                  action:"Creates governance proposal. Simple majority (>50%) required.",
                  portal:"Lender → Investor → Lender",
                  requires_vote:true,
                },
                {
                  trigger:"Loan reaches 90 days delinquent",
                  action:"Auto-generates risk alert to investors. Governance proposal for enforcement strategy if UPB > $1M.",
                  portal:"Lender → Investor (alert)",
                  requires_vote:false,
                },
                {
                  trigger:"Collateral disposition / REO sale",
                  action:"Requires 75% supermajority investor vote. Proceeds waterfall calculated post-vote.",
                  portal:"Lender → Investor → Lender",
                  requires_vote:true,
                },
                {
                  trigger:"Distribution payment processed",
                  action:"Investor portal automatically updated. Distribution statement generated.",
                  portal:"Lender → Investor (read)",
                  requires_vote:false,
                },
                {
                  trigger:"Lender approves borrower financial submission",
                  action:"DSCR/LTV recalculated. Performance metrics updated in investor portal.",
                  portal:"Borrower → Lender → Investor (read)",
                  requires_vote:false,
                },
              ].map((rule, i) => (
                <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{rule.trigger}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{rule.action}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {rule.portal}
                    </span>
                    {rule.requires_vote && (
                      <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-xs font-bold text-violet-600">
                        Vote Required
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-700">Implementation Note:</strong> These rules are enforced server-side in the Kontra API through role middleware on each router.
              The borrower and investor portals submit to separate API endpoints which require role-specific JWT claims.
              All workflow events are appended to <code className="font-mono text-slate-700">governance_audit_log</code> for a full, immutable trail.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
