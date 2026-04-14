/**
 * Kontra Command Centers API — Phase 8
 * Routes at /api/cc
 *
 * Covers all 6 operational command centers:
 *  servicing   – Servicing Operations Center
 *  inspection  – Inspection Intelligence Center
 *  hazard      – Hazard Loss Recovery Center
 *  compliance  – Compliance & Covenant Center
 *  exchange    – Tokenization Exchange Center
 *  admin       – Admin Policy Command Center
 */

const express = require('express');
const router  = express.Router();
const { v4: uuid } = require('uuid');

// ─── Seed helpers ─────────────────────────────────────────────────────────────

const now   = () => new Date().toISOString();
const minsAgo  = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();
const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

const STATUS_BADGE = {
  running:   { label: 'Running',    color: 'blue'   },
  pending:   { label: 'Pending',    color: 'amber'  },
  complete:  { label: 'Complete',   color: 'green'  },
  escalated: { label: 'Escalated',  color: 'red'    },
  breach:    { label: 'SLA Breach', color: 'red'    },
  review:    { label: 'In Review',  color: 'purple' },
  approved:  { label: 'Approved',   color: 'green'  },
  rejected:  { label: 'Rejected',   color: 'red'    },
  open:      { label: 'Open',       color: 'amber'  },
  closed:    { label: 'Closed',     color: 'gray'   },
};

// ─── In-memory state rings (reseeded on restart) ─────────────────────────────

const actionLog = []; // POST /actions append here

// ─────────────────────────────────────────────────────────────────────────────
// 1. SERVICING OPERATIONS CENTER
// ─────────────────────────────────────────────────────────────────────────────

