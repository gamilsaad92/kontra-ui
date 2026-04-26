/**
 * Kontra Servicing → Asset Management & Compliance
 *
 * Freddie Mac PRS / Fannie Mae Servicing Guide–aligned lifecycle engine.
 *
 * Lifecycle stages:  Performing → Monitoring → Exception → Default → Resolution
 * Compliance items:  PRS-style queue with SLA, severity, approval gates
 * Reporting engine:  Rent roll, financials, inspections, insurance, reserves
 * PM compliance:     Eligibility validation per agency requirements
 * Borrower module:   Consent requests, cure notices, default notices
 * Audit trail:       Immutable per-loan event log
 */

import { useState } from "react";
import { useServicingContext } from "./ServicingContext";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  ArrowRightIcon,
  BellAlertIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────

type LifecycleStage = "performing" | "monitoring" | "exception" | "default" | "resolution";

type ComplianceSeverity = "critical" | "high" | "medium" | "low";
type ComplianceStatus   = "open" | "in_progress" | "resolved" | "overdue";
type ComplianceCategory =
  | "Reporting"
  | "PM Compliance"
  | "Inspection"
  | "Escrow"
  | "Insurance"
  | "Covenant"
  | "Reserve"
  | "Borrower";

type ComplianceItem = {
  id: string;
  category: ComplianceCategory;
  title: string;
  detail: string;
  severity: ComplianceSeverity;
  status: ComplianceStatus;
  sla_due: string;
  sla_days_remaining: number;
  required_docs: string[];
  docs_received: string[];
  requires_approval: boolean;
  agency_ref: string;
};

type ReportingLine = {
  name: string;
  frequency: string;
  due_date: string;
  submitted_date: string | null;
  status: "current" | "due_soon" | "overdue" | "missing";
  validated: boolean;
  agency_required: boolean;
};

type PmEligibilityCheck = {
  criterion: string;
  required: string;
  actual: string;
  pass: boolean;
  agency_ref: string;
};

type InspectionRecord = {
  date: string;
  inspector: string;
  condition: "LS1" | "LS2" | "LS3" | "DM" | "Critical";
  score: number;
  open_items: number;
  resolved_items: number;
  next_required: string;
};

type BorrowerInteraction = {
  date: string;
  type: "Consent Request" | "Cure Notice" | "Default Notice" | "Waiver Request" | "Modification";
  status: "sent" | "pending_approval" | "responded" | "overdue";
  summary: string;
};

type AuditEvent = {
  ts: string;
  actor: string;
  action: string;
  prior_state: string;
  new_state: string;
  category: ComplianceCategory;
};

type LoanCompliance = {
  loan_ref: string;
  borrower: string;
  property: string;
  type: string;
  stage: LifecycleStage;
  stage_since: string;
  dscr: number;
  dscr_covenant: number;
  occupancy_pct: number;
  occupancy_threshold: number;
  upb: number;
  agency: "Freddie Mac" | "Fannie Mae" | "Portfolio";
  pm_company: string;
  pm_contact: string;
  pm_fee_pct: number;
  pm_agreement_expires: string;
  compliance_items: ComplianceItem[];
  reporting: ReportingLine[];
  pm_eligibility: PmEligibilityCheck[];
  inspections: InspectionRecord[];
  borrower_interactions: BorrowerInteraction[];
  audit_log: AuditEvent[];
};

// ── Portfolio data ─────────────────────────────────────────────────────────────

