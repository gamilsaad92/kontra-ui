/**
 * Kontra Workflow Engine — Operational Dashboard
 *
 * Phase 1: Enterprise Core
 * Every servicing process is a machine-readable workflow with triggers,
 * steps, approvals, statuses, deadlines, and audit logs.
 *
 * Tabs:
 *   Instances     — Live kanban board of all workflow runs
 *   Templates     — 6 pre-built workflow templates with launch modal
 *   Approvals     — Human approval queue (approve / reject / request changes)
 *   Audit Log     — Immutable chronological trail of every action
 *   API Reference — Headless API docs + webhook configuration
 */

import { useState, useEffect, useCallback } from "react";
import {
  BoltIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CodeBracketIcon,
  BellAlertIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────────────────────

type WFStatus = "queued" | "running" | "needs_review" | "completed" | "failed" | "cancelled";

interface WorkflowRun {
  id: string;
  workflow_type: string;
  template_id?: string;
  status: WFStatus;
  current_step?: string;
  priority: number;
  loan_id?: string;
  loan_ref?: string;
  sla_deadline?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

interface WorkflowStep {
  id: string;
  name: string;
  type: "automated" | "human_approval" | "notification" | "ai_analysis" | "condition" | "external_trigger";
  assigned_role?: string;
  description: string;
  deadline_hours?: number | null;
  next_step?: string | null;
  on_reject?: string | null;
  output_artifact?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger_types: string[];
  sla_hours: number;
  steps: WorkflowStep[];
}

interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  actor_type: "system" | "human" | "ai";
  workflow_type: string;
  action: string;
  entity: string;
  detail: string;
  loan_ref?: string;
}

interface ApprovalItem {
  id: string;
  workflow_run_id: string;
  loan_ref: string;
  workflow_type: string;
  step_name: string;
  description: string;
  requested_by: string;
  requested_at: string;
  deadline: string;
  priority: "critical" | "high" | "normal";
  amount_usd?: number;
}

// ── Demo Data ─────────────────────────────────────────────────────────────────

const DEMO_RUNS: WorkflowRun[] = [
  { id:"wr-001", workflow_type:"borrower_financial_analysis", template_id:"borrower_financial_analysis", status:"needs_review", current_step:"servicer_review", priority:2, loan_ref:"LN-2847", sla_deadline:"2026-04-15T17:00:00Z", created_at:"2026-04-10T09:00:00Z", started_at:"2026-04-10T09:02:00Z" },
  { id:"wr-002", workflow_type:"inspection_review", template_id:"inspection_review", status:"running", current_step:"extract_deficiencies", priority:5, loan_ref:"LN-3301", sla_deadline:"2026-04-14T17:00:00Z", created_at:"2026-04-11T14:00:00Z", started_at:"2026-04-11T14:01:00Z" },
  { id:"wr-003", workflow_type:"covenant_monitoring", template_id:"covenant_monitoring", status:"needs_review", current_step:"cure_review", priority:1, loan_ref:"LN-0094", sla_deadline:"2026-04-13T09:00:00Z", created_at:"2026-04-09T08:00:00Z", started_at:"2026-04-09T08:01:00Z" },
  { id:"wr-004", workflow_type:"maturity_tracking", template_id:"maturity_tracking", status:"queued", current_step:"t90_alert", priority:3, loan_ref:"LN-1122", sla_deadline:"2026-04-20T17:00:00Z", created_at:"2026-04-12T16:00:00Z" },
  { id:"wr-005", workflow_type:"hazard_loss_disbursement", template_id:"hazard_loss_disbursement", status:"running", current_step:"adjuster_coordination", priority:2, loan_ref:"LN-5578", sla_deadline:"2026-04-18T17:00:00Z", created_at:"2026-04-08T10:00:00Z", started_at:"2026-04-08T10:05:00Z" },
  { id:"wr-006", workflow_type:"watchlist_review", template_id:"watchlist_review", status:"completed", current_step:undefined, priority:1, loan_ref:"LN-7734", sla_deadline:"2026-04-10T17:00:00Z", created_at:"2026-04-08T08:00:00Z", started_at:"2026-04-08T08:10:00Z", completed_at:"2026-04-09T16:30:00Z" },
  { id:"wr-007", workflow_type:"inspection_review", template_id:"inspection_review", status:"completed", current_step:undefined, priority:5, loan_ref:"LN-2847", sla_deadline:"2026-04-07T17:00:00Z", created_at:"2026-04-05T09:00:00Z", completed_at:"2026-04-07T11:00:00Z" },
  { id:"wr-008", workflow_type:"covenant_monitoring", template_id:"covenant_monitoring", status:"failed", current_step:"data_pull", priority:3, loan_ref:"LN-4490", sla_deadline:"2026-04-11T09:00:00Z", created_at:"2026-04-11T08:00:00Z", error_message:"Supabase timeout on covenant data fetch" },
];

const DEMO_APPROVALS: ApprovalItem[] = [
  { id:"ap-001", workflow_run_id:"wr-003", loan_ref:"LN-0094", workflow_type:"Covenant Monitoring", step_name:"Cure Review", description:"DSCR covenant breach: 1.08x vs 1.25x threshold. Borrower submitted cure plan. Review and decide.", requested_by:"System", requested_at:"2026-04-11T10:00:00Z", deadline:"2026-04-13T09:00:00Z", priority:"critical" },
  { id:"ap-002", workflow_run_id:"wr-001", loan_ref:"LN-2847", workflow_type:"Borrower Financial Analysis", step_name:"Servicer Review", description:"Q1 2026 financials uploaded. DSCR: 1.34x, Occupancy: 89%. Review AI extraction for accuracy.", requested_by:"System", requested_at:"2026-04-10T09:30:00Z", deadline:"2026-04-15T17:00:00Z", priority:"high", amount_usd:undefined },
  { id:"ap-003", workflow_run_id:"wr-004", loan_ref:"LN-1122", workflow_type:"Maturity Tracking", step_name:"Lender Evaluation", description:"Borrower requests 12-month extension. Extension fee: $125,000. Current DSCR: 1.18x. Investor vote not required (< $5M UPB).", requested_by:"borrower_portal", requested_at:"2026-04-12T14:00:00Z", deadline:"2026-04-20T17:00:00Z", priority:"normal", amount_usd:125000 },
];

const DEMO_AUDIT: AuditEntry[] = [
  { id:"al-001", ts:"2026-04-12T16:05:00Z", actor:"System", actor_type:"system", workflow_type:"maturity_tracking", action:"WORKFLOW_CREATED", entity:"wr-004", detail:"Maturity T-90 alert triggered for LN-1122. Maturity date: 2026-07-12.", loan_ref:"LN-1122" },
  { id:"al-002", ts:"2026-04-12T16:06:00Z", actor:"maturity_monitor", actor_type:"ai", workflow_type:"maturity_tracking", action:"STEP_COMPLETED", entity:"wr-004 / t90_alert", detail:"Payoff quote: $4.2M. Extension eligible (1 remaining). Sponsor liquidity: $890K.", loan_ref:"LN-1122" },
  { id:"al-003", ts:"2026-04-11T14:00:00Z", actor:"System", actor_type:"system", workflow_type:"inspection_review", action:"WORKFLOW_CREATED", entity:"wr-002", detail:"Inspection report uploaded for LN-3301. AI extraction queued.", loan_ref:"LN-3301" },
  { id:"al-004", ts:"2026-04-11T14:12:00Z", actor:"inspection_analyzer", actor_type:"ai", workflow_type:"inspection_review", action:"ARTIFACT_CREATED", entity:"wr-002 / deficiency_list", detail:"7 deficiencies extracted: 1 critical (roof structural), 2 high, 4 low. Estimated cure cost: $145,000.", loan_ref:"LN-3301" },
  { id:"al-005", ts:"2026-04-11T10:00:00Z", actor:"System", actor_type:"system", workflow_type:"covenant_monitoring", action:"COVENANT_BREACH_DETECTED", entity:"LN-0094 / dscr", detail:"DSCR test: 1.08x. Threshold: 1.25x. Breach severity: material. Cure period: 30 days.", loan_ref:"LN-0094" },
  { id:"al-006", ts:"2026-04-11T10:02:00Z", actor:"System", actor_type:"system", workflow_type:"covenant_monitoring", action:"APPROVAL_REQUESTED", entity:"ap-001", detail:"Cure review routed to lender_admin. Deadline: 2026-04-13T09:00Z.", loan_ref:"LN-0094" },
  { id:"al-007", ts:"2026-04-10T09:02:00Z", actor:"financial_extractor", actor_type:"ai", workflow_type:"borrower_financial_analysis", action:"ARTIFACT_CREATED", entity:"wr-001 / financial_summary", detail:"Q1 2026 extraction: NOI $288K, DSCR 1.34x, LTV 68.2%, Occupancy 89%. 2 discrepancies flagged.", loan_ref:"LN-2847" },
  { id:"al-008", ts:"2026-04-09T16:30:00Z", actor:"jamie.chen@kontra.com", actor_type:"human", workflow_type:"watchlist_review", action:"WORKFLOW_APPROVED", entity:"wr-006", detail:"Committee decision: hold with enhanced monitoring. Next review: 90 days. Action plan filed.", loan_ref:"LN-7734" },
  { id:"al-009", ts:"2026-04-08T10:05:00Z", actor:"System", actor_type:"system", workflow_type:"hazard_loss_disbursement", action:"WORKFLOW_CREATED", entity:"wr-005", detail:"Hail damage event filed for LN-5578 / Harbor Blvd. Estimated loss: $280,000. Claim #HC-2847.", loan_ref:"LN-5578" },
  { id:"al-010", ts:"2026-04-08T08:10:00Z", actor:"risk_scorer", actor_type:"ai", workflow_type:"watchlist_review", action:"ARTIFACT_CREATED", entity:"wr-006 / risk_score_memo", detail:"Risk score: 67/100 (Substandard). Key drivers: 94d delinquency, DSCR 0.98x, capex reserve depleted.", loan_ref:"LN-7734" },
];

const DEMO_TEMPLATES: WorkflowTemplate[] = [
  {
    id:"inspection_review", name:"Inspection Review", category:"servicing",
    description:"Property inspection lifecycle: scheduling → site visit → deficiency extraction → approval → cure tracking.",
    trigger_types:["inspection-uploaded","draw-submitted"], sla_hours:72,
    steps:[
      { id:"sched", name:"Schedule Inspection", type:"human_approval", assigned_role:"servicer", description:"Assign inspector and schedule visit.", deadline_hours:24, next_step:"site_visit" },
      { id:"site_visit", name:"Site Visit", type:"external_trigger", description:"Inspector uploads report.", deadline_hours:96, next_step:"extract_deficiencies" },
      { id:"extract_deficiencies", name:"AI Deficiency Extraction", type:"ai_analysis", description:"AI reads report, extracts deficiencies.", deadline_hours:2, output_artifact:"deficiency_list", next_step:"deficiency_review" },
      { id:"deficiency_review", name:"Deficiency Review", type:"human_approval", assigned_role:"servicer", description:"Confirm severity and cure deadlines.", deadline_hours:48, next_step:"borrower_notification" },
      { id:"borrower_notification", name:"Notify Borrower", type:"notification", description:"Send deficiency report to borrower.", deadline_hours:4, next_step:"cure_monitoring" },
      { id:"cure_monitoring", name:"Cure Monitoring", type:"automated", description:"Track cure deadlines, escalate at T-7.", deadline_hours:null, next_step:"final_approval" },
      { id:"final_approval", name:"Final Sign-Off", type:"human_approval", assigned_role:"lender_admin", description:"Lender signs off all deficiencies cured.", deadline_hours:24, next_step:null },
    ],
  },
  {
    id:"hazard_loss_disbursement", name:"Hazard Loss Disbursement", category:"servicing",
    description:"Insurance claim processing: event filing → adjuster → reserve calculation → controlled disbursement.",
    trigger_types:["hazard-loss-filed"], sla_hours:120,
    steps:[
      { id:"claim_intake", name:"Claim Intake", type:"human_approval", assigned_role:"servicer", description:"Record event, file with insurer.", deadline_hours:24, next_step:"adjuster_coordination" },
      { id:"adjuster_coordination", name:"Adjuster Report", type:"external_trigger", description:"Wait for adjuster report.", deadline_hours:336, next_step:"reserve_calculation" },
      { id:"reserve_calculation", name:"Reserve Calculation", type:"ai_analysis", description:"Calculate disbursement and holdback.", deadline_hours:4, output_artifact:"disbursement_schedule", next_step:"lender_approval" },
      { id:"lender_approval", name:"Lender Approval", type:"human_approval", assigned_role:"lender_admin", description:"Approve disbursement and holdback.", deadline_hours:48, next_step:"investor_notification" },
      { id:"investor_notification", name:"Investor Notification", type:"notification", description:"Notify investors of material event.", deadline_hours:4, next_step:"disbursement_execution" },
      { id:"disbursement_execution", name:"Execute Disbursement", type:"human_approval", assigned_role:"servicer", description:"Wire funds, record disbursement.", deadline_hours:24, next_step:"repair_monitoring" },
      { id:"repair_monitoring", name:"Repair Monitoring", type:"automated", description:"Monitor repairs for holdback release.", deadline_hours:null, next_step:null },
    ],
  },
  {
    id:"watchlist_review", name:"Watchlist Review", category:"risk",
    description:"At-risk loan monitoring: data aggregation → AI risk scoring → committee review → action plan → investor alert.",
    trigger_types:["watchlist-added","delinquency-threshold"], sla_hours:48,
    steps:[
      { id:"data_aggregation", name:"Data Aggregation", type:"automated", description:"Pull all loan data for review.", deadline_hours:2, next_step:"risk_scoring" },
      { id:"risk_scoring", name:"AI Risk Scoring", type:"ai_analysis", description:"Generate risk score 1-100.", deadline_hours:4, output_artifact:"risk_score_memo", next_step:"servicer_assessment" },
      { id:"servicer_assessment", name:"Servicer Assessment", type:"human_approval", assigned_role:"servicer", description:"Review and confirm risk rating.", deadline_hours:24, next_step:"committee_review" },
      { id:"committee_review", name:"Committee Review", type:"human_approval", assigned_role:"lender_admin", description:"Credit committee decides action.", deadline_hours:48, next_step:"action_execution" },
      { id:"action_execution", name:"Execute Action Plan", type:"automated", description:"Route to sub-workflow.", deadline_hours:4, next_step:"investor_alert" },
      { id:"investor_alert", name:"Investor Alert", type:"notification", description:"Send risk alert to investor portal.", deadline_hours:4, next_step:null },
    ],
  },
  {
    id:"borrower_financial_analysis", name:"Borrower Financial Analysis", category:"servicing",
    description:"Annual/quarterly financial review: upload → AI extraction → DSCR/LTV calculation → covenant check → approval.",
    trigger_types:["financial-uploaded","annual-review-due"], sla_hours:96,
    steps:[
      { id:"document_validation", name:"Document Validation", type:"ai_analysis", description:"Verify package completeness.", deadline_hours:2, output_artifact:"document_checklist", next_step:"ai_extraction" },
      { id:"ai_extraction", name:"AI Financial Extraction", type:"ai_analysis", description:"Extract NOI, DSCR, LTV, occupancy.", deadline_hours:4, output_artifact:"financial_summary", next_step:"covenant_check" },
      { id:"covenant_check", name:"Covenant Check", type:"automated", description:"Test all active covenants.", deadline_hours:1, output_artifact:"covenant_status", next_step:"servicer_review" },
      { id:"servicer_review", name:"Servicer Review", type:"human_approval", assigned_role:"servicer", description:"Verify figures, note discrepancies.", deadline_hours:48, next_step:"lender_approval" },
      { id:"lender_approval", name:"Lender Approval", type:"human_approval", assigned_role:"lender_admin", description:"Approve updated financials.", deadline_hours:48, next_step:"metrics_update" },
      { id:"metrics_update", name:"Update Metrics", type:"automated", description:"Push DSCR/LTV to all portals.", deadline_hours:1, next_step:"borrower_confirmation" },
      { id:"borrower_confirmation", name:"Borrower Confirmation", type:"notification", description:"Send receipt and covenant notices.", deadline_hours:4, next_step:null },
    ],
  },
  {
    id:"maturity_tracking", name:"Maturity Tracking & Extension", category:"risk",
    description:"From T-90 alert through payoff or extension, including investor vote when required by PSA.",
    trigger_types:["maturity-t90","extension-requested"], sla_hours:168,
    steps:[
      { id:"t90_alert", name:"T-90 Alert", type:"automated", description:"Generate payoff quote and analysis.", deadline_hours:4, output_artifact:"maturity_analysis", next_step:"borrower_outreach" },
      { id:"borrower_outreach", name:"Borrower Outreach", type:"notification", description:"Send maturity notice and options.", deadline_hours:4, next_step:"borrower_response" },
      { id:"borrower_response", name:"Await Response", type:"external_trigger", description:"Wait for borrower to respond.", deadline_hours:336, next_step:"lender_evaluation" },
      { id:"lender_evaluation", name:"Lender Evaluation", type:"human_approval", assigned_role:"lender_admin", description:"Evaluate extension request.", deadline_hours:120, next_step:"investor_vote_check" },
      { id:"investor_vote_check", name:"Investor Vote Check", type:"condition", description:"Is investor vote required?", next_step:"execute_extension" },
      { id:"investor_vote", name:"Investor Vote", type:"external_trigger", description:"Governance proposal in investor portal.", deadline_hours:504, next_step:"execute_extension" },
      { id:"execute_extension", name:"Execute Extension", type:"human_approval", assigned_role:"servicer", description:"Process docs, collect fee, update maturity.", deadline_hours:48, next_step:"notification_close" },
      { id:"notification_close", name:"Close & Notify", type:"notification", description:"Confirm and archive workflow.", deadline_hours:4, next_step:null },
    ],
  },
  {
    id:"covenant_monitoring", name:"Covenant Monitoring", category:"compliance",
    description:"Scheduled covenant test cycle: automated data pull → violation detection → cure period → escalation.",
    trigger_types:["covenant-test-due","covenant-breach"], sla_hours:24,
    steps:[
      { id:"data_pull", name:"Pull Data", type:"automated", description:"Fetch financials and market data.", deadline_hours:2, next_step:"calculate_covenants" },
      { id:"calculate_covenants", name:"Calculate Covenants", type:"automated", description:"Run all covenant tests.", deadline_hours:1, output_artifact:"covenant_test_results", next_step:"violation_check" },
      { id:"violation_check", name:"Violation Check", type:"condition", description:"Any covenants failing?", next_step:"log_passing" },
      { id:"log_passing", name:"Log Results", type:"automated", description:"Record to audit log.", deadline_hours:1, next_step:null },
      { id:"violation_notification", name:"Violation Alert", type:"notification", description:"Alert servicer and lender.", deadline_hours:2, next_step:"cure_period" },
      { id:"cure_period", name:"Cure Monitoring", type:"automated", description:"Track cure period, send reminders.", deadline_hours:null, next_step:"cure_review" },
      { id:"cure_review", name:"Cure Review", type:"human_approval", assigned_role:"lender_admin", description:"Accept cure or declare default.", deadline_hours:48, next_step:"watchlist_check" },
      { id:"investor_breach_alert", name:"Investor Breach Notice", type:"notification", description:"Notify investors of material breach.", deadline_hours:4, next_step:null },
    ],
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<WFStatus, { label:string; color:string; bg:string; border:string; icon: typeof ClockIcon }> = {
  queued:       { label:"Queued",       color:"text-slate-600",   bg:"bg-slate-100",   border:"border-slate-300",   icon:ClockIcon },
  running:      { label:"Running",      color:"text-blue-700",    bg:"bg-blue-50",     border:"border-blue-200",    icon:ArrowPathIcon },
  needs_review: { label:"Needs Review", color:"text-amber-700",   bg:"bg-amber-50",    border:"border-amber-300",   icon:ExclamationTriangleIcon },
  completed:    { label:"Completed",    color:"text-emerald-700", bg:"bg-emerald-50",  border:"border-emerald-200", icon:CheckCircleIcon },
  failed:       { label:"Failed",       color:"text-red-700",     bg:"bg-red-50",      border:"border-red-200",     icon:XCircleIcon },
  cancelled:    { label:"Cancelled",    color:"text-slate-500",   bg:"bg-slate-50",    border:"border-slate-200",   icon:XCircleIcon },
};

const STEP_TYPE_CFG: Record<string, { label:string; color:string; icon: typeof BoltIcon }> = {
  automated:       { label:"Automated",      color:"text-blue-600",   icon:BoltIcon },
  human_approval:  { label:"Human Approval", color:"text-amber-600",  icon:UserCircleIcon },
  notification:    { label:"Notification",   color:"text-violet-600", icon:BellAlertIcon },
  ai_analysis:     { label:"AI Analysis",    color:"text-emerald-600",icon:SparklesIcon },
  condition:       { label:"Condition",      color:"text-slate-600",  icon:ChevronRightIcon },
  external_trigger:{ label:"External",       color:"text-orange-600", icon:ArrowTopRightOnSquareIcon },
};

const CATEGORY_CFG: Record<string, { label:string; icon: typeof BoltIcon; color:string }> = {
  servicing:      { label:"Servicing",      icon:WrenchScrewdriverIcon, color:"text-brand-600" },
  risk:           { label:"Risk",           icon:ExclamationTriangleIcon,color:"text-amber-600" },
  compliance:     { label:"Compliance",     icon:ShieldCheckIcon,        color:"text-emerald-600" },
  capital_markets:{ label:"Capital Mkts",  icon:ChartBarIcon,            color:"text-violet-600" },
  operations:     { label:"Operations",    icon:CurrencyDollarIcon,      color:"text-slate-600" },
};

const HEADLESS_API_ENDPOINTS = [
  { method:"GET",  path:"/api/workflows",                  desc:"List all workflow runs with status/type filters" },
  { method:"POST", path:"/api/workflows",                  desc:"Create and queue a new workflow run" },
  { method:"GET",  path:"/api/workflows/:id",              desc:"Get run detail with steps and artifacts" },
  { method:"POST", path:"/api/workflows/:id/retry",        desc:"Retry a failed or cancelled workflow" },
  { method:"POST", path:"/api/workflows/:id/cancel",       desc:"Cancel a queued or running workflow" },
  { method:"GET",  path:"/api/workflow-templates",         desc:"List all 6 machine-readable workflow templates" },
  { method:"POST", path:"/api/workflows/from-template",    desc:"Launch workflow from template with loan_id context" },
  { method:"POST", path:"/api/reviews/:workflowId/approve",desc:"Human approves workflow output" },
  { method:"POST", path:"/api/reviews/:workflowId/reject", desc:"Human rejects workflow output" },
  { method:"POST", path:"/api/triggers/financial-uploaded",desc:"Trigger: borrower financial package uploaded" },
  { method:"POST", path:"/api/triggers/inspection-uploaded",desc:"Trigger: inspection report uploaded" },
  { method:"POST", path:"/api/triggers/draw-submitted",    desc:"Trigger: construction draw request submitted" },
  { method:"POST", path:"/api/triggers/covenant-breach",   desc:"Trigger: covenant violation detected" },
  { method:"POST", path:"/api/triggers/occupancy-alert",   desc:"Trigger: occupancy below threshold" },
  { method:"POST", path:"/api/agents/callback",            desc:"Agent posts back step result (external agent integration)" },
  { method:"GET",  path:"/api/webhooks",                   desc:"List webhook subscriptions for this org" },
  { method:"POST", path:"/api/webhooks",                   desc:"Register new webhook endpoint (event, url)" },
  { method:"DELETE",path:"/api/webhooks",                  desc:"Remove webhook subscription" },
  { method:"GET",  path:"/api/webhooks/topics",            desc:"List all available webhook event types" },
];

const WEBHOOK_EVENT_TYPES = [
  "workflow.created", "workflow.step_completed", "workflow.approval_required",
  "workflow.completed", "workflow.failed",
  "loan.delinquent", "loan.maturity_approaching",
  "covenant.breached", "covenant.cured",
  "draw.submitted", "draw.approved", "draw.rejected",
  "inspection.uploaded", "inspection.deficiency_critical",
  "financial.uploaded", "financial.approved",
  "hazard.loss_filed", "hazard.disbursement_approved",
  "distribution.processed", "investor.vote_required",
];

type Tab = "instances" | "templates" | "approvals" | "audit" | "api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}
function relTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function slaColor(deadline?: string) {
  if (!deadline) return "text-slate-400";
  const hrs = (new Date(deadline).getTime() - Date.now()) / 3600000;
  if (hrs < 0) return "text-red-600 font-black";
  if (hrs < 24) return "text-red-500 font-bold";
  if (hrs < 72) return "text-amber-600 font-semibold";
  return "text-slate-500";
}
function slaLabel(deadline?: string) {
  if (!deadline) return "No SLA";
  const hrs = (new Date(deadline).getTime() - Date.now()) / 3600000;
  if (hrs < 0) return "SLA BREACHED";
  if (hrs < 1) return "< 1h left";
  if (hrs < 24) return `${Math.round(hrs)}h left`;
  return `${Math.round(hrs / 24)}d left`;
}
function humanReadableType(t: string) {
  return t.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const METHOD_COLOR: Record<string, string> = {
  GET:"text-emerald-700 bg-emerald-50 border-emerald-200",
  POST:"text-blue-700 bg-blue-50 border-blue-200",
  DELETE:"text-red-700 bg-red-50 border-red-200",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: WFStatus }) {
  const cfg = STATUS_CFG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function StepTypePill({ type }: { type: string }) {
  const cfg = STEP_TYPE_CFG[type] ?? STEP_TYPE_CFG.automated;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function LaunchModal({ template, onClose }: { template: WorkflowTemplate; onClose: () => void }) {
  const [loanRef, setLoanRef] = useState("");
  const [launched, setLaunched] = useState(false);

  function launch() {
    setLaunched(true);
    setTimeout(onClose, 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{CATEGORY_CFG[template.category]?.label}</p>
            <h2 className="text-lg font-black text-white">{template.name}</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ClockIcon className="h-4 w-4" />
            SLA {template.sla_hours}h
          </div>
        </div>
        <p className="text-sm text-slate-400 mb-5">{template.description}</p>

        <div className="space-y-3 mb-6">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Loan Reference</label>
            <input
              type="text" placeholder="e.g. LN-2847"
              value={loanRef} onChange={(e) => setLoanRef(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-bold text-slate-400 mb-2">{template.steps.length} steps in this workflow</p>
            <div className="space-y-1.5">
              {template.steps.slice(0,4).map((step, i) => (
                <div key={step.id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-4 text-right">{i+1}.</span>
                  <StepTypePill type={step.type} />
                  <span className="text-xs text-slate-400">{step.name}</span>
                  {step.deadline_hours && <span className="text-xs text-slate-600 ml-auto">{step.deadline_hours}h</span>}
                </div>
              ))}
              {template.steps.length > 4 && (
                <p className="text-xs text-slate-600 pl-6">+{template.steps.length - 4} more steps…</p>
              )}
            </div>
          </div>
        </div>

        {launched ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-900/40 border border-emerald-700/40 px-4 py-3">
            <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">Workflow queued successfully</span>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={launch}
              disabled={!loanRef.trim()}
              className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-white transition-colors disabled:opacity-40"
            >
              <PlayIcon className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              Launch Workflow
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkflowEnginePage() {
  const [tab, setTab] = useState<Tab>("instances");
  const [runs, setRuns] = useState<WorkflowRun[]>(DEMO_RUNS);
  const [approvals, setApprovals] = useState<ApprovalItem[]>(DEMO_APPROVALS);
  const [statusFilter, setStatusFilter] = useState<WFStatus | "all">("all");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [launchTemplate, setLaunchTemplate] = useState<WorkflowTemplate | null>(null);
  const [approvalAction, setApprovalAction] = useState<Record<string, "approve"|"reject"|"changes"|null>>({});
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [reviewedApprovals, setReviewedApprovals] = useState<Set<string>>(new Set());
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookSaved, setWebhookSaved] = useState(false);

  const filteredRuns = statusFilter === "all" ? runs : runs.filter((r) => r.status === statusFilter);

  const statusCounts = runs.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function submitApproval(apId: string, action: "approve"|"reject"|"changes") {
    setReviewedApprovals((prev) => new Set([...prev, apId]));
    setApprovals((prev) => prev.filter((a) => a.id !== apId));
  }

  const kanbanCols: { status: WFStatus; label: string }[] = [
    { status:"queued",       label:"Queued" },
    { status:"running",      label:"Running" },
    { status:"needs_review", label:"Needs Review" },
    { status:"completed",    label:"Completed" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background:"#800020" }}>
              <BoltIcon className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-900">Workflow Engine</h1>
            <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              Phase 1 Active
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Every servicing process is a machine-readable workflow — triggers, steps, human approvals, AI agents, deadlines, and audit logs.
            Headless API + webhooks for external integration.
          </p>
        </div>
        <button
          onClick={() => setTab("templates")}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Workflow
        </button>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          { status:"all",         label:"Total",        value:runs.length,              color:"text-slate-900",   bg:"bg-slate-50",   border:"border-slate-200" },
          { status:"needs_review",label:"Needs Review", value:statusCounts.needs_review??0, color:"text-amber-700",   bg:"bg-amber-50",   border:"border-amber-200" },
          { status:"running",     label:"Running",      value:statusCounts.running??0,  color:"text-blue-700",    bg:"bg-blue-50",    border:"border-blue-200" },
          { status:"queued",      label:"Queued",       value:statusCounts.queued??0,   color:"text-slate-600",   bg:"bg-slate-50",   border:"border-slate-200" },
          { status:"failed",      label:"Failed",       value:statusCounts.failed??0,   color:"text-red-700",     bg:"bg-red-50",     border:"border-red-200" },
        ] as { status:WFStatus|"all"; label:string; value:number; color:string; bg:string; border:string }[]).map((s) => (
          <button
            key={s.status}
            onClick={() => setStatusFilter(s.status)}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${s.bg} ${s.border} ${statusFilter === s.status ? "ring-2 ring-slate-900 ring-offset-1" : "hover:ring-1 hover:ring-slate-300"}`}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
            <p className={`mt-0.5 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 overflow-x-auto">
          {([
            ["instances","Instances"],
            ["templates","Templates"],
            ["approvals",`Approvals${approvals.length > 0 ? ` (${approvals.length})` : ""}`],
            ["audit","Audit Log"],
            ["api","API & Webhooks"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
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

      {/* ══ INSTANCES ══════════════════════════════════════════════════════════ */}
      {tab === "instances" && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filter:</span>
            {(["all","queued","running","needs_review","completed","failed"] as (WFStatus|"all")[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  statusFilter === s
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-500 hover:border-slate-400"
                }`}
              >
                {s === "all" ? "All" : STATUS_CFG[s as WFStatus].label}
              </button>
            ))}
          </div>

          {/* Kanban board (collapsed to list when filtered) */}
          {statusFilter === "all" ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {kanbanCols.map((col) => {
                const colRuns = runs.filter((r) => r.status === col.status);
                const cfg = STATUS_CFG[col.status];
                return (
                  <div key={col.status} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className={`text-xs font-black uppercase tracking-widest ${cfg.color}`}>{col.label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${cfg.color}`}>{colRuns.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colRuns.map((run) => (
                        <div
                          key={run.id}
                          onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                          className="rounded-lg border border-white/60 bg-white shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow"
                        >
                          <p className="text-xs font-black text-slate-700">{run.loan_ref}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{humanReadableType(run.workflow_type)}</p>
                          {run.current_step && (
                            <p className="text-xs text-blue-600 mt-1.5 font-semibold">▶ {humanReadableType(run.current_step)}</p>
                          )}
                          <p className={`text-xs mt-1.5 ${slaColor(run.sla_deadline)}`}>
                            {slaLabel(run.sla_deadline)}
                          </p>
                          {run.priority <= 2 && (
                            <span className="inline-block mt-1.5 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-xs font-bold text-red-600">High Priority</span>
                          )}
                        </div>
                      ))}
                      {colRuns.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">No workflows</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRuns.map((run) => {
                const expanded = expandedRun === run.id;
                return (
                  <div key={run.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedRun(expanded ? null : run.id)}
                    >
                      <div className="flex items-center gap-4 px-5 py-4">
                        <StatusPill status={run.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900">
                            {humanReadableType(run.workflow_type)}
                            {run.loan_ref && <span className="ml-2 font-normal text-slate-500">— {run.loan_ref}</span>}
                          </p>
                          {run.current_step && (
                            <p className="text-xs text-blue-600 mt-0.5">Current step: {humanReadableType(run.current_step)}</p>
                          )}
                          {run.error_message && (
                            <p className="text-xs text-red-500 mt-0.5 truncate">{run.error_message}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 shrink-0 text-xs text-slate-500">
                          <span className={slaColor(run.sla_deadline)}>{slaLabel(run.sla_deadline)}</span>
                          <span>P{run.priority}</span>
                          <span>{relTime(run.created_at)}</span>
                          <ChevronDownIcon className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 grid grid-cols-3 gap-4 text-sm">
                        <div><p className="text-xs font-bold text-slate-400 mb-1">Workflow ID</p><p className="font-mono text-xs text-slate-700">{run.id}</p></div>
                        <div><p className="text-xs font-bold text-slate-400 mb-1">Created</p><p>{fmt(run.created_at)}</p></div>
                        <div><p className="text-xs font-bold text-slate-400 mb-1">SLA Deadline</p><p className={slaColor(run.sla_deadline)}>{run.sla_deadline ? fmt(run.sla_deadline) : "None"}</p></div>
                        {run.started_at && <div><p className="text-xs font-bold text-slate-400 mb-1">Started</p><p>{fmt(run.started_at)}</p></div>}
                        {run.completed_at && <div><p className="text-xs font-bold text-slate-400 mb-1">Completed</p><p>{fmt(run.completed_at)}</p></div>}
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-1">Actions</p>
                          <div className="flex gap-2">
                            {run.status === "failed" && (
                              <button
                                onClick={() => setRuns((prev) => prev.map((r) => r.id === run.id ? { ...r, status:"queued" } : r))}
                                className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                              >
                                <ArrowPathIcon className="h-3 w-3 inline mr-1" />Retry
                              </button>
                            )}
                            {["queued","running"].includes(run.status) && (
                              <button
                                onClick={() => setRuns((prev) => prev.map((r) => r.id === run.id ? { ...r, status:"cancelled" } : r))}
                                className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TEMPLATES ══════════════════════════════════════════════════════════ */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{DEMO_TEMPLATES.length} workflow templates across {new Set(DEMO_TEMPLATES.map((t) => t.category)).size} categories</p>
          </div>
          {DEMO_TEMPLATES.map((t) => {
            const catCfg = CATEGORY_CFG[t.category];
            const CatIcon = catCfg?.icon ?? BoltIcon;
            const expanded = expandedTemplate === t.id;
            return (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedTemplate(expanded ? null : t.id)}
                >
                  <div className="flex items-start gap-4 px-6 py-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 shrink-0">
                      <CatIcon className={`h-5 w-5 ${catCfg?.color ?? "text-slate-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-black text-slate-900">{t.name}</p>
                        <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">
                          {catCfg?.label ?? t.category}
                        </span>
                        <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                          {t.steps.length} steps · SLA {t.sla_hours}h
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">{t.description}</p>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {t.trigger_types.map((tt) => (
                          <span key={tt} className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-mono text-blue-600">{tt}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setLaunchTemplate(t); }}
                        className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 transition-colors"
                      >
                        <PlayIcon className="h-3.5 w-3.5" />
                        Launch
                      </button>
                      <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-slate-100 px-6 py-5 bg-slate-50">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Execution Steps</p>
                    <div className="relative">
                      {/* Vertical connector */}
                      <div className="absolute left-4 top-5 bottom-5 w-px bg-slate-200" />
                      <div className="space-y-3">
                        {t.steps.map((step, i) => {
                          const stepCfg = STEP_TYPE_CFG[step.type] ?? STEP_TYPE_CFG.automated;
                          const StepIcon = stepCfg.icon;
                          return (
                            <div key={step.id} className="flex items-start gap-4 relative">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white ${
                                step.type === "human_approval" ? "bg-amber-100" :
                                step.type === "ai_analysis"   ? "bg-emerald-100" :
                                step.type === "notification"  ? "bg-violet-100" :
                                "bg-slate-100"
                              } shadow-sm z-10`}>
                                <StepIcon className={`h-3.5 w-3.5 ${stepCfg.color}`} />
                              </div>
                              <div className="flex-1 rounded-lg border border-white bg-white px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-sm font-bold text-slate-800">{step.name}</p>
                                  <StepTypePill type={step.type} />
                                  {step.assigned_role && (
                                    <span className="text-xs text-amber-600 font-semibold">→ {step.assigned_role}</span>
                                  )}
                                  {step.deadline_hours && (
                                    <span className="ml-auto text-xs text-slate-400 font-mono">{step.deadline_hours}h</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">{step.description}</p>
                                {step.output_artifact && (
                                  <span className="inline-block mt-1.5 text-xs text-emerald-600 font-mono">→ artifact: {step.output_artifact}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ APPROVALS ══════════════════════════════════════════════════════════ */}
      {tab === "approvals" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Human approval queue — all pending steps requiring review before workflow can continue.</p>
          {approvals.length === 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
              <CheckCircleIcon className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-700">Approval queue is clear</p>
              <p className="text-xs text-emerald-600 mt-1">All workflow steps have been reviewed.</p>
            </div>
          )}
          {approvals.map((ap) => {
            const action = approvalAction[ap.id];
            const notes = approvalNotes[ap.id] ?? "";
            const isOverdue = new Date(ap.deadline) < new Date();
            const PriorityIcon = ap.priority === "critical" ? ExclamationTriangleIcon : ap.priority === "high" ? ExclamationTriangleIcon : ClockIcon;

            return (
              <div key={ap.id} className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                ap.priority === "critical" ? "border-red-300" :
                ap.priority === "high" ? "border-amber-300" :
                "border-slate-200"
              }`}>
                {/* Header */}
                <div className={`flex items-start gap-4 px-6 py-5 ${
                  ap.priority === "critical" ? "bg-red-50" :
                  ap.priority === "high" ? "bg-amber-50" :
                  "bg-white"
                }`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    ap.priority === "critical" ? "bg-red-100" :
                    ap.priority === "high" ? "bg-amber-100" :
                    "bg-slate-100"
                  }`}>
                    <PriorityIcon className={`h-5 w-5 ${
                      ap.priority === "critical" ? "text-red-600" :
                      ap.priority === "high" ? "text-amber-600" :
                      "text-slate-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-black uppercase ${
                        ap.priority === "critical" ? "text-red-700 bg-red-100 border-red-300" :
                        ap.priority === "high" ? "text-amber-700 bg-amber-100 border-amber-300" :
                        "text-slate-500 bg-slate-100 border-slate-200"
                      }`}>{ap.priority}</span>
                      <span className="text-xs font-bold text-slate-600">{ap.loan_ref}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{ap.workflow_type}</span>
                    </div>
                    <p className="text-sm font-black text-slate-900">{ap.step_name}</p>
                    <p className="text-sm text-slate-600 mt-1">{ap.description}</p>
                    {ap.amount_usd && (
                      <p className="text-sm font-bold text-slate-900 mt-1">
                        Amount: ${ap.amount_usd.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">Due</p>
                    <p className={`text-xs font-bold ${isOverdue ? "text-red-600" : "text-slate-700"}`}>
                      {isOverdue ? "OVERDUE" : fmt(ap.deadline)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Ref: {ap.workflow_run_id}</p>
                  </div>
                </div>

                {/* Review area */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 space-y-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Review Notes (optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Add context, conditions, or rejection reason…"
                      value={notes}
                      onChange={(e) => setApprovalNotes((prev) => ({ ...prev, [ap.id]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitApproval(ap.id, "approve")}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition-colors"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => submitApproval(ap.id, "changes")}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Request Changes
                    </button>
                    <button
                      onClick={() => submitApproval(ap.id, "reject")}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 transition-colors"
                    >
                      <XCircleIcon className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ AUDIT LOG ══════════════════════════════════════════════════════════ */}
      {tab === "audit" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Immutable Audit Trail</h2>
                <p className="text-xs text-slate-500 mt-0.5">Every workflow action, AI decision, and human review — append-only, timestamped.</p>
              </div>
              <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                {DEMO_AUDIT.length} entries (demo)
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {DEMO_AUDIT.map((entry) => {
                const actorColor = entry.actor_type === "ai" ? "text-emerald-600 bg-emerald-50" :
                                   entry.actor_type === "human" ? "text-amber-600 bg-amber-50" :
                                   "text-slate-600 bg-slate-100";
                const actorLabel = entry.actor_type === "ai" ? "AI" : entry.actor_type === "human" ? "Human" : "System";
                return (
                  <div key={entry.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="shrink-0 text-right min-w-[80px]">
                      <p className="text-xs font-mono text-slate-400">{fmt(entry.ts)}</p>
                    </div>
                    <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${actorColor}`}>{actorLabel}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-xs font-black text-slate-700 font-mono">{entry.action}</p>
                        {entry.loan_ref && (
                          <span className="text-xs text-slate-400">{entry.loan_ref}</span>
                        )}
                        <span className="text-xs text-blue-500 truncate max-w-[200px]">{entry.entity}</span>
                      </div>
                      <p className="text-sm text-slate-600">{entry.detail}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{entry.actor}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ API & WEBHOOKS ══════════════════════════════════════════════════════ */}
      {tab === "api" && (
        <div className="space-y-6">
          {/* Header banner */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
            <div className="flex items-start gap-4">
              <CodeBracketIcon className="h-8 w-8 text-slate-400 shrink-0 mt-1" />
              <div>
                <h2 className="text-base font-black text-white">Headless API — Enterprise Integration Layer</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Every Kontra action is accessible via REST API. External systems, agent frameworks, and data pipelines
                  can trigger workflows, read statuses, post agent callbacks, and receive real-time events via webhooks.
                </p>
                <div className="flex gap-3 mt-3">
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-mono text-slate-300">Base URL: /api</span>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-mono text-slate-300">Auth: Bearer {"{jwt}"}</span>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-mono text-slate-300">Tenant: X-Org-Id header</span>
                </div>
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">API Endpoints</h2>
              <p className="text-xs text-slate-500 mt-0.5">{HEADLESS_API_ENDPOINTS.length} endpoints — all multi-tenant, org-scoped</p>
            </div>
            <div className="divide-y divide-slate-50">
              {HEADLESS_API_ENDPOINTS.map((ep, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors">
                  <span className={`rounded border px-2 py-0.5 text-xs font-black font-mono w-16 text-center ${METHOD_COLOR[ep.method] ?? "text-slate-600 bg-slate-50 border-slate-200"}`}>
                    {ep.method}
                  </span>
                  <code className="text-xs font-mono text-slate-700 flex-1">{ep.path}</code>
                  <p className="text-xs text-slate-500 text-right max-w-xs">{ep.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook configuration */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <BellAlertIcon className="h-4 w-4 text-violet-500" />
                <h2 className="text-sm font-bold text-slate-900">Webhook Configuration</h2>
              </div>
              <p className="text-xs text-slate-500">Register external endpoints to receive real-time workflow events. Delivered with HMAC-SHA256 signature.</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Endpoint URL</label>
                  <input
                    type="url" placeholder="https://your-system.com/webhooks/kontra"
                    value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">
                    Event Types ({webhookEvents.length} selected)
                  </label>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-slate-50">
                    {WEBHOOK_EVENT_TYPES.map((ev) => (
                      <label key={ev} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={webhookEvents.includes(ev)}
                          onChange={(e) => setWebhookEvents((prev) => e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev))}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
                        />
                        <span className="text-xs font-mono text-slate-600 group-hover:text-slate-900 transition-colors">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {webhookSaved ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-700">Webhook registered — HMAC secret generated</span>
                </div>
              ) : (
                <button
                  disabled={!webhookUrl.trim() || webhookEvents.length === 0}
                  onClick={() => { setWebhookSaved(true); setTimeout(() => setWebhookSaved(false), 4000); }}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  Register Webhook
                </button>
              )}
            </div>
          </div>

          {/* Canonical entity schema reference */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <DocumentTextIcon className="h-4 w-4 text-blue-500" />
                <h2 className="text-sm font-bold text-slate-900">Canonical Data Architecture</h2>
              </div>
              <p className="text-xs text-slate-500">Phase 1 standardizes all loan servicing entities across the platform.</p>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[
                { group:"Parties & Collateral", entities:["borrowers","properties","organizations"] },
                { group:"Servicing Operations", entities:["payments","draws","inspections","deficiencies","escrows","reserves","borrower_financials"] },
                { group:"Risk & Compliance", entities:["covenants","maturities","watchlist_items","compliance_items","risk_items"] },
                { group:"Events & Incidents", entities:["hazard_loss_events","regulatory_scans","document_reviews"] },
                { group:"Workflow Layer", entities:["workflow_runs","agent_steps","agent_artifacts","human_reviews","approvals"] },
                { group:"Capital Markets", entities:["pools","tokens","trades","pool_investments","token_valuations"] },
              ].map((grp) => (
                <div key={grp.group} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">{grp.group}</p>
                  <div className="space-y-1">
                    {grp.entities.map((e) => (
                      <p key={e} className="text-xs font-mono text-slate-700">{e}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Launch Modal ── */}
      {launchTemplate && (
        <LaunchModal template={launchTemplate} onClose={() => setLaunchTemplate(null)} />
      )}
    </div>
  );
}
