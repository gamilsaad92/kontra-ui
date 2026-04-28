/**
 * Servicing Cases — Phase 3
 *
 * Structured case management system for servicing events.
 * Each case captures a compliance/operational event on a loan,
 * tracks its lifecycle, and shows its impact on the Token Gate.
 *
 * Case types: Covenant Breach · Insurance Lapse · Reserve Shortfall ·
 *   Inspection Finding · Occupancy Watch · LTV Breach · Tax Delinquency ·
 *   Token Issuance Block · Borrower Communication · Routine Review
 *
 * Lifecycle: Open → In Review → Pending Borrower → Escalated → Resolved
 *
 * Architecture: Servicing Cases feed the Compliance Gate,
 * which blocks or clears tokenization downstream.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ClockIcon,
  UserIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ArrowTopRightOnSquareIcon,
  CubeIcon,
  FlagIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  XMarkIcon,
  BanknotesIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

// ── Types ──────────────────────────────────────────────────────────────────────
type CaseSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type CaseStatus   = 'Open' | 'In Review' | 'Pending Borrower' | 'Escalated' | 'Resolved';
type CaseType =
  | 'Covenant Breach'
  | 'Insurance Renewal'
  | 'Reserve Shortfall'
  | 'Inspection Finding'
  | 'Occupancy Watch'
  | 'LTV Breach'
  | 'Tax Delinquency'
  | 'Token Issuance Block'
  | 'Borrower Communication'
  | 'Routine Review';

interface CaseActivity {
  date: string;
  actor: string;
  role: string;
  action: string;
  note?: string;
}

interface ServicingCase {
  id: string;
  loanId: string;
  loanTitle: string;
  type: CaseType;
  severity: CaseSeverity;
  status: CaseStatus;
  assignedTo: string;
  assignedRole: string;
  openedDate: string;
  dueDate: string;
  resolvedDate?: string;
  summary: string;
  description: string;
  tokenGateImpact: 'SUSPENDED' | 'WATCH' | 'CLEAR' | 'NONE';
  tokenGateCriterion: string;
  regulatoryRef: string;
  activity: CaseActivity[];
}

// ── Demo cases ─────────────────────────────────────────────────────────────────
const CASES: ServicingCase[] = [
  {
    id: 'CASE-010',
    loanId: 'LN-5593',
    loanTitle: 'Harbour Square Retail',
    type: 'LTV Breach',
    severity: 'CRITICAL',
    status: 'Escalated',
    assignedTo: 'Marcus Webb',
    assignedRole: 'Senior Servicer',
    openedDate: '2026-04-10',
    dueDate: '2026-04-30',
    summary: 'LTV at 71.8% — exceeds 70.0% cap. Loan is TOKEN SUSPENDED.',
    description: 'Current appraised LTV of 71.8% breaches the 70.0% LTV covenant cap. Per the Loan Agreement §7.2(b), borrower must either (a) principal paydown to restore compliance or (b) provide approved supplemental collateral within 30 days of notice. Case escalated to senior review on 2026-04-20. Token gate criterion #8 (LTV ≤ Cap) is in breach, blocking tokenization.',
    tokenGateImpact: 'SUSPENDED',
    tokenGateCriterion: 'LTV ≤ Covenant Cap',
    regulatoryRef: 'Freddie Mac Multifamily §23.3 · Loan Agreement §7.2(b)',
    activity: [
      { date: '2026-04-10', actor: 'System', role: 'Automated', action: 'Case auto-created', note: 'LTV threshold breach detected during quarterly covenant check.' },
      { date: '2026-04-12', actor: 'Marcus Webb', role: 'Senior Servicer', action: 'Case accepted', note: 'Reviewing appraisal report and contacting borrower.' },
      { date: '2026-04-15', actor: 'Marcus Webb', role: 'Senior Servicer', action: 'Breach notice sent', note: 'Formal breach notice delivered to GCO Property Partners per Loan Agreement §7.2.' },
      { date: '2026-04-20', actor: 'Marcus Webb', role: 'Senior Servicer', action: 'Escalated to senior review', note: 'Borrower has not responded within 5-day window. Escalating per SOP.' },
    ],
  },
  {
    id: 'CASE-001',
    loanId: 'LN-5593',
    loanTitle: 'Harbour Square Retail',
    type: 'Covenant Breach',
    severity: 'CRITICAL',
    status: 'Open',
    assignedTo: 'Sarah Chen',
    assignedRole: 'Servicer',
    openedDate: '2026-04-08',
    dueDate: '2026-05-01',
    summary: 'DSCR at 1.08x — below 1.20x floor. 30-day cure window active.',
    description: 'DSCR has declined to 1.08x against a covenant floor of 1.20x. Per the Fannie Mae Multifamily Servicing Guide §303, a 30-day cure period is triggered. Borrower must submit a Corrective Action Plan (CAP) detailing steps to restore DSCR compliance. Failure to cure within 30 days will trigger a default event. Token Gate criterion #5 (DSCR ≥ Floor) is in breach — tokenization is SUSPENDED.',
    tokenGateImpact: 'SUSPENDED',
    tokenGateCriterion: 'DSCR ≥ Covenant Floor',
    regulatoryRef: 'Fannie Mae Multifamily Servicing Guide §303 · Freddie Mac PRS §12.4',
    activity: [
      { date: '2026-04-08', actor: 'System', role: 'Automated', action: 'Case auto-created', note: 'Quarterly DSCR test failed: actual 1.08x vs floor 1.20x.' },
      { date: '2026-04-09', actor: 'Sarah Chen', role: 'Servicer', action: 'Case accepted', note: 'Reviewing Q1 financials submitted by borrower.' },
      { date: '2026-04-11', actor: 'Sarah Chen', role: 'Servicer', action: 'Cure notice sent', note: '30-day cure window opened. Borrower notified per Loan Agreement §8.1.' },
    ],
  },
  {
    id: 'CASE-002',
    loanId: 'LN-4108',
    loanTitle: 'Grand Central Offices',
    type: 'Covenant Breach',
    severity: 'CRITICAL',
    status: 'Open',
    assignedTo: 'Marcus Webb',
    assignedRole: 'Senior Servicer',
    openedDate: '2026-04-08',
    dueDate: '2026-05-01',
    summary: 'DSCR 1.08x (floor 1.25x) + Debt Yield 7.1% (floor 8.0%). Dual breach.',
    description: 'Two simultaneous covenant breaches: (1) DSCR at 1.08x against 1.25x floor, and (2) Debt Yield at 7.1% against 8.0% floor. Combined breach severity is CRITICAL per internal SOP. A 30-day cure period is active. Borrower has submitted a preliminary Corrective Action Plan citing tenant renewals expected in Q2 2026. Token Gate criteria #5 and #8 are in breach — tokenization is SUSPENDED.',
    tokenGateImpact: 'SUSPENDED',
    tokenGateCriterion: 'DSCR ≥ Floor · Debt Yield ≥ Floor',
    regulatoryRef: 'Fannie Mae Guide §303 · Freddie Mac §12.4 · Loan Agreement §7.3',
    activity: [
      { date: '2026-04-08', actor: 'System', role: 'Automated', action: 'Case auto-created', note: 'Dual covenant breach detected: DSCR + Debt Yield.' },
      { date: '2026-04-10', actor: 'Marcus Webb', role: 'Senior Servicer', action: 'Case accepted + escalated', note: 'Dual breach triggers senior servicer assignment per SOP §4.2.' },
      { date: '2026-04-14', actor: 'Marcus Webb', role: 'Senior Servicer', action: 'CAP received', note: 'Borrower submitted preliminary Corrective Action Plan. Under review.' },
      { date: '2026-04-22', actor: 'Marcus Webb', role: 'Senior Servicer', action: 'CAP review in progress', note: 'CAP reviewed — tenant renewal LOIs received. Monitoring Q2 occupancy.' },
    ],
  },
  {
    id: 'CASE-007',
    loanId: 'LN-4108',
    loanTitle: 'Grand Central Offices',
    type: 'Occupancy Watch',
    severity: 'HIGH',
    status: 'Open',
    assignedTo: 'Marcus Webb',
    assignedRole: 'Senior Servicer',
    openedDate: '2026-04-08',
    dueDate: '2026-05-30',
    summary: '81% occupancy — 4pp below 85% covenant floor. Linked to CASE-002.',
    description: 'Occupancy at 81% is 4 percentage points below the 85% covenant floor. This is a contributing factor to the DSCR breach in CASE-002. Borrower is pursuing two pending lease renewals (approx. 8,000 sq ft) expected to close by Q2 2026. If executed, occupancy would recover to ~87%, which would also improve DSCR. Monitoring in coordination with CASE-002.',
    tokenGateImpact: 'SUSPENDED',
    tokenGateCriterion: 'Occupancy ≥ Covenant Floor',
    regulatoryRef: 'Freddie Mac Multifamily Underwriting §8.2 · Loan Agreement §7.4',
    activity: [
      { date: '2026-04-08', actor: 'System', role: 'Automated', action: 'Case auto-created', note: 'Occupancy covenant breach: 81% < 85% floor.' },
      { date: '2026-04-10', actor: 'Marcus Webb', role: 'Senior Servicer', action: 'Linked to CASE-002', note: 'Occupancy decline is primary driver of DSCR breach.' },
      { date: '2026-04-22', actor: 'Marcus Webb', role: 'Senior Servicer', action: 'LOIs received', note: 'Two LOIs for 8,000 sq ft received. Expecting lease execution by May 15.' },
    ],
  },
  {
    id: 'CASE-003',
    loanId: 'LN-2847',
    loanTitle: 'The Meridian Apartments',
    type: 'Insurance Renewal',
    severity: 'HIGH',
    status: 'Open',
    assignedTo: 'Elena Torres',
    assignedRole: 'Servicer',
    openedDate: '2026-04-15',
    dueDate: '2026-06-15',
    summary: 'The Hartford policy (HP-2847-2024) expires Jul 15. 78-day renewal window.',
    description: 'Commercial property insurance with The Hartford (Policy HP-2847-2024) expires July 15, 2026. Per Fannie Mae Multifamily Servicing Guide §601 and the Loan Agreement §6.3, borrower must deliver evidence of renewal no later than 30 days before expiry (June 15). A 78-day watch window is now open. Token Gate criterion #2 (Insurance Active) is on WATCH — if policy lapses, tokenization will be SUSPENDED.',
    tokenGateImpact: 'WATCH',
    tokenGateCriterion: 'Insurance Active & Not Expiring',
    regulatoryRef: 'Fannie Mae Multifamily Servicing Guide §601 · Loan Agreement §6.3',
    activity: [
      { date: '2026-04-15', actor: 'System', role: 'Automated', action: 'Watch alert created', note: 'Insurance expiry within 90-day window. Auto-case opened.' },
      { date: '2026-04-16', actor: 'Elena Torres', role: 'Servicer', action: 'Case accepted', note: 'Contacting borrower and Hartford agent for renewal evidence.' },
      { date: '2026-04-20', actor: 'Elena Torres', role: 'Servicer', action: 'Renewal requested', note: 'Formal renewal request sent to borrower. 30-day response deadline set.' },
    ],
  },
  {
    id: 'CASE-004',
    loanId: 'LN-5593',
    loanTitle: 'Harbour Square Retail',
    type: 'Reserve Shortfall',
    severity: 'HIGH',
    status: 'Open',
    assignedTo: 'Sarah Chen',
    assignedRole: 'Servicer',
    openedDate: '2026-04-08',
    dueDate: '2026-05-15',
    summary: 'Reserve balance $78,500 — $11,500 below $90,000 minimum. Cure required.',
    description: 'Current reserve balance of $78,500 falls $11,500 short of the $90,000 minimum reserve requirement per the Loan Agreement §5.4. Borrower must deposit the deficiency within 30 days of notification. This shortfall is blocking Token Gate criterion #4 (Reserves ≥ Minimum). Linked to the broader stress conditions on LN-5593 (CASE-001 and CASE-010).',
    tokenGateImpact: 'SUSPENDED',
    tokenGateCriterion: 'Reserves ≥ Minimum',
    regulatoryRef: 'Freddie Mac Multifamily Servicing §5.1 · Loan Agreement §5.4',
    activity: [
      { date: '2026-04-08', actor: 'System', role: 'Automated', action: 'Reserve shortfall detected', note: 'Monthly escrow reconciliation: balance $78,500 vs $90,000 minimum.' },
      { date: '2026-04-09', actor: 'Sarah Chen', role: 'Servicer', action: 'Case accepted', note: 'Deficiency notice to be prepared.' },
      { date: '2026-04-12', actor: 'Sarah Chen', role: 'Servicer', action: 'Deficiency notice sent', note: 'Borrower notified of $11,500 reserve shortfall. 30-day cure window.' },
    ],
  },
  {
    id: 'CASE-005',
    loanId: 'LN-5593',
    loanTitle: 'Harbour Square Retail',
    type: 'Inspection Finding',
    severity: 'MEDIUM',
    status: 'In Review',
    assignedTo: 'David Kim',
    assignedRole: 'Field Inspector',
    openedDate: '2026-02-21',
    dueDate: '2026-06-01',
    summary: '2 moderate findings: HVAC system degradation + parking structure drainage.',
    description: 'Colliers inspection (Feb 20, 2026) identified 2 moderate findings: (1) HVAC system showing end-of-life indicators — estimated replacement cost $85,000, and (2) parking structure drainage insufficient per current code — estimated remediation $40,000. Borrower has received bids. No critical findings. Token Gate criterion #8 (No Open Critical Repairs) is currently passing, but escalation to critical would block tokenization.',
    tokenGateImpact: 'NONE',
    tokenGateCriterion: 'No Open Critical Repairs (monitoring)',
    regulatoryRef: 'Freddie Mac Property Condition Assessment §4.3 · ASTM E2018',
    activity: [
      { date: '2026-02-21', actor: 'System', role: 'Automated', action: 'Findings imported', note: 'Post-inspection findings uploaded from Colliers report.' },
      { date: '2026-02-25', actor: 'David Kim', role: 'Field Inspector', action: 'Case accepted', note: 'Reviewing HVAC and drainage scopes of work.' },
      { date: '2026-03-10', actor: 'David Kim', role: 'Field Inspector', action: 'Bids received', note: 'Borrower provided 2 contractor bids for each finding. Under evaluation.' },
      { date: '2026-04-05', actor: 'David Kim', role: 'Field Inspector', action: 'Contractor selected', note: 'HVAC: Allied Mechanical ($82K). Drainage: Pacific Paving ($38K). Work scheduled Q2.' },
    ],
  },
  {
    id: 'CASE-008',
    loanId: 'LN-1120',
    loanTitle: 'Lakeside Mixed-Use',
    type: 'Token Issuance Block',
    severity: 'MEDIUM',
    status: 'Open',
    assignedTo: 'Elena Torres',
    assignedRole: 'Servicer',
    openedDate: '2026-04-01',
    dueDate: '2026-06-01',
    summary: 'PPM not filed + no KYC/AML investors verified. Blocking token issuance on LN-1120.',
    description: 'LN-1120 (Lakeside Mixed-Use) is operationally strong (DSCR 1.55x, LTV 61.8%, Gate 10/12) but blocked from token issuance on two investor-layer criteria: (1) Private Placement Memorandum (PPM) has not been filed with legal counsel — required per SEC Reg D 506(c) before any accredited investor offering, and (2) No investors have completed KYC/AML verification per FinCEN 31 CFR §1010.230. Both must be resolved before KTRA-1120 can be issued.',
    tokenGateImpact: 'WATCH',
    tokenGateCriterion: 'PPM Filed · KYC/AML Complete',
    regulatoryRef: 'SEC Reg D 506(c) · FinCEN 31 CFR §1010.230 · SEC Rule 506(c)(2)(ii)',
    activity: [
      { date: '2026-04-01', actor: 'Elena Torres', role: 'Servicer', action: 'Case created', note: 'Token gate pre-check for LN-1120 identified 2 blocking investor-layer gaps.' },
      { date: '2026-04-05', actor: 'Elena Torres', role: 'Servicer', action: 'Legal engaged', note: 'Outside counsel (Morrison & Foerster) engaged for PPM drafting. ETA: 6 weeks.' },
      { date: '2026-04-10', actor: 'Elena Torres', role: 'Servicer', action: 'KYC process initiated', note: 'Investor portal opened. 3 prospective accredited investors notified for KYC/AML onboarding.' },
    ],
  },
  {
    id: 'CASE-006',
    loanId: 'LN-3201',
    loanTitle: 'Rosewood Medical Plaza',
    type: 'Inspection Finding',
    severity: 'LOW',
    status: 'In Review',
    assignedTo: 'David Kim',
    assignedRole: 'Field Inspector',
    openedDate: '2025-12-12',
    dueDate: '2026-06-10',
    summary: '1 moderate + 3 minor findings from Dec 2025 Cushman & Wakefield inspection.',
    description: 'Cushman & Wakefield inspection (Dec 10, 2025) identified 1 moderate finding (elevator cab refurbishment — $28,000 est.) and 3 minor findings (exterior sealant, lobby lighting, HVAC filter schedule). All findings are cosmetic or deferred maintenance — no critical items. Borrower has budgeted repairs in Q2 2026 CapEx plan. Token Gate is not impacted.',
    tokenGateImpact: 'NONE',
    tokenGateCriterion: 'No impact — no critical findings',
    regulatoryRef: 'ASTM E2018 · Freddie Mac Property Condition §4.3',
    activity: [
      { date: '2025-12-12', actor: 'System', role: 'Automated', action: 'Findings imported', note: 'Cushman & Wakefield inspection report processed.' },
      { date: '2025-12-15', actor: 'David Kim', role: 'Field Inspector', action: 'Case accepted', note: 'All findings are low-severity. Monitoring borrower CapEx plan.' },
      { date: '2026-03-01', actor: 'David Kim', role: 'Field Inspector', action: 'CapEx plan received', note: 'Borrower Q2 CapEx plan includes elevator ($28K) and cosmetic items. Approved.' },
    ],
  },
  {
    id: 'CASE-009',
    loanId: 'LN-0728',
    loanTitle: 'Pacific Vista Industrial',
    type: 'Routine Review',
    severity: 'LOW',
    status: 'Resolved',
    assignedTo: 'Sarah Chen',
    assignedRole: 'Servicer',
    openedDate: '2026-04-01',
    dueDate: '2026-04-15',
    resolvedDate: '2026-04-10',
    summary: 'Semi-annual review complete. All 12/12 Token Gate criteria passing.',
    description: 'Semi-annual servicing review of LN-0728 (Pacific Vista Industrial). All financial covenants passing: DSCR 2.10x, LTV 55.0%, Occupancy 100%, Debt Yield 13.8%. Reserves at 162% of minimum. Insurance current through Mar 2027. Taxes paid. Rent roll certified by CBRE (March 2026). Colliers inspection clear (Jan 2026). All 12 Token Gate criteria passing. KTRA-0728 token status: ACTIVE.',
    tokenGateImpact: 'CLEAR',
    tokenGateCriterion: 'All 12/12 passing',
    regulatoryRef: 'Freddie Mac Annual Review §18.2 · Fannie Mae Guide §304',
    activity: [
      { date: '2026-04-01', actor: 'Sarah Chen', role: 'Servicer', action: 'Review opened', note: 'Semi-annual routine review — all inputs collected.' },
      { date: '2026-04-08', actor: 'Sarah Chen', role: 'Servicer', action: 'Review completed', note: 'All covenants passing. Token gate: 12/12. No actions required.' },
      { date: '2026-04-10', actor: 'Sarah Chen', role: 'Servicer', action: 'Case resolved', note: 'Routine review closed with clean bill of health. Next review: Oct 2026.' },
    ],
  },
];

// ── Config ────────────────────────────────────────────────────────────────────
const SEV: Record<CaseSeverity, { label: string; classes: string; dot: string }> = {
  CRITICAL: { label: 'Critical', classes: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500' },
  HIGH:     { label: 'High',     classes: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  MEDIUM:   { label: 'Medium',   classes: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-400' },
  LOW:      { label: 'Low',      classes: 'bg-slate-50 text-slate-600 border-slate-200',  dot: 'bg-slate-400' },
};

const STATUS_CFG: Record<CaseStatus, { classes: string; icon: React.ElementType }> = {
  'Open':              { classes: 'bg-blue-50 text-blue-700 border-blue-200',     icon: FlagIcon },
  'In Review':         { classes: 'bg-violet-50 text-violet-700 border-violet-200', icon: MagnifyingGlassIcon },
  'Pending Borrower':  { classes: 'bg-amber-50 text-amber-700 border-amber-200',  icon: ClockIcon },
  'Escalated':         { classes: 'bg-red-50 text-red-700 border-red-200',        icon: ExclamationTriangleIcon },
  'Resolved':          { classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircleIcon },
};

const GATE_IMPACT: Record<string, { label: string; classes: string; Icon: React.ElementType }> = {
  SUSPENDED: { label: 'Token SUSPENDED',  classes: 'bg-red-50 text-red-700 border-red-200',       Icon: ShieldExclamationIcon },
  WATCH:     { label: 'Token WATCH',      classes: 'bg-amber-50 text-amber-700 border-amber-200',  Icon: ShieldExclamationIcon },
  CLEAR:     { label: 'Token CLEAR',      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ShieldCheckIcon },
  NONE:      { label: 'No gate impact',   classes: 'bg-slate-50 text-slate-500 border-slate-200',  Icon: ShieldCheckIcon },
};

const TYPE_ICONS: Partial<Record<CaseType, React.ElementType>> = {
  'Covenant Breach':       ExclamationTriangleIcon,
  'Insurance Renewal':     ShieldCheckIcon,
  'Reserve Shortfall':     BanknotesIcon,
  'Inspection Finding':    WrenchScrewdriverIcon,
  'Occupancy Watch':       ExclamationTriangleIcon,
  'LTV Breach':            ExclamationTriangleIcon,
  'Token Issuance Block':  CubeIcon,
  'Routine Review':        CheckCircleIcon,
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function daysOpen(s: string, end?: string) {
  return Math.ceil((new Date(end ?? new Date().toISOString()).getTime() - new Date(s).getTime()) / 86400000);
}
function daysUntil(s: string) {
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
}

const STATUS_FLOW: CaseStatus[] = ['Open', 'In Review', 'Pending Borrower', 'Escalated', 'Resolved'];
const ALL_STATUSES: CaseStatus[] = ['Open', 'In Review', 'Pending Borrower', 'Escalated', 'Resolved'];

// ── New Case Modal ────────────────────────────────────────────────────────────
function NewCaseModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ loanId: 'LN-5593', type: 'Covenant Breach', severity: 'HIGH', assignedTo: '', summary: '' });
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-black text-slate-900">Open New Servicing Case</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 transition-colors">
            <XMarkIcon className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        {saved ? (
          <div className="px-6 py-10 text-center">
            <CheckCircleIcon className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
            <p className="font-bold text-slate-900">Case created</p>
            <p className="text-sm text-slate-500 mt-1">Assigned servicer notified.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Loan</label>
                <select value={form.loanId} onChange={(e) => setForm({ ...form, loanId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                  {['LN-0728', 'LN-3201', 'LN-2847', 'LN-4108', 'LN-5593', 'LN-1120'].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Severity</label>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Case Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                {['Covenant Breach', 'Insurance Renewal', 'Reserve Shortfall', 'Inspection Finding',
                  'Occupancy Watch', 'LTV Breach', 'Tax Delinquency', 'Token Issuance Block',
                  'Borrower Communication', 'Routine Review'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Assign To</label>
              <input type="text" placeholder="Servicer name" value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Summary</label>
              <textarea rows={3} placeholder="Brief description of the issue…" value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors">Open Case</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ServicingCasesPage() {
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'All'>('All');
  const [sevFilter, setSevFilter]       = useState<CaseSeverity | 'All'>('All');
  const [search, setSearch]             = useState('');
  const [expandedId, setExpanded]       = useState<string | null>(null);
  const [showNewCase, setShowNewCase]   = useState(false);
  const [noteInputs, setNoteInputs]     = useState<Record<string, string>>({});
  const [addedNotes, setAddedNotes]     = useState<Record<string, string[]>>({});

  const filtered = useMemo(() => {
    let out = CASES;
    if (statusFilter !== 'All') out = out.filter((c) => c.status === statusFilter);
    if (sevFilter !== 'All')    out = out.filter((c) => c.severity === sevFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((c) =>
        c.id.toLowerCase().includes(q) || c.loanId.toLowerCase().includes(q) ||
        c.loanTitle.toLowerCase().includes(q) || c.type.toLowerCase().includes(q) ||
        c.assignedTo.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q),
      );
    }
    return out;
  }, [statusFilter, sevFilter, search]);

  const stats = useMemo(() => {
    const open      = CASES.filter((c) => c.status !== 'Resolved');
    const critical  = CASES.filter((c) => c.severity === 'CRITICAL');
    const escalated = CASES.filter((c) => c.status === 'Escalated');
    const resolved  = CASES.filter((c) => c.status === 'Resolved');
    const avgDays   = open.length ? Math.round(open.reduce((s, c) => s + daysOpen(c.openedDate), 0) / open.length) : 0;
    const suspended = CASES.filter((c) => c.tokenGateImpact === 'SUSPENDED' && c.status !== 'Resolved').length;
    return { open: open.length, critical: critical.length, escalated: escalated.length, resolved: resolved.length, avgDays, suspended };
  }, []);

  return (
    <div className="space-y-5">
      {showNewCase && <NewCaseModal onClose={() => setShowNewCase(false)} />}

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Open Cases',        value: String(stats.open),      accent: stats.open > 0,      red: false },
          { label: 'Critical',          value: String(stats.critical),   accent: stats.critical > 0,  red: stats.critical > 0 },
          { label: 'Escalated',         value: String(stats.escalated),  accent: stats.escalated > 0, red: stats.escalated > 0 },
          { label: 'Avg Days Open',     value: `${stats.avgDays}d`,      accent: stats.avgDays > 14,  red: false },
          { label: 'Token SUSPENDED',   value: String(stats.suspended),  accent: stats.suspended > 0, red: stats.suspended > 0 },
          { label: 'Resolved (all time)', value: String(stats.resolved), accent: false,               red: false },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.red ? 'border-red-200 bg-red-50' : s.accent ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className={`mt-0.5 text-2xl font-black tabular-nums ${s.red ? 'text-red-700' : s.accent ? 'text-amber-700' : 'text-slate-900'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search case, loan, servicer…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900" />
        </div>
        <button onClick={() => setShowNewCase(true)}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors">
          <PlusIcon className="h-4 w-4" />Open New Case
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['All', ...ALL_STATUSES] as const).map((s) => {
          const count = s === 'All' ? CASES.length : CASES.filter((c) => c.status === s).length;
          const cfg = s !== 'All' ? STATUS_CFG[s as CaseStatus] : null;
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {count > 0 && s !== 'All' && s !== 'Resolved' && cfg && (
                <span className={`h-1.5 w-1.5 rounded-full ${statusFilter === s ? 'bg-white' : STATUS_CFG[s as CaseStatus]?.classes.includes('red') ? 'bg-red-500' : 'bg-slate-400'}`} />
              )}
              {s} ({count})
            </button>
          );
        })}
        <span className="w-px bg-slate-200 self-stretch mx-1" />
        {(['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => {
          const count = sev === 'All' ? CASES.length : CASES.filter((c) => c.severity === sev).length;
          const cfg = sev !== 'All' ? SEV[sev as CaseSeverity] : null;
          return (
            <button key={sev} onClick={() => setSevFilter(sev)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition-colors ${
                sevFilter === sev
                  ? (sev === 'CRITICAL' ? 'bg-red-600 text-white border-red-600' :
                     sev === 'HIGH' ? 'bg-orange-500 text-white border-orange-500' :
                     sev === 'MEDIUM' ? 'bg-amber-500 text-white border-amber-500' :
                     sev === 'LOW' ? 'bg-slate-700 text-white border-slate-700' :
                     'bg-slate-900 text-white border-slate-900')
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}>
              {cfg && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
              {sev === 'All' ? 'All Severity' : cfg!.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Case list */}
      <div className="space-y-3">
        {filtered.map((c) => (
          <CaseCard key={c.id} case_={c}
            expanded={expandedId === c.id}
            noteInput={noteInputs[c.id] ?? ''}
            addedNotes={addedNotes[c.id] ?? []}
            onToggle={() => setExpanded(expandedId === c.id ? null : c.id)}
            onNoteChange={(v) => setNoteInputs((p) => ({ ...p, [c.id]: v }))}
            onAddNote={(note) => {
              setAddedNotes((p) => ({ ...p, [c.id]: [...(p[c.id] ?? []), note] }));
              setNoteInputs((p) => ({ ...p, [c.id]: '' }));
            }}
          />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
            <p className="text-sm font-medium text-slate-600">No cases match your filters</p>
            <button onClick={() => { setStatusFilter('All'); setSevFilter('All'); setSearch(''); }}
              className="mt-2 text-xs text-slate-400 underline">Clear filters</button>
          </div>
        )}
      </div>

      {/* Regulatory footer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Compliance Architecture</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Every servicing case maps to a Token Gate criterion. Open Critical and High cases in Covenant Breach, Reserve Shortfall, LTV Breach, or Insurance Lapse categories
          automatically suspend tokenization on the affected loan until the case is Resolved.
          Regulatory basis: <span className="font-semibold">Freddie Mac PRS · Fannie Mae Guide §303 · SEC Reg D 506(c) · FinCEN 31 CFR §1010.230</span>.
        </p>
      </div>
    </div>
  );
}

// ── Case Card ─────────────────────────────────────────────────────────────────
function CaseCard({ case_: c, expanded, noteInput, addedNotes, onToggle, onNoteChange, onAddNote }: {
  case_: ServicingCase; expanded: boolean;
  noteInput: string; addedNotes: string[];
  onToggle: () => void;
  onNoteChange: (v: string) => void;
  onAddNote: (note: string) => void;
}) {
  const sevCfg  = SEV[c.severity];
  const statCfg = STATUS_CFG[c.status];
  const gateCfg = GATE_IMPACT[c.tokenGateImpact];
  const StatusIcon = statCfg.icon;
  const GateIcon   = gateCfg.Icon;
  const TypeIcon   = TYPE_ICONS[c.type] ?? DocumentTextIcon;

  const days    = c.status === 'Resolved' ? daysOpen(c.openedDate, c.resolvedDate) : daysOpen(c.openedDate);
  const due     = daysUntil(c.dueDate);
  const dueUrgent = due <= 7 && c.status !== 'Resolved';

  const isResolved = c.status === 'Resolved';

  return (
    <div className={`rounded-xl border bg-white ${
      c.severity === 'CRITICAL' && !isResolved ? 'border-red-200' :
      c.severity === 'HIGH' && !isResolved     ? 'border-orange-200' :
      isResolved                               ? 'border-emerald-100 opacity-80' :
      'border-slate-200'
    }`}>
      {/* Header row */}
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <TypeIcon className={`h-4 w-4 mt-0.5 shrink-0 ${c.severity === 'CRITICAL' ? 'text-red-500' : c.severity === 'HIGH' ? 'text-orange-500' : 'text-slate-400'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-slate-500 tabular-nums">{c.id}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-black ${sevCfg.classes}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${sevCfg.dot}`} />{sevCfg.label}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${statCfg.classes}`}>
                  <StatusIcon className="h-3 w-3" />{c.status}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${gateCfg.classes}`}>
                  <GateIcon className="h-3 w-3" />{gateCfg.label}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-900">{c.type} — {c.loanTitle}</p>
              <p className="text-xs text-slate-500 mt-0.5">{c.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <UserIcon className="h-3 w-3" />{c.assignedTo}
              </p>
              <p className="text-[10px] text-slate-400">{c.assignedRole}</p>
            </div>
            {expanded ? <ChevronUpIcon className="h-4 w-4 text-slate-400" /> : <ChevronDownIcon className="h-4 w-4 text-slate-400" />}
          </div>
        </div>

        {/* Meta strip */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            Opened {fmtDate(c.openedDate)} · {days} day{days !== 1 ? 's' : ''} {isResolved ? 'to resolve' : 'open'}
          </span>
          {!isResolved && (
            <span className={`flex items-center gap-1 ${dueUrgent ? 'text-red-600 font-bold' : ''}`}>
              <FlagIcon className="h-3.5 w-3.5" />
              Due {fmtDate(c.dueDate)}{due >= 0 ? ` (${due}d)` : ' — OVERDUE'}
            </span>
          )}
          {isResolved && c.resolvedDate && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircleIcon className="h-3.5 w-3.5" />Resolved {fmtDate(c.resolvedDate)}
            </span>
          )}
          <Link to={`/onchain/gate?loan=${c.loanId}`} onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-violet-600 hover:underline">
            <CubeIcon className="h-3.5 w-3.5" />{c.loanId} Token Gate
          </Link>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
          <div className="p-4 space-y-4">
            {/* Description */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Case Description</p>
              <p className="text-sm text-slate-700 leading-relaxed">{c.description}</p>
            </div>

            {/* Regulatory + Token Gate row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Regulatory Basis</p>
                <p className="text-xs text-slate-700 font-mono">{c.regulatoryRef}</p>
              </div>
              <div className={`rounded-lg border p-3 ${gateCfg.classes}`}>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Token Gate Impact</p>
                <p className="text-xs font-bold">{c.tokenGateCriterion}</p>
                <Link to={`/onchain/gate?loan=${c.loanId}`} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold underline opacity-80 hover:opacity-100">
                  View full gate evaluation →
                </Link>
              </div>
            </div>

            {/* Activity timeline */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Activity Timeline</p>
              <div className="space-y-0">
                {[...c.activity, ...addedNotes.map((n, i) => ({
                  date: new Date().toISOString().slice(0, 10),
                  actor: 'You', role: 'Servicer',
                  action: 'Note added', note: n,
                }))].map((a, i, arr) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                      {i < arr.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                    </div>
                    <div className="pb-3 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800">{a.actor}</span>
                        <span className="text-[10px] text-slate-400">{a.role}</span>
                        <span className="text-[10px] text-slate-400">{fmtDate(a.date)}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-semibold">{a.action}</p>
                      {a.note && <p className="text-xs text-slate-500 mt-0.5">{a.note}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add note */}
              {!isResolved && (
                <div className="flex gap-2 mt-2">
                  <input type="text" placeholder="Add a note or update…" value={noteInput}
                    onChange={(e) => onNoteChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && noteInput.trim()) onAddNote(noteInput.trim()); }}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900" />
                  <button onClick={() => noteInput.trim() && onAddNote(noteInput.trim())}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition-colors">
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <Link to={`/onchain/gate?loan=${c.loanId}`}
                className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors">
                <ShieldCheckIcon className="h-3.5 w-3.5" />Token Gate — {c.loanId}
              </Link>
              <Link to="/servicer/overview"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />Servicing Overview
              </Link>
              {(c.type === 'Covenant Breach' || c.type === 'LTV Breach') && (
                <Link to="/governance/loan-control"
                  className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />Governance
                </Link>
              )}
              {(c.type === 'Reserve Shortfall' || c.type === 'Insurance Renewal') && (
                <Link to="/servicer/escrow"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  <BanknotesIcon className="h-3.5 w-3.5" />Escrow
                </Link>
              )}
              {c.type === 'Inspection Finding' && (
                <Link to="/servicer/inspections"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  <WrenchScrewdriverIcon className="h-3.5 w-3.5" />Inspections
                </Link>
              )}
              {!isResolved && (
                <button className="ml-auto flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors">
                  <CheckCircleIcon className="h-3.5 w-3.5" />Mark Resolved
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