const LOANS: LoanCompliance[] = [
  {
    loan_ref: "LN-2847",
    borrower: "Cedar Grove Partners",
    property: "The Meridian Apartments",
    type: "Multifamily",
    stage: "monitoring",
    stage_since: "2026-02-15",
    dscr: 1.138,
    dscr_covenant: 1.25,
    occupancy_pct: 91.7,
    occupancy_threshold: 80,
    upb: 4_112_500,
    agency: "Freddie Mac",
    pm_company: "First Choice Residential",
    pm_contact: "Rebecca Walton · (404) 555-0182",
    pm_fee_pct: 5.5,
    pm_agreement_expires: "2027-06-30",
    compliance_items: [
      {
        id: "ci-2847-1",
        category: "Covenant",
        title: "DSCR below covenant floor",
        detail: "Q1 2026 DSCR of 1.138x is below the 1.25x covenant. Requires borrower financial review and lender notification within 30 days.",
        severity: "high",
        status: "in_progress",
        sla_due: "2026-05-15",
        sla_days_remaining: 19,
        required_docs: ["Q1 2026 P&L", "Rent Roll", "Debt Service Schedule"],
        docs_received: ["Q1 2026 P&L"],
        requires_approval: true,
        agency_ref: "Freddie Mac PRS §4.3 — DSCR Monitoring",
      },
      {
        id: "ci-2847-2",
        category: "Reporting",
        title: "Q1 2026 rent roll validation pending",
        detail: "Rent roll submitted Apr 5, 2026. AI extraction complete. Manual validation required before filing.",
        severity: "medium",
        status: "in_progress",
        sla_due: "2026-05-01",
        sla_days_remaining: 5,
        required_docs: ["Signed Rent Roll", "Lease Abstracts"],
        docs_received: ["Signed Rent Roll"],
        requires_approval: false,
        agency_ref: "Freddie Mac Asset Mgmt Guide §6.2",
      },
      {
        id: "ci-2847-3",
        category: "Inspection",
        title: "Annual physical inspection due",
        detail: "Last inspection was Apr 2025. Annual inspection required by May 31, 2026 per agency requirements.",
        severity: "medium",
        status: "open",
        sla_due: "2026-05-31",
        sla_days_remaining: 35,
        required_docs: ["Inspection Report", "Condition Exhibit", "Photo Documentation"],
        docs_received: [],
        requires_approval: false,
        agency_ref: "Freddie Mac PRS §8.1 — Annual Inspection",
      },
      {
        id: "ci-2847-4",
        category: "Escrow",
        title: "Escrow shortage — ground rent",
        detail: "$42,100 shortage projected by Sep 15, 2026. Ground rent line underfunded. Cure notice pending lender approval.",
        severity: "high",
        status: "open",
        sla_due: "2026-05-20",
        sla_days_remaining: 24,
        required_docs: ["Cure Notice Draft", "Escrow Analysis"],
        docs_received: ["Escrow Analysis"],
        requires_approval: true,
        agency_ref: "Freddie Mac Servicing §7.4 — Escrow Shortage",
      },
    ],
    reporting: [
      { name: "Annual Financial Statement", frequency: "Annual", due_date: "2026-04-30", submitted_date: "2026-04-05", status: "due_soon", validated: false, agency_required: true },
      { name: "Q1 Rent Roll", frequency: "Quarterly", due_date: "2026-04-15", submitted_date: "2026-04-05", status: "current", validated: true, agency_required: true },
      { name: "Property Insurance Certificate", frequency: "Annual", due_date: "2026-07-01", submitted_date: "2025-07-08", status: "current", validated: true, agency_required: true },
      { name: "Annual Physical Inspection", frequency: "Annual", due_date: "2026-05-31", submitted_date: null, status: "due_soon", validated: false, agency_required: true },
      { name: "Replacement Reserve Analysis", frequency: "Annual", due_date: "2026-06-30", submitted_date: null, status: "due_soon", validated: false, agency_required: true },
      { name: "Operating Budget", frequency: "Annual", due_date: "2026-01-15", submitted_date: "2026-01-10", status: "current", validated: true, agency_required: false },
    ],
    pm_eligibility: [
      { criterion: "Management experience", required: "≥5 years multifamily", actual: "12 years", pass: true, agency_ref: "Fannie Mae MF Guide §3786.02" },
      { criterion: "Proximity to property", required: "≤50 miles", actual: "8 miles", pass: true, agency_ref: "Fannie Mae MF Guide §3786.02" },
      { criterion: "Management fee", required: "≤7% EGI", actual: "5.5%", pass: true, agency_ref: "Freddie Mac PM Guide §4.1" },
      { criterion: "Agreement term", required: "Current, not expired", actual: "Expires Jun 30, 2027", pass: true, agency_ref: "Freddie Mac PM Guide §4.2" },
      { criterion: "Termination clause", required: "30-day notice, lender consent", actual: "60-day notice + lender consent ✓", pass: true, agency_ref: "Freddie Mac PM Guide §4.3" },
      { criterion: "Insurance certificates", required: "Current E&O + GL", actual: "Current (exp Oct 2026)", pass: true, agency_ref: "Freddie Mac PM Guide §5.1" },
    ],
    inspections: [
      { date: "2025-04-12", inspector: "NCI Group", condition: "LS2", score: 78, open_items: 3, resolved_items: 11, next_required: "2026-05-31" },
      { date: "2024-03-28", inspector: "NCI Group", condition: "LS2", score: 74, open_items: 8, resolved_items: 6, next_required: "2025-04-30" },
    ],
    borrower_interactions: [
      { date: "2026-04-10", type: "Cure Notice", status: "pending_approval", summary: "DSCR covenant breach notification — requires lender signature before delivery to borrower." },
      { date: "2026-03-01", type: "Consent Request", status: "responded", summary: "Borrower requested approval to replace HVAC units — approved Apr 2, 2026." },
    ],
    audit_log: [
      { ts: "2026-04-10T09:14:00Z", actor: "Servicer", action: "DSCR covenant breach detected — Q1 2026", prior_state: "Performing", new_state: "Monitoring", category: "Covenant" },
      { ts: "2026-04-05T14:30:00Z", actor: "Borrower", action: "Q1 rent roll submitted", prior_state: "Overdue", new_state: "In Review", category: "Reporting" },
      { ts: "2026-03-15T10:00:00Z", actor: "System", action: "Escrow shortage projection run — $42,100 identified", prior_state: "Clean", new_state: "Shortage", category: "Escrow" },
      { ts: "2026-02-15T08:00:00Z", actor: "System", action: "Loan moved to Monitoring stage", prior_state: "Performing", new_state: "Monitoring", category: "Covenant" },
    ],
  },
  {
    loan_ref: "LN-3201",
    borrower: "Metro Development LLC",
    property: "Westgate Industrial Park",
    type: "Industrial",
    stage: "exception",
    stage_since: "2026-04-01",
    dscr: 1.189,
    dscr_covenant: 1.25,
    occupancy_pct: 95.0,
    occupancy_threshold: 80,
    upb: 5_520_000,
    agency: "Fannie Mae",
    pm_company: "Metro Asset Services",
    pm_contact: "Tony Reeves · (512) 555-0244",
    pm_fee_pct: 3.5,
    pm_agreement_expires: "2026-12-31",
    compliance_items: [
      {
        id: "ci-3201-1",
        category: "Insurance",
        title: "Insurance certificate expired",
        detail: "Property insurance certificate expired Apr 1, 2026. Agency requires current certificate on file at all times. Borrower non-responsive to two requests.",
        severity: "critical",
        status: "overdue",
        sla_due: "2026-04-15",
        sla_days_remaining: -11,
        required_docs: ["Updated GL Certificate", "Property All-Risk Policy Declaration"],
        docs_received: [],
        requires_approval: false,
        agency_ref: "Fannie Mae Servicing Guide B-1-01 — Insurance Requirements",
      },
      {
        id: "ci-3201-2",
        category: "PM Compliance",
        title: "PM agreement renewal not initiated",
        detail: "Agreement expires Dec 31, 2026. Agency requires renewal or replacement notice 90 days before expiry. Deadline: Oct 3, 2026. No renewal submitted.",
        severity: "high",
        status: "open",
        sla_due: "2026-10-03",
        sla_days_remaining: 160,
        required_docs: ["Renewal Agreement Draft", "PM Eligibility Certification"],
        docs_received: [],
        requires_approval: true,
        agency_ref: "Fannie Mae MF Guide §3786.04 — PM Agreement Renewal",
      },
      {
        id: "ci-3201-3",
        category: "Covenant",
        title: "DSCR below 1.25x covenant floor",
        detail: "Q1 2026 DSCR of 1.189x breaches 1.25x floor. Monitoring plan required. Financial recovery timeline from borrower within 45 days.",
        severity: "high",
        status: "in_progress",
        sla_due: "2026-05-15",
        sla_days_remaining: 19,
        required_docs: ["Recovery Plan", "Q1 P&L Statement", "Rent Roll"],
        docs_received: ["Q1 P&L Statement"],
        requires_approval: true,
        agency_ref: "Fannie Mae Servicing Guide §E-4-02 — DSCR Breach Protocol",
      },
      {
        id: "ci-3201-4",
        category: "Reporting",
        title: "Q1 2026 financials not validated",
        detail: "Q1 financials submitted but AI validation found 3 discrepancies requiring manual review. Short pay on Apr 1 payment also flagged.",
        severity: "medium",
        status: "in_progress",
        sla_due: "2026-04-30",
        sla_days_remaining: 4,
        required_docs: ["Reconciled P&L", "Bank Statements"],
        docs_received: ["Q1 P&L Statement"],
        requires_approval: false,
        agency_ref: "Fannie Mae MF Guide §3701 — Annual Reporting",
      },
    ],
    reporting: [
      { name: "Annual Financial Statement", frequency: "Annual", due_date: "2026-04-30", submitted_date: "2026-04-12", status: "due_soon", validated: false, agency_required: true },
      { name: "Q1 Rent Roll", frequency: "Quarterly", due_date: "2026-04-15", submitted_date: "2026-04-15", status: "current", validated: true, agency_required: true },
      { name: "Property Insurance Certificate", frequency: "Annual", due_date: "2026-04-01", submitted_date: "2025-03-30", status: "overdue", validated: false, agency_required: true },
      { name: "Annual Physical Inspection", frequency: "Annual", due_date: "2026-06-30", submitted_date: null, status: "due_soon", validated: false, agency_required: true },
      { name: "Replacement Reserve Analysis", frequency: "Annual", due_date: "2026-06-30", submitted_date: "2026-01-08", status: "current", validated: true, agency_required: true },
    ],
    pm_eligibility: [
      { criterion: "Management experience", required: "≥5 years industrial", actual: "9 years", pass: true, agency_ref: "Fannie Mae MF Guide §3786.02" },
      { criterion: "Proximity to property", required: "≤50 miles", actual: "12 miles", pass: true, agency_ref: "Fannie Mae MF Guide §3786.02" },
      { criterion: "Management fee", required: "≤6% EGI", actual: "3.5%", pass: true, agency_ref: "Fannie Mae MF Guide §3786.03" },
      { criterion: "Agreement term", required: "Current, not expired", actual: "Expires Dec 31, 2026 — no renewal", pass: false, agency_ref: "Fannie Mae MF Guide §3786.04" },
      { criterion: "Termination clause", required: "30-day notice, lender consent", actual: "30-day notice, no lender consent clause", pass: false, agency_ref: "Fannie Mae MF Guide §3786.05" },
      { criterion: "Insurance certificates", required: "Current E&O + GL", actual: "EXPIRED — Apr 1, 2026", pass: false, agency_ref: "Fannie Mae Servicing B-1-01" },
    ],
    inspections: [
      { date: "2025-06-18", inspector: "Partner Engineering", condition: "LS1", score: 88, open_items: 1, resolved_items: 7, next_required: "2026-06-30" },
      { date: "2024-06-10", inspector: "Partner Engineering", condition: "LS2", score: 81, open_items: 5, resolved_items: 3, next_required: "2025-06-30" },
    ],
    borrower_interactions: [
      { date: "2026-04-20", type: "Cure Notice", status: "sent", summary: "Insurance certificate expiry — 10-day cure notice delivered." },
      { date: "2026-04-08", type: "Cure Notice", status: "sent", summary: "Insurance expiry warning — first notice delivered Apr 8." },
    ],
    audit_log: [
      { ts: "2026-04-01T00:00:00Z", actor: "System", action: "Insurance certificate expired — critical flag raised", prior_state: "Monitoring", new_state: "Exception", category: "Insurance" },
      { ts: "2026-04-01T09:00:00Z", actor: "System", action: "DSCR covenant breach confirmed — 1.189x", prior_state: "Monitoring", new_state: "Exception", category: "Covenant" },
      { ts: "2026-04-08T11:20:00Z", actor: "Servicer", action: "First cure notice sent to borrower (insurance)", prior_state: "Open", new_state: "Sent", category: "Insurance" },
      { ts: "2026-04-20T14:00:00Z", actor: "Servicer", action: "Second cure notice sent — 10-day deadline", prior_state: "Sent", new_state: "Overdue", category: "Insurance" },
    ],
  },
  {
    loan_ref: "LN-5593",
    borrower: "Westridge Capital",
    property: "Summit Office Complex",
    type: "Office",
    stage: "monitoring",
    stage_since: "2026-03-01",
    dscr: 1.22,
    dscr_covenant: 1.25,
    occupancy_pct: 84.0,
    occupancy_threshold: 80,
    upb: 6_800_000,
    agency: "Freddie Mac",
    pm_company: "Summit Property Partners",
    pm_contact: "Diana Park · (212) 555-0371",
    pm_fee_pct: 4.0,
    pm_agreement_expires: "2028-03-31",
    compliance_items: [
      {
        id: "ci-5593-1",
        category: "Covenant",
        title: "DSCR within 5% of covenant floor",
        detail: "DSCR of 1.22x is within 2.4% of the 1.25x covenant floor. Enhanced monitoring required. Quarterly reporting frequency increased.",
        severity: "high",
        status: "in_progress",
        sla_due: "2026-05-15",
        sla_days_remaining: 19,
        required_docs: ["Q1 NOI Bridge Analysis", "Rent Roll", "Tenant Pipeline Report"],
        docs_received: ["Rent Roll"],
        requires_approval: false,
        agency_ref: "Freddie Mac PRS §4.3(b) — Enhanced Monitoring",
      },
      {
        id: "ci-5593-2",
        category: "Escrow",
        title: "TI reserve projected shortage",
        detail: "$27,200 shortfall projected by Jul 1, 2026. Two lease renewals pending — if renewals close, TI reserves will be drawn. Contribution increase required.",
        severity: "medium",
        status: "open",
        sla_due: "2026-05-30",
        sla_days_remaining: 34,
        required_docs: ["Escrow Analysis Report", "TI Budget"],
        docs_received: ["Escrow Analysis Report"],
        requires_approval: true,
        agency_ref: "Freddie Mac Servicing §7.4",
      },
      {
        id: "ci-5593-3",
        category: "Reporting",
        title: "Annual financials validation in progress",
        detail: "2025 annual financials submitted Mar 28. AI review flagged tenant recovery billing discrepancy. Manual reconciliation needed.",
        severity: "medium",
        status: "in_progress",
        sla_due: "2026-04-30",
        sla_days_remaining: 4,
        required_docs: ["Reconciled P&L", "Tenant CAM Reconciliations"],
        docs_received: ["2025 Annual P&L"],
        requires_approval: false,
        agency_ref: "Freddie Mac Asset Mgmt §6.2",
      },
    ],
    reporting: [
      { name: "Annual Financial Statement", frequency: "Annual", due_date: "2026-04-30", submitted_date: "2026-03-28", status: "current", validated: false, agency_required: true },
      { name: "Q1 Rent Roll", frequency: "Quarterly", due_date: "2026-04-15", submitted_date: "2026-04-14", status: "current", validated: true, agency_required: true },
      { name: "Property Insurance Certificate", frequency: "Annual", due_date: "2026-11-01", submitted_date: "2025-11-05", status: "current", validated: true, agency_required: true },
      { name: "Annual Physical Inspection", frequency: "Annual", due_date: "2026-08-31", submitted_date: null, status: "due_soon", validated: false, agency_required: true },
      { name: "TI Reserve Analysis", frequency: "Semi-Annual", due_date: "2026-06-30", submitted_date: null, status: "due_soon", validated: false, agency_required: true },
    ],
    pm_eligibility: [
      { criterion: "Management experience", required: "≥5 years office", actual: "18 years", pass: true, agency_ref: "Freddie Mac PM Guide §4.1" },
      { criterion: "Proximity to property", required: "≤50 miles", actual: "2 miles (NYC)", pass: true, agency_ref: "Freddie Mac PM Guide §4.1" },
      { criterion: "Management fee", required: "≤6% EGI", actual: "4.0%", pass: true, agency_ref: "Freddie Mac PM Guide §4.1" },
      { criterion: "Agreement term", required: "Current, not expired", actual: "Expires Mar 31, 2028", pass: true, agency_ref: "Freddie Mac PM Guide §4.2" },
      { criterion: "Termination clause", required: "30-day notice, lender consent", actual: "30-day notice + lender consent ✓", pass: true, agency_ref: "Freddie Mac PM Guide §4.3" },
      { criterion: "Insurance certificates", required: "Current E&O + GL", actual: "Current (exp Dec 2026)", pass: true, agency_ref: "Freddie Mac PM Guide §5.1" },
    ],
    inspections: [
      { date: "2025-08-20", inspector: "Terracon Consultants", condition: "LS2", score: 82, open_items: 4, resolved_items: 9, next_required: "2026-08-31" },
    ],
    borrower_interactions: [
      { date: "2026-04-15", type: "Consent Request", status: "pending_approval", summary: "Borrower requesting approval to modify lease terms for anchor tenant (FloorSpace Inc.) — 10,000 SF expansion." },
    ],
    audit_log: [
      { ts: "2026-03-01T09:00:00Z", actor: "System", action: "DSCR watch flag — 1.22x within 5% of 1.25x floor", prior_state: "Performing", new_state: "Monitoring", category: "Covenant" },
      { ts: "2026-03-15T14:00:00Z", actor: "System", action: "TI reserve shortage projected — $27,200", prior_state: "Clean", new_state: "Watch", category: "Escrow" },
      { ts: "2026-03-28T10:30:00Z", actor: "Borrower", action: "Annual financials submitted", prior_state: "Missing", new_state: "Submitted", category: "Reporting" },
    ],
  },
  {
    loan_ref: "LN-0728",
    borrower: "Crestwood Logistics",
    property: "Crestwood Distribution Center",
    type: "Industrial",
    stage: "performing",
    stage_since: "2024-10-01",
    dscr: 1.48,
    dscr_covenant: 1.25,
    occupancy_pct: 100.0,
    occupancy_threshold: 80,
    upb: 7_100_000,
    agency: "Freddie Mac",
    pm_company: "Texas Industrial Management",
    pm_contact: "James Ortega · (214) 555-0509",
    pm_fee_pct: 3.0,
    pm_agreement_expires: "2027-09-30",
    compliance_items: [
      {
        id: "ci-0728-1",
        category: "Reporting",
        title: "Q2 rent roll due Jun 15",
        detail: "Routine quarterly rent roll due Jun 15, 2026. No current deficiencies.",
        severity: "low",
        status: "open",
        sla_due: "2026-06-15",
        sla_days_remaining: 50,
        required_docs: ["Signed Rent Roll"],
        docs_received: [],
        requires_approval: false,
        agency_ref: "Freddie Mac Asset Mgmt §6.2",
      },
    ],
    reporting: [
      { name: "Annual Financial Statement", frequency: "Annual", due_date: "2026-04-30", submitted_date: "2026-04-02", status: "current", validated: true, agency_required: true },
      { name: "Q1 Rent Roll", frequency: "Quarterly", due_date: "2026-04-15", submitted_date: "2026-04-10", status: "current", validated: true, agency_required: true },
      { name: "Property Insurance Certificate", frequency: "Annual", due_date: "2026-08-01", submitted_date: "2025-08-05", status: "current", validated: true, agency_required: true },
      { name: "Annual Physical Inspection", frequency: "Annual", due_date: "2026-09-30", submitted_date: null, status: "due_soon", validated: false, agency_required: true },
      { name: "Replacement Reserve Analysis", frequency: "Annual", due_date: "2026-09-30", submitted_date: "2025-09-28", status: "current", validated: true, agency_required: true },
    ],
    pm_eligibility: [
      { criterion: "Management experience", required: "≥5 years industrial", actual: "15 years", pass: true, agency_ref: "Freddie Mac PM Guide §4.1" },
      { criterion: "Proximity to property", required: "≤50 miles", actual: "6 miles (Dallas)", pass: true, agency_ref: "Freddie Mac PM Guide §4.1" },
      { criterion: "Management fee", required: "≤6% EGI", actual: "3.0%", pass: true, agency_ref: "Freddie Mac PM Guide §4.1" },
      { criterion: "Agreement term", required: "Current, not expired", actual: "Expires Sep 30, 2027", pass: true, agency_ref: "Freddie Mac PM Guide §4.2" },
      { criterion: "Termination clause", required: "30-day notice, lender consent", actual: "30-day notice + lender consent ✓", pass: true, agency_ref: "Freddie Mac PM Guide §4.3" },
      { criterion: "Insurance certificates", required: "Current E&O + GL", actual: "Current (exp Sep 2026)", pass: true, agency_ref: "Freddie Mac PM Guide §5.1" },
    ],
    inspections: [
      { date: "2025-09-15", inspector: "EBI Consulting", condition: "LS1", score: 93, open_items: 0, resolved_items: 4, next_required: "2026-09-30" },
    ],
    borrower_interactions: [],
    audit_log: [
      { ts: "2026-04-02T10:00:00Z", actor: "Borrower", action: "Annual financials submitted — clean", prior_state: "Pending", new_state: "Validated", category: "Reporting" },
      { ts: "2026-04-10T09:30:00Z", actor: "System", action: "April payment posted — on time, clean", prior_state: "Due", new_state: "Posted", category: "Reporting" },
    ],
  },
  {
    loan_ref: "LN-4108",
    borrower: "Oakfield Group",
    property: "Oakfield Retail Plaza",
    type: "Retail",
    stage: "exception",
    stage_since: "2026-01-15",
    dscr: 1.31,
    dscr_covenant: 1.20,
    occupancy_pct: 78.5,
    occupancy_threshold: 80,
    upb: 2_800_000,
    agency: "Fannie Mae",
    pm_company: "Greenleaf Retail Advisors",
    pm_contact: "Mike Faber · (312) 555-0128",
    pm_fee_pct: 4.5,
    pm_agreement_expires: "2025-12-31",
    compliance_items: [
      {
        id: "ci-4108-1",
        category: "PM Compliance",
        title: "PM agreement expired — operating on holdover",
        detail: "Agreement expired Dec 31, 2025. Operating on unauthorized holdover. New PM proposed (Oak Management Co.) — transition package pending lender approval.",
        severity: "critical",
        status: "in_progress",
        sla_due: "2026-05-14",
        sla_days_remaining: 18,
        required_docs: ["New PM Agreement", "PM Eligibility Cert", "Updated Insurance Certs", "Transition Plan", "Lender Consent Letter"],
        docs_received: ["New PM Agreement Draft"],
        requires_approval: true,
        agency_ref: "Fannie Mae MF Guide §3786.04 — PM Transition",
      },
      {
        id: "ci-4108-2",
        category: "Covenant",
        title: "Occupancy below 80% threshold",
        detail: "Current occupancy of 78.5% is below the 80% minimum covenant. Two vacant anchor units (12,800 SF). Borrower must submit lease pipeline within 30 days.",
        severity: "high",
        status: "open",
        sla_due: "2026-05-26",
        sla_days_remaining: 30,
        required_docs: ["Lease Pipeline Report", "Vacancy Marketing Plan"],
        docs_received: [],
        requires_approval: true,
        agency_ref: "Fannie Mae Servicing Guide E-4-02 — Occupancy Covenant",
      },
      {
        id: "ci-4108-3",
        category: "Reserve",
        title: "Replacement reserve underfunded",
        detail: "Reserve balance $54,600 vs required $62,000. Shortfall of $7,400. Monthly contribution insufficient to fund before June 1 disbursement.",
        severity: "medium",
        status: "open",
        sla_due: "2026-05-20",
        sla_days_remaining: 24,
        required_docs: ["Reserve Analysis", "Cure Plan"],
        docs_received: [],
        requires_approval: false,
        agency_ref: "Fannie Mae MF Guide §3702 — Reserve Requirements",
      },
      {
        id: "ci-4108-4",
        category: "Reporting",
        title: "Annual inspection overdue",
        detail: "Last inspection Jun 2024. Annual inspection was due Jun 2025 — 10 months overdue. Escalated to critical per agency standards.",
        severity: "critical",
        status: "overdue",
        sla_due: "2026-02-28",
        sla_days_remaining: -57,
        required_docs: ["Inspection Report", "Condition Exhibit", "Repair Schedule"],
        docs_received: [],
        requires_approval: false,
        agency_ref: "Fannie Mae MF Guide §3710 — Physical Inspection",
      },
    ],
    reporting: [
      { name: "Annual Financial Statement", frequency: "Annual", due_date: "2026-04-30", submitted_date: "2026-04-20", status: "current", validated: false, agency_required: true },
      { name: "Q1 Rent Roll", frequency: "Quarterly", due_date: "2026-04-15", submitted_date: "2026-04-15", status: "current", validated: true, agency_required: true },
      { name: "Property Insurance Certificate", frequency: "Annual", due_date: "2026-10-01", submitted_date: "2025-10-08", status: "current", validated: true, agency_required: true },
      { name: "Annual Physical Inspection", frequency: "Annual", due_date: "2025-06-30", submitted_date: null, status: "overdue", validated: false, agency_required: true },
      { name: "PM Agreement (Current)", frequency: "As needed", due_date: "2025-12-31", submitted_date: null, status: "overdue", validated: false, agency_required: true },
    ],
    pm_eligibility: [
      { criterion: "Management experience", required: "≥5 years retail", actual: "7 years", pass: true, agency_ref: "Fannie Mae MF Guide §3786.02" },
      { criterion: "Proximity to property", required: "≤50 miles", actual: "15 miles (Chicago)", pass: true, agency_ref: "Fannie Mae MF Guide §3786.02" },
      { criterion: "Management fee", required: "≤7% EGI", actual: "4.5%", pass: true, agency_ref: "Fannie Mae MF Guide §3786.03" },
      { criterion: "Agreement term", required: "Current, not expired", actual: "EXPIRED Dec 31, 2025 — holdover", pass: false, agency_ref: "Fannie Mae MF Guide §3786.04" },
      { criterion: "Termination clause", required: "30-day notice, lender consent", actual: "60-day notice, no lender consent — NON-COMPLIANT", pass: false, agency_ref: "Fannie Mae MF Guide §3786.05" },
      { criterion: "Insurance certificates", required: "Current E&O + GL", actual: "Current (exp Nov 2026)", pass: true, agency_ref: "Fannie Mae Servicing B-1-01" },
    ],
    inspections: [
      { date: "2024-06-14", inspector: "Rimkus Consulting", condition: "LS2", score: 72, open_items: 7, resolved_items: 3, next_required: "2025-06-30" },
    ],
    borrower_interactions: [
      { date: "2026-04-14", type: "Consent Request", status: "pending_approval", summary: "Borrower submitted new PM transition package — Oak Management Co. Awaiting lender approval." },
      { date: "2026-01-20", type: "Cure Notice", status: "responded", summary: "Occupancy cure notice — borrower responded Feb 5 with lease pipeline for 8,000 SF." },
    ],
    audit_log: [
      { ts: "2026-01-15T09:00:00Z", actor: "System", action: "PM agreement expired — exception raised", prior_state: "Monitoring", new_state: "Exception", category: "PM Compliance" },
      { ts: "2026-01-20T10:00:00Z", actor: "Servicer", action: "Occupancy covenant breach confirmed — 78.5%", prior_state: "Monitoring", new_state: "Exception", category: "Covenant" },
      { ts: "2026-01-20T11:00:00Z", actor: "Servicer", action: "Cure notice sent — occupancy", prior_state: "Open", new_state: "Sent", category: "Borrower" },
      { ts: "2026-02-05T14:00:00Z", actor: "Borrower", action: "Cure response received — lease pipeline submitted", prior_state: "Sent", new_state: "Responded", category: "Borrower" },
      { ts: "2026-04-14T15:00:00Z", actor: "Borrower", action: "PM transition package submitted (Oak Management Co.)", prior_state: "Open", new_state: "In Review", category: "PM Compliance" },
    ],
  },
  {
    loan_ref: "LN-1120",
    borrower: "Sunrise Holdings",
    property: "Sunrise Business Park",
    type: "Mixed-Use",
    stage: "performing",
    stage_since: "2024-04-01",
    dscr: 1.55,
    dscr_covenant: 1.25,
    occupancy_pct: 97.2,
    occupancy_threshold: 80,
    upb: 3_200_000,
    agency: "Portfolio",
    pm_company: "Sunrise Asset Management",
    pm_contact: "Nina Alvarez · (305) 555-0296",
    pm_fee_pct: 4.0,
    pm_agreement_expires: "2027-03-31",
    compliance_items: [
      {
        id: "ci-1120-1",
        category: "Reporting",
        title: "Q2 rent roll due Jun 15",
        detail: "Routine quarterly rent roll. All prior submissions validated.",
        severity: "low",
        status: "open",
        sla_due: "2026-06-15",
        sla_days_remaining: 50,
        required_docs: ["Signed Rent Roll"],
        docs_received: [],
        requires_approval: false,
        agency_ref: "Portfolio Servicing Agreement §4.2",
      },
    ],
    reporting: [
      { name: "Annual Financial Statement", frequency: "Annual", due_date: "2026-04-30", submitted_date: "2026-04-05", status: "current", validated: true, agency_required: true },
      { name: "Q1 Rent Roll", frequency: "Quarterly", due_date: "2026-04-15", submitted_date: "2026-04-10", status: "current", validated: true, agency_required: true },
      { name: "Property Insurance Certificate", frequency: "Annual", due_date: "2026-07-01", submitted_date: "2025-07-05", status: "current", validated: true, agency_required: true },
      { name: "Annual Physical Inspection", frequency: "Annual", due_date: "2026-07-31", submitted_date: null, status: "due_soon", validated: false, agency_required: false },
      { name: "Replacement Reserve Analysis", frequency: "Annual", due_date: "2026-07-31", submitted_date: "2025-07-20", status: "current", validated: true, agency_required: false },
    ],
    pm_eligibility: [
      { criterion: "Management experience", required: "≥3 years mixed-use", actual: "11 years", pass: true, agency_ref: "Portfolio Servicing Agreement §6.1" },
      { criterion: "Proximity to property", required: "≤75 miles", actual: "4 miles (Miami)", pass: true, agency_ref: "Portfolio Servicing Agreement §6.1" },
      { criterion: "Management fee", required: "≤7% EGI", actual: "4.0%", pass: true, agency_ref: "Portfolio Servicing Agreement §6.2" },
      { criterion: "Agreement term", required: "Current, not expired", actual: "Expires Mar 31, 2027", pass: true, agency_ref: "Portfolio Servicing Agreement §6.3" },
      { criterion: "Termination clause", required: "30-day notice", actual: "30-day notice ✓", pass: true, agency_ref: "Portfolio Servicing Agreement §6.4" },
      { criterion: "Insurance certificates", required: "Current GL", actual: "Current (exp Jul 2026)", pass: true, agency_ref: "Portfolio Servicing Agreement §6.5" },
    ],
    inspections: [
      { date: "2025-07-10", inspector: "Engel Burman Group", condition: "LS1", score: 91, open_items: 1, resolved_items: 5, next_required: "2026-07-31" },
    ],
    borrower_interactions: [],
    audit_log: [
      { ts: "2026-04-05T10:00:00Z", actor: "Borrower", action: "Annual financials submitted — validated clean", prior_state: "Pending", new_state: "Validated", category: "Reporting" },
      { ts: "2026-04-10T09:00:00Z", actor: "System", action: "April payment posted — on time", prior_state: "Due", new_state: "Posted", category: "Reporting" },
    ],
  },
];

