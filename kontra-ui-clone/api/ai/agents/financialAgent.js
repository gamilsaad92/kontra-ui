/**
 * Financial Agent — analyzes borrower financial statements for multifamily/CRE.
 * Calculates DSCR, occupancy trends, NOI variance, and flags guide-rule exceptions.
 * Follows Freddie Mac Multifamily Seller/Servicer Guide Chapter 67 style.
 *
 * @param {object} input
 * @param {object} input.current            - current period financials
 * @param {number} input.current.gpr        - gross potential rent
 * @param {number} input.current.egi        - effective gross income
 * @param {number} input.current.vacancy    - vacancy rate (0-1)
 * @param {number} input.current.expenses   - total operating expenses
 * @param {number} input.current.noi        - net operating income
 * @param {number} input.current.occupancy  - occupancy rate (0-1)
 * @param {object} [input.prior]            - prior period (same shape as current)
 * @param {object} [input.underwritten]     - underwritten values (same shape)
 * @param {number} input.annual_debt_service - annual debt service
 * @param {number} [input.dscr_covenant]    - minimum DSCR from loan docs (default 1.20)
 * @param {number} [input.occupancy_covenant] - minimum occupancy (default 0.85)
 * @param {string[]} [input.variance_explanations] - borrower-provided explanations
 * @param {object}   [input.context]        - { loan_id, property_name, period }
 * @returns {object} AiReviewOutput
 */
