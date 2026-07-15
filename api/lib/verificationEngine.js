/**
 * verificationEngine.js — Cross-document consistency verification (stateless)
 *
 * All verification results are computed on-demand from Supabase's deal_analyses
 * and deal_rooms tables. No PostgreSQL pool / separate tables needed — this
 * removes the hard dependency on DATABASE_URL being present on Render.
 *
 * CRE Acquisition checks:
 *   - Rent roll NOI vs operating statement NOI (>5% threshold)
 *   - Rent roll occupancy vs operating statement vacancy rate
 *   - Inspection + insurance physical due diligence completeness
 *
 * Business Acquisition checks:
 *   - Financials TTM revenue vs seller-stated revenue (>10% threshold)
 *   - Financials EBITDA vs seller-stated EBITDA (>20% threshold)
 *   - Financials EBITDA vs IRS tax-return net income (>40% premium)
 *   - Tax returns revenue vs financials TTM revenue (>10% threshold)
 *   - LOI stated price vs deal_amount (>5% threshold)
 *   - EBITDA sanity (negative = critical flag)
 *
 * Results: 'verified' | 'discrepancy' | 'pending_review'
 */

const { supabase } = require('../db');

// ── Robust numeric helpers ───────────────────────────────────────────────────

function parseNumber(val) {
  if (val == null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const s = String(val).trim();
  if (!s || s === '—' || s === 'N/A' || s === 'n/a') return null;
  const parens = /^\(([^)]+)\)$/.test(s);
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

// camelCase → snake_case and snake_case → camelCase helpers for metrics key lookup
function toSnake(k) {
  return k.replace(/([A-Z])/g, '_$1').toLowerCase();
}
function toCamel(k) {
  return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// ── Structured extraction ─────────────────────────────────────────────────────

function extractFields(section, raw) {
  if (!raw || typeof raw !== 'object') return { _unreadable: false };

  const isUnreadable =
    raw.pending === true ||
    (typeof raw.confidence === 'number' && raw.confidence === 0) ||
    /scanned|encrypted|image.only|no.text/i.test(raw.summary || '');

  if (isUnreadable) return { _unreadable: true };

  const m = (raw.metrics && typeof raw.metrics === 'object') ? raw.metrics : {};
  const r = (...keys) => {
    for (const k of keys) {
      const v = raw[k] ?? m[k] ?? m[toSnake(k)] ?? m[toCamel(k)];
      if (v != null) return v;
    }
    return undefined;
  };

  try {
    switch (section) {
      case 'rent_roll': {
        const monthly_rent = parseNumber(r('totalMonthlyRent', 'monthlyRent', 'grossScheduledRent', 'total_monthly_rent', 'monthly_rent'));
        const occ = parsePct(r('occupancyRate', 'occupancy', 'occupancy_rate'));
        const noi = parseNumber(r('netOperatingIncome', 'noi', 'stabilizedNoi', 'projectedNoi', 'net_operating_income'));
        const egi_annual = monthly_rent != null ? monthly_rent * 12 : null;
        return { monthly_rent, occupancy_rate: occ, noi, egi_annual, _unreadable: false };
      }

      case 'financials': {
        const noi = parseNumber(r('netOperatingIncome', 'noi', 'operatingIncome', 'net_operating_income'));
        const egi = parseNumber(r('effectiveGrossIncome', 'effectiveGrossRevenue', 'grossRevenue', 'gross_revenue'));
        const revenue = parseNumber(r('revenue', 'annualRevenue', 'totalRevenue', 'trailingTwelveMonthsRevenue', 'annual_revenue', 'total_revenue', 'ttm_revenue'));
        const ttm_revenue = parseNumber(r('trailingTwelveMonths', 'ttmRevenue', 'ttm_revenue', 'trailing_twelve_months_revenue')) ?? revenue;
        const ebitda = parseNumber(r('ebitda', 'adjustedEbitda', 'adjusted_ebitda', 'operatingCashFlow', 'operating_cash_flow', 'adjusted_ebitda_ttm'));
        const op_expenses = parseNumber(r('totalOperatingExpenses', 'operatingExpenses', 'total_operating_expenses', 'operating_expenses'));
        return { noi, egi, revenue, ttm_revenue, ebitda, op_expenses, _unreadable: false };
      }

      case 'inspection': {
        const overallCondition = (r('overallCondition', 'overall_condition', 'condition') || '').toLowerCase();
        const overall_ok = !['poor', 'critical', 'failed', 'unsafe'].includes(overallCondition);
        const critical_count = parseNumber(r('totalCriticalCount', 'criticalCount', 'criticalItems', 'critical_count') ?? 0) ?? 0;
        return { overall_ok, critical_count, condition: overallCondition, _unreadable: false };
      }

      case 'insurance': {
        const coverage_amount = parseNumber(r('coverageAmount', 'totalCoverage', 'coverage_amount', 'total_coverage'));
        const expiry_date = r('expirationDate', 'expiryDate', 'expiration_date', 'expiry_date') || null;
        return { coverage_amount, expiry_date, _unreadable: false };
      }

      case 'tax_returns': {
        const revenue = parseNumber(r('annualRevenue', 'grossRevenue', 'totalRevenue', 'grossIncome', 'annual_revenue', 'gross_revenue', 'total_revenue', 'gross_income', 'revenue'));
        const net_income = parseNumber(r('netIncome', 'taxableIncome', 'adjustedGrossIncome', 'net_income', 'taxable_income', 'adjusted_gross_income'));
        return { revenue, net_income, _unreadable: false };
      }

      case 'loi':
      case 'purchase_agreement': {
        const stated_price = parseNumber(r('purchasePrice', 'offerPrice', 'price', 'dealPrice', 'purchase_price', 'offer_price', 'deal_price', 'asking_price', 'transaction_value'));
        return { stated_price, _unreadable: false };
      }

      default:
        return { _unreadable: false };
    }
  } catch {
    return { _unreadable: false };
  }
}

// ── CRE Acquisition checks ─────────────────────────────────────────────────────

function runCreChecks(propertyId, extractionsBySection) {
  const rr   = extractionsBySection.rent_roll  || {};
  const fs   = extractionsBySection.financials || {};
  const insp = extractionsBySection.inspection || {};
  const checks = [];

  // Check 1: Rent roll NOI vs operating statement NOI
  const rrNoi = rr.noi ?? null;
  const fsNoi = fs.noi ?? null;

  if (rr._unreadable || fs._unreadable) {
    const unreadableSec = rr._unreadable ? 'rent roll' : 'operating statement';
    checks.push({
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
    const noNoi = [];
    if (extractionsBySection._hasRentRoll && rrNoi == null) noNoi.push('rent roll (no NOI field found)');
    if (extractionsBySection._hasFinancials && fsNoi == null) noNoi.push('operating statement (no NOI field found)');
    const missing = !extractionsBySection._hasRentRoll ? 'rent roll' : !extractionsBySection._hasFinancials ? 'operating statement' : null;
    checks.push({
      check_type: 'noi_cross_check',
      doc_section_a: 'rent_roll', doc_section_b: 'financials',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: rrNoi, value_b: fsNoi, delta_pct: null,
      description: missing
        ? `Waiting for ${missing} upload to run NOI consistency check.`
        : `NOI could not be extracted from ${noNoi.join(' and ')}. Ensure documents include a net operating income line item.`,
    });
  }

  // Check 2: Occupancy rate consistency
  const rrOcc = rr.occupancy_rate ?? null;
  const fsVacancy = fs.vacancy_rate != null ? fs.vacancy_rate : null;
  const fsOcc = fsVacancy != null ? 1 - fsVacancy : null;

  if (rrOcc != null && fsOcc != null) {
    const delta = Math.abs(rrOcc - fsOcc) * 100;
    const isDiscrepancy = delta > 5;
    checks.push({
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

  // Check 3: Physical due diligence completeness
  const hasInspection = !!extractionsBySection._hasInspection;
  const hasInsurance  = !!extractionsBySection._hasInsurance;

  if (hasInspection && hasInsurance) {
    const overall_ok   = insp.overall_ok !== false;
    const criticalCount = insp.critical_count ?? 0;
    checks.push({
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
      !hasInsurance  && 'insurance certificate',
    ].filter(Boolean).join(' and ');
    checks.push({
      check_type: 'physical_due_diligence_complete',
      doc_section_a: 'inspection', doc_section_b: 'insurance',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: null, value_b: null, delta_pct: null,
      description: `Waiting for ${missingDocs} to complete physical due diligence verification.`,
    });
  }

  return checks;
}

// ── Business Acquisition checks ───────────────────────────────────────────────

function runBaChecks(propertyId, extractionsBySection, dealRoom) {
  const taxData = extractionsBySection.tax_returns || {};
  const finData = extractionsBySection.financials  || {};
  const loiData = extractionsBySection.loi || extractionsBySection.purchase_agreement || {};
  const checks  = [];

  const dealAmount   = parseNumber(dealRoom?.deal_amount)    ?? null;
  const statedRevenue = parseNumber(dealRoom?.stated_revenue) ?? null;
  const statedEbitda  = parseNumber(dealRoom?.stated_ebitda)  ?? null;

  // Check 1: Financials TTM revenue vs seller-stated revenue
  if (finData.ttm_revenue != null && statedRevenue != null) {
    const delta = pctDelta(finData.ttm_revenue, statedRevenue);
    const isDiscrepancy = delta != null && delta > 10;
    const isCritical    = delta != null && delta > 25;
    checks.push({
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

  // Check 2: Financials EBITDA vs seller-stated EBITDA
  if (finData.ebitda != null && statedEbitda != null) {
    if (finData.ebitda <= 0) {
      checks.push({
        check_type: 'ebitda_vs_stated_ebitda',
        doc_section_a: 'financials', doc_section_b: null,
        status: 'discrepancy', badge_label: 'Discrepancy Found', severity: 'critical',
        value_a: finData.ebitda, value_b: statedEbitda, delta_pct: null,
        description: `Uploaded financials show negative or zero EBITDA (${formatCurrency(finData.ebitda)}) while seller states ${formatCurrency(statedEbitda)}. A business with no positive cash flow cannot support the stated valuation — requires seller explanation.`,
      });
    } else {
      const delta = pctDelta(finData.ebitda, statedEbitda);
      const isDiscrepancy = delta != null && delta > 20;
      const isCritical    = delta != null && delta > 40;
      checks.push({
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

  // Check 3: Financials EBITDA vs IRS tax-return net income
  const taxNetIncome = taxData.net_income ?? null;
  if (finData.ebitda != null && taxNetIncome != null) {
    const ebitdaPremiumPct = taxNetIncome !== 0
      ? ((finData.ebitda - taxNetIncome) / Math.abs(taxNetIncome)) * 100
      : null;
    const isAggressive = ebitdaPremiumPct != null && ebitdaPremiumPct > 40;
    checks.push({
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
      check_type: 'financials_vs_tax_ebitda',
      doc_section_a: 'financials', doc_section_b: 'tax_returns',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: finData.ebitda ?? null, value_b: taxNetIncome, delta_pct: null,
      description: missing
        ? `Waiting for ${missing} to compare seller-stated EBITDA against IRS-filed income.`
        : 'EBITDA or net income could not be extracted. Ensure financials include an EBITDA line and tax returns include net/taxable income.',
    });
  }

  // Check 4: Tax returns revenue vs financials TTM revenue
  if (taxData.revenue != null && finData.ttm_revenue != null) {
    const delta = pctDelta(taxData.revenue, finData.ttm_revenue);
    const isDiscrepancy = delta != null && delta > 10;
    checks.push({
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
      check_type: 'tax_returns_vs_financials_revenue',
      doc_section_a: 'tax_returns', doc_section_b: 'financials',
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: taxData.revenue ?? null, value_b: finData.ttm_revenue ?? null, delta_pct: null,
      description: `Waiting for ${missing} to cross-check reported revenue.`,
    });
  }

  // Check 6: LOI stated price vs deal_amount
  const loiPrice = loiData.stated_price ?? null;
  if (loiPrice != null && dealAmount != null) {
    const delta = pctDelta(loiPrice, dealAmount);
    const isDiscrepancy = delta != null && delta > 5;
    checks.push({
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

  // Check 7: EBITDA sanity
  if (finData.ebitda != null) {
    const isNegative = finData.ebitda < 0;
    checks.push({
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
      check_type: 'ebitda_sanity',
      doc_section_a: 'financials', doc_section_b: null,
      status: 'pending_review', badge_label: 'Pending Review', severity: 'info',
      value_a: null, value_b: null, delta_pct: null,
      description: finData._unreadable
        ? 'Financial statement could not be read (scanned or encrypted PDF). Upload a text-based PDF to enable EBITDA check.'
        : 'EBITDA could not be extracted from the financial statement. Ensure the document includes an EBITDA or operating cash flow line.',
    });
  }

  return checks;
}

// ── Core compute (stateless, Supabase-only) ───────────────────────────────────

/**
 * Fetch deal_analyses + deal_rooms from Supabase, run pack checks, and return
 * { checks, summary, bySection } — no DB writes, safe to call at any time.
 */
async function computeVerification(propertyId, packId) {
  const SECTIONS = ['rent_roll', 'financials', 'inspection', 'insurance', 'tax_returns', 'loi', 'purchase_agreement'];

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
  const dealRoom = roomRes.data  || {};

  // Index by section — take the most recent for each section
  const latestBySection = {};
  for (const a of analyses) {
    if (!latestBySection[a.section]) latestBySection[a.section] = a.analysis;
  }

  // Extract structured fields per section + set presence flags
  const extractionsBySection = {};
  for (const sec of SECTIONS) {
    if (latestBySection[sec]) {
      extractionsBySection[sec] = extractFields(sec, latestBySection[sec]);
      // e.g. 'rent_roll' → '_hasRentRoll', 'tax_returns' → '_hasTaxReturns'
      const flag = '_has' + sec.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('');
      extractionsBySection[flag] = true;
    }
  }

  // Resolve packId if not provided
  const resolvedPackId = packId || (
    extractionsBySection._hasRentRoll ? 'cre_acquisition' : 'business_acquisition'
  );

  const rawChecks = resolvedPackId === 'business_acquisition'
    ? runBaChecks(propertyId, extractionsBySection, dealRoom)
    : runCreChecks(propertyId, extractionsBySection);

  // Stamp with property_id and pack_id
  const checks = rawChecks.map(c => ({ ...c, property_id: propertyId, pack_id: resolvedPackId }));

  const summary = {
    verified:      checks.filter(c => c.status === 'verified').length,
    discrepancies: checks.filter(c => c.status === 'discrepancy').length,
    pending:       checks.filter(c => c.status === 'pending_review').length,
  };

  // Build bySection map — escalation: discrepancy > pending_review > verified
  const bySection = {};
  for (const c of checks) {
    for (const sec of [c.doc_section_a, c.doc_section_b].filter(Boolean)) {
      if (!bySection[sec]) bySection[sec] = { status: null, checks: [] };
      const cur = bySection[sec].status;
      if (c.status === 'discrepancy') {
        bySection[sec].status = 'discrepancy';
      } else if (c.status === 'pending_review' && cur !== 'discrepancy') {
        bySection[sec].status = 'pending_review';
      } else if (c.status === 'verified' && cur == null) {
        bySection[sec].status = 'verified';
      }
      bySection[sec].checks.push({
        check_type:  c.check_type,
        status:      c.status,
        badge_label: c.badge_label,
        description: c.description,
        severity:    c.severity,
        value_a:     c.value_a,
        value_b:     c.value_b,
        delta_pct:   c.delta_pct,
      });
    }
  }
  // Sections with only null status → pending_review
  for (const sec of Object.keys(bySection)) {
    if (!bySection[sec].status) bySection[sec].status = 'pending_review';
  }

  console.log(`[verification] computed ${propertyId} (${resolvedPackId}) — ${analyses.length} docs, ${checks.length} checks`);
  return { checks, summary, bySection };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run (compute) verification for a deal room.
 * Stateless — no DB writes, just returns current computed state.
 */
async function runVerification(propertyId, packId) {
  return computeVerification(propertyId, packId);
}

/**
 * Get badge-friendly status: latest check per check_type + per-section map.
 * Returns { results, summary }.
 */
async function getVerificationStatus(propertyId) {
  try {
    const { checks, summary } = await computeVerification(propertyId);
    // Deduplicate by check_type — keep last occurrence (most specific)
    const seen = new Map();
    for (const c of checks) seen.set(c.check_type, c);
    const results = Array.from(seen.values()).sort((a, b) => {
      const order = { discrepancy: 0, pending_review: 1, verified: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });
    return { results, summary };
  } catch (err) {
    console.warn('[verification] getVerificationStatus failed:', err.message);
    return { results: [], summary: { verified: 0, discrepancies: 0, pending: 0 } };
  }
}

/**
 * Get the full verification log formatted as a single synthetic run.
 * Returns { runs: [{ run_id, pack_id, run_at, checks }], summary }.
 */
async function getFullVerificationLog(propertyId) {
  try {
    const { checks, summary } = await computeVerification(propertyId);
    if (checks.length === 0) {
      return { runs: [], summary };
    }
    const run = {
      run_id:  'current',
      pack_id: checks[0]?.pack_id || 'unknown',
      run_at:  new Date().toISOString(),
      checks,
    };
    return { runs: [run], summary };
  } catch (err) {
    console.warn('[verification] getFullVerificationLog failed:', err.message);
    return { runs: [], summary: { verified: 0, discrepancies: 0, pending: 0 } };
  }
}

/** Legacy no-op — tables no longer needed. Kept for backward compat imports. */
async function initVerificationTables() {}

module.exports = { runVerification, getVerificationStatus, getFullVerificationLog, initVerificationTables };
