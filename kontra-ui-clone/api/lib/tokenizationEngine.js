/**
 * Kontra Tokenization Engine — Phase 6
 *
 * The Tokenization Readiness Agent evaluates a CRE loan across 5 dimensions
 * and produces a scored readiness report before any asset is token-packaged.
 *
 * Dimensions (each 0–100, weighted):
 *   1. Data Completeness         (20%) — All required loan fields populated
 *   2. Servicing History         (25%) — Payment record integrity, no delinquency gaps
 *   3. Compliance Readiness      (25%) — DSCR, LTV, insurance, inspection currency
 *   4. Covenant Status           (15%) — Borrower covenant compliance
 *   5. Legal Document Sufficiency(15%) — Required docs present and recorded
 *
 * Output: { score, status, dimensions, blockingIssues, conditionalIssues, recommendations, assessedAt }
 *   status: 'token_ready' | 'conditional' | 'not_ready'
 *   score ≥ 85 → token_ready
 *   score 65–84 → conditional (issues must be resolved)
 *   score < 65  → not_ready
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

// ── Required field definitions ────────────────────────────────────────────────

const REQUIRED_LOAN_FIELDS = [
  { key: 'loan_number',       label: 'Loan Number',         weight: 1   },
  { key: 'borrower_name',     label: 'Borrower Name',       weight: 1   },
  { key: 'property_address',  label: 'Property Address',    weight: 1   },
  { key: 'property_type',     label: 'Property Type',       weight: 1   },
  { key: 'original_balance',  label: 'Original Balance',    weight: 1   },
  { key: 'current_balance',   label: 'Current Balance',     weight: 1   },
  { key: 'interest_rate',     label: 'Interest Rate',       weight: 1   },
  { key: 'maturity_date',     label: 'Maturity Date',       weight: 1   },
  { key: 'origination_date',  label: 'Origination Date',    weight: 1   },
  { key: 'amortization_term', label: 'Amortization Term',   weight: 0.5 },
  { key: 'loan_type',         label: 'Loan Type',           weight: 0.5 },
  { key: 'property_value',    label: 'Property Value',      weight: 1   },
  { key: 'ltv',               label: 'Loan-to-Value',       weight: 1   },
  { key: 'dscr',              label: 'DSCR',                weight: 1   },
  { key: 'noi',               label: 'Net Operating Income',weight: 1   },
  { key: 'occupancy_rate',    label: 'Occupancy Rate',      weight: 0.5 },
  { key: 'servicer_name',     label: 'Servicer Name',       weight: 0.5 },
  { key: 'tax_id',            label: 'Borrower Tax ID',     weight: 1   },
  { key: 'entity_type',       label: 'Borrower Entity Type',weight: 0.5 },
];

const REQUIRED_DOCUMENTS = [
  { id: 'loan_agreement',    label: 'Executed Loan Agreement',           critical: true  },
  { id: 'promissory_note',   label: 'Promissory Note',                   critical: true  },
  { id: 'deed_of_trust',     label: 'Deed of Trust / Mortgage',          critical: true  },
  { id: 'title_policy',      label: 'Title Insurance Policy',            critical: true  },
  { id: 'appraisal',         label: 'FIRREA-Compliant Appraisal',        critical: true  },
  { id: 'environmental',     label: 'Phase I Environmental Report',      critical: true  },
  { id: 'survey',            label: 'Property Survey',                   critical: false },
  { id: 'insurance_binder',  label: 'Hazard Insurance Binder',          critical: true  },
  { id: 'rent_roll',         label: 'Executed Rent Roll',                critical: false },
  { id: 'operating_stmt',    label: 'T-12 Operating Statement',         critical: false },
  { id: 'borrower_financials',label: 'Borrower Financial Statements',   critical: false },
  { id: 'entity_documents',  label: 'Entity Formation / Authorization', critical: true  },
  { id: 'ust_certificate',   label: 'UCC/UST Certificate',              critical: false },
];

// ── Scoring helpers ───────────────────────────────────────────────────────────

function score(value, max = 100) {
  return Math.min(max, Math.max(0, Math.round(value)));
}

function pct(a, b) {
  return b === 0 ? 0 : (a / b) * 100;
}

// ── Dimension 1: Data Completeness ────────────────────────────────────────────

function assessDataCompleteness(loan) {
  const issues = [];
  const missing = [];

  let weightedPresent = 0;
  let weightedTotal   = 0;

  for (const field of REQUIRED_LOAN_FIELDS) {
    weightedTotal += field.weight;
    const val = loan[field.key];
    const present = val !== null && val !== undefined && val !== '' && val !== 0;
    if (present) {
      weightedPresent += field.weight;
    } else {
      missing.push(field.label);
      if (field.weight === 1) issues.push({ severity: 'blocking', message: `Missing required field: ${field.label}` });
    }
  }

  const rawScore = pct(weightedPresent, weightedTotal);
  const dim = score(rawScore);

  // Additional checks
  if (loan.current_balance && loan.original_balance && loan.current_balance > loan.original_balance * 1.5) {
    issues.push({ severity: 'warning', message: 'Current balance exceeds 150% of original balance — verify data' });
  }
  if (loan.interest_rate && (loan.interest_rate < 0.005 || loan.interest_rate > 0.30)) {
    issues.push({ severity: 'warning', message: `Interest rate ${(loan.interest_rate * 100).toFixed(2)}% is outside normal range` });
  }

  return {
    name:   'Data Completeness',
    score:  dim,
    weight: 0.20,
    issues,
    details: { missingFields: missing, presentFields: REQUIRED_LOAN_FIELDS.length - missing.length, totalFields: REQUIRED_LOAN_FIELDS.length },
  };
}

// ── Dimension 2: Servicing History Integrity ──────────────────────────────────

function assessServicingHistory(loan, servicingHistory = {}) {
  const issues = [];
  let dim = 100;

  const {
    months_on_books = null,
    delinquent_days_30 = 0,
    delinquent_days_60 = 0,
    delinquent_days_90 = 0,
    forbearance_count = 0,
    modification_count = 0,
    payment_history_months = null,
    last_payment_date = null,
    watchlist_status = false,
    special_servicing = false,
  } = servicingHistory;

  // Need at least 6 months on books to tokenize
  if (!months_on_books || months_on_books < 6) {
    dim -= 30;
    issues.push({ severity: 'blocking', message: `Loan must have ≥6 months on books for tokenization (current: ${months_on_books || 0} months)` });
  } else if (months_on_books < 12) {
    dim -= 10;
    issues.push({ severity: 'conditional', message: `Loan has ${months_on_books} months on books — 12+ preferred for institutional investors` });
  }

  // Delinquency
  if (delinquent_days_90 > 0) {
    dim -= 40;
    issues.push({ severity: 'blocking', message: `Loan has ${delinquent_days_90} periods of 90+ day delinquency in history` });
  } else if (delinquent_days_60 > 0) {
    dim -= 25;
    issues.push({ severity: 'blocking', message: `Loan has ${delinquent_days_60} periods of 60+ day delinquency in history` });
  } else if (delinquent_days_30 > 1) {
    dim -= 15;
    issues.push({ severity: 'conditional', message: `${delinquent_days_30} 30-day delinquencies in payment history — disclose to investors` });
  } else if (delinquent_days_30 === 1) {
    dim -= 5;
    issues.push({ severity: 'warning', message: '1 isolated 30-day delinquency — must be disclosed in offering docs' });
  }

  // Forbearance / modification
  if (forbearance_count > 0 && (Date.now() - new Date(loan.origination_date || 0)) < 2 * 365 * 24 * 3600 * 1000) {
    dim -= 15;
    issues.push({ severity: 'conditional', message: `${forbearance_count} forbearance event(s) in last 24 months — require disclosure` });
  }
  if (modification_count > 0) {
    dim -= 10;
    issues.push({ severity: 'conditional', message: `Loan has ${modification_count} modification(s) — original terms no longer apply; update offering docs` });
  }

  // Special servicing / watchlist
  if (special_servicing) {
    dim -= 50;
    issues.push({ severity: 'blocking', message: 'Loan is in special servicing — cannot tokenize' });
  }
  if (watchlist_status) {
    dim -= 20;
    issues.push({ severity: 'blocking', message: 'Loan is on surveillance watchlist — must be resolved before tokenization' });
  }

  // Payment history completeness
  if (!payment_history_months || payment_history_months < 6) {
    dim -= 10;
    issues.push({ severity: 'conditional', message: 'Payment history record is incomplete (<6 months)' });
  }
  if (!last_payment_date) {
    dim -= 5;
    issues.push({ severity: 'warning', message: 'Last payment date not recorded' });
  }

  return {
    name:   'Servicing History Integrity',
    score:  score(dim),
    weight: 0.25,
    issues,
    details: { months_on_books, delinquent_days_30, delinquent_days_60, delinquent_days_90, forbearance_count, modification_count, watchlist_status, special_servicing },
  };
}

// ── Dimension 3: Compliance Readiness ─────────────────────────────────────────

function assessComplianceReadiness(loan, compliance = {}) {
  const issues = [];
  let dim = 100;

  const {
    dscr_current                  = loan.dscr         || null,
    ltv_current                   = loan.ltv           || null,
    insurance_expiry              = null,
    inspection_date               = null,
    tax_payments_current          = true,
    ofac_cleared                  = true,
    aml_cleared                   = true,
    bsa_compliant                 = true,
    state_usury_compliant         = true,
    respa_compliant               = true,
    dodd_frank_compliant          = true,
  } = compliance;

  // DSCR
  if (dscr_current === null || dscr_current === undefined) {
    dim -= 20;
    issues.push({ severity: 'blocking', message: 'Current DSCR not available — required for offering disclosure' });
  } else if (dscr_current < 1.0) {
    dim -= 35;
    issues.push({ severity: 'blocking', message: `DSCR ${dscr_current.toFixed(2)} is below 1.0 — loan is cash-flow negative` });
  } else if (dscr_current < 1.15) {
    dim -= 20;
    issues.push({ severity: 'blocking', message: `DSCR ${dscr_current.toFixed(2)} below minimum threshold of 1.15 for tokenization` });
  } else if (dscr_current < 1.25) {
    dim -= 10;
    issues.push({ severity: 'conditional', message: `DSCR ${dscr_current.toFixed(2)} is below preferred 1.25 — limited to qualified investor pools` });
  }

  // LTV
  if (ltv_current === null || ltv_current === undefined) {
    dim -= 15;
    issues.push({ severity: 'blocking', message: 'Current LTV not available — required for offering disclosure' });
  } else if (ltv_current > 0.80) {
    dim -= 25;
    issues.push({ severity: 'blocking', message: `LTV ${(ltv_current * 100).toFixed(1)}% exceeds 80% maximum for tokenization` });
  } else if (ltv_current > 0.75) {
    dim -= 10;
    issues.push({ severity: 'conditional', message: `LTV ${(ltv_current * 100).toFixed(1)}% above 75% — may limit investor eligibility pools` });
  }

  // Insurance
  if (!insurance_expiry) {
    dim -= 10;
    issues.push({ severity: 'conditional', message: 'Insurance expiry date not on file' });
  } else {
    const daysToExpiry = (new Date(insurance_expiry) - Date.now()) / (1000 * 3600 * 24);
    if (daysToExpiry < 0) {
      dim -= 30;
      issues.push({ severity: 'blocking', message: `Insurance expired ${Math.abs(Math.round(daysToExpiry))} days ago` });
    } else if (daysToExpiry < 30) {
      dim -= 15;
      issues.push({ severity: 'blocking', message: `Insurance expires in ${Math.round(daysToExpiry)} days — must renew before tokenization` });
    } else if (daysToExpiry < 90) {
      dim -= 5;
      issues.push({ severity: 'conditional', message: `Insurance expires in ${Math.round(daysToExpiry)} days — renew within offering window` });
    }
  }

  // Inspection
  if (!inspection_date) {
    dim -= 5;
    issues.push({ severity: 'warning', message: 'Property inspection date not on file' });
  } else {
    const daysSinceInspection = (Date.now() - new Date(inspection_date)) / (1000 * 3600 * 24);
    if (daysSinceInspection > 365) {
      dim -= 10;
      issues.push({ severity: 'conditional', message: `Last inspection was ${Math.round(daysSinceInspection)} days ago — obtain fresh inspection for offering` });
    }
  }

  // Tax
  if (!tax_payments_current) {
    dim -= 20;
    issues.push({ severity: 'blocking', message: 'Property tax payments are delinquent' });
  }

  // Regulatory clearances
  if (!ofac_cleared) { dim -= 40; issues.push({ severity: 'blocking', message: 'OFAC screening not cleared — cannot proceed' }); }
  if (!aml_cleared)  { dim -= 40; issues.push({ severity: 'blocking', message: 'AML review not cleared — cannot proceed' }); }
  if (!bsa_compliant){ dim -= 20; issues.push({ severity: 'blocking', message: 'BSA compliance not confirmed' }); }
  if (!state_usury_compliant)  { dim -= 15; issues.push({ severity: 'blocking', message: 'State usury compliance not confirmed' }); }
  if (!respa_compliant)        { dim -= 10; issues.push({ severity: 'blocking', message: 'RESPA compliance not confirmed' }); }
  if (!dodd_frank_compliant)   { dim -= 10; issues.push({ severity: 'blocking', message: 'Dodd-Frank qualified mortgage status not confirmed' }); }

  return {
    name:   'Compliance Readiness',
    score:  score(dim),
    weight: 0.25,
    issues,
    details: { dscr_current, ltv_current, insurance_expiry, inspection_date, tax_payments_current, ofac_cleared, aml_cleared, bsa_compliant },
  };
}

// ── Dimension 4: Covenant Status ──────────────────────────────────────────────

function assessCovenantStatus(loan, covenants = {}) {
  const issues = [];
  let dim = 100;

  const {
    dscr_covenant          = null,
    dscr_actual            = loan.dscr || null,
    ltv_covenant           = null,
    ltv_actual             = loan.ltv  || null,
    occupancy_covenant     = null,
    occupancy_actual       = loan.occupancy_rate || null,
    reserve_balance        = null,
    reserve_requirement    = null,
    reporting_current      = true,
    consent_violations     = 0,
    cure_period_active     = false,
  } = covenants;

  // DSCR covenant
  if (dscr_covenant && dscr_actual !== null) {
    if (dscr_actual < dscr_covenant) {
      const deficiency = ((dscr_covenant - dscr_actual) / dscr_covenant * 100).toFixed(1);
      dim -= 30;
      issues.push({ severity: 'blocking', message: `DSCR ${dscr_actual.toFixed(2)} breaches covenant of ${dscr_covenant.toFixed(2)} by ${deficiency}%` });
    } else if (dscr_actual < dscr_covenant * 1.05) {
      dim -= 10;
      issues.push({ severity: 'conditional', message: `DSCR ${dscr_actual.toFixed(2)} is within 5% of covenant threshold ${dscr_covenant.toFixed(2)}` });
    }
  } else if (!dscr_actual) {
    dim -= 15;
    issues.push({ severity: 'conditional', message: 'DSCR covenant compliance cannot be verified — current DSCR not available' });
  }

  // LTV covenant
  if (ltv_covenant && ltv_actual !== null) {
    if (ltv_actual > ltv_covenant) {
      dim -= 20;
      issues.push({ severity: 'blocking', message: `LTV ${(ltv_actual*100).toFixed(1)}% breaches covenant of ${(ltv_covenant*100).toFixed(1)}%` });
    }
  }

  // Occupancy covenant
  if (occupancy_covenant && occupancy_actual !== null) {
    if (occupancy_actual < occupancy_covenant) {
      const gap = ((occupancy_covenant - occupancy_actual) * 100).toFixed(1);
      if (gap > 10) {
        dim -= 20;
        issues.push({ severity: 'blocking', message: `Occupancy ${(occupancy_actual*100).toFixed(1)}% breaches covenant of ${(occupancy_covenant*100).toFixed(1)}% by ${gap}pp` });
      } else {
        dim -= 10;
        issues.push({ severity: 'conditional', message: `Occupancy ${(occupancy_actual*100).toFixed(1)}% is below covenant ${(occupancy_covenant*100).toFixed(1)}%` });
      }
    }
  }

  // Reserve
  if (reserve_requirement && reserve_balance !== null) {
    const coverage = reserve_balance / reserve_requirement;
    if (coverage < 0.80) {
      dim -= 15;
      issues.push({ severity: 'blocking', message: `Reserve balance $${reserve_balance?.toLocaleString()} is ${((1-coverage)*100).toFixed(0)}% below requirement of $${reserve_requirement?.toLocaleString()}` });
    } else if (coverage < 1.0) {
      dim -= 8;
      issues.push({ severity: 'conditional', message: `Reserve balance below requirement (${(coverage*100).toFixed(0)}% funded)` });
    }
  }

  // Reporting
  if (!reporting_current) {
    dim -= 10;
    issues.push({ severity: 'conditional', message: 'Borrower reporting obligations not current — financials overdue' });
  }

  if (consent_violations > 0) {
    dim -= consent_violations * 10;
    issues.push({ severity: consent_violations > 1 ? 'blocking' : 'conditional', message: `${consent_violations} uncured consent violation(s) on record` });
  }

  if (cure_period_active) {
    dim -= 15;
    issues.push({ severity: 'blocking', message: 'Active cure period — cannot tokenize while covenant cure is in progress' });
  }

  return {
    name:   'Covenant Status',
    score:  score(dim),
    weight: 0.15,
    issues,
    details: { dscr_covenant, dscr_actual, ltv_covenant, ltv_actual, occupancy_covenant, occupancy_actual, reserve_balance, reserve_requirement, reporting_current, consent_violations },
  };
}

// ── Dimension 5: Legal Document Sufficiency ───────────────────────────────────

function assessLegalDocuments(documents = []) {
  const issues = [];
  const documentIds = new Set(documents.map(d => d.id || d.type || d));
  let dim = 100;

  let criticalMissing = 0;
  let nonCriticalMissing = 0;
  const missingDocs  = [];
  const presentDocs  = [];

  for (const req of REQUIRED_DOCUMENTS) {
    if (documentIds.has(req.id)) {
      presentDocs.push(req.label);
    } else {
      missingDocs.push(req.label);
      if (req.critical) {
        criticalMissing++;
        issues.push({ severity: 'blocking', message: `Missing critical document: ${req.label}` });
      } else {
        nonCriticalMissing++;
        issues.push({ severity: 'conditional', message: `Missing document: ${req.label}` });
      }
    }
  }

  dim -= criticalMissing    * 15;
  dim -= nonCriticalMissing * 5;

  // Check for document age
  for (const doc of documents) {
    if (doc.date && doc.id === 'appraisal') {
      const days = (Date.now() - new Date(doc.date)) / (1000 * 3600 * 24);
      if (days > 365) {
        dim -= 10;
        issues.push({ severity: 'conditional', message: `Appraisal is ${Math.round(days)} days old — FIRREA requires refresh if >12 months for offering` });
      }
    }
    if (doc.date && doc.id === 'environmental') {
      const days = (Date.now() - new Date(doc.date)) / (1000 * 3600 * 24);
      if (days > 365 * 2) {
        dim -= 5;
        issues.push({ severity: 'conditional', message: `Phase I Environmental Report is ${Math.round(days/365)} years old — consider Phase I update` });
      }
    }
  }

  return {
    name:   'Legal Document Sufficiency',
    score:  score(dim),
    weight: 0.15,
    issues,
    details: { presentDocs, missingDocs, criticalMissing, nonCriticalMissing, totalRequired: REQUIRED_DOCUMENTS.length },
  };
}

// ── Master assessment ─────────────────────────────────────────────────────────

function assessReadiness(loan, { servicingHistory = {}, compliance = {}, covenants = {}, documents = [] } = {}) {
  const dims = [
    assessDataCompleteness(loan),
    assessServicingHistory(loan, servicingHistory),
    assessComplianceReadiness(loan, compliance),
    assessCovenantStatus(loan, covenants),
    assessLegalDocuments(documents),
  ];

  const weightedScore = dims.reduce((s, d) => s + d.score * d.weight, 0);
  const overallScore  = score(weightedScore);

  const blockingIssues     = dims.flatMap(d => d.issues.filter(i => i.severity === 'blocking'));
  const conditionalIssues  = dims.flatMap(d => d.issues.filter(i => i.severity === 'conditional'));
  const warnings           = dims.flatMap(d => d.issues.filter(i => i.severity === 'warning'));

  let status;
  if (blockingIssues.length > 0 || overallScore < 65) status = 'not_ready';
  else if (conditionalIssues.length > 0 || overallScore < 85) status = 'conditional';
  else status = 'token_ready';

  // Recommendations
  const recommendations = [];
  if (status === 'token_ready') {
    recommendations.push('Loan is token-eligible. Proceed with ERC-1400 package creation and investor onboarding.');
  } else {
    if (blockingIssues.length)    recommendations.push(`Resolve ${blockingIssues.length} blocking issue(s) before tokenization can proceed.`);
    if (conditionalIssues.length) recommendations.push(`${conditionalIssues.length} conditional issue(s) must be resolved or disclosed to investors.`);
    recommendations.push('Re-assess after remediation. Target score ≥85 for unrestricted token eligibility.');
  }

  return {
    assessmentId: uuidv4(),
    loanId:       loan.loan_number || loan.id || 'unknown',
    score:        overallScore,
    status,
    dimensions:   dims.map(({ weight: _w, ...rest }) => rest),
    blockingIssues,
    conditionalIssues,
    warnings,
    recommendations,
    assessedAt:   new Date().toISOString(),
    assessedBy:   'kontra-tokenization-agent-v1',
  };
}

// ── ERC-1400 checklist ────────────────────────────────────────────────────────

const ERC1400_REQUIREMENTS = [
  { id: 'issuance_controller', label: 'Issuance Controller Set',                  desc: 'Contract has designated controller for forced transfers'         },
  { id: 'transfer_restrictions',label: 'Transfer Restrictions Encoded',           desc: 'canTransfer() checks investor whitelist and eligibility rules'   },
  { id: 'document_hash',       label: 'Offering Document Hash On-Chain',          desc: 'getDocument() returns IPFS hash of the legal offering document'  },
  { id: 'partition_support',   label: 'Partition (Tranche) Support',              desc: 'Loan can be split into senior/mezzanine/equity tranches'         },
  { id: 'transfer_with_data',  label: 'transferWithData() Implemented',           desc: 'AML/KYC data passed as calldata on every transfer'               },
  { id: 'operator_auth',       label: 'Operator Authorization',                   desc: 'Servicer can operate on behalf of token holders'                 },
  { id: 'issuance_control',    label: 'Controlled Issuance (minting)',            desc: 'Only controller can issue new tokens after initial offering'     },
  { id: 'redemption',          label: 'Redemption / Burn Support',                desc: 'Tokens can be redeemed (burned) on payoff or maturity'          },
];

module.exports = {
  assessReadiness,
  assessDataCompleteness,
  assessServicingHistory,
  assessComplianceReadiness,
  assessCovenantStatus,
  assessLegalDocuments,
  ERC1400_REQUIREMENTS,
  REQUIRED_LOAN_FIELDS,
  REQUIRED_DOCUMENTS,
};