const servicingData = () => ({
  kpis: [
    { label: 'Active Loans',       value: 1_284,   delta: '+12',   unit: '',    trend: 'up'   },
    { label: 'Payments Due Today', value: 47,       delta: '-3',    unit: '',    trend: 'down' },
    { label: 'Delinquency Rate',   value: 2.4,      delta: '-0.3%', unit: '%',   trend: 'down' },
    { label: 'Avg Days Past Due',  value: 8.2,      delta: '+1.1',  unit: 'days',trend: 'up'  },
    { label: 'SLA Breach Count',   value: 6,        delta: '+2',    unit: '',    trend: 'up'   },
    { label: 'Escrow Shortfalls',  value: 23,       delta: '-4',    unit: '',    trend: 'down' },
  ],
  workflows: [
    { id: uuid(), name: 'Payment Waterfall Processing',  loan: 'LN-0091', borrower: 'Greystone Capital',  status: 'running',   agent: 'PaymentAgent',   slaHours: 2,  elapsedMins: 38,  priority: 'high'   },
    { id: uuid(), name: 'Escrow Analysis & True-Up',     loan: 'LN-0047', borrower: 'Meridian RE Group',  status: 'running',   agent: 'EscrowAgent',    slaHours: 4,  elapsedMins: 87,  priority: 'normal' },
    { id: uuid(), name: 'Delinquency Cure Letter',       loan: 'LN-0132', borrower: 'Apex CRE Partners',  status: 'pending',   agent: 'NoticeAgent',    slaHours: 24, elapsedMins: 420, priority: 'normal' },
    { id: uuid(), name: 'Reserve Draw Request Review',   loan: 'LN-0208', borrower: 'Blackstone Realty',  status: 'breach',    agent: 'DrawAgent',      slaHours: 8,  elapsedMins: 620, priority: 'critical'},
    { id: uuid(), name: 'Late Charge Waiver Approval',   loan: 'LN-0017', borrower: 'Summit CRE Fund',    status: 'review',    agent: 'PolicyAgent',    slaHours: 6,  elapsedMins: 320, priority: 'low'    },
    { id: uuid(), name: 'Payoff Statement Generation',   loan: 'LN-0374', borrower: 'Harbor Investments', status: 'complete',  agent: 'DocAgent',       slaHours: 4,  elapsedMins: 210, priority: 'normal' },
    { id: uuid(), name: 'Balloon Maturity Alert',        loan: 'LN-0055', borrower: 'Metro Tower LLC',    status: 'escalated', agent: 'MaturityAgent',  slaHours: 1,  elapsedMins: 95,  priority: 'critical'},
  ],
  agentOutputs: [
    { id: uuid(), agent: 'PaymentAgent',  model: 'gpt-4o', action: 'Processed $342,800 payment for LN-0091; allocated $289,420 principal, $53,380 interest. Waterfall complete.',        confidence: 0.99, ts: minsAgo(4),  status: 'complete', loan: 'LN-0091' },
    { id: uuid(), agent: 'EscrowAgent',   model: 'gpt-4o', action: 'Projected $12,400 escrow shortfall for LN-0047. Recommend $1,033/mo increase starting next cycle.',               confidence: 0.94, ts: minsAgo(18), status: 'pending', loan: 'LN-0047' },
    { id: uuid(), agent: 'MaturityAgent', model: 'gpt-4o', action: 'LN-0055 matures in 47 days. Loan-to-value at 78.4%. Extension request received. Escalated to credit committee.',  confidence: 0.97, ts: minsAgo(31), status: 'escalated', loan: 'LN-0055' },
    { id: uuid(), agent: 'DrawAgent',     model: 'gpt-4o', action: 'Draw request $88,000 on LN-0208 — supporting invoices received, 2 of 3 lien waivers missing. SLA breached.',      confidence: 0.89, ts: minsAgo(62), status: 'breach',   loan: 'LN-0208' },
  ],
  approvals: [
    { id: uuid(), type: 'Reserve Draw',     loan: 'LN-0208', amount: 88_000, requestedBy: 'Blackstone Realty',  submittedAt: hoursAgo(10), urgency: 'high'   },
    { id: uuid(), type: 'Late Charge Waiver', loan: 'LN-0017', amount: 4_250, requestedBy: 'Summit CRE Fund',   submittedAt: hoursAgo(5),  urgency: 'normal' },
    { id: uuid(), type: 'Extension Request', loan: 'LN-0055', amount: 0,    requestedBy: 'Metro Tower LLC',    submittedAt: hoursAgo(2),  urgency: 'critical'},
  ],
  slaBreaches: [
    { id: uuid(), workflow: 'Reserve Draw Request Review', loan: 'LN-0208', breachedBy: '1h 20m', assignee: 'J. Rivera',  severity: 'critical' },
    { id: uuid(), workflow: 'Balloon Maturity Alert',      loan: 'LN-0055', breachedBy: '35m',    assignee: 'K. Thompson', severity: 'high'    },
  ],
  exceptions: [
    { id: uuid(), code: 'MISSING_LIEN_WAIVER',    description: 'LN-0208: 2 of 3 lien waivers missing for draw disbursement', loan: 'LN-0208', severity: 'high'   },
    { id: uuid(), code: 'ESCROW_SHORTFALL',        description: 'LN-0047: Projected shortfall of $12,400 before year-end',    loan: 'LN-0047', severity: 'medium' },
    { id: uuid(), code: 'DELINQUENCY_60_DAY',      description: 'LN-0132: 60-day delinquency threshold crossed',              loan: 'LN-0132', severity: 'high'   },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. INSPECTION INTELLIGENCE CENTER
// ─────────────────────────────────────────────────────────────────────────────

const inspectionData = () => ({
  kpis: [
    { label: 'Inspections This Month',  value: 94,    delta: '+8',   unit: '',   trend: 'up'   },
    { label: 'Critical Findings',       value: 12,    delta: '+3',   unit: '',   trend: 'up'   },
    { label: 'Avg Condition Score',     value: 72.4,  delta: '+1.2', unit: '/100',trend: 'up'  },
    { label: 'Pending Site Visits',     value: 19,    delta: '-5',   unit: '',   trend: 'down' },
    { label: 'AI Accuracy (30-day)',    value: 96.1,  delta: '+0.4%',unit: '%',  trend: 'up'   },
    { label: 'Deferred Maintenance',    value: 3.2,   delta: '+0.7', unit: '$M', trend: 'up'   },
  ],
  workflows: [
    { id: uuid(), name: 'AI Image Analysis — Roof',       property: '14 Harbor Blvd',  loan: 'LN-0309', status: 'running',   agent: 'InspectionAI', slaHours: 2,  elapsedMins: 22,  priority: 'normal'   },
    { id: uuid(), name: 'Structural Report Review',       property: '88 Park Ave',     loan: 'LN-0174', status: 'review',    agent: 'StructuralAI', slaHours: 4,  elapsedMins: 210, priority: 'high'     },
    { id: uuid(), name: 'HVAC Condition Assessment',      property: 'Riverside Tower', loan: 'LN-0411', status: 'running',   agent: 'MEPAgent',     slaHours: 3,  elapsedMins: 55,  priority: 'normal'   },
    { id: uuid(), name: 'Environmental Flag Review',      property: '720 Canal St',    loan: 'LN-0522', status: 'escalated', agent: 'EnvAgent',     slaHours: 1,  elapsedMins: 88,  priority: 'critical' },
    { id: uuid(), name: 'Annual Inspection Due Notice',   property: 'Midway Commerce', loan: 'LN-0088', status: 'pending',   agent: 'SchedulerAI',  slaHours: 24, elapsedMins: 0,   priority: 'low'      },
    { id: uuid(), name: 'Fire Safety Code Compliance',    property: '14 Harbor Blvd',  loan: 'LN-0309', status: 'breach',    agent: 'CodeAgent',    slaHours: 6,  elapsedMins: 490, priority: 'critical' },
  ],
  agentOutputs: [
    { id: uuid(), agent: 'InspectionAI', model: 'gpt-4o', action: '14 Harbor Blvd: AI roof analysis flagged 12% membrane deterioration, 2 active penetrations. Recommend immediate repair estimate.',     confidence: 0.93, ts: minsAgo(8),  status: 'pending',  property: '14 Harbor Blvd'  },
    { id: uuid(), agent: 'EnvAgent',     model: 'gpt-4o', action: '720 Canal St: Phase I ESA findings show potential contamination from adjacent dry cleaner. Phase II recommended. Escalated.',          confidence: 0.91, ts: minsAgo(27), status: 'escalated', property: '720 Canal St'    },
    { id: uuid(), agent: 'MEPAgent',     model: 'gpt-4o', action: 'Riverside Tower: HVAC system 18 yrs old, 4 RTUs approaching end of life. Capital reserve shortfall of $340K projected.',               confidence: 0.88, ts: minsAgo(44), status: 'pending',   property: 'Riverside Tower' },
    { id: uuid(), agent: 'StructuralAI', model: 'gpt-4o', action: '88 Park Ave: Third-party structural report reviewed. All findings within acceptable limits. Condition score upgraded to 81.',           confidence: 0.97, ts: minsAgo(110), status: 'complete', property: '88 Park Ave'     },
  ],
  approvals: [
    { id: uuid(), type: 'Capital Repair Authorization',   property: '14 Harbor Blvd', loan: 'LN-0309', amount: 127_000, requestedBy: 'InspectionAI', submittedAt: minsAgo(45),   urgency: 'high'    },
    { id: uuid(), type: 'Phase II ESA Order',             property: '720 Canal St',   loan: 'LN-0522', amount: 22_500,  requestedBy: 'EnvAgent',      submittedAt: minsAgo(90),   urgency: 'critical'},
    { id: uuid(), type: 'HVAC Reserve Draw Increase',     property: 'Riverside Tower',loan: 'LN-0411', amount: 340_000, requestedBy: 'MEPAgent',       submittedAt: hoursAgo(3),   urgency: 'normal'  },
  ],
  slaBreaches: [
    { id: uuid(), workflow: 'Fire Safety Code Compliance', property: '14 Harbor Blvd', breachedBy: '1h 50m', assignee: 'M. Okafor',   severity: 'critical' },
    { id: uuid(), workflow: 'Environmental Flag Review',   property: '720 Canal St',   breachedBy: '28m',    assignee: 'L. Vasquez',  severity: 'high'    },
  ],
  exceptions: [
    { id: uuid(), code: 'ENV_CONTAMINATION_FLAG',  description: '720 Canal St: Phase I ESA contamination flag requires Phase II within 30 days',  property: '720 Canal St',   severity: 'critical' },
    { id: uuid(), code: 'FIRE_CODE_VIOLATION',     description: '14 Harbor Blvd: Fire suppression system inspection overdue by 8 months',           property: '14 Harbor Blvd', severity: 'high'     },
    { id: uuid(), code: 'CAPITAL_RESERVE_DEFICIT', description: 'Riverside Tower: Capital reserve funded at 42% of required minimum',               property: 'Riverside Tower', severity: 'medium'  },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. HAZARD LOSS RECOVERY CENTER
// ─────────────────────────────────────────────────────────────────────────────

const hazardData = () => ({
  kpis: [
    { label: 'Open Claims',          value: 34,    delta: '+5',    unit: '',   trend: 'up'   },
    { label: 'Total Claim Value',    value: 8.7,   delta: '+1.2',  unit: '$M', trend: 'up'   },
    { label: 'Avg Claim Age',        value: 41,    delta: '+3',    unit: 'days',trend: 'up'  },
    { label: 'Disbursed This Month', value: 2.4,   delta: '-0.3',  unit: '$M', trend: 'down' },
    { label: 'Pending Inspections',  value: 11,    delta: '+2',    unit: '',   trend: 'up'   },
    { label: 'Recovery Rate',        value: 87.3,  delta: '+1.8%', unit: '%',  trend: 'up'   },
  ],
  workflows: [
    { id: uuid(), name: 'Hurricane Damage Claim Processing',  loan: 'LN-0291', property: 'Gulf Coast Apts',   status: 'running',   agent: 'ClaimsAgent',   slaHours: 8,  elapsedMins: 180, priority: 'high'    },
    { id: uuid(), name: 'Loss Draft Endorsement Review',      loan: 'LN-0117', property: 'Brookfield Plaza',  status: 'pending',   agent: 'DraftAgent',    slaHours: 4,  elapsedMins: 95,  priority: 'normal'  },
    { id: uuid(), name: 'Repair Draw #3 Disbursement',        loan: 'LN-0291', property: 'Gulf Coast Apts',   status: 'running',   agent: 'DrawAgent',     slaHours: 2,  elapsedMins: 44,  priority: 'normal'  },
    { id: uuid(), name: 'Insurance Adequacy Review',          loan: 'LN-0088', property: 'Midway Commerce',   status: 'breach',    agent: 'InsuranceAI',   slaHours: 6,  elapsedMins: 580, priority: 'critical'},
    { id: uuid(), name: 'Adjuster Report Analysis',           loan: 'LN-0344', property: 'Harbor Warehouse',  status: 'review',    agent: 'AdjusterAI',    slaHours: 3,  elapsedMins: 155, priority: 'normal'  },
    { id: uuid(), name: 'Flood Zone Re-certification',        loan: 'LN-0502', property: '99 Tidal Ave',      status: 'escalated', agent: 'FloodAgent',    slaHours: 1,  elapsedMins: 78,  priority: 'critical'},
  ],
  agentOutputs: [
    { id: uuid(), agent: 'ClaimsAgent',  model: 'gpt-4o', action: 'Gulf Coast Apts hurricane claim: adjuster estimate $1.84M, contractor bid $2.1M. Delta $260K under review. Draw 1 of 4 approved $420K.',   confidence: 0.92, ts: minsAgo(12), status: 'running',  property: 'Gulf Coast Apts'  },
    { id: uuid(), agent: 'InsuranceAI',  model: 'gpt-4o', action: 'Midway Commerce: replacement cost value increased 18% YOY. Current policy underinsured by $2.1M. Notify borrower within 10 days. SLA breached.', confidence: 0.96, ts: minsAgo(35), status: 'breach',   property: 'Midway Commerce'  },
    { id: uuid(), agent: 'FloodAgent',   model: 'gpt-4o', action: '99 Tidal Ave: FEMA FIRM map revision moves property to AE flood zone. NFIP policy required within 45 days. Escalated to compliance.',            confidence: 0.98, ts: minsAgo(58), status: 'escalated',property: '99 Tidal Ave'     },
    { id: uuid(), agent: 'AdjusterAI',   model: 'gpt-4o', action: 'Harbor Warehouse adjuster report analyzed. All repairs within scope. Recommend releasing Draw #2 of $118,000. Documents complete.',               confidence: 0.94, ts: minsAgo(88), status: 'pending',  property: 'Harbor Warehouse' },
  ],
  approvals: [
    { id: uuid(), type: 'Repair Draw Disbursement',    property: 'Gulf Coast Apts',  loan: 'LN-0291', amount: 420_000, requestedBy: 'ClaimsAgent',  submittedAt: minsAgo(30),   urgency: 'high'    },
    { id: uuid(), type: 'Loss Draft Endorsement',      property: 'Brookfield Plaza', loan: 'LN-0117', amount: 340_000, requestedBy: 'DraftAgent',   submittedAt: hoursAgo(2),   urgency: 'normal'  },
    { id: uuid(), type: 'Adjuster Report Draw Release',property: 'Harbor Warehouse', loan: 'LN-0344', amount: 118_000, requestedBy: 'AdjusterAI',   submittedAt: hoursAgo(3),   urgency: 'normal'  },
  ],
  slaBreaches: [
    { id: uuid(), workflow: 'Insurance Adequacy Review',  property: 'Midway Commerce', breachedBy: '3h 40m', assignee: 'P. Chen',    severity: 'critical' },
    { id: uuid(), workflow: 'Flood Zone Re-certification',property: '99 Tidal Ave',    breachedBy: '18m',    assignee: 'A. Watkins', severity: 'high'    },
  ],
  exceptions: [
    { id: uuid(), code: 'UNDERINSURANCE',      description: 'Midway Commerce: policy underinsured by $2.1M; 10-day cure clock running',           property: 'Midway Commerce', severity: 'critical' },
    { id: uuid(), code: 'FLOOD_ZONE_CHANGE',   description: '99 Tidal Ave: FEMA re-mapping requires NFIP policy within 45 days',                  property: '99 Tidal Ave',    severity: 'high'     },
    { id: uuid(), code: 'CLAIM_DELTA',         description: 'Gulf Coast Apts: $260K delta between adjuster estimate and contractor bid pending',   property: 'Gulf Coast Apts', severity: 'medium'   },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. COMPLIANCE & COVENANT CENTER
// ─────────────────────────────────────────────────────────────────────────────

const complianceData = () => ({
  kpis: [
    { label: 'Covenants Monitored',  value: 3_420, delta: '+84',   unit: '',   trend: 'up'   },
    { label: 'Breaches This Month',  value: 14,    delta: '+3',    unit: '',   trend: 'up'   },
    { label: 'Cures In Progress',    value: 8,     delta: '-2',    unit: '',   trend: 'down' },
    { label: 'Compliance Rate',      value: 99.6,  delta: '+0.1%', unit: '%',  trend: 'up'   },
    { label: 'Deadlines This Week',  value: 23,    delta: '+6',    unit: '',   trend: 'up'   },
    { label: 'Regulatory Flags',     value: 3,     delta: '0',     unit: '',   trend: 'flat' },
  ],
  workflows: [
    { id: uuid(), name: 'DSCR Covenant Test — Q1',      loan: 'LN-0071', borrower: 'Summit CRE Fund',   status: 'running',   agent: 'CovenantAI',   slaHours: 4,  elapsedMins: 55,  priority: 'high'    },
    { id: uuid(), name: 'LTV Recalculation',             loan: 'LN-0132', borrower: 'Apex CRE Partners', status: 'pending',   agent: 'ValuationAI',  slaHours: 8,  elapsedMins: 200, priority: 'normal'  },
    { id: uuid(), name: 'Anti-Money Laundering Review',  loan: 'LN-0501', borrower: 'GreenField Realty', status: 'review',    agent: 'AMLAgent',     slaHours: 24, elapsedMins: 660, priority: 'high'    },
    { id: uuid(), name: 'Operating Statement Variance',  loan: 'LN-0208', borrower: 'Blackstone Realty', status: 'breach',    agent: 'FinancialAI',  slaHours: 6,  elapsedMins: 540, priority: 'critical'},
    { id: uuid(), name: 'Occupancy Certificate Renewal', loan: 'LN-0089', borrower: 'Harbor Investments',status: 'pending',   agent: 'CertAgent',    slaHours: 48, elapsedMins: 120, priority: 'normal'  },
    { id: uuid(), name: 'Flood Insurance Covenant',      loan: 'LN-0502', borrower: 'Metro Tower LLC',   status: 'escalated', agent: 'InsuranceAI',  slaHours: 1,  elapsedMins: 92,  priority: 'critical'},
    { id: uuid(), name: 'Guarantor Net Worth Cert',      loan: 'LN-0174', borrower: 'Meridian RE Group', status: 'complete',  agent: 'GuarantorAI',  slaHours: 8,  elapsedMins: 350, priority: 'low'     },
  ],
  agentOutputs: [
    { id: uuid(), agent: 'CovenantAI',  model: 'gpt-4o', action: 'LN-0071 DSCR Test Q1: actual 1.12x vs covenant 1.20x minimum. BREACH declared. 30-day cure period initiated. Equity infusion or rate buydown required.',  confidence: 0.98, ts: minsAgo(9),  status: 'breach',   loan: 'LN-0071' },
    { id: uuid(), agent: 'AMLAgent',    model: 'gpt-4o', action: 'LN-0501 AML review: 2 suspicious wire transfers flagged. FinCEN SAR filing threshold triggered. Referred to compliance officer.',                          confidence: 0.97, ts: minsAgo(22), status: 'escalated', loan: 'LN-0501' },
    { id: uuid(), agent: 'FinancialAI', model: 'gpt-4o', action: 'LN-0208 operating statement variance 28% below projections. Possible cash diversion. SLA for follow-up breached. Recommend site visit.',                  confidence: 0.91, ts: minsAgo(48), status: 'breach',    loan: 'LN-0208' },
    { id: uuid(), agent: 'GuarantorAI', model: 'gpt-4o', action: 'LN-0174 guarantor net worth certification reviewed. $48M verified net worth exceeds $35M covenant minimum. No action required.',                          confidence: 0.99, ts: minsAgo(95), status: 'complete',  loan: 'LN-0174' },
  ],
  approvals: [
    { id: uuid(), type: 'DSCR Covenant Waiver',       loan: 'LN-0071', amount: 0,   requestedBy: 'Summit CRE Fund',    submittedAt: minsAgo(20),  urgency: 'critical' },
    { id: uuid(), type: 'SAR Filing Authorization',   loan: 'LN-0501', amount: 0,   requestedBy: 'AMLAgent',           submittedAt: minsAgo(55),  urgency: 'high'     },
    { id: uuid(), type: 'Operating Variance Cure Plan',loan: 'LN-0208', amount: 0,  requestedBy: 'Blackstone Realty',  submittedAt: hoursAgo(4),  urgency: 'high'     },
  ],
  slaBreaches: [
    { id: uuid(), workflow: 'Operating Statement Variance', loan: 'LN-0208', breachedBy: '3h 0m', assignee: 'D. Park',    severity: 'critical' },
    { id: uuid(), workflow: 'Flood Insurance Covenant',     loan: 'LN-0502', breachedBy: '32m',   assignee: 'R. Nguyen',  severity: 'high'    },
  ],
  exceptions: [
    { id: uuid(), code: 'DSCR_BREACH',          description: 'LN-0071: DSCR 1.12x below 1.20x covenant minimum — 30-day cure clock active',      loan: 'LN-0071', severity: 'critical' },
    { id: uuid(), code: 'AML_SAR_REQUIRED',     description: 'LN-0501: SAR filing threshold triggered; FinCEN deadline in 30 days',               loan: 'LN-0501', severity: 'critical' },
    { id: uuid(), code: 'OPERATING_VARIANCE',   description: 'LN-0208: Operating income 28% below underwriting; follow-up SLA breached',          loan: 'LN-0208', severity: 'high'     },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. TOKENIZATION EXCHANGE CENTER
// ─────────────────────────────────────────────────────────────────────────────

const exchangeData = () => ({
  kpis: [
    { label: 'Tokens Issued',        value: 42_800_000, delta: '+2.1M',   unit: '',   trend: 'up'   },
    { label: 'Active Wallets',       value: 1_847,      delta: '+124',    unit: '',   trend: 'up'   },
    { label: 'Pending Transfers',    value: 18,         delta: '+4',      unit: '',   trend: 'up'   },
    { label: 'On-Chain Settlements', value: 94,         delta: '+11',     unit: '/day',trend: 'up'  },
    { label: 'Whitelist Approvals',  value: 7,          delta: '+2',      unit: 'pending',trend:'up'},
    { label: 'AUM Tokenized',        value: 284.7,      delta: '+18.2',   unit: '$M', trend: 'up'   },
  ],
  workflows: [
    { id: uuid(), name: 'KYC/AML Wallet Verification',   wallet: '0x3a4f...b812', investor: 'Pinnacle Capital',    status: 'running',   agent: 'KYCAgent',     slaHours: 24, elapsedMins: 110, priority: 'normal'  },
    { id: uuid(), name: 'ERC-1400 Transfer Approval',    wallet: '0xc91e...4477', investor: 'Summit Fund II',      status: 'pending',   agent: 'TransferAgent', slaHours: 2,  elapsedMins: 58,  priority: 'high'    },
    { id: uuid(), name: 'Partition Rebalance',           token: 'KTRA-0091',      fund: 'Kontra Multifamily I',   status: 'running',   agent: 'PartitionAI',  slaHours: 1,  elapsedMins: 18,  priority: 'normal'  },
    { id: uuid(), name: 'Stablecoin Payment Settlement', token: 'KTRA-0208',      fund: 'Kontra Office II',       status: 'breach',    agent: 'PaymentAgent', slaHours: 4,  elapsedMins: 390, priority: 'critical'},
    { id: uuid(), name: 'Dividend Distribution Calc',    token: 'KTRA-0174',      fund: 'Kontra Industrial I',    status: 'complete',  agent: 'DistribAgent', slaHours: 6,  elapsedMins: 280, priority: 'normal'  },
    { id: uuid(), name: 'Redemption Request Processing', wallet: '0x77b2...aa91', investor: 'Harbor Endowment',   status: 'review',    agent: 'RedemptionAI', slaHours: 48, elapsedMins: 720, priority: 'high'    },
    { id: uuid(), name: 'Token Issuance — New Tranche',  token: 'KTRA-NEW',       fund: 'Kontra Multifamily II',  status: 'escalated', agent: 'IssuanceAgent',slaHours: 2,  elapsedMins: 148, priority: 'critical'},
  ],
  agentOutputs: [
    { id: uuid(), agent: 'KYCAgent',      model: 'gpt-4o', action: 'Pinnacle Capital wallet 0x3a4f...b812: KYC documents verified. Accredited investor status confirmed. Whitelist approval ready.',   confidence: 0.99, ts: minsAgo(6),  status: 'pending',  wallet: '0x3a4f...b812' },
    { id: uuid(), agent: 'PaymentAgent',  model: 'gpt-4o', action: 'KTRA-0208 stablecoin USDC payment $284,000 received. Gas estimation failed on Polygon — retry queued. SLA breach imminent.',       confidence: 0.87, ts: minsAgo(24), status: 'breach',    token: 'KTRA-0208'    },
    { id: uuid(), agent: 'IssuanceAgent', model: 'gpt-4o', action: 'Kontra Multifamily II new tranche: $45M allocation approved by credit. ERC-1400 deployment requires legal sign-off. Escalated.',  confidence: 0.95, ts: minsAgo(41), status: 'escalated', token: 'KTRA-NEW'     },
    { id: uuid(), agent: 'DistribAgent',  model: 'gpt-4o', action: 'KTRA-0174 Q1 dividend: $1.84M distributed to 312 wallets. Per-token: $0.043. All on-chain transfers confirmed. Complete.',         confidence: 0.99, ts: minsAgo(88), status: 'complete',  token: 'KTRA-0174'    },
  ],
  approvals: [
    { id: uuid(), type: 'Wallet Whitelist',       wallet: '0x3a4f...b812', investor: 'Pinnacle Capital',  amount: 0,         submittedAt: minsAgo(15),   urgency: 'normal'  },
    { id: uuid(), type: 'Token Issuance Sign-Off', token: 'KTRA-NEW',      fund: 'Kontra Multifamily II',amount: 45_000_000, submittedAt: hoursAgo(2),   urgency: 'critical'},
    { id: uuid(), type: 'Redemption Release',     wallet: '0x77b2...aa91', investor: 'Harbor Endowment', amount: 820_000,   submittedAt: hoursAgo(12),  urgency: 'high'    },
  ],
  slaBreaches: [
    { id: uuid(), workflow: 'Stablecoin Payment Settlement', token: 'KTRA-0208', breachedBy: '2h 30m', assignee: 'B. Kim',    severity: 'critical' },
    { id: uuid(), workflow: 'Token Issuance — New Tranche',  token: 'KTRA-NEW',  breachedBy: '28m',    assignee: 'T. Hassan', severity: 'high'    },
  ],
  exceptions: [
    { id: uuid(), code: 'GAS_ESTIMATION_FAILURE',  description: 'KTRA-0208: Polygon gas estimation error — USDC transfer of $284K stalled',     token: 'KTRA-0208', severity: 'critical' },
    { id: uuid(), code: 'LEGAL_SIGN_OFF_REQUIRED', description: 'KTRA-NEW: $45M new tranche awaiting legal counsel signature',                   token: 'KTRA-NEW',  severity: 'high'     },
    { id: uuid(), code: 'REDEMPTION_HOLD',         description: '0x77b2: Redemption request $820K — lock-up period expires in 8 days',           wallet: '0x77b2...aa91', severity: 'medium' },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ADMIN POLICY COMMAND CENTER
// ─────────────────────────────────────────────────────────────────────────────

const adminData = () => ({
  kpis: [
    { label: 'Active Policies',     value: 218,   delta: '+7',    unit: '',   trend: 'up'   },
    { label: 'Rules Evaluated/Day', value: 14_820, delta: '+1.2K', unit: '',   trend: 'up'   },
    { label: 'Policy Violations',   value: 11,    delta: '+3',    unit: '',   trend: 'up'   },
    { label: 'Pending Escalations', value: 9,     delta: '+2',    unit: '',   trend: 'up'   },
    { label: 'Role Changes (7d)',   value: 14,    delta: '+6',    unit: '',   trend: 'up'   },
    { label: 'Audit Flags',         value: 4,     delta: '+1',    unit: '',   trend: 'up'   },
  ],
  workflows: [
    { id: uuid(), name: 'Policy Rule Conflict Detection', scope: 'Servicing',   version: 'v4.2', status: 'running',   agent: 'PolicyAI',     slaHours: 1,  elapsedMins: 12,  priority: 'normal'  },
    { id: uuid(), name: 'Role Permission Audit',          scope: 'All Portals', version: 'v2.1', status: 'running',   agent: 'AuditAgent',   slaHours: 4,  elapsedMins: 85,  priority: 'high'    },
    { id: uuid(), name: 'Workflow SLA Threshold Tuning',  scope: 'Draws',       version: 'v1.7', status: 'review',    agent: 'SLAAgent',     slaHours: 8,  elapsedMins: 300, priority: 'normal'  },
    { id: uuid(), name: 'API Rate Limit Policy Rollout',  scope: 'Enterprise',  version: 'v3.0', status: 'pending',   agent: 'RateLimitAI',  slaHours: 2,  elapsedMins: 40,  priority: 'normal'  },
    { id: uuid(), name: 'AI Budget Policy Enforcement',   scope: 'Cost Gov.',   version: 'v1.4', status: 'breach',    agent: 'BudgetAgent',  slaHours: 2,  elapsedMins: 195, priority: 'critical'},
    { id: uuid(), name: 'SSO Configuration Sync',         scope: 'Auth',        version: 'v2.9', status: 'complete',  agent: 'SSOAgent',     slaHours: 1,  elapsedMins: 42,  priority: 'low'     },
    { id: uuid(), name: 'Data Retention Policy Sweep',    scope: 'Compliance',  version: 'v1.2', status: 'escalated', agent: 'RetentionAI',  slaHours: 24, elapsedMins: 1260,priority: 'high'    },
  ],
  agentOutputs: [
    { id: uuid(), agent: 'PolicyAI',    model: 'gpt-4o', action: 'Conflict detected: Rule 118 (Draw SLA 8h) conflicts with Rule 204 (Draw Pause on Breach). Recommend Rule 204 takes precedence with 2h grace.', confidence: 0.93, ts: minsAgo(5),  status: 'pending',   scope: 'Servicing'   },
    { id: uuid(), agent: 'AuditAgent',  model: 'gpt-4o', action: '3 users have admin-level access not reflected in current org chart. 1 terminated employee account still active. Escalate to IT security.',      confidence: 0.99, ts: minsAgo(19), status: 'escalated', scope: 'All Portals' },
    { id: uuid(), agent: 'BudgetAgent', model: 'gpt-4o', action: 'AI budget Policy v1.4 enforcement: Org "realty-west" exceeded monthly cap $2,000 by $480. Hard-stop triggered. SLA for notification breached.',  confidence: 0.97, ts: minsAgo(44), status: 'breach',     scope: 'Cost Gov.'   },
    { id: uuid(), agent: 'RetentionAI', model: 'gpt-4o', action: '14,820 loan records eligible for archiving under 7-year retention policy. Recommend batch archive to cold storage. Estimated savings $1,200/mo.', confidence: 0.96, ts: minsAgo(88), status: 'pending',   scope: 'Compliance'  },
  ],
  approvals: [
    { id: uuid(), type: 'Policy Conflict Resolution',  scope: 'Servicing',  version: 'v4.2', requestedBy: 'PolicyAI',   submittedAt: minsAgo(10),  urgency: 'high'    },
    { id: uuid(), type: 'Account Deactivation',        scope: 'Auth',       user: 'term.user@legacy.com', requestedBy: 'AuditAgent', submittedAt: minsAgo(25),  urgency: 'critical'},
    { id: uuid(), type: 'Budget Hard-Stop Override',   scope: 'Cost Gov.',  org: 'realty-west', requestedBy: 'BudgetAgent', submittedAt: minsAgo(50),  urgency: 'high'   },
  ],
  slaBreaches: [
    { id: uuid(), workflow: 'AI Budget Policy Enforcement',scope: 'Cost Gov.',  breachedBy: '55m',    assignee: 'Admin', severity: 'critical' },
    { id: uuid(), workflow: 'Data Retention Policy Sweep', scope: 'Compliance', breachedBy: '17h 0m', assignee: 'Admin', severity: 'high'    },
  ],
  exceptions: [
    { id: uuid(), code: 'TERMINATED_USER_ACTIVE', description: 'term.user@legacy.com: Terminated employee account still active — immediate deactivation required', scope: 'Auth',       severity: 'critical' },
    { id: uuid(), code: 'BUDGET_HARD_STOP',       description: 'realty-west: Monthly AI budget cap exceeded by $480 — hard stop triggered',                        scope: 'Cost Gov.',  severity: 'high'     },
    { id: uuid(), code: 'POLICY_CONFLICT',        description: 'Rules 118/204 conflict in Servicing scope — resolution pending approval',                          scope: 'Servicing',  severity: 'medium'   },
  ],
});

// ─── Data factory ─────────────────────────────────────────────────────────────

const CENTERS = {
  servicing:  servicingData,
  inspection: inspectionData,
  hazard:     hazardData,
  compliance: complianceData,
  exchange:   exchangeData,
  admin:      adminData,
};

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/centers', (req, res) => {
  res.json({
    centers: [
      { id: 'servicing',  label: 'Servicing Operations Center',   path: '/servicing-ops',   color: 'burgundy', icon: 'BuildingOfficeIcon' },
      { id: 'inspection', label: 'Inspection Intelligence Center', path: '/inspection',      color: 'blue',     icon: 'MagnifyingGlassIcon'},
      { id: 'hazard',     label: 'Hazard Loss Recovery Center',    path: '/hazard-recovery', color: 'amber',    icon: 'ShieldExclamationIcon'},
      { id: 'compliance', label: 'Compliance & Covenant Center',   path: '/compliance-center', color: 'violet', icon: 'ScaleIcon'          },
      { id: 'exchange',   label: 'Tokenization Exchange Center',   path: '/exchange',        color: 'emerald',  icon: 'CubeTransparentIcon'},
      { id: 'admin',      label: 'Admin Policy Command Center',    path: '/policy-command',  color: 'red',      icon: 'Cog6ToothIcon'      },
    ],
  });
});

router.get('/:center/dashboard', (req, res) => {
  const { center } = req.params;
  const factory = CENTERS[center];
  if (!factory) return res.status(404).json({ error: `Unknown center: ${center}` });
  res.json({ center, generatedAt: now(), ...factory() });
});

router.post('/:center/actions/:actionId', (req, res) => {
  const { center, actionId } = req.params;
  const { action, note } = req.body;
  const entry = { id: uuid(), center, actionId, action, note, actorId: req.headers['x-user-id'] || 'user', ts: now() };
  actionLog.push(entry);
  res.json({ ok: true, ...entry });
});

router.get('/action-log', (req, res) => {
  res.json({ log: actionLog.slice(-50) });
});

module.exports = router;
