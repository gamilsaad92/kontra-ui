/**
 * verificationEngine.js — Cross-document consistency verification
 *
 * Append-only audit log design:
 *   verification_runs   — one row per runVerification() call (run_id anchor)
 *   verification_checks — one row per check per run (no UNIQUE; never mutated)
 *   document_extractions — structured fields pulled from each doc per run
 *
 * getVerificationStatus() returns the LATEST check per check_type via
 * DISTINCT ON (check_type) ORDER BY run_id DESC — safe to call any time.
 *
 * CRE Acquisition checks:
 *   - Rent roll NOI vs operating statement NOI (>5% threshold)
 *   - Rent roll occupancy vs operating statement vacancy rate
 *   - Inspection + insurance physical due diligence completeness
 *
 * Business Acquisition checks:
 *   - Financials TTM revenue vs seller-stated deal_amount (sanity range)
 *   - Tax returns revenue vs financials TTM revenue (>10% threshold)
 *   - LOI price vs deal room deal_amount (>5% threshold)
 *   - EBITDA sanity (negative EBITDA = critical flag)
 *
 * Results: 'verified' | 'discrepancy' | 'pending_review'
 */

const { getPool } = require('./pgAdapter');
const { supabase } = require('../db');

// ── Table bootstrap ───────────────────────────────────────────────────────────

let _tablesReady = false;