const runFinancialAgent = (input = {}) => {
  const cur = input.current || {};
  const prior = input.prior || {};
  const uwn = input.underwritten || {};
  const ads = Number(input.annual_debt_service) || 0;
  const dscrCovenant = Number(input.dscr_covenant) || 1.20;
  const occupancyCovenant = Number(input.occupancy_covenant) || 0.85;
  const varExplanations = input.variance_explanations || [];
  const context = input.context || {};

  const reasons = [];
  const evidence = [];
  const proposedUpdates = {};

  const pct = (v, decimals = 1) =>
    v !== undefined && !Number.isNaN(v) ? `${(v * 100).toFixed(decimals)}%` : 'N/A';
  const currency = (v) =>
    v !== undefined && !Number.isNaN(v) ? `$${Number(v).toLocaleString()}` : 'N/A';
  const round2 = (v) => Math.round(v * 100) / 100;

  // ── 1. DSCR calculation ──────────────────────────────────────────────────
  const currentNoi = Number(cur.noi) || 0;
  const dscr = ads > 0 ? round2(currentNoi / ads) : null;
  const priorNoi = Number(prior.noi) || 0;
  const priorDscr = ads > 0 && priorNoi > 0 ? round2(priorNoi / ads) : null;
  const uwnDscr = ads > 0 && uwn.noi ? round2(Number(uwn.noi) / ads) : null;

  proposedUpdates.dscr = dscr;
  proposedUpdates.prior_dscr = priorDscr;
  proposedUpdates.underwritten_dscr = uwnDscr;

  if (dscr !== null && dscr < dscrCovenant) {
    const severity = dscr < dscrCovenant * 0.9 ? 'high' : 'medium';
    reasons.push({
      code: 'dscr_below_covenant',
      message: `Current DSCR of ${dscr}x is below the loan covenant of ${dscrCovenant}x.`,
      severity,
    });
  }

  if (dscr !== null && priorDscr !== null) {
    const dscrDelta = round2(dscr - priorDscr);
    const dscrChangePct = priorDscr > 0 ? round2((dscrDelta / priorDscr) * 100) : 0;
    proposedUpdates.dscr_change = dscrDelta;
    proposedUpdates.dscr_change_pct = dscrChangePct;

    if (dscrChangePct <= -10) {
      reasons.push({
        code: 'dscr_deteriorating',
        message: `DSCR declined ${Math.abs(dscrChangePct).toFixed(1)}% from ${priorDscr}x to ${dscr}x vs. prior period.`,
        severity: dscrChangePct <= -20 ? 'high' : 'medium',
      });
    }
  }

  // ── 2. Occupancy analysis ────────────────────────────────────────────────
  const currentOcc = Number(cur.occupancy);
  const priorOcc = Number(prior.occupancy);
  const uwnOcc = Number(uwn.occupancy);

  if (!Number.isNaN(currentOcc)) {
    proposedUpdates.occupancy = currentOcc;
    if (currentOcc < occupancyCovenant) {
      reasons.push({
        code: 'occupancy_below_covenant',
        message: `Occupancy of ${pct(currentOcc)} is below the required ${pct(occupancyCovenant)} threshold.`,
        severity: currentOcc < occupancyCovenant - 0.05 ? 'high' : 'medium',
      });
    }

    if (!Number.isNaN(priorOcc)) {
      const occDelta = round2((currentOcc - priorOcc) * 100);
      proposedUpdates.occupancy_change_pp = occDelta;
      if (occDelta <= -5) {
        reasons.push({
          code: 'occupancy_declining',
          message: `Occupancy dropped ${Math.abs(occDelta).toFixed(1)} percentage points from ${pct(priorOcc)} to ${pct(currentOcc)}.`,
          severity: occDelta <= -10 ? 'high' : 'medium',
        });
      }
    }
  }

  // ── 3. NOI variance vs underwritten ─────────────────────────────────────
  const uwnNoi = Number(uwn.noi);
  if (!Number.isNaN(uwnNoi) && uwnNoi > 0 && currentNoi > 0) {
    const noiVariancePct = round2(((currentNoi - uwnNoi) / uwnNoi) * 100);
    proposedUpdates.noi_variance_pct = noiVariancePct;
    if (noiVariancePct <= -10) {
      reasons.push({
        code: 'noi_below_underwritten',
        message: `NOI of ${currency(currentNoi)} is ${Math.abs(noiVariancePct).toFixed(1)}% below underwritten ${currency(uwnNoi)}.`,
        severity: noiVariancePct <= -20 ? 'high' : 'medium',
      });
    }
  }

  // ── 4. Expense ratio check ───────────────────────────────────────────────
  const curExpenses = Number(cur.expenses);
  const curEgi = Number(cur.egi);
  if (!Number.isNaN(curExpenses) && !Number.isNaN(curEgi) && curEgi > 0) {
    const expenseRatio = round2(curExpenses / curEgi);
    proposedUpdates.expense_ratio = expenseRatio;
    const priorExpenses = Number(prior.expenses);
    const priorEgi = Number(prior.egi);
    if (!Number.isNaN(priorExpenses) && !Number.isNaN(priorEgi) && priorEgi > 0) {
      const priorExpenseRatio = round2(priorExpenses / priorEgi);
      const ratioDelta = round2((expenseRatio - priorExpenseRatio) * 100);
      proposedUpdates.expense_ratio_change_pp = ratioDelta;
      if (ratioDelta >= 5) {
        reasons.push({
          code: 'expense_ratio_spike',
          message: `Expense ratio increased ${ratioDelta.toFixed(1)} pp to ${pct(expenseRatio)} from prior period.`,
          severity: ratioDelta >= 10 ? 'high' : 'medium',
        });
      }
    }
  }

  // ── 5. Variance explanation check ───────────────────────────────────────
  if (reasons.length > 0 && varExplanations.length === 0) {
    reasons.push({
      code: 'missing_variance_explanations',
      message: 'No borrower explanations provided for financial variances.',
      severity: 'medium',
    });
  }

  // ── 6. Build variance matrix ─────────────────────────────────────────────
  const varianceMatrix = [];
  const metrics = [
    { key: 'noi', label: 'NOI' },
    { key: 'egi', label: 'EGI' },
    { key: 'expenses', label: 'Operating Expenses' },
    { key: 'occupancy', label: 'Occupancy' },
  ];
  metrics.forEach(({ key, label }) => {
    const curVal = Number(cur[key]);
    const priorVal = Number(prior[key]);
    const uwnVal = Number(uwn[key]);
    if (!Number.isNaN(curVal)) {
      varianceMatrix.push({
        metric: label,
        current: curVal,
        prior: Number.isNaN(priorVal) ? null : priorVal,
        underwritten: Number.isNaN(uwnVal) ? null : uwnVal,
        vs_prior_pct: (!Number.isNaN(priorVal) && priorVal !== 0)
          ? round2(((curVal - priorVal) / Math.abs(priorVal)) * 100) : null,
        vs_uwn_pct: (!Number.isNaN(uwnVal) && uwnVal !== 0)
          ? round2(((curVal - uwnVal) / Math.abs(uwnVal)) * 100) : null,
      });
    }
  });
  proposedUpdates.variance_matrix = varianceMatrix;

  // ── 7. Status, confidence, recommended actions ───────────────────────────
  const hasHigh = reasons.some((r) => r.severity === 'high');
  const hasMed = reasons.some((r) => r.severity === 'medium');
  const status = hasHigh ? 'fail' : hasMed ? 'needs_review' : 'pass';
  const confidence = status === 'pass' ? 0.86 : status === 'fail' ? 0.33 : 0.60;

  const recommendedActions = [];

  if (dscr !== null && dscr < dscrCovenant) {
    recommendedActions.push({
      action_type: 'request_borrower_explanation',
      label: 'Request borrower DSCR explanation and recovery plan',
      payload: { metric: 'DSCR', current: dscr, covenant: dscrCovenant },
      requires_approval: true,
    });
  }

  if (reasons.some((r) => r.code === 'occupancy_below_covenant' || r.code === 'occupancy_declining')) {
    recommendedActions.push({
      action_type: 'request_rent_roll',
      label: 'Request current rent roll with lease expiration schedule',
      payload: { period: context.period },
      requires_approval: true,
    });
  }

  if (hasHigh) {
    recommendedActions.push({
      action_type: 'flag_watchlist',
      label: 'Flag loan for watchlist review',
      payload: { loan_id: context.loan_id, reason: 'Financial covenant breach' },
      requires_approval: true,
    });
  }

  recommendedActions.push({
    action_type: 'generate_financial_comment',
    label: 'Generate Freddie Mac servicer comment',
    payload: { dscr, occupancy: currentOcc, period: context.period },
    requires_approval: true,
  });

  // ── 8. Title & summary ───────────────────────────────────────────────────
  const propName = context.property_name || 'Property';
  const period = context.period || 'reporting period';

  let title;
  if (status === 'pass') {
    title = `${propName} — ${period}: financials within covenant thresholds (DSCR ${dscr}x)`;
  } else if (hasHigh) {
    const primary = reasons.find((r) => r.severity === 'high');
    title = `${propName} — ${period}: covenant breach — ${primary.message}`;
  } else {
    title = `${propName} — ${period}: financial variances require servicer review`;
  }

  const summaryParts = [];
  if (dscr !== null) summaryParts.push(`DSCR: ${dscr}x (covenant: ${dscrCovenant}x)`);
  if (!Number.isNaN(currentOcc)) summaryParts.push(`Occupancy: ${pct(currentOcc)} (covenant: ${pct(occupancyCovenant)})`);
  if (!Number.isNaN(uwnNoi) && currentNoi) summaryParts.push(`NOI: ${currency(currentNoi)} vs. UW ${currency(uwnNoi)}`);

  const summary = summaryParts.length
    ? `${summaryParts.join(' | ')}. ${status === 'pass' ? 'No exceptions identified.' : `${reasons.length} exception(s) require review.`}`
    : status === 'pass'
      ? 'Financials reviewed — no covenant exceptions identified.'
      : `${reasons.length} financial exception(s) identified requiring servicer action.`;

  return {
    status,
    confidence,
    title,
    summary,
    reasons,
    evidence,
    recommended_actions: recommendedActions,
    proposed_updates: proposedUpdates,
  };
};

module.exports = { runFinancialAgent };
