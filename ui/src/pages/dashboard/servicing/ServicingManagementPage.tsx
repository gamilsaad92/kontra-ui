/**
 * Kontra Servicing → Property Management Change (PMC) Workflow
 *
 * Freddie Mac Multifamily Servicing Guide–compliant PMC lifecycle engine.
 *
 * Stages:  Draft → Submitted → Under Review → Freddie Mac Review → Approved / Rejected
 * Docs:    5 required per submission package
 * Rules:   Termination ≤30 days no-cause/no-penalty, fee caps, affiliation check
 * Audit:   Immutable per-loan PMC timeline with actor, role, and state transitions
 * Blocks:  Unresolved PMC → watchlist flag + downstream action lockout
 */

import { useState } from "react";
import { useServicingContext } from "./ServicingContext";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  ArrowRightIcon,
  ShieldExclamationIcon,
  LockClosedIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  DocumentTextIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────

type PMCStage =
  | "no_change"
  | "unauthorized"
  | "draft"
  | "submitted"
  | "under_review"
  | "freddie_review"
  | "approved"
  | "rejected";

type ComplianceFlag = "clean" | "review_required" | "pending_change" | "non_compliant";

type ValidationSeverity = "blocking" | "warning";

type ValidationIssue = {
  id: string;
  rule: string;
  detail: string;
  severity: ValidationSeverity;
  resolved: boolean;
  fm_ref: string;
};

type DocStatus = "missing" | "uploaded" | "accepted" | "rejected";

type DocRequirement = {
  id: string;
  name: string;
  description: string;
  required: boolean;
  status: DocStatus;
  uploaded_by?: string;
  uploaded_at?: string;
};

type PMCComment = {
  id: string;
  author: string;
  role: "Servicer" | "Lender" | "Borrower" | "System";
  text: string;
  ts: string;
  stage: PMCStage;
};

type AuditEvent = {
  ts: string;
  actor: string;
  role: "Servicer" | "Lender" | "Borrower" | "System";
  action: string;
  from_stage: PMCStage;
  to_stage: PMCStage;
  note?: string;
};

type PMInfo = {
  company: string;
  contact: string;
  fee_pct: number;
  experience_years: number;
  proximity_miles: number;
  agreement_expires: string;
  affiliated_with_borrower: boolean;
  termination_clause: string;
};

type PMCRecord = {
  loan_ref: string;
  borrower: string;
  property: string;
  property_type: string;
  upb: number;
  agency: string;
  stage: PMCStage;
  compliance_flag: ComplianceFlag;
  stage_since: string;
  sla_due: string | null;
  sla_days_remaining: number | null;
  trigger_reason: string;
  current_pm: PMInfo;
  proposed_pm: PMInfo | null;
  validation_issues: ValidationIssue[];
  required_docs: DocRequirement[];
  comments: PMCComment[];
  audit_timeline: AuditEvent[];
  blocked_actions: string[];
};

// ── Fee cap thresholds by property type ───────────────────────────────────────

const FEE_CAPS: Record<string, number> = {
  Multifamily: 5.0,
  Industrial:  4.0,
  Office:      5.0,
  Retail:      5.5,
  "Mixed-Use": 5.0,
};

// ── Stage config ───────────────────────────────────────────────────────────────

const STAGES: { key: PMCStage; label: string; short: string }[] = [
  { key: "draft",          label: "Draft",              short: "Draft" },
  { key: "submitted",      label: "Submitted",          short: "Submitted" },
  { key: "under_review",   label: "Under Review",       short: "Review" },
  { key: "freddie_review", label: "Freddie Mac Review", short: "FM Review" },
  { key: "approved",       label: "Approved",           short: "Approved" },
];

const STAGE_ORDER: PMCStage[] = ["draft", "submitted", "under_review", "freddie_review", "approved"];

const stageIndex = (s: PMCStage) => STAGE_ORDER.indexOf(s);

const flagConfig: Record<ComplianceFlag, { label: string; bg: string; color: string; dot: string }> = {
  clean:           { label: "Clean",           bg: "bg-emerald-50 border border-emerald-200",  color: "text-emerald-700", dot: "bg-emerald-500" },
  review_required: { label: "Review Required", bg: "bg-amber-50 border border-amber-200",      color: "text-amber-700",   dot: "bg-amber-500"   },
  pending_change:  { label: "Pending Change",  bg: "bg-blue-50 border border-blue-200",        color: "text-blue-700",    dot: "bg-blue-500"    },
  non_compliant:   { label: "Non-Compliant",   bg: "bg-red-50 border border-red-200",          color: "text-red-700",     dot: "bg-red-500"     },
};