// ── Stage config ───────────────────────────────────────────────────────────────

const STAGES: { key: LifecycleStage; label: string; color: string; bg: string; dot: string }[] = [
  { key: "performing",  label: "Performing",  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200",  dot: "bg-emerald-500" },
  { key: "monitoring",  label: "Monitoring",  color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",      dot: "bg-amber-500"   },
  { key: "exception",   label: "Exception",   color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",    dot: "bg-orange-500"  },
  { key: "default",     label: "Default",     color: "text-red-700",     bg: "bg-red-50 border-red-200",          dot: "bg-red-500"     },
  { key: "resolution",  label: "Resolution",  color: "text-violet-700",  bg: "bg-violet-50 border-violet-200",    dot: "bg-violet-500"  },
];

const stageFor = (s: LifecycleStage) => STAGES.find(x => x.key === s) ?? STAGES[0];

const severityConfig: Record<ComplianceSeverity, { label: string; bg: string; dot: string }> = {
  critical: { label: "Critical", bg: "bg-red-100 text-red-800",    dot: "bg-red-500" },
  high:     { label: "High",     bg: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  medium:   { label: "Medium",   bg: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  low:      { label: "Low",      bg: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

const ciStatusConfig: Record<ComplianceStatus, { label: string; bg: string }> = {
  open:        { label: "Open",        bg: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", bg: "bg-blue-100 text-blue-700" },
  resolved:    { label: "Resolved",    bg: "bg-emerald-100 text-emerald-700" },
  overdue:     { label: "Overdue",     bg: "bg-red-100 text-red-700" },
};

const reportingStatusConfig = {
  current:   { label: "Current",   dot: "bg-emerald-500", color: "text-emerald-700" },
  due_soon:  { label: "Due Soon",  dot: "bg-amber-500",   color: "text-amber-700" },
  overdue:   { label: "Overdue",   dot: "bg-red-500",     color: "text-red-700" },
  missing:   { label: "Missing",   dot: "bg-red-600",     color: "text-red-800" },
};

const conditionConfig = {
  LS1:      { label: "LS1 — Good",     color: "text-emerald-700" },
  LS2:      { label: "LS2 — Fair",     color: "text-amber-700" },
  LS3:      { label: "LS3 — Marginal", color: "text-orange-700" },
  DM:       { label: "DM — Deficient", color: "text-red-700" },
  Critical: { label: "Critical",       color: "text-red-900" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type DetailTab = "compliance" | "reporting" | "pm" | "inspections" | "borrower" | "audit";

const TABS: { key: DetailTab; label: string; icon: typeof ClockIcon }[] = [
  { key: "compliance",  label: "Compliance Queue", icon: BellAlertIcon },
  { key: "reporting",   label: "Reporting",        icon: ChartBarIcon },
  { key: "pm",          label: "PM Eligibility",   icon: UserGroupIcon },
  { key: "inspections", label: "Inspections",      icon: ShieldCheckIcon },
  { key: "borrower",    label: "Borrower",         icon: DocumentTextIcon },
  { key: "audit",       label: "Audit Log",        icon: ClipboardDocumentListIcon },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function LifecyclePipeline({ stage }: { stage: LifecycleStage }) {
  const stageIdx = STAGES.findIndex(s => s.key === stage);
  return (
    <div className="flex items-center gap-0">
      {STAGES.map((s, i) => {
        const active  = s.key === stage;
        const passed  = i < stageIdx;
        return (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
              active  ? `${s.bg} border ${s.color}` :
              passed  ? "bg-slate-200 text-slate-500" :
              "bg-slate-50 text-slate-300 border border-slate-100"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${active ? s.dot : passed ? "bg-slate-400" : "bg-slate-200"}`} />
              {s.label}
            </div>
            {i < STAGES.length - 1 && (
              <ArrowRightIcon className={`h-3 w-3 mx-1 ${i < stageIdx ? "text-slate-400" : "text-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ComplianceQueueItem({
  item, onAct,
}: {
  item: ComplianceItem;
  onAct: (id: string, action: "progress" | "resolve") => void;
}) {
  const sv = severityConfig[item.severity];
  const st = ciStatusConfig[item.status];
  const overdue = item.sla_days_remaining < 0;
  const docsOk = item.docs_received.length >= item.required_docs.length;

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${item.status === "overdue" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-black uppercase shrink-0 ${sv.bg}`}>
            {sv.label}
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">{item.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{item.category} · {item.agency_ref}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.bg}`}>{st.label}</span>
          <span className={`text-xs font-semibold ${overdue ? "text-red-700" : item.sla_days_remaining <= 10 ? "text-amber-700" : "text-slate-500"}`}>
            {overdue ? `${Math.abs(item.sla_days_remaining)}d overdue` : `${item.sla_days_remaining}d remaining`}
          </span>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.detail}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-500 mb-1">Required Documents</p>
          <div className="space-y-1">
            {item.required_docs.map(doc => {
              const rx = item.docs_received.includes(doc);
              return (
                <div key={doc} className="flex items-center gap-1.5">
                  {rx
                    ? <CheckCircleIcon className="h-3 w-3 text-emerald-500 shrink-0" />
                    : <XCircleIcon className="h-3 w-3 text-red-400 shrink-0" />}
                  <span className={rx ? "text-emerald-700" : "text-red-700"}>{doc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {item.requires_approval && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 self-start">
            <ShieldCheckIcon className="inline h-3 w-3 mr-1" />
            Requires lender approval
          </div>
        )}
      </div>

      {item.status !== "resolved" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAct(item.id, "progress")}
            disabled={item.status === "in_progress"}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            Mark In Progress
          </button>
          <button
            onClick={() => onAct(item.id, "resolve")}
            disabled={!docsOk}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition"
          >
            {docsOk ? "Resolve Item" : `${item.docs_received.length}/${item.required_docs.length} docs — blocked`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ServicingManagementPage() {
  const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
  const [selectedRef, setSelectedRef] = useState<string>(LOANS[0].loan_ref);
  const [activeTab, setActiveTab] = useState<DetailTab>("compliance");
  const [items, setItems] = useState<Record<string, ComplianceItem[]>>(
    Object.fromEntries(LOANS.map(l => [l.loan_ref, l.compliance_items]))
  );

  const loan = LOANS.find(l => l.loan_ref === selectedRef) ?? LOANS[0];
  const stage = stageFor(loan.stage);
  const loanItems = items[loan.loan_ref] ?? [];

  const openItems     = loanItems.filter(i => i.status !== "resolved");
  const criticalCount = loanItems.filter(i => i.severity === "critical" && i.status !== "resolved").length;
  const overdueCount  = loanItems.filter(i => i.status === "overdue").length;

  const handleAct = (id: string, action: "progress" | "resolve") => {
    setItems(prev => ({
      ...prev,
      [loan.loan_ref]: (prev[loan.loan_ref] ?? []).map(ci => {
        if (ci.id !== id) return ci;
        const next = action === "resolve" ? "resolved" : "in_progress";
        if (action === "resolve") {
          logAudit({
            id: `audit-ci-${id}-${Date.now()}`,
            action: `Compliance item resolved — ${ci.title}`,
            detail: ci.detail,
            timestamp: new Date().toISOString(),
            status: "approved",
          });
          if (ci.requires_approval) {
            requestApproval(`Lender approval — ${ci.title}`, ci.detail);
          }
        } else {
          addTask({
            id: `task-ci-${id}`,
            title: ci.title,
            detail: ci.detail,
            status: "in-review",
            category: ci.category,
            requiresApproval: ci.requires_approval,
          });
        }
        return { ...ci, status: next as ComplianceStatus };
      }),
    }));
  };

  const handleSendNotice = (interaction: BorrowerInteraction) => {
    requestApproval(
      `Send ${interaction.type} — ${loan.loan_ref}`,
      `${loan.borrower} · ${loan.property}: ${interaction.summary}`
    );
    addAlert({
      id: `alert-borrower-${loan.loan_ref}-${Date.now()}`,
      title: `${interaction.type} queued — ${loan.loan_ref}`,
      detail: interaction.summary,
      severity: "medium",
      category: "Borrower",
    });
  };

  const portfolioStats = {
    performing: LOANS.filter(l => l.stage === "performing").length,
    monitoring:  LOANS.filter(l => l.stage === "monitoring").length,
    exception:   LOANS.filter(l => l.stage === "exception").length,
    critical:    LOANS.flatMap(l => l.compliance_items).filter(i => i.severity === "critical" && i.status !== "resolved").length,
    overdue:     LOANS.flatMap(l => l.compliance_items).filter(i => i.status === "overdue").length,
  };

  return (
    <div className="space-y-5">
      {/* Portfolio header */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Performing",  value: portfolioStats.performing, color: "text-emerald-700" },
          { label: "Monitoring",  value: portfolioStats.monitoring,  color: "text-amber-700" },
          { label: "Exception",   value: portfolioStats.exception,   color: "text-orange-700" },
          { label: "Critical Items", value: portfolioStats.critical, color: portfolioStats.critical > 0 ? "text-red-700" : "text-emerald-700" },
          { label: "Overdue",     value: portfolioStats.overdue,    color: portfolioStats.overdue > 0 ? "text-red-700" : "text-emerald-700" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Loan roster */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Asset Compliance Roster — {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Loan / Property</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-right">DSCR</th>
                <th className="px-4 py-3 text-right">Occupancy</th>
                <th className="px-4 py-3 text-center">Open Items</th>
                <th className="px-4 py-3 text-center">Critical</th>
                <th className="px-4 py-3 text-left">Agency</th>
              </tr>
            </thead>
            <tbody>
              {LOANS.map(l => {
                const sg = stageFor(l.stage);
                const lItems = items[l.loan_ref] ?? [];
                const lCrit = lItems.filter(i => i.severity === "critical" && i.status !== "resolved").length;
                const lOpen = lItems.filter(i => i.status !== "resolved").length;
                const dscrOk = l.dscr >= l.dscr_covenant;
                const occOk  = l.occupancy_pct >= l.occupancy_threshold;
                return (
                  <tr
                    key={l.loan_ref}
                    onClick={() => { setSelectedRef(l.loan_ref); setActiveTab("compliance"); }}
                    className={`border-t border-slate-100 cursor-pointer transition hover:bg-slate-50 ${selectedRef === l.loan_ref ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BuildingOffice2Icon className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-900">{l.loan_ref}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[160px]">{l.property}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${sg.bg} ${sg.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${sg.dot}`} />
                        {sg.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${dscrOk ? "text-emerald-700" : "text-red-700"}`}>
                      {l.dscr.toFixed(3)}x
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${occOk ? "text-slate-700" : "text-red-700 font-bold"}`}>
                      {l.occupancy_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      {lOpen > 0
                        ? <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{lOpen}</span>
                        : <CheckCircleIcon className="h-4 w-4 text-emerald-500 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {lCrit > 0
                        ? <span className="inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-black text-red-800">{lCrit}</span>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{l.agency}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loan detail engine */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Loan header */}
        <div className={`border-b px-5 py-4 ${stage.bg}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-base font-black ${stage.color}`}>{loan.loan_ref}</h2>
                <span className="text-slate-400">·</span>
                <span className="text-sm font-semibold text-slate-700">{loan.borrower}</span>
                <span className="text-slate-400">·</span>
                <span className="text-xs text-slate-500">{loan.property}</span>
              </div>
              <div className="mt-2">
                <LifecyclePipeline stage={loan.stage} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                In {loan.stage} stage since {loan.stage_since} · {loan.agency} · {fmt(loan.upb)} UPB
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-lg border border-white/80 bg-white/60 px-3 py-2 shadow-sm text-center">
                <p className="text-xs text-slate-400">DSCR</p>
                <p className={`font-black text-lg ${loan.dscr >= loan.dscr_covenant ? "text-emerald-700" : "text-red-700"}`}>
                  {loan.dscr.toFixed(3)}x
                </p>
                <p className="text-[10px] text-slate-400">Floor: {loan.dscr_covenant}x</p>
              </div>
              <div className="rounded-lg border border-white/80 bg-white/60 px-3 py-2 shadow-sm text-center">
                <p className="text-xs text-slate-400">Occupancy</p>
                <p className={`font-black text-lg ${loan.occupancy_pct >= loan.occupancy_threshold ? "text-emerald-700" : "text-red-700"}`}>
                  {loan.occupancy_pct.toFixed(1)}%
                </p>
                <p className="text-[10px] text-slate-400">Min: {loan.occupancy_threshold}%</p>
              </div>
              <div className="rounded-lg border border-white/80 bg-white/60 px-3 py-2 shadow-sm text-center">
                <p className="text-xs text-slate-400">Open Items</p>
                <p className={`font-black text-lg ${openItems.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {openItems.length}
                </p>
                <p className="text-[10px] text-slate-400">{criticalCount} critical · {overdueCount} overdue</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-100 bg-slate-50 px-4">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition ${
                    activeTab === tab.key
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.key === "compliance" && openItems.length > 0 && (
                    <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                      {openItems.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-5">
          {/* ── Compliance Queue ── */}
          {activeTab === "compliance" && (
            <div className="space-y-3">
              {loanItems.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-700">No open compliance items — loan in good standing.</p>
                </div>
              ) : (
                loanItems
                  .sort((a, b) => {
                    const order = { overdue: 0, critical: 1, high: 2, medium: 3, low: 4 };
                    if (a.status === "overdue" && b.status !== "overdue") return -1;
                    if (b.status === "overdue" && a.status !== "overdue") return 1;
                    return (order[a.severity as keyof typeof order] ?? 5) - (order[b.severity as keyof typeof order] ?? 5);
                  })
                  .map(item => (
                    <ComplianceQueueItem key={item.id} item={item} onAct={handleAct} />
                  ))
              )}
            </div>
          )}

          {/* ── Reporting ── */}
          {activeTab === "reporting" && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 text-left">Report</th>
                    <th className="px-4 py-3 text-center">Frequency</th>
                    <th className="px-4 py-3 text-right">Due</th>
                    <th className="px-4 py-3 text-right">Submitted</th>
                    <th className="px-4 py-3 text-center">Validated</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.reporting.map((r, i) => {
                    const rs = reportingStatusConfig[r.status];
                    return (
                      <tr key={i} className={`border-t border-slate-100 ${r.status === "overdue" ? "bg-red-50" : r.status === "due_soon" ? "bg-amber-50/40" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{r.name}</p>
                          {r.agency_required && <p className="text-xs text-slate-400">Agency required</p>}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500">{r.frequency}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{r.due_date}</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {r.submitted_date ?? <span className="text-red-500 font-semibold">Not submitted</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.validated
                            ? <CheckCircleIcon className="h-4 w-4 text-emerald-500 mx-auto" />
                            : r.submitted_date
                              ? <ClockIcon className="h-4 w-4 text-amber-500 mx-auto" />
                              : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${rs.dot}`} />
                            <span className={`text-xs font-semibold ${rs.color}`}>{rs.label}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── PM Eligibility ── */}
          {activeTab === "pm" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{loan.pm_company}</p>
                  <p className="text-xs text-slate-500">{loan.pm_contact} · {loan.pm_fee_pct}% fee · Expires {loan.pm_agreement_expires}</p>
                </div>
                <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
                  loan.pm_eligibility.every(c => c.pass)
                    ? "bg-emerald-100 text-emerald-700"
                    : loan.pm_eligibility.some(c => !c.pass && ["Agreement term", "Termination clause"].includes(c.criterion))
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                }`}>
                  {loan.pm_eligibility.every(c => c.pass)
                    ? "Fully Compliant"
                    : `${loan.pm_eligibility.filter(c => !c.pass).length} Criteria Failing`}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3 text-left">Criterion</th>
                      <th className="px-4 py-3 text-left">Required</th>
                      <th className="px-4 py-3 text-left">Actual</th>
                      <th className="px-4 py-3 text-left">Agency Reference</th>
                      <th className="px-4 py-3 text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.pm_eligibility.map((c, i) => (
                      <tr key={i} className={`border-t border-slate-100 ${!c.pass ? "bg-red-50" : ""}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">{c.criterion}</td>
                        <td className="px-4 py-3 text-slate-600">{c.required}</td>
                        <td className={`px-4 py-3 font-semibold ${c.pass ? "text-emerald-700" : "text-red-700"}`}>{c.actual}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{c.agency_ref}</td>
                        <td className="px-4 py-3 text-center">
                          {c.pass
                            ? <CheckCircleIcon className="h-5 w-5 text-emerald-500 mx-auto" />
                            : <XCircleIcon className="h-5 w-5 text-red-500 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Inspections ── */}
          {activeTab === "inspections" && (
            <div className="space-y-3">
              {loan.inspections.map((insp, i) => {
                const cc = conditionConfig[insp.condition];
                return (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{insp.date}</p>
                          <span className={`text-xs font-bold ${cc.color}`}>{cc.label}</span>
                        </div>
                        <p className="text-xs text-slate-500">{insp.inspector}</p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-2xl font-black text-slate-900">{insp.score}</p>
                          <p className="text-xs text-slate-400">Score / 100</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-2xl font-black ${insp.open_items > 0 ? "text-amber-700" : "text-emerald-700"}`}>{insp.open_items}</p>
                          <p className="text-xs text-slate-400">Open</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black text-slate-500">{insp.resolved_items}</p>
                          <p className="text-xs text-slate-400">Resolved</p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Next inspection required by: <strong>{insp.next_required}</strong></p>
                  </div>
                );
              })}
              {loan.inspections.length === 0 && (
                <p className="text-sm text-slate-400 italic">No inspection records on file.</p>
              )}
            </div>
          )}

          {/* ── Borrower Interactions ── */}
          {activeTab === "borrower" && (
            <div className="space-y-3">
              {loan.borrower_interactions.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No borrower interactions recorded.</p>
              ) : (
                loan.borrower_interactions.map((bi, i) => {
                  const isPending = bi.status === "pending_approval";
                  return (
                    <div key={i} className={`rounded-xl border p-4 shadow-sm ${isPending ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              bi.status === "pending_approval" ? "bg-amber-100 text-amber-800" :
                              bi.status === "sent"            ? "bg-blue-100 text-blue-800" :
                              bi.status === "responded"       ? "bg-emerald-100 text-emerald-800" :
                              "bg-red-100 text-red-800"
                            }`}>{bi.type}</span>
                            <span className="text-xs text-slate-400">{bi.date}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">{bi.summary}</p>
                        </div>
                        {isPending && (
                          <button
                            onClick={() => handleSendNotice(bi)}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition shrink-0"
                          >
                            Submit for Approval
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Audit Log ── */}
          {activeTab === "audit" && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Immutable Audit Trail — {loan.loan_ref}
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {loan.audit_log.map((ev, i) => (
                  <div key={i} className="flex items-start gap-4 px-4 py-3">
                    <div className="w-36 shrink-0 text-xs text-slate-400 tabular-nums">
                      {new Date(ev.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{ev.action}</p>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{ev.actor}</span>
                        <span>·</span>
                        <span>{ev.category}</span>
                        {ev.prior_state !== ev.new_state && (
                          <>
                            <span>·</span>
                            <span>{ev.prior_state} → <strong>{ev.new_state}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