async function initVerificationTables() {
  if (_tablesReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS verification_runs (
      id          SERIAL PRIMARY KEY,
      property_id TEXT NOT NULL,
      pack_id     TEXT NOT NULL DEFAULT 'cre_acquisition',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_vruns_property
      ON verification_runs(property_id, id DESC);

    CREATE TABLE IF NOT EXISTS verification_checks (
      id            SERIAL PRIMARY KEY,
      run_id        INT NOT NULL REFERENCES verification_runs(id) ON DELETE CASCADE,
      property_id   TEXT NOT NULL,
      pack_id       TEXT NOT NULL DEFAULT 'cre_acquisition',
      check_type    TEXT NOT NULL,
      doc_section_a TEXT,
      doc_section_b TEXT,
      status        TEXT NOT NULL CHECK (status IN ('verified','discrepancy','pending_review')),
      badge_label   TEXT NOT NULL,
      description   TEXT,
      value_a       NUMERIC,
      value_b       NUMERIC,
      delta_pct     NUMERIC,
      severity      TEXT NOT NULL DEFAULT 'info'
                    CHECK (severity IN ('info','warning','critical')),
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_vchecks_property_run
      ON verification_checks(property_id, run_id DESC);

    CREATE TABLE IF NOT EXISTS document_extractions (
      id               SERIAL PRIMARY KEY,
      run_id           INT NOT NULL REFERENCES verification_runs(id) ON DELETE CASCADE,
      property_id      TEXT NOT NULL,
      section          TEXT NOT NULL,
      extracted_fields JSONB NOT NULL DEFAULT '{}',
      is_unreadable    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_dextractions_run
      ON document_extractions(run_id, property_id);
  `);
  _tablesReady = true;
}

// ── Robust numeric helpers ───────────────────────────────────────────────────

/**
 * Parse a currency/numeric string to a float.
 * Handles: "$1,200,000", "1.2M", "(900000)" for negatives, plain numbers.
 * Returns null for unreadable values.
 */
function parseNumber(val) {
  if (val == null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const s = String(val).trim();
  if (!s || s === '—' || s === 'N/A' || s === 'n/a') return null;

  // Detect parentheses-negative: "(1,200,000)"
  const parens = /^\(([^)]+)\)$/.test(s);

  // Expand shorthand: "1.2M" → 1200000, "500K" → 500000
  const shorthand = s.match(/^[\$\s]*([\d,]+\.?\d*)\s*([KkMmBb])$/);
  if (shorthand) {
    const base = parseFloat(shorthand[1].replace(/,/g, ''));
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[shorthand[2].toLowerCase()] || 1;
    return isNaN(base) ? null : (parens ? -base : base) * mult;
  }

  const cleaned = s.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : (parens ? -n : n);
}

/**
 * Parse a percentage value to a decimal (0–1).
 * Handles: "92.5%", "0.925", "92.5"
 */
function parsePct(val) {
  if (val == null) return null;
  const n = parseNumber(val);
  if (n == null) return null;
  return n > 1 ? n / 100 : n;
}

function pctDelta(a, b) {
  if (a == null || b == null || isNaN(a) || isNaN(b)) return null;
  if (Math.max(Math.abs(a), Math.abs(b)) === 0) return 0;
  return Math.abs((a - b) / Math.max(Math.abs(a), Math.abs(b))) * 100;
}

function formatCurrency(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Structured extraction ─────────────────────────────────────────────────────

/**
 * Extract structured numeric fields from raw analysis JSON for a given section.
 * All numeric fields are normalised via parseNumber() before use.
 * Returns an object of { fieldName: number|boolean|string|null }.
 * Also returns { _unreadable: true } if the doc was flagged as a scanned image.
 */
function extractFields(section, raw) {
  if (!raw || typeof raw !== 'object') return { _unreadable: false };

  const isUnreadable =
    raw.pending === true ||
    (typeof raw.confidence === 'number' && raw.confidence === 0) ||
    /scanned|encrypted|image.only|no.text/i.test(raw.summary || '');

  if (isUnreadable) return { _unreadable: true };

  try {
    switch (section) {
      case 'rent_roll': {
        // Both track-document lightweight and aiDealReview extended formats
        const monthly_rent = parseNumber(raw.totalMonthlyRent || raw.monthlyRent || raw.grossScheduledRent);
        const occ = parsePct(raw.occupancyRate || raw.occupancy);
        // NOI may be provided directly on the rent roll (stabilized NOI, projected NOI)
        const noi = parseNumber(
          raw.netOperatingIncome || raw.noi || raw.stabilizedNoi || raw.projectedNoi
        );
        // Derive annualized EGI from monthly rent if NOI not explicit
        const egi_annual = monthly_rent != null ? monthly_rent * 12 : null;
        return { monthly_rent, occupancy_rate: occ, noi, egi_annual, _unreadable: false };
      }

      case 'financials': {
        // Operating statement (CRE) or financial statements (BA) share this section
        const noi = parseNumber(
          raw.netOperatingIncome || raw.noi || raw.operatingIncome
        );
        const egi = parseNumber(
          raw.effectiveGrossIncome || raw.effectiveGrossRevenue || raw.grossRevenue
        );
        const revenue = parseNumber(
          raw.revenue || raw.annualRevenue || raw.totalRevenue || raw.trailingTwelveMonthsRevenue
        );
        const ttm_revenue = parseNumber(raw.trailingTwelveMonths || raw.ttmRevenue) ?? revenue;
        const ebitda = parseNumber(raw.ebitda || raw.adjustedEbitda || raw.operatingCashFlow);
        const op_expenses = parseNumber(raw.totalOperatingExpenses || raw.operatingExpenses);
        return { noi, egi, revenue, ttm_revenue, ebitda, op_expenses, _unreadable: false };
      }

      case 'inspection': {
        const overallCondition = (raw.overallCondition || '').toLowerCase();
        const overall_ok = !['poor', 'critical', 'failed', 'unsafe'].includes(overallCondition);
        const critical_count = parseNumber(raw.totalCriticalCount ?? raw.criticalCount ?? raw.criticalItems) ?? 0;
        return { overall_ok, critical_count, condition: overallCondition, _unreadable: false };
      }

      case 'insurance': {
        const coverage_amount = parseNumber(raw.coverageAmount || raw.totalCoverage);
        const expiry_date = raw.expirationDate || raw.expiryDate || null;
        return { coverage_amount, expiry_date, _unreadable: false };
      }

      case 'tax_returns': {
        const revenue = parseNumber(
          raw.annualRevenue || raw.grossRevenue || raw.totalRevenue || raw.grossIncome
        );
        const net_income = parseNumber(raw.netIncome || raw.taxableIncome || raw.adjustedGrossIncome);
        return { revenue, net_income, _unreadable: false };
      }

      case 'loi':
      case 'purchase_agreement': {
        const stated_price = parseNumber(raw.purchasePrice || raw.offerPrice || raw.price || raw.dealPrice);
        return { stated_price, _unreadable: false };
      }

      default:
        return { _unreadable: false };
    }
  } catch {
    return { _unreadable: false };
  }
}

// ── Persist a single check (append-only) ─────────────────────────────────────

function insertCheck(pool, runId, row) {
  return pool.query(`
    INSERT INTO verification_checks
      (run_id, property_id, pack_id, check_type, doc_section_a, doc_section_b,
       status, badge_label, description, value_a, value_b, delta_pct, severity)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
  `, [
    runId, row.property_id, row.pack_id, row.check_type,
    row.doc_section_a ?? null, row.doc_section_b ?? null,
    row.status, row.badge_label,
    row.description ?? null,
    row.value_a ?? null, row.value_b ?? null, row.delta_pct ?? null,
    row.severity ?? 'info',
  ]);
}

// ── CRE Acquisition checks ────────────────────────────────────────────────────

async function runCreChecks(pool, runId, propertyId, extractionsBySection) {
  const rr = extractionsBySection.rent_roll || {};
  const fs = extractionsBySection.financials || {};
  const insp = extractionsBySection.inspection || {};
  const ins = extractionsBySection.insurance || {};

  const checks = [];

  // ── Check 1: Rent roll NOI vs operating statement NOI (core CRE check) ──
  // Prefer direct NOI from both documents. Fall back to deriving rent-roll
  // NOI from EGI minus operating expenses if the operating statement has
  // both components but the rent roll lacks an explicit NOI field.

  const rrNoi = rr.noi ?? null;
  const fsNoi = fs.noi ?? null;

  if (rr._unreadable || fs._unreadable) {
    // At least one doc was a scanned image — surface that clearly
    const unreadableSec = rr._unreadable ? 'rent roll' : 'operating statement';
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'noi_cross_check',
      doc_section_a: 'rent_roll', doc_section_b: 'financials',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: null, value_b: null, delta_pct: null,
      description: `Unreadable document — the ${unreadableSec} could not be parsed (scanned image or encrypted PDF). Upload a text-based PDF to enable NOI verification.`,
    });
  } else if (rrNoi != null && fsNoi != null) {
    const delta = pctDelta(rrNoi, fsNoi);
    const isDiscrepancy = delta != null && delta > 5;
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'noi_cross_check',
      doc_section_a: 'rent_roll', doc_section_b: 'financials',
      status: isDiscrepancy ? 'discrepancy' : 'verified',
      badge_label: isDiscrepancy ? 'Discrepancy Found' : 'Verified',
      severity: isDiscrepancy ? (delta > 15 ? 'critical' : 'warning') : 'info',
      value_a: rrNoi, value_b: fsNoi, delta_pct: delta,
      description: isDiscrepancy
        ? `Rent roll NOI (${formatCurrency(rrNoi)}) differs from operating statement NOI (${formatCurrency(fsNoi)}) by ${delta?.toFixed(1)}%. A gap >5% may signal vacancy loss discrepancies, unreported expenses, or off-market leases — flag for buyer review.`
        : `Rent roll NOI (${formatCurrency(rrNoi)}) is consistent with operating statement NOI (${formatCurrency(fsNoi)}) — gap is within the 5% threshold.`,
    });
  } else if (extractionsBySection._hasRentRoll || extractionsBySection._hasFinancials) {
    // One or both docs uploaded but NOI not extractable — give precise reason
    const noNoi = [];
    if (extractionsBySection._hasRentRoll && rrNoi == null) noNoi.push('rent roll (no NOI field found)');
    if (extractionsBySection._hasFinancials && fsNoi == null) noNoi.push('operating statement (no NOI field found)');
    const missing = !extractionsBySection._hasRentRoll ? 'rent roll' : !extractionsBySection._hasFinancials ? 'operating statement' : null;
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'noi_cross_check',
      doc_section_a: 'rent_roll', doc_section_b: 'financials',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: rrNoi, value_b: fsNoi, delta_pct: null,
      description: missing
        ? `Waiting for ${missing} upload to run NOI consistency check.`
        : `NOI could not be extracted from ${noNoi.join(' and ')}. Ensure documents include a net operating income line item.`,
    });
  }

  // ── Check 2: Occupancy rate consistency ──
  const rrOcc = rr.occupancy_rate ?? null;
  // Operating statement vacancy rate (if available) gives occupancy = 1 - vacancy
  const fsVacancy = fs.vacancy_rate != null ? fs.vacancy_rate : null;
  const fsOcc = fsVacancy != null ? 1 - fsVacancy : null;

  if (rrOcc != null && fsOcc != null) {
    const delta = Math.abs(rrOcc - fsOcc) * 100; // in percentage points
    const isDiscrepancy = delta > 5;
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'occupancy_cross_check',
      doc_section_a: 'rent_roll', doc_section_b: 'financials',
      status: isDiscrepancy ? 'discrepancy' : 'verified',
      badge_label: isDiscrepancy ? 'Discrepancy Found' : 'Verified',
      severity: isDiscrepancy ? 'warning' : 'info',
      value_a: rrOcc * 100, value_b: fsOcc * 100, delta_pct: delta,
      description: isDiscrepancy
        ? `Rent roll occupancy (${(rrOcc * 100).toFixed(1)}%) differs from operating statement implied occupancy (${(fsOcc * 100).toFixed(1)}%) by ${delta.toFixed(1)} percentage points. Reconcile before closing.`
        : `Occupancy rates are consistent between rent roll (${(rrOcc * 100).toFixed(1)}%) and operating statement (${(fsOcc * 100).toFixed(1)}%).`,
    });
  }

  // ── Check 3: Physical due diligence completeness ──
  const hasInspection = !!extractionsBySection._hasInspection;
  const hasInsurance = !!extractionsBySection._hasInsurance;

  if (hasInspection && hasInsurance) {
    const overall_ok = insp.overall_ok !== false;
    const criticalCount = insp.critical_count ?? 0;
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'physical_due_diligence_complete',
      doc_section_a: 'inspection', doc_section_b: 'insurance',
      status: overall_ok ? 'verified' : 'discrepancy',
      badge_label: overall_ok ? 'Verified' : 'Discrepancy Found',
      severity: overall_ok ? 'info' : (criticalCount > 2 ? 'critical' : 'warning'),
      value_a: null, value_b: null, delta_pct: null,
      description: overall_ok
        ? 'Inspection report and insurance certificate are both on file. Physical due diligence package is complete.'
        : `Inspection report indicates ${insp.condition || 'poor'} condition${criticalCount > 0 ? ` with ${criticalCount} critical item${criticalCount > 1 ? 's' : ''}` : ''}. Review all findings before proceeding.`,
    });
  } else {
    const missingDocs = [
      !hasInspection && 'inspection report',
      !hasInsurance && 'insurance certificate',
    ].filter(Boolean).join(' and ');
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'physical_due_diligence_complete',
      doc_section_a: 'inspection', doc_section_b: 'insurance',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: null, value_b: null, delta_pct: null,
      description: `Waiting for ${missingDocs} to complete physical due diligence verification.`,
    });
  }

  for (const check of checks) {
    await insertCheck(pool, runId, check)
      .catch(e => console.warn('[verification] insert error:', e.message));
  }
}

// ── Business Acquisition checks ───────────────────────────────────────────────

async function runBaChecks(pool, runId, propertyId, extractionsBySection, dealRoom) {
  const taxData = extractionsBySection.tax_returns || {};
  const finData = extractionsBySection.financials || {};
  const loiData = extractionsBySection.loi || extractionsBySection.purchase_agreement || {};
  const checks = [];

  // Seller-stated deal amount from deal room (the canonical asking price field)
  const dealAmount = parseNumber(dealRoom?.deal_amount) ?? null;
  // Seller-stated revenue and EBITDA from the deal room summary panel
  // (populated when the owner enters the business summary at deal room creation)
  const statedRevenue = parseNumber(dealRoom?.stated_revenue) ?? null;
  const statedEbitda  = parseNumber(dealRoom?.stated_ebitda)  ?? null;

  // ── Check 1: Extracted financials TTM revenue vs seller-stated revenue ──
  // Compares what the seller told you (stated_revenue in deal room summary)
  // against what their independently uploaded financials actually show.
  // A gap >10% surfaces undisclosed revenue adjustments or inconsistencies.
  if (finData.ttm_revenue != null && statedRevenue != null) {
    const delta = pctDelta(finData.ttm_revenue, statedRevenue);
    const isDiscrepancy = delta != null && delta > 10;
    const isCritical = delta != null && delta > 25;
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'ttm_revenue_vs_stated_revenue',
      doc_section_a: 'financials', doc_section_b: null,
      status: isDiscrepancy ? 'discrepancy' : 'verified',
      badge_label: isDiscrepancy ? 'Discrepancy Found' : 'Verified',
      severity: isCritical ? 'critical' : isDiscrepancy ? 'warning' : 'info',
      value_a: finData.ttm_revenue, value_b: statedRevenue, delta_pct: delta,
      description: isDiscrepancy
        ? `Uploaded financials TTM revenue (${formatCurrency(finData.ttm_revenue)}) differs from seller-stated revenue (${formatCurrency(statedRevenue)}) by ${delta?.toFixed(1)}%. A gap ${isCritical ? '>25%' : '>10%'} may indicate undisclosed adjustments or mismatched accounting periods — flag for buyer's accountant.`
        : `Uploaded financials TTM revenue (${formatCurrency(finData.ttm_revenue)}) is consistent with seller-stated revenue (${formatCurrency(statedRevenue)}) — within the 10% threshold.`,
    });
  } else if (extractionsBySection._hasFinancials) {
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'ttm_revenue_vs_stated_revenue',
      doc_section_a: 'financials', doc_section_b: null,
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: finData.ttm_revenue ?? null, value_b: statedRevenue, delta_pct: null,
      description: statedRevenue == null
        ? 'Seller has not entered a stated revenue figure in the deal room summary. Add it to enable revenue cross-check against uploaded financials.'
        : finData._unreadable
          ? 'Financial statement could not be read (scanned or encrypted PDF). Upload a text-based PDF to enable revenue cross-check.'
          : 'TTM revenue could not be extracted from the financial statement. Ensure the document includes a total or trailing-twelve-months revenue line.',
    });
  }

  // ── Check 2: Extracted financials EBITDA vs seller-stated EBITDA ──
  // Compares the seller's disclosed EBITDA (deal room summary) against
  // what their independently uploaded financials show. Add-backs in seller
  // financials commonly inflate EBITDA; a gap >20% warrants itemised review.
  if (finData.ebitda != null && statedEbitda != null) {
    if (finData.ebitda <= 0) {
      checks.push({
        property_id: propertyId, pack_id: 'business_acquisition',
        check_type: 'ebitda_vs_stated_ebitda',
        doc_section_a: 'financials', doc_section_b: null,
        status: 'discrepancy', badge_label: 'Discrepancy Found', severity: 'critical',
        value_a: finData.ebitda, value_b: statedEbitda, delta_pct: null,
        description: `Uploaded financials show negative or zero EBITDA (${formatCurrency(finData.ebitda)}) while seller states ${formatCurrency(statedEbitda)}. A business with no positive cash flow cannot support the stated valuation — requires seller explanation.`,
      });
    } else {
      const delta = pctDelta(finData.ebitda, statedEbitda);
      const isDiscrepancy = delta != null && delta > 20;
      const isCritical = delta != null && delta > 40;
      checks.push({
        property_id: propertyId, pack_id: 'business_acquisition',
        check_type: 'ebitda_vs_stated_ebitda',
        doc_section_a: 'financials', doc_section_b: null,
        status: isDiscrepancy ? 'discrepancy' : 'verified',
        badge_label: isDiscrepancy ? 'Discrepancy Found' : 'Verified',
        severity: isCritical ? 'critical' : isDiscrepancy ? 'warning' : 'info',
        value_a: finData.ebitda, value_b: statedEbitda, delta_pct: delta,
        description: isDiscrepancy
          ? `Uploaded financials EBITDA (${formatCurrency(finData.ebitda)}) differs from seller-stated EBITDA (${formatCurrency(statedEbitda)}) by ${delta?.toFixed(1)}%. Gaps ${isCritical ? '>40%' : '>20%'} indicate add-backs or adjustments that need itemised review with buyer's accountant.`
          : `Uploaded financials EBITDA (${formatCurrency(finData.ebitda)}) is consistent with seller-stated EBITDA (${formatCurrency(statedEbitda)}) — within the 20% threshold.`,
      });
    }
  } else if (extractionsBySection._hasFinancials) {
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'ebitda_vs_stated_ebitda',
      doc_section_a: 'financials', doc_section_b: null,
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: finData.ebitda ?? null, value_b: statedEbitda, delta_pct: null,
      description: statedEbitda == null
        ? 'Seller has not entered a stated EBITDA figure in the deal room summary. Add it to enable EBITDA cross-check against uploaded financials.'
        : finData._unreadable
          ? 'Financial statement could not be read. Upload a text-based PDF to enable EBITDA cross-check.'
          : 'EBITDA could not be extracted. Ensure financial statements include an EBITDA or operating cash flow line.',
    });
  }

  // ── Check 3: Seller-stated financials EBITDA vs IRS tax-return net income ──
  // Tax returns (IRS-filed) are the independently verified source.
  // Seller-prepared financials (with add-backs) are the seller-stated figures.
  // Comparing surfaced add-backs that don't hold up, non-recurring revenue,
  // or owner compensation re-characterised as profit.
  const taxNetIncome = taxData.net_income ?? null;
  if (finData.ebitda != null && taxNetIncome != null) {
    const ebitdaPremiumPct = taxNetIncome !== 0
      ? ((finData.ebitda - taxNetIncome) / Math.abs(taxNetIncome)) * 100
      : null;
    const isAggressive = ebitdaPremiumPct != null && ebitdaPremiumPct > 40;
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'financials_vs_tax_ebitda',
      doc_section_a: 'financials', doc_section_b: 'tax_returns',
      status: isAggressive ? 'discrepancy' : 'verified',
      badge_label: isAggressive ? 'Discrepancy Found' : 'Verified',
      severity: isAggressive ? 'warning' : 'info',
      value_a: finData.ebitda, value_b: taxNetIncome, delta_pct: ebitdaPremiumPct,
      description: isAggressive
        ? `Seller-stated EBITDA (${formatCurrency(finData.ebitda)}) is ${ebitdaPremiumPct?.toFixed(1)}% above IRS-filed net income (${formatCurrency(taxNetIncome)}). Add-backs of this magnitude warrant itemised review — flag for buyer's accountant.`
        : `Seller-stated EBITDA (${formatCurrency(finData.ebitda)}) is consistent with IRS-filed net income (${formatCurrency(taxNetIncome)}) after normal D&A and tax add-backs.`,
    });
  } else if (extractionsBySection._hasFinancials || extractionsBySection._hasTaxReturns) {
    const missing = !extractionsBySection._hasFinancials ? 'financial statements' : !extractionsBySection._hasTaxReturns ? 'tax returns' : null;
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'financials_vs_tax_ebitda',
      doc_section_a: 'financials', doc_section_b: 'tax_returns',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: finData.ebitda ?? null, value_b: taxNetIncome, delta_pct: null,
      description: missing
        ? `Waiting for ${missing} to compare seller-stated EBITDA against IRS-filed income.`
        : 'EBITDA or net income could not be extracted. Ensure financials include an EBITDA line and tax returns include net/taxable income.',
    });
  }

  // ── Check 4: Tax returns revenue vs financials TTM revenue ──
  if (taxData.revenue != null && finData.ttm_revenue != null) {
    const delta = pctDelta(taxData.revenue, finData.ttm_revenue);
    const isDiscrepancy = delta != null && delta > 10;
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'tax_returns_vs_financials_revenue',
      doc_section_a: 'tax_returns', doc_section_b: 'financials',
      status: isDiscrepancy ? 'discrepancy' : 'verified',
      badge_label: isDiscrepancy ? 'Discrepancy Found' : 'Verified',
      severity: isDiscrepancy ? (delta > 25 ? 'critical' : 'warning') : 'info',
      value_a: taxData.revenue, value_b: finData.ttm_revenue, delta_pct: delta,
      description: isDiscrepancy
        ? `Tax return revenue (${formatCurrency(taxData.revenue)}) differs from financial statement TTM revenue (${formatCurrency(finData.ttm_revenue)}) by ${delta?.toFixed(1)}%. A gap >10% may indicate unreported revenue, timing differences, or inconsistent accounting — flag for buyer's accountant.`
        : `Tax return revenue (${formatCurrency(taxData.revenue)}) is consistent with financial statement TTM revenue (${formatCurrency(finData.ttm_revenue)}) — within the 10% threshold.`,
    });
  } else if (extractionsBySection._hasTaxReturns || extractionsBySection._hasFinancials) {
    const missing = !extractionsBySection._hasTaxReturns ? 'tax returns' : 'financial statements';
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'tax_returns_vs_financials_revenue',
      doc_section_a: 'tax_returns', doc_section_b: 'financials',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: taxData.revenue ?? null, value_b: finData.ttm_revenue ?? null, delta_pct: null,
      description: `Waiting for ${missing} to cross-check reported revenue.`,
    });
  }

  // ── Check 6: LOI stated price vs deal room deal_amount ──
  const loiPrice = loiData.stated_price ?? null;
  if (loiPrice != null && dealAmount != null) {
    const delta = pctDelta(loiPrice, dealAmount);
    const isDiscrepancy = delta != null && delta > 5;
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'loi_price_vs_deal_amount',
      doc_section_a: 'loi', doc_section_b: null,
      status: isDiscrepancy ? 'discrepancy' : 'verified',
      badge_label: isDiscrepancy ? 'Discrepancy Found' : 'Verified',
      severity: isDiscrepancy ? 'warning' : 'info',
      value_a: loiPrice, value_b: dealAmount, delta_pct: delta,
      description: isDiscrepancy
        ? `LOI stated price (${formatCurrency(loiPrice)}) differs from the deal room deal amount (${formatCurrency(dealAmount)}) by ${delta?.toFixed(1)}%. Confirm which figure is current before advancing to a PSA.`
        : `LOI price (${formatCurrency(loiPrice)}) matches the deal room deal amount (${formatCurrency(dealAmount)}).`,
    });
  }

  // ── Check 7: EBITDA sanity — must be positive for a business for sale ──
  if (finData.ebitda != null) {
    const isNegative = finData.ebitda < 0;
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'ebitda_sanity',
      doc_section_a: 'financials', doc_section_b: null,
      status: isNegative ? 'discrepancy' : 'verified',
      badge_label: isNegative ? 'Discrepancy Found' : 'Verified',
      severity: isNegative ? 'critical' : 'info',
      value_a: finData.ebitda, value_b: null, delta_pct: null,
      description: isNegative
        ? `Financials show negative EBITDA (${formatCurrency(finData.ebitda)}). The business is not cash-flow positive — this is a material risk factor that requires seller explanation before proceeding.`
        : `EBITDA is positive (${formatCurrency(finData.ebitda)}). Business appears cash-flow positive based on submitted financials.`,
    });
  } else if (extractionsBySection._hasFinancials) {
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'ebitda_sanity',
      doc_section_a: 'financials', doc_section_b: null,
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: null, value_b: null, delta_pct: null,
      description: finData._unreadable
        ? 'Financial statement could not be read (scanned or encrypted PDF). Upload a text-based PDF to enable EBITDA check.'
        : 'EBITDA could not be extracted from the financial statement. Ensure the document includes an EBITDA or operating cash flow line.',
    });
  }

  for (const check of checks) {
    await insertCheck(pool, runId, check)
      .catch(e => console.warn('[verification] insert error:', e.message));
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run all verification checks for a deal room.
 * Creates a new run_id on every call — the log is append-only.
 *
 * @param {string} propertyId
 * @param {string} packId — 'cre_acquisition' | 'business_acquisition'
 */
async function runVerification(propertyId, packId) {
  try {
    await initVerificationTables();
    const pool = getPool();

    // Fetch all analyses and deal room data in parallel
    const [analysesRes, roomRes] = await Promise.all([
      supabase.from('deal_analyses')
        .select('section, analysis, filename, created_at')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false }),
      supabase.from('deal_rooms')
        .select('deal_amount, deal_type, property_name, stated_revenue, stated_ebitda')
        .eq('property_id', propertyId)
        .maybeSingle(),
    ]);

    const analyses = analysesRes.data || [];
    const dealRoom = roomRes.data || {};

    // Index by section — take the latest for each section
    const latestBySection = {};
    for (const a of analyses) {
      if (!latestBySection[a.section]) latestBySection[a.section] = a.analysis;
    }

    // Extract structured fields per section + presence flags
    const extractionsBySection = {};
    const SECTIONS = ['rent_roll', 'financials', 'inspection', 'insurance', 'tax_returns', 'loi', 'purchase_agreement'];
    for (const sec of SECTIONS) {
      if (latestBySection[sec]) {
        extractionsBySection[sec] = extractFields(sec, latestBySection[sec]);
        extractionsBySection[`_has${sec.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('')}`] = true;
      }
    }

    // ── Open a new run ──────────────────────────────────────────────────────
    const runRow = await pool.query(
      `INSERT INTO verification_runs (property_id, pack_id) VALUES ($1,$2) RETURNING id`,
      [propertyId, packId || 'cre_acquisition']
    );
    const runId = runRow.rows[0].id;

    // ── Persist document_extractions for this run ───────────────────────────
    for (const sec of SECTIONS) {
      if (extractionsBySection[sec]) {
        const fields = { ...extractionsBySection[sec] };
        const isUnreadable = fields._unreadable === true;
        delete fields._unreadable;
        // Include confidence score from raw analysis if available
        const rawAnalysis = latestBySection[sec];
        const confidence = (rawAnalysis && typeof rawAnalysis.confidence === 'number')
          ? rawAnalysis.confidence
          : null;
        if (confidence != null) fields.confidence = confidence;
        await pool.query(
          `INSERT INTO document_extractions (run_id, property_id, section, extracted_fields, is_unreadable)
           VALUES ($1,$2,$3,$4,$5)`,
          [runId, propertyId, sec, JSON.stringify(fields), isUnreadable]
        ).catch(e => console.warn('[verification] extraction insert:', e.message));
      }
    }

    // ── Run pack-specific checks ────────────────────────────────────────────
    if (packId === 'business_acquisition') {
      await runBaChecks(pool, runId, propertyId, extractionsBySection, dealRoom);
    } else {
      await runCreChecks(pool, runId, propertyId, extractionsBySection);
    }

    console.log(`[verification] ✓ ${propertyId} (${packId}) run=${runId} — ${analyses.length} docs`);
  } catch (err) {
    console.warn('[verification] runVerification failed:', err.message);
  }
}

