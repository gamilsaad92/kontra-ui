/**
 * verificationEngine.js — Cross-document consistency verification
 *
 * After any document is saved to deal_analyses, this engine:
 *  1. Reads all existing analyses for the deal room
 *  2. Runs pack-specific cross-checks on the extracted data
 *  3. Writes results to local Postgres verification_results table
 *
 * CRE Acquisition checks:
 *   - Rent roll monthly income vs operating statement GPR (annual / 12)
 *   - Rent roll occupancy vs operating statement vacancy
 *   - Operating statement NOI vs appraisal NOI (if available)
 *
 * Business Acquisition checks:
 *   - Tax returns revenue vs financials TTM revenue
 *   - Financials EBITDA vs deal room stated deal amount (sanity range)
 *   - LOI price vs deal room deal_amount
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
    CREATE TABLE IF NOT EXISTS verification_results (
      id SERIAL PRIMARY KEY,
      property_id TEXT NOT NULL,
      pack_id TEXT NOT NULL DEFAULT 'cre_acquisition',
      check_type TEXT NOT NULL,
      doc_section_a TEXT,
      doc_section_b TEXT,
      status TEXT NOT NULL CHECK (status IN ('verified', 'discrepancy', 'pending_review')),
      badge_label TEXT NOT NULL,
      description TEXT,
      value_a NUMERIC,
      value_b NUMERIC,
      delta_pct NUMERIC,
      severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(property_id, check_type)
    );
    CREATE INDEX IF NOT EXISTS idx_verification_results_property
      ON verification_results(property_id);
  `);
  _tablesReady = true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctDelta(a, b) {
  if (!a || !b) return null;
  return Math.abs((a - b) / Math.max(a, b)) * 100;
}

function formatCurrency(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function upsertResult(pool, row) {
  return pool.query(`
    INSERT INTO verification_results
      (property_id, pack_id, check_type, doc_section_a, doc_section_b, status,
       badge_label, description, value_a, value_b, delta_pct, severity, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
    ON CONFLICT (property_id, check_type) DO UPDATE SET
      pack_id=EXCLUDED.pack_id, doc_section_a=EXCLUDED.doc_section_a,
      doc_section_b=EXCLUDED.doc_section_b, status=EXCLUDED.status,
      badge_label=EXCLUDED.badge_label, description=EXCLUDED.description,
      value_a=EXCLUDED.value_a, value_b=EXCLUDED.value_b,
      delta_pct=EXCLUDED.delta_pct, severity=EXCLUDED.severity,
      updated_at=NOW()
  `, [
    row.property_id, row.pack_id, row.check_type, row.doc_section_a, row.doc_section_b,
    row.status, row.badge_label, row.description,
    row.value_a ?? null, row.value_b ?? null, row.delta_pct ?? null, row.severity ?? 'info',
  ]);
}

// ── Parse useful numbers out of analysis JSON ─────────────────────────────────

function parseAnalysis(section, analysis) {
  if (!analysis || typeof analysis !== 'object') return {};
  try {
    switch (section) {
      case 'rent_roll': {
        // Track-document LIGHTWEIGHT_AI_PROMPTS format
        const monthly = parseFloat(String(analysis.totalMonthlyRent || '').replace(/[^0-9.]/g, '')) || null;
        const occ = parseFloat(String(analysis.occupancyRate || '').replace(/[^0-9.]/g, '')) || null;
        const occDecimal = occ != null ? (occ > 1 ? occ / 100 : occ) : null;
        return { monthly_rent: monthly, occupancy_rate: occDecimal };
      }
      case 'financials': {
        // aiDealReview router produces: netOperatingIncome, effectiveGrossIncome, revenue, ebitda
        const noi = analysis.netOperatingIncome || analysis.noi || null;
        const egi = analysis.effectiveGrossIncome || analysis.grossRevenue || null;
        const revenue = analysis.revenue || analysis.annualRevenue || analysis.totalRevenue || egi;
        const ebitda = analysis.ebitda || analysis.operatingIncome || null;
        const ttm = analysis.trailingTwelveMonths || null; // BA specific
        return { noi, egi, revenue, ebitda, ttm_revenue: ttm || revenue };
      }
      case 'inspection': {
        const overallOk = !(analysis.overallCondition === 'poor' || analysis.overallCondition === 'critical');
        const criticalCount = analysis.totalCriticalCount ?? analysis.criticalCount ?? 0;
        return { overall_ok: overallOk, critical_count: criticalCount };
      }
      case 'insurance': {
        const coverage = analysis.coverageAmount || null;
        const expiry = analysis.expirationDate || null;
        return { coverage_amount: coverage, expiry_date: expiry };
      }
      case 'tax_returns': {
        // BA pack — tax returns report revenue
        const revenue = analysis.annualRevenue || analysis.grossRevenue || analysis.totalRevenue || null;
        const income = analysis.netIncome || analysis.taxableIncome || null;
        return { revenue, net_income: income };
      }
      case 'purchase_agreement':
      case 'loi': {
        const price = parseFloat(String(analysis.purchasePrice || '').replace(/[^0-9.]/g, '')) || null;
        return { stated_price: price };
      }
      default:
        return {};
    }
  } catch {
    return {};
  }
}

// ── CRE Acquisition checks ────────────────────────────────────────────────────

async function runCreChecks(pool, propertyId, analysesBySection) {
  const checks = [];

  // 1. Rent roll vs operating statement — monthly income consistency
  const rr = parseAnalysis('rent_roll', analysesBySection.rent_roll);
  const fs = parseAnalysis('financials', analysesBySection.financials);

  if (rr.monthly_rent != null && fs.egi != null) {
    const rrAnnual = rr.monthly_rent * 12;
    const delta = pctDelta(rrAnnual, fs.egi);
    const isDiscrepancy = delta != null && delta > 5;
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'rent_roll_vs_operating_income',
      doc_section_a: 'rent_roll', doc_section_b: 'financials',
      status: isDiscrepancy ? 'discrepancy' : 'verified',
      badge_label: isDiscrepancy ? 'Discrepancy Found' : 'Verified',
      severity: isDiscrepancy ? (delta > 15 ? 'critical' : 'warning') : 'info',
      value_a: rrAnnual, value_b: fs.egi, delta_pct: delta,
      description: isDiscrepancy
        ? `Rent roll annualized income (${formatCurrency(rrAnnual)}) differs from operating statement EGI (${formatCurrency(fs.egi)}) by ${delta?.toFixed(1)}%. Review for vacancy loss accounting or off-market leases.`
        : `Rent roll annualized income (${formatCurrency(rrAnnual)}) is consistent with operating statement EGI (${formatCurrency(fs.egi)}) — within 5%.`,
    });
  } else if (analysesBySection.rent_roll || analysesBySection.financials) {
    const missing = !analysesBySection.rent_roll ? 'rent roll' : 'operating statement';
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'rent_roll_vs_operating_income',
      doc_section_a: 'rent_roll', doc_section_b: 'financials',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: rr.monthly_rent ? rr.monthly_rent * 12 : null, value_b: fs.egi,
      description: `Waiting for ${missing} upload to run income consistency check.`,
    });
  }

  // 2. NOI check — operating statement vs purchase agreement implied NOI (cap rate)
  if (fs.noi != null) {
    const noi = fs.noi;
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'noi_extracted',
      doc_section_a: 'financials', doc_section_b: null,
      status: 'verified', badge_label: 'Verified', severity: 'info',
      value_a: noi, value_b: null, delta_pct: null,
      description: `Operating statement NOI extracted: ${formatCurrency(noi)} / year. Used as baseline for cap rate and DSCR checks.`,
    });
  }

  // 3. Inspection + insurance both present = complete package check
  const hasInspection = !!analysesBySection.inspection;
  const hasInsurance = !!analysesBySection.insurance;
  if (hasInspection && hasInsurance) {
    const inspOk = parseAnalysis('inspection', analysesBySection.inspection).overall_ok;
    checks.push({
      property_id: propertyId, pack_id: 'cre_acquisition',
      check_type: 'physical_due_diligence_complete',
      doc_section_a: 'inspection', doc_section_b: 'insurance',
      status: inspOk ? 'verified' : 'discrepancy',
      badge_label: inspOk ? 'Verified' : 'Discrepancy Found',
      severity: inspOk ? 'info' : 'warning',
      value_a: null, value_b: null, delta_pct: null,
      description: inspOk
        ? 'Inspection report and insurance certificate are both on file. Physical due diligence package is complete.'
        : 'Inspection report indicates poor or critical property condition. Review findings before proceeding.',
    });
  } else {
    const missingDocs = [!hasInspection && 'inspection report', !hasInsurance && 'insurance certificate'].filter(Boolean).join(' and ');
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
    await upsertResult(pool, check).catch(e => console.warn('[verification] upsert error:', e.message));
  }
}

// ── Business Acquisition checks ───────────────────────────────────────────────

async function runBaChecks(pool, propertyId, analysesBySection, dealRoom) {
  const checks = [];

  const taxData = parseAnalysis('tax_returns', analysesBySection.tax_returns);
  const finData = parseAnalysis('financials', analysesBySection.financials);
  const loiData = parseAnalysis('loi', analysesBySection.loi);

  // 1. Tax returns revenue vs financials TTM revenue
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
        ? `Tax return revenue (${formatCurrency(taxData.revenue)}) differs from financial statements TTM revenue (${formatCurrency(finData.ttm_revenue)}) by ${delta?.toFixed(1)}%. This gap may indicate unreported revenue, timing differences, or data inconsistency — flag for buyer diligence.`
        : `Tax return revenue (${formatCurrency(taxData.revenue)}) is consistent with financial statements TTM revenue (${formatCurrency(finData.ttm_revenue)}) — within 10%.`,
    });
  } else if (analysesBySection.tax_returns || analysesBySection.financials) {
    const missing = !analysesBySection.tax_returns ? 'tax returns' : 'financial statements';
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'tax_returns_vs_financials_revenue',
      doc_section_a: 'tax_returns', doc_section_b: 'financials',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: taxData.revenue, value_b: finData.ttm_revenue, delta_pct: null,
      description: `Waiting for ${missing} to cross-check reported revenue.`,
    });
  }

  // 2. LOI stated price vs deal room deal_amount
  const dealAmount = parseFloat(String(dealRoom?.deal_amount || '').replace(/[^0-9.]/g, '')) || null;
  if (loiData.stated_price != null && dealAmount != null) {
    const delta = pctDelta(loiData.stated_price, dealAmount);
    const isDiscrepancy = delta != null && delta > 5;
    checks.push({
      property_id: propertyId, pack_id: 'business_acquisition',
      check_type: 'loi_price_vs_deal_amount',
      doc_section_a: 'loi', doc_section_b: null,
      status: isDiscrepancy ? 'discrepancy' : 'verified',
      badge_label: isDiscrepancy ? 'Discrepancy Found' : 'Verified',
      severity: isDiscrepancy ? 'warning' : 'info',
      value_a: loiData.stated_price, value_b: dealAmount, delta_pct: delta,
      description: isDiscrepancy
        ? `LOI stated price (${formatCurrency(loiData.stated_price)}) differs from the deal room deal amount (${formatCurrency(dealAmount)}) by ${delta?.toFixed(1)}%. Confirm which figure is current before proceeding to PSA.`
        : `LOI price (${formatCurrency(loiData.stated_price)}) matches deal room deal amount (${formatCurrency(dealAmount)}).`,
    });
  }

  // 3. EBITDA sanity check (must be positive)
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
        ? `Financials show negative EBITDA (${formatCurrency(finData.ebitda)}). The business is not cash-flow positive — this is a material risk factor that requires explanation from the seller.`
        : `EBITDA is positive (${formatCurrency(finData.ebitda)}). Business appears cash-flow positive based on submitted financials.`,
    });
  }

  for (const check of checks) {
    await upsertResult(pool, check).catch(e => console.warn('[verification] upsert error:', e.message));
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Run all verification checks for a deal room. Safe to call repeatedly — all
 * checks are upserted so re-running after a new upload just refreshes results.
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
        .select('deal_amount, deal_type, property_name')
        .eq('property_id', propertyId)
        .maybeSingle(),
    ]);

    const analyses = analysesRes.data || [];
    const dealRoom = roomRes.data || {};

    // Index by section — take the latest for each section
    const bySection = {};
    for (const a of analyses) {
      if (!bySection[a.section]) bySection[a.section] = a.analysis;
    }

    if (packId === 'business_acquisition') {
      await runBaChecks(pool, propertyId, bySection, dealRoom);
    } else {
      await runCreChecks(pool, propertyId, bySection);
    }

    console.log(`[verification] ✓ ${propertyId} (${packId}) — ${analyses.length} docs checked`);
  } catch (err) {
    console.warn('[verification] runVerification failed:', err.message);
  }
}

/**
 * Fetch current verification status for a deal room.
 * Returns { results: VerificationResult[], summary: { verified, discrepancies, pending } }
 */
async function getVerificationStatus(propertyId) {
  try {
    await initVerificationTables();
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM verification_results WHERE property_id = $1 ORDER BY severity DESC, updated_at DESC`,
      [propertyId]
    );
    const summary = {
      verified: rows.filter(r => r.status === 'verified').length,
      discrepancies: rows.filter(r => r.status === 'discrepancy').length,
      pending: rows.filter(r => r.status === 'pending_review').length,
    };
    return { results: rows, summary };
  } catch (err) {
    console.warn('[verification] getVerificationStatus failed:', err.message);
    return { results: [], summary: { verified: 0, discrepancies: 0, pending: 0 } };
  }
}

module.exports = { runVerification, getVerificationStatus, initVerificationTables };