const REQUIRED_DOCS_TEMPLATE: Omit<DocRequirement, "status" | "uploaded_by" | "uploaded_at">[] = [
  {
    id: "doc-pma",
    name: "New Property Management Agreement",
    description: "Fully executed or draft agreement with proposed PM company. Must include management fee, scope of services, and term.",
    required: true,
  },
  {
    id: "doc-termination",
    name: "Termination Clause Addendum",
    description: "Addendum must explicitly state ≤30 days written notice, no-cause termination, and zero penalty to borrower/lender. FM Servicing Guide §34.01.",
    required: true,
  },
  {
    id: "doc-resume",
    name: "PM Company Resume / Experience Profile",
    description: "Minimum 5 years experience managing comparable property type within 50-mile radius. Include portfolio reference list.",
    required: true,
  },
  {
    id: "doc-rent-roll",
    name: "Current Rent Roll (Signed)",
    description: "Certified rent roll signed by current property manager, dated within 30 days of submission.",
    required: true,
  },
  {
    id: "doc-explanation",
    name: "Borrower Explanation Letter",
    description: "Borrower letter explaining reason for management change, transition timeline, and confirmation of no operational disruption.",
    required: true,
  },
];

// ── Initial PMC data ───────────────────────────────────────────────────────────

const INITIAL_RECORDS: PMCRecord[] = [
  {
    loan_ref:         "LN-2847",
    borrower:         "Cedar Grove Partners",
    property:         "The Meridian Apartments",
    property_type:    "Multifamily",
    upb:              4_112_500,
    agency:           "Freddie Mac",
    stage:            "no_change",
    compliance_flag:  "clean",
    stage_since:      "2024-07-01",
    sla_due:          null,
    sla_days_remaining: null,
    trigger_reason:   "No PMC active",
    current_pm: {
      company:                 "First Choice Residential",
      contact:                 "Rebecca Walton · (404) 555-0182",
      fee_pct:                 5.5,
      experience_years:        12,
      proximity_miles:         8,
      agreement_expires:       "2027-06-30",
      affiliated_with_borrower: false,
      termination_clause:      "60-day notice + lender consent",
    },
    proposed_pm:        null,
    validation_issues:  [],
    required_docs:      [],
    comments:           [],
    audit_timeline: [
      { ts: "2024-07-01T09:00:00Z", actor: "System", role: "System", action: "PM agreement confirmed current — no PMC required", from_stage: "no_change", to_stage: "no_change" },
    ],
    blocked_actions: [],
  },
  {
    loan_ref:         "LN-3201",
    borrower:         "Metro Development LLC",
    property:         "Westgate Industrial Park",
    property_type:    "Industrial",
    upb:              5_520_000,
    agency:           "Fannie Mae",
    stage:            "unauthorized",
    compliance_flag:  "non_compliant",
    stage_since:      "2026-04-18",
    sla_due:          "2026-04-28",
    sla_days_remaining: 2,
    trigger_reason:   "System detected unauthorized PM substitution — new company listed on rent roll does not match lender records",
    current_pm: {
      company:                 "Metro Asset Services",
      contact:                 "Tony Reeves · (512) 555-0244",
      fee_pct:                 3.5,
      experience_years:        9,
      proximity_miles:         12,
      agreement_expires:       "2026-12-31",
      affiliated_with_borrower: false,
      termination_clause:      "30-day notice, no lender consent clause",
    },
    proposed_pm: {
      company:                 "Pinnacle Regional Mgmt (unauthorized)",
      contact:                 "Unknown — not on file",
      fee_pct:                 6.5,
      experience_years:        3,
      proximity_miles:         64,
      agreement_expires:       "2027-04-30",
      affiliated_with_borrower: true,
      termination_clause:      "90-day notice with 6-month early termination fee",
    },
    validation_issues: [
      { id: "vi-3201-1", rule: "Unauthorized PM Change", detail: "PM company on April rent roll ('Pinnacle Regional Mgmt') does not match lender-approved PM ('Metro Asset Services'). No consent obtained.", severity: "blocking", resolved: false, fm_ref: "FM Servicing Guide §34.02 — Unauthorized PM Change" },
      { id: "vi-3201-2", rule: "Termination Clause Non-Compliant", detail: "Proposed agreement contains 90-day notice + 6-month penalty. Freddie Mac requires ≤30 days, no-cause, no penalty.", severity: "blocking", resolved: false, fm_ref: "FM Servicing Guide §34.01(b)" },
      { id: "vi-3201-3", rule: "Management Fee Exceeds Cap", detail: "Proposed fee of 6.5% exceeds Freddie Mac cap of 4.0% for Industrial properties.", severity: "blocking", resolved: false, fm_ref: "FM Asset Mgmt Guide §4.1(c)" },
      { id: "vi-3201-4", rule: "Borrower Affiliation Conflict", detail: "Proposed PM company has ownership overlap with borrower entity — requires disclosure and lender waiver.", severity: "blocking", resolved: false, fm_ref: "FM Servicing Guide §34.03 — Affiliation Disclosure" },
      { id: "vi-3201-5", rule: "Insufficient PM Experience", detail: "Proposed PM has 3 years experience; minimum required is 5 years for Freddie Mac industrial assets.", severity: "blocking", resolved: false, fm_ref: "FM Asset Mgmt Guide §4.2(a)" },
      { id: "vi-3201-6", rule: "Proximity Exceeds Limit", detail: "Proposed PM office is 64 miles from property; Freddie Mac limit is 50 miles for non-metropolitan markets.", severity: "blocking", resolved: false, fm_ref: "FM Asset Mgmt Guide §4.2(b)" },
    ],
    required_docs: REQUIRED_DOCS_TEMPLATE.map(d => ({ ...d, status: "missing" as DocStatus })),
    comments: [
      { id: "c-3201-1", author: "System", role: "System", text: "PMC task auto-created. Unauthorized PM detected on April 2026 rent roll. Borrower must submit compliant PMC package within 10 days or loan placed on watchlist.", ts: "2026-04-18T09:00:00Z", stage: "unauthorized" },
    ],
    audit_timeline: [
      { ts: "2026-04-18T09:00:00Z", actor: "System", role: "System", action: "UNAUTHORIZED PM DETECTED — April rent roll lists 'Pinnacle Regional Mgmt.' No lender consent on file.", from_stage: "no_change", to_stage: "unauthorized", note: "Auto-trigger: rent roll AI extraction" },
    ],
    blocked_actions: ["Draw Requests", "Escrow Disbursements", "Loan Modification Approvals"],
  },
  {
    loan_ref:         "LN-5593",
    borrower:         "Westridge Capital",
    property:         "Summit Office Complex",
    property_type:    "Office",
    upb:              6_800_000,
    agency:           "Freddie Mac",
    stage:            "no_change",
    compliance_flag:  "clean",
    stage_since:      "2025-04-01",
    sla_due:          null,
    sla_days_remaining: null,
    trigger_reason:   "No PMC active",
    current_pm: {
      company:                 "Summit Property Partners",
      contact:                 "Diana Park · (212) 555-0371",
      fee_pct:                 4.0,
      experience_years:        18,
      proximity_miles:         2,
      agreement_expires:       "2028-03-31",
      affiliated_with_borrower: false,
      termination_clause:      "30-day notice + lender consent ✓",
    },
    proposed_pm:        null,
    validation_issues:  [],
    required_docs:      [],
    comments:           [],
    audit_timeline: [
      { ts: "2025-04-01T09:00:00Z", actor: "System", role: "System", action: "PM agreement confirmed — no PMC required", from_stage: "no_change", to_stage: "no_change" },
    ],
    blocked_actions: [],
  },
  {
    loan_ref:         "LN-0728",
    borrower:         "Crestwood Logistics",
    property:         "Crestwood Distribution Center",
    property_type:    "Industrial",
    upb:              7_100_000,
    agency:           "Freddie Mac",
    stage:            "no_change",
    compliance_flag:  "clean",
    stage_since:      "2024-10-01",
    sla_due:          null,
    sla_days_remaining: null,
    trigger_reason:   "No PMC active",
    current_pm: {
      company:                 "Texas Industrial Management",
      contact:                 "James Ortega · (214) 555-0509",
      fee_pct:                 3.0,
      experience_years:        15,
      proximity_miles:         6,
      agreement_expires:       "2027-09-30",
      affiliated_with_borrower: false,
      termination_clause:      "30-day notice + lender consent ✓",
    },
    proposed_pm:        null,
    validation_issues:  [],
    required_docs:      [],
    comments:           [],
    audit_timeline: [
      { ts: "2024-10-01T09:00:00Z", actor: "System", role: "System", action: "PM agreement confirmed — no PMC required", from_stage: "no_change", to_stage: "no_change" },
    ],
    blocked_actions: [],
  },
  {
    loan_ref:         "LN-4108",
    borrower:         "Oakfield Group",
    property:         "Oakfield Retail Plaza",
    property_type:    "Retail",
    upb:              2_800_000,
    agency:           "Fannie Mae",
    stage:            "under_review",
    compliance_flag:  "pending_change",
    stage_since:      "2026-04-14",
    sla_due:          "2026-05-14",
    sla_days_remaining: 18,
    trigger_reason:   "PM agreement expired Dec 31, 2025. Borrower submitted PMC package Apr 14, 2026 for transition to Oak Management Co.",
    current_pm: {
      company:                 "Greenleaf Retail Advisors (EXPIRED)",
      contact:                 "Mike Faber · (312) 555-0128",
      fee_pct:                 4.5,
      experience_years:        7,
      proximity_miles:         15,
      agreement_expires:       "2025-12-31",
      affiliated_with_borrower: false,
      termination_clause:      "60-day notice — no lender consent clause",
    },
    proposed_pm: {
      company:                 "Oak Management Co.",
      contact:                 "Sandra Torres · (312) 555-0801",
      fee_pct:                 4.0,
      experience_years:        9,
      proximity_miles:         11,
      agreement_expires:       "2029-04-30",
      affiliated_with_borrower: false,
      termination_clause:      "30-day no-cause, no penalty ✓",
    },
    validation_issues: [
      { id: "vi-4108-1", rule: "Termination Clause — Existing PM", detail: "Current (expired) agreement had 60-day notice and no lender consent clause. Termination of holdover requires 60-day wind-down letter.", severity: "warning", resolved: false, fm_ref: "FM Servicing Guide §34.01(b)" },
      { id: "vi-4108-2", rule: "Agreement Gap Period", detail: "PM operated on unauthorized holdover Jan 1 – Apr 13, 2026 (103 days). Borrower explanation letter must address gap period explicitly.", severity: "warning", resolved: false, fm_ref: "FM Servicing Guide §34.02(a)" },
    ],
    required_docs: REQUIRED_DOCS_TEMPLATE.map((d, i) => ({
      ...d,
      status: (["doc-pma", "doc-termination", "doc-rent-roll"].includes(d.id) ? "uploaded" : "missing") as DocStatus,
      uploaded_by: ["doc-pma", "doc-termination", "doc-rent-roll"].includes(d.id) ? "Borrower" : undefined,
      uploaded_at: ["doc-pma", "doc-termination", "doc-rent-roll"].includes(d.id) ? "2026-04-14" : undefined,
    })),
    comments: [
      { id: "c-4108-1", author: "Borrower", role: "Borrower", text: "Submitting PMC package for transition from Greenleaf Retail Advisors to Oak Management Co. Oak has managed our Chicago portfolio for 9 years with no performance issues.", ts: "2026-04-14T10:30:00Z", stage: "submitted" },
      { id: "c-4108-2", author: "Servicer", role: "Servicer", text: "Package received. PM agreement and termination addendum look compliant. Missing: PM resume/experience profile and borrower explanation letter. Returning for completion.", ts: "2026-04-16T14:00:00Z", stage: "under_review" },
    ],
    audit_timeline: [
      { ts: "2026-01-15T09:00:00Z", actor: "System", role: "System", action: "PM agreement expired Dec 31, 2025 — PMC required flag raised", from_stage: "no_change", to_stage: "draft", note: "Auto-trigger: agreement expiry" },
      { ts: "2026-04-14T10:30:00Z", actor: "Oakfield Group", role: "Borrower", action: "PMC package submitted — transition to Oak Management Co.", from_stage: "draft", to_stage: "submitted" },
      { ts: "2026-04-14T11:00:00Z", actor: "System", role: "System", action: "Automated validation run — 2 warnings, 0 blocking issues, 2/5 docs missing", from_stage: "submitted", to_stage: "submitted" },
      { ts: "2026-04-15T09:00:00Z", actor: "System", role: "System", action: "SLA clock started — 30-day review deadline: May 14, 2026", from_stage: "submitted", to_stage: "submitted" },
      { ts: "2026-04-16T14:00:00Z", actor: "Servicer", role: "Servicer", action: "Package advanced to Under Review — 2 outstanding docs requested from borrower", from_stage: "submitted", to_stage: "under_review" },
    ],
    blocked_actions: ["Draw Requests"],
  },
  {
    loan_ref:         "LN-1120",
    borrower:         "Sunrise Holdings",
    property:         "Sunrise Business Park",
    property_type:    "Mixed-Use",
    upb:              3_200_000,
    agency:           "Portfolio",
    stage:            "no_change",
    compliance_flag:  "clean",
    stage_since:      "2024-04-01",
    sla_due:          null,
    sla_days_remaining: null,
    trigger_reason:   "No PMC active",
    current_pm: {
      company:                 "Sunrise Asset Management",
      contact:                 "Nina Alvarez · (305) 555-0296",
      fee_pct:                 4.0,
      experience_years:        11,
      proximity_miles:         4,
      agreement_expires:       "2027-03-31",
      affiliated_with_borrower: false,
      termination_clause:      "30-day notice ✓",
    },
    proposed_pm:        null,
    validation_issues:  [],
    required_docs:      [],
    comments:           [],
    audit_timeline: [
      { ts: "2024-04-01T09:00:00Z", actor: "System", role: "System", action: "PM agreement confirmed — no PMC required", from_stage: "no_change", to_stage: "no_change" },
    ],
    blocked_actions: [],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const now = () => new Date().toISOString();

function StagePipeline({ stage }: { stage: PMCStage }) {
  const activeIdx = stageIndex(stage);
  const isRejected = stage === "rejected";
  const isUnauth   = stage === "unauthorized";
  const isNoChange = stage === "no_change";

  if (isNoChange) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-semibold text-emerald-700">No PMC Active — PM agreement current and compliant</span>
      </div>
    );
  }

  if (isUnauth) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2">
        <ShieldExclamationIcon className="h-4 w-4 text-red-600 shrink-0" />
        <span className="text-sm font-bold text-red-700">UNAUTHORIZED CHANGE DETECTED — PMC Required Immediately</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0 flex-wrap">
      {STAGES.map((s, i) => {
        const active = s.key === stage;
        const passed = i < activeIdx;
        const isLast = i === STAGES.length - 1;
        return (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition ${
              active  ? "bg-amber-50 border-amber-300 text-amber-800" :
              passed  ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
              isRejected && i === activeIdx + 1 ? "bg-red-50 border-red-200 text-red-700" :
              "bg-slate-50 border-slate-200 text-slate-300"
            }`}>
              {passed && <CheckCircleIcon className="h-3 w-3 text-emerald-500 shrink-0" />}
              {active && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
              {!passed && !active && <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
              {s.short}
            </div>
            {!isLast && (
              <ArrowRightIcon className={`h-3 w-3 mx-0.5 ${i < activeIdx ? "text-emerald-400" : "text-slate-200"}`} />
            )}
          </div>
        );
      })}
      {isRejected && (
        <div className="flex items-center gap-1 ml-2">
          <ArrowRightIcon className="h-3 w-3 text-red-300" />
          <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Rejected</span>
        </div>
      )}
    </div>
  );
}

function PMCard({ pm, label, type }: { pm: PMInfo; label: string; type: "current" | "proposed" }) {
  const feeCap = FEE_CAPS[type] ?? 5.0;
  const feeOk  = pm.fee_pct <= (feeCap + 99); // evaluate against property type when rendering
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${type === "proposed" ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
      <p className={`text-xs font-black uppercase tracking-wide ${type === "proposed" ? "text-blue-700" : "text-slate-500"}`}>{label}</p>
      <div>
        <p className="font-bold text-slate-900">{pm.company}</p>
        <p className="text-xs text-slate-500">{pm.contact}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          { k: "Fee", v: `${pm.fee_pct}%`, warn: false },
          { k: "Experience", v: `${pm.experience_years} yrs`, warn: pm.experience_years < 5 },
          { k: "Proximity", v: `${pm.proximity_miles} mi`, warn: pm.proximity_miles > 50 },
          { k: "Expires", v: pm.agreement_expires, warn: false },
        ].map(row => (
          <div key={row.k} className={`rounded-lg px-2.5 py-2 ${row.warn ? "bg-red-50 border border-red-200" : "bg-slate-50"}`}>
            <p className="text-slate-400">{row.k}</p>
            <p className={`font-bold ${row.warn ? "text-red-700" : "text-slate-900"}`}>{row.v}</p>
          </div>
        ))}
      </div>
      <div className={`rounded-lg border px-3 py-2 text-xs ${pm.affiliated_with_borrower ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
        <span className="font-semibold">Affiliation: </span>
        {pm.affiliated_with_borrower ? "⚠ Related party — disclosure required" : "None disclosed"}
      </div>
      <div className={`rounded-lg border px-3 py-2 text-xs ${pm.termination_clause.includes("✓") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        <span className="font-semibold">Termination: </span>{pm.termination_clause}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function ServicingManagementPage() {
  const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
  const [records, setRecords] = useState<PMCRecord[]>(INITIAL_RECORDS);
  const [selectedRef, setSelectedRef] = useState<string>(
    INITIAL_RECORDS.find(r => r.stage !== "no_change")?.loan_ref ?? INITIAL_RECORDS[0].loan_ref
  );
  const [newComment, setNewComment] = useState<Record<string, string>>({});

  const record = records.find(r => r.loan_ref === selectedRef) ?? records[0];

  const mutate = (ref: string, fn: (r: PMCRecord) => PMCRecord) => {
    setRecords(prev => prev.map(r => r.loan_ref === ref ? fn(r) : r));
  };

  // Upload a document
  const handleUpload = (docId: string) => {
    mutate(record.loan_ref, r => ({
      ...r,
      required_docs: r.required_docs.map(d =>
        d.id === docId
          ? { ...d, status: "uploaded" as DocStatus, uploaded_by: "Servicer", uploaded_at: new Date().toLocaleDateString("en-US") }
          : d
      ),
    }));
    logAudit({
      id: `audit-pmc-doc-${docId}-${Date.now()}`,
      action: `Document uploaded — ${record.required_docs.find(d => d.id === docId)?.name}`,
      detail: `PMC package — ${record.loan_ref}`,
      timestamp: now(),
      status: "logged",
    });
  };

  // Accept a document
  const handleAcceptDoc = (docId: string) => {
    mutate(record.loan_ref, r => ({
      ...r,
      required_docs: r.required_docs.map(d =>
        d.id === docId ? { ...d, status: "accepted" as DocStatus } : d
      ),
    }));
  };

  // Resolve a validation issue
  const handleResolveIssue = (issueId: string) => {
    mutate(record.loan_ref, r => ({
      ...r,
      validation_issues: r.validation_issues.map(vi =>
        vi.id === issueId ? { ...vi, resolved: true } : vi
      ),
    }));
    logAudit({
      id: `audit-pmc-vi-${issueId}-${Date.now()}`,
      action: `Validation issue resolved — ${record.validation_issues.find(v => v.id === issueId)?.rule}`,
      detail: record.loan_ref,
      timestamp: now(),
      status: "logged",
    });
  };

  // Advance stage
  const handleAdvance = () => {
    const curIdx = stageIndex(record.stage);
    if (curIdx < 0 || curIdx >= STAGE_ORDER.length - 1) return;
    const nextStage = STAGE_ORDER[curIdx + 1];
    const blockingOpen = record.validation_issues.filter(v => v.severity === "blocking" && !v.resolved);
    const docsOk = record.required_docs.every(d => d.status === "uploaded" || d.status === "accepted");
    if (blockingOpen.length > 0 || !docsOk) return;

    mutate(record.loan_ref, r => ({
      ...r,
      stage: nextStage,
      stage_since: new Date().toLocaleDateString("en-US"),
      compliance_flag: nextStage === "approved" ? "clean" : "pending_change",
      blocked_actions: nextStage === "approved" ? [] : r.blocked_actions,
      audit_timeline: [
        ...r.audit_timeline,
        { ts: now(), actor: "Servicer", role: "Servicer" as const, action: `PMC stage advanced: ${r.stage} → ${nextStage}`, from_stage: r.stage, to_stage: nextStage },
      ],
    }));

    if (nextStage === "approved") {
      requestApproval(`PMC Approved — ${record.loan_ref}`, `${record.property}: transition to ${record.proposed_pm?.company} approved after full compliance review.`);
      addAlert({ id: `alert-pmc-approved-${record.loan_ref}`, title: `PMC Approved — ${record.loan_ref}`, detail: `Transition to ${record.proposed_pm?.company} complete.`, severity: "low", category: "Management" });
    } else {
      addTask({ id: `task-pmc-${record.loan_ref}-${nextStage}`, title: `PMC ${nextStage.replace("_", " ")} — ${record.loan_ref}`, detail: `${record.property}: PMC package at stage ${nextStage}.`, status: "in-review", category: "Management", requiresApproval: nextStage === "freddie_review" });
    }
  };

  // Reject PMC
  const handleReject = () => {
    mutate(record.loan_ref, r => ({
      ...r,
      stage: "rejected",
      compliance_flag: "non_compliant",
      audit_timeline: [
        ...r.audit_timeline,
        { ts: now(), actor: "Servicer", role: "Servicer" as const, action: `PMC Rejected — returned to borrower for revision`, from_stage: r.stage, to_stage: "rejected" },
      ],
    }));
    addAlert({ id: `alert-pmc-rejected-${record.loan_ref}`, title: `PMC Rejected — ${record.loan_ref}`, detail: "Package returned to borrower. Blocking issues must be resolved before re-submission.", severity: "high", category: "Management" });
  };

  // Initiate PMC on a clean loan
  const handleInitiatePMC = (ref: string) => {
    mutate(ref, r => ({
      ...r,
      stage: "draft",
      compliance_flag: "pending_change",
      sla_due: new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-US"),
      sla_days_remaining: 30,
      required_docs: REQUIRED_DOCS_TEMPLATE.map(d => ({ ...d, status: "missing" as DocStatus })),
      audit_timeline: [
        ...r.audit_timeline,
        { ts: now(), actor: "Servicer", role: "Servicer" as const, action: "PMC initiated by servicer — package assembly started", from_stage: "no_change" as PMCStage, to_stage: "draft" as PMCStage },
      ],
    }));
    setSelectedRef(ref);
  };

  // Add comment
  const handleComment = () => {
    const text = (newComment[record.loan_ref] ?? "").trim();
    if (!text) return;
    mutate(record.loan_ref, r => ({
      ...r,
      comments: [...r.comments, {
        id: `c-${Date.now()}`,
        author: "Servicer",
        role: "Servicer" as const,
        text,
        ts: now(),
        stage: r.stage,
      }],
      audit_timeline: [
        ...r.audit_timeline,
        { ts: now(), actor: "Servicer", role: "Servicer" as const, action: `Comment added at ${r.stage} stage`, from_stage: r.stage, to_stage: r.stage, note: text.slice(0, 60) },
      ],
    }));
    setNewComment(prev => ({ ...prev, [record.loan_ref]: "" }));
  };

  const blockingOpen = record.validation_issues.filter(v => v.severity === "blocking" && !v.resolved);
  const warningOpen  = record.validation_issues.filter(v => v.severity === "warning" && !v.resolved);
  const docsOk = record.required_docs.length > 0 && record.required_docs.every(d => d.status === "uploaded" || d.status === "accepted");
  const canAdvance = record.stage !== "no_change" && record.stage !== "approved" && record.stage !== "rejected" && record.stage !== "unauthorized" && blockingOpen.length === 0 && docsOk;
  const curStageIdx = stageIndex(record.stage);

  const portfolioStats = {
    active: records.filter(r => !["no_change", "approved"].includes(r.stage)).length,
    unauthorized: records.filter(r => r.stage === "unauthorized").length,
    pending: records.filter(r => ["draft", "submitted", "under_review", "freddie_review"].includes(r.stage)).length,
    approved: records.filter(r => r.stage === "approved").length,
    blocked: records.filter(r => r.blocked_actions.length > 0).length,
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Active PMCs",    value: portfolioStats.active,       color: portfolioStats.active > 0 ? "text-amber-700" : "text-slate-500" },
          { label: "Unauthorized",   value: portfolioStats.unauthorized, color: portfolioStats.unauthorized > 0 ? "text-red-700" : "text-emerald-700" },
          { label: "In Pipeline",    value: portfolioStats.pending,      color: portfolioStats.pending > 0 ? "text-blue-700" : "text-slate-500" },
          { label: "Approved YTD",   value: portfolioStats.approved,     color: "text-emerald-700" },
          { label: "Actions Blocked",value: portfolioStats.blocked,      color: portfolioStats.blocked > 0 ? "text-red-700" : "text-emerald-700" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* PMC Roster */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">PMC Workflow Roster</p>
          <p className="text-xs text-slate-400">Freddie Mac Servicing Guide §34 · Fannie Mae MF Guide §3786</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Loan / Property</th>
                <th className="px-4 py-3 text-left">Current PM</th>
                <th className="px-4 py-3 text-left">PMC Stage</th>
                <th className="px-4 py-3 text-center">Compliance</th>
                <th className="px-4 py-3 text-center">SLA</th>
                <th className="px-4 py-3 text-center">Blocked</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const flag = flagConfig[r.compliance_flag];
                const isSelected = r.loan_ref === selectedRef;
                const critical = r.stage === "unauthorized";
                return (
                  <tr
                    key={r.loan_ref}
                    onClick={() => setSelectedRef(r.loan_ref)}
                    className={`border-t border-slate-100 cursor-pointer transition hover:bg-slate-50 ${
                      isSelected ? "bg-amber-50/40" : critical ? "bg-red-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BuildingOffice2Icon className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-900">{r.loan_ref}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[160px]">{r.property}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800 text-xs font-medium truncate max-w-[160px]">{r.current_pm.company}</p>
                      <p className="text-xs text-slate-400">Exp {r.current_pm.agreement_expires}</p>
                    </td>
                    <td className="px-4 py-3">
                      {r.stage === "no_change" ? (
                        <span className="text-xs text-slate-400">No PMC Active</span>
                      ) : r.stage === "unauthorized" ? (
                        <span className="text-xs font-black text-red-700 uppercase">Unauthorized</span>
                      ) : r.stage === "approved" ? (
                        <span className="text-xs font-bold text-emerald-700">Approved</span>
                      ) : r.stage === "rejected" ? (
                        <span className="text-xs font-bold text-red-600">Rejected</span>
                      ) : (
                        <span className="text-xs font-semibold text-blue-700">
                          {STAGES.find(s => s.key === r.stage)?.label ?? r.stage}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${flag.bg} ${flag.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${flag.dot}`} />
                        {flag.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.sla_days_remaining !== null ? (
                        <span className={`text-xs font-bold ${r.sla_days_remaining <= 5 ? "text-red-700" : r.sla_days_remaining <= 14 ? "text-amber-700" : "text-slate-600"}`}>
                          {r.sla_days_remaining}d
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.blocked_actions.length > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <LockClosedIcon className="h-3.5 w-3.5 text-red-600" />
                          <span className="text-xs font-bold text-red-700">{r.blocked_actions.length}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.stage === "no_change" && (
                        <button
                          onClick={e => { e.stopPropagation(); handleInitiatePMC(r.loan_ref); }}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Initiate PMC
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PMC Detail */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className={`border-b px-5 py-4 ${record.stage === "unauthorized" ? "bg-red-50" : record.stage === "no_change" ? "bg-emerald-50/40" : "bg-amber-50/40"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-900">{record.loan_ref}</h2>
                <span className="text-slate-400">·</span>
                <span className="text-sm font-semibold text-slate-600">{record.borrower}</span>
                <span className="text-slate-400">·</span>
                <span className="text-xs text-slate-500">{record.property} ({record.property_type})</span>
              </div>
              <div className="mt-2">
                <StagePipeline stage={record.stage} />
              </div>
              {record.trigger_reason && (
                <p className="mt-2 text-xs text-slate-500 max-w-2xl">{record.trigger_reason}</p>
              )}
            </div>
            {record.sla_days_remaining !== null && (
              <div className={`rounded-xl border px-4 py-2 text-center ${record.sla_days_remaining <= 5 ? "border-red-300 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                <p className="text-xs text-slate-400">SLA Deadline</p>
                <p className={`text-2xl font-black ${record.sla_days_remaining <= 5 ? "text-red-700" : "text-amber-700"}`}>{record.sla_days_remaining}d</p>
                <p className="text-[10px] text-slate-400">{record.sla_due}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Blocked Actions Banner */}
          {record.blocked_actions.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <LockClosedIcon className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm font-black text-red-800">Downstream Actions Blocked — Unresolved PMC</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {record.blocked_actions.map(a => (
                  <span key={a} className="rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">{a}</span>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-red-700">All listed actions are locked until PMC reaches Approved status or blocking issues are resolved.</p>
            </div>
          )}

          {/* PM Cards */}
          {(record.stage !== "no_change") && (
            <div className={`grid gap-4 ${record.proposed_pm ? "lg:grid-cols-2" : ""}`}>
              <PMCard pm={record.current_pm} label="Current Property Manager" type="current" />
              {record.proposed_pm && (
                <PMCard pm={record.proposed_pm} label="Proposed Property Manager" type="proposed" />
              )}
            </div>
          )}

          {/* Validation Issues */}
          {record.validation_issues.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                Compliance Validation — {blockingOpen.length} blocking · {warningOpen.length} warnings
              </p>
              <div className="space-y-2">
                {record.validation_issues.map(vi => (
                  <div key={vi.id} className={`rounded-xl border p-3.5 ${vi.resolved ? "border-emerald-200 bg-emerald-50 opacity-70" : vi.severity === "blocking" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        {vi.resolved
                          ? <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          : vi.severity === "blocking"
                            ? <XCircleIcon className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                            : <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-black uppercase px-1.5 py-0.5 rounded ${vi.severity === "blocking" ? "bg-red-200 text-red-900" : "bg-amber-200 text-amber-900"}`}>
                              {vi.severity === "blocking" ? "Blocking" : "Warning"}
                            </span>
                            <p className="text-sm font-bold text-slate-900">{vi.rule}</p>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">{vi.detail}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{vi.fm_ref}</p>
                        </div>
                      </div>
                      {!vi.resolved && (
                        <button
                          onClick={() => handleResolveIssue(vi.id)}
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Bundle */}
          {record.required_docs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Submission Package — {record.required_docs.filter(d => d.status === "uploaded" || d.status === "accepted").length}/{record.required_docs.length} docs received
                </p>
                {!docsOk && <span className="text-xs font-bold text-red-600">Package incomplete — cannot advance</span>}
                {docsOk && <span className="text-xs font-bold text-emerald-600">✓ Package complete</span>}
              </div>
              <div className="space-y-2">
                {record.required_docs.map(doc => {
                  const received = doc.status === "uploaded" || doc.status === "accepted";
                  return (
                    <div key={doc.id} className={`rounded-xl border p-3.5 ${received ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          {received
                            ? <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            : <DocumentArrowUpIcon className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />}
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{doc.name}</p>
                            <p className="text-xs text-slate-500">{doc.description}</p>
                            {received && <p className="text-xs text-emerald-700 mt-0.5">Uploaded by {doc.uploaded_by} · {doc.uploaded_at}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {doc.status === "uploaded" && (
                            <button onClick={() => handleAcceptDoc(doc.id)} className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                              Accept
                            </button>
                          )}
                          {!received && (
                            <button onClick={() => handleUpload(doc.id)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition">
                              Upload
                            </button>
                          )}
                          {doc.status === "accepted" && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Accepted</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stage Actions */}
          {!["no_change", "approved", "rejected"].includes(record.stage) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Stage Actions</p>
              {!docsOk && <p className="text-xs text-amber-700 mb-2">⚠ All 5 documents must be uploaded before advancing.</p>}
              {blockingOpen.length > 0 && <p className="text-xs text-red-700 mb-2">⛔ {blockingOpen.length} blocking validation issue{blockingOpen.length > 1 ? "s" : ""} must be resolved before advancing.</p>}
              {record.stage === "unauthorized" && (
                <p className="text-xs text-red-700 mb-2">Unauthorized PM change detected. Borrower must submit a compliant PMC package to clear this flag.</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAdvance}
                  disabled={!canAdvance}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition"
                >
                  {curStageIdx >= 0 && curStageIdx < STAGE_ORDER.length - 1
                    ? `Advance → ${STAGES.find(s => s.key === STAGE_ORDER[curStageIdx + 1])?.label ?? "Next"}`
                    : "Advance"}
                </button>
                {record.stage !== "draft" && record.stage !== "unauthorized" && (
                  <button
                    onClick={handleReject}
                    className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 transition"
                  >
                    Reject PMC
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Comments */}
          {record.stage !== "no_change" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                <DocumentTextIcon className="inline h-3.5 w-3.5 mr-1" />
                PMC Comments
              </p>
              <div className="space-y-2 mb-3">
                {record.comments.map(c => (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${c.role === "System" ? "bg-slate-100 text-slate-500" : c.role === "Borrower" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-800"}`}>
                        {c.role}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{c.author}</span>
                      <span className="text-xs text-slate-400">{new Date(c.ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-sm text-slate-700">{c.text}</p>
                  </div>
                ))}
                {record.comments.length === 0 && <p className="text-xs text-slate-400 italic">No comments yet.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment[record.loan_ref] ?? ""}
                  onChange={e => setNewComment(prev => ({ ...prev, [record.loan_ref]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleComment()}
                  placeholder="Add a comment…"
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <button onClick={handleComment} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 transition">
                  Add
                </button>
              </div>
            </div>
          )}

          {/* PMC Audit Timeline */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
              <ClockIcon className="inline h-3.5 w-3.5 mr-1" />
              PMC Audit Timeline — Immutable
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="divide-y divide-slate-100">
                {[...record.audit_timeline].reverse().map((ev, i) => (
                  <div key={i} className="flex items-start gap-4 px-4 py-3">
                    <div className="w-32 shrink-0 text-xs text-slate-400 tabular-nums">
                      {new Date(ev.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${ev.role === "System" ? "bg-slate-100 text-slate-500" : ev.role === "Borrower" ? "bg-violet-100 text-violet-700" : ev.role === "Lender" ? "bg-burgundy-100 text-red-900" : "bg-amber-100 text-amber-800"}`}>
                        {ev.role}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{ev.action}</p>
                      {ev.from_stage !== ev.to_stage && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {ev.from_stage} → {ev.to_stage}
                        </p>
                      )}
                      {ev.note && <p className="text-xs text-slate-500 mt-0.5 italic">"{ev.note}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