/**
 * Fetch current verification status for a deal room.
 * Uses DISTINCT ON to return the LATEST result per check_type (append-only safe).
 * Returns { results, summary }
 */
async function getVerificationStatus(propertyId) {
  try {
    await initVerificationTables();
    const pool = getPool();

    // Latest result per check_type via DISTINCT ON with run_id DESC
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (check_type)
        c.id, c.run_id, c.property_id, c.pack_id, c.check_type,
        c.doc_section_a, c.doc_section_b, c.status, c.badge_label,
        c.description, c.value_a, c.value_b, c.delta_pct, c.severity,
        c.created_at,
        r.created_at AS run_at
      FROM verification_checks c
      JOIN verification_runs r ON r.id = c.run_id
      WHERE c.property_id = $1
      ORDER BY check_type, c.run_id DESC
    `, [propertyId]);

    const summary = {
      verified: rows.filter(r => r.status === 'verified').length,
      discrepancies: rows.filter(r => r.status === 'discrepancy').length,
      pending: rows.filter(r => r.status === 'pending_review').length,
    };
    // Sort for display: discrepancies first, then pending, then verified
    rows.sort((a, b) => {
      const order = { discrepancy: 0, pending_review: 1, verified: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });
    return { results: rows, summary };
  } catch (err) {
    console.warn('[verification] getVerificationStatus failed:', err.message);
    return { results: [], summary: { verified: 0, discrepancies: 0, pending: 0 } };
  }
}

/**
 * Fetch the complete append-only verification history for a deal room.
 * Returns all runs with their checks, newest run first.
 * Used by the full-log endpoint so auditors can see every check that ever ran.
 */
async function getFullVerificationLog(propertyId) {
  try {
    await initVerificationTables();
    const pool = getPool();

    // All runs for this property, newest first
    const runsRes = await pool.query(
      `SELECT id, pack_id, created_at FROM verification_runs
       WHERE property_id = $1 ORDER BY id DESC`,
      [propertyId]
    );
    const runs = runsRes.rows;

    if (runs.length === 0) {
      return { runs: [], summary: { verified: 0, discrepancies: 0, pending: 0 } };
    }

    // All checks across all runs (join for display convenience)
    const checksRes = await pool.query(
      `SELECT c.*, r.created_at AS run_at
       FROM verification_checks c
       JOIN verification_runs r ON r.id = c.run_id
       WHERE c.property_id = $1
       ORDER BY c.run_id DESC, c.id ASC`,
      [propertyId]
    );
    const allChecks = checksRes.rows;

    // Group checks by run_id
    const checksByRun = {};
    for (const c of allChecks) {
      if (!checksByRun[c.run_id]) checksByRun[c.run_id] = [];
      checksByRun[c.run_id].push(c);
    }

    const enrichedRuns = runs.map(r => ({
      run_id: r.id,
      pack_id: r.pack_id,
      run_at: r.created_at,
      checks: checksByRun[r.id] || [],
    }));

    // Summary from the latest run only (current state)
    const latestChecks = checksByRun[runs[0].id] || [];
    const summary = {
      verified: latestChecks.filter(c => c.status === 'verified').length,
      discrepancies: latestChecks.filter(c => c.status === 'discrepancy').length,
      pending: latestChecks.filter(c => c.status === 'pending_review').length,
    };

    return { runs: enrichedRuns, summary };
  } catch (err) {
    console.warn('[verification] getFullVerificationLog failed:', err.message);
    return { runs: [], summary: { verified: 0, discrepancies: 0, pending: 0 } };
  }
}

module.exports = { runVerification, getVerificationStatus, getFullVerificationLog, initVerificationTables };
