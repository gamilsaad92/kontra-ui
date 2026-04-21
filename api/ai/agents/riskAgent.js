/**
 * Risk Agent — aggregates signals from financial, inspection, draw, and delinquency
 * events to produce a portfolio risk score, watchlist recommendation, and escalation logic.
 *
 * Follows Freddie Mac Multifamily servicing risk classification conventions.
 * Score of 0–100 (lower = better). Watchlist at >= 60. Special servicing at >= 80.
 *
 * @param {object} input
 * @param {object} [input.financial]   - { dscr, occupancy, noi_variance_pct, dscr_change_pct, expense_ratio }
 * @param {object} [input.inspection]  - { open_life_safety, deferred_maintenance_count, pr90_items }
 * @param {object} [input.draw]        - { missing_lien_waivers, sov_variance_pct, inspector_cert }
 * @param {object} [input.delinquency] - { days_past_due, missed_payments_12m, current_balance }
 * @param {object} [input.escrow]      - { shortage_amount, months_to_zero }
 * @param {object} [input.context]     - { loan_id, property_name, loan_amount, maturity_date }
 * @returns {object} AiReviewOutput
 */
const runRiskAgent = (input = {}) => {
  const fin = input.financial || {};
  const insp = input.inspection || {};
  const draw = input.draw || {};
  const delinq = input.delinquency || {};
  const escrow = input.escrow || {};
  const context = input.context || {};

  const reasons = [];
  const evidence = [];
  const proposedUpdates = {};

  let score = 0;
  const scoringFactors = [];

  const addFactor = (category, weight, description, severity) => {
    score += weight;
    scoringFactors.push({ category, weight, description, severity });
    reasons.push({ code: `risk_${category.toLowerCase().replace(/ /g, '_')}`, message: description, severity });
  };

  // ── 1. Financial risk factors ─────────────────────────────────────────────
  const dscr = Number(fin.dscr);
  if (!Number.isNaN(dscr)) {
    if (dscr < 1.00) addFactor('Financial', 25, `DSCR critically low at ${dscr}x (below 1.00 — loan may not self-service).`, 'high');
    else if (dscr < 1.10) addFactor('Financial', 18, `DSCR at ${dscr}x is below typical 1.10 servicing threshold.`, 'high');
    else if (dscr < 1.20) addFactor('Financial', 10, `DSCR at ${dscr}x is below the 1.20 covenant level.`, 'medium');
    else if (dscr < 1.25) addFactor('Financial', 5, `DSCR at ${dscr}x is approaching covenant minimum.`, 'low');
  }

  const dscrChange = Number(fin.dscr_change_pct);
  if (!Number.isNaN(dscrChange) && dscrChange <= -15) {
    addFactor('Financial Trend', dscrChange <= -25 ? 15 : 8,
      `DSCR deteriorated ${Math.abs(dscrChange).toFixed(1)}% year-over-year — negative trend.`,
      dscrChange <= -25 ? 'high' : 'medium');
  }

  const occupancy = Number(fin.occupancy);
  if (!Number.isNaN(occupancy)) {
    if (occupancy < 0.75) addFactor('Occupancy', 20, `Occupancy critically low at ${(occupancy * 100).toFixed(1)}%.`, 'high');
    else if (occupancy < 0.85) addFactor('Occupancy', 12, `Occupancy at ${(occupancy * 100).toFixed(1)}% — below required 85% threshold.`, 'medium');
    else if (occupancy < 0.90) addFactor('Occupancy', 5, `Occupancy at ${(occupancy * 100).toFixed(1)}% — approaching minimum threshold.`, 'low');
  }

  const noiVariance = Number(fin.noi_variance_pct);
  if (!Number.isNaN(noiVariance) && noiVariance <= -15) {
    addFactor('NOI', noiVariance <= -25 ? 12 : 7,
      `NOI ${Math.abs(noiVariance).toFixed(1)}% below underwritten levels.`,
      noiVariance <= -25 ? 'high' : 'medium');
  }

  // ── 2. Inspection risk factors ────────────────────────────────────────────
  const lifeS = Number(insp.open_life_safety);
  if (!Number.isNaN(lifeS) && lifeS > 0) {
    addFactor('Life Safety', lifeS >= 3 ? 20 : 12,
      `${lifeS} open life-safety deficiency item(s) flagged — requires immediate resolution.`,
      'high');
  }

  const deferMaint = Number(insp.deferred_maintenance_count);
  if (!Number.isNaN(deferMaint) && deferMaint > 0) {
    addFactor('Deferred Maintenance', deferMaint >= 5 ? 10 : 5,
      `${deferMaint} deferred maintenance item(s) identified.`,
      deferMaint >= 5 ? 'medium' : 'low');
  }

  const pr90 = Number(insp.pr90_items);
  if (!Number.isNaN(pr90) && pr90 > 0) {
    addFactor('Physical Condition', 8,
      `${pr90} PR-90 physical condition item(s) noted — may impact value.`, 'medium');
  }

  // ── 3. Draw risk factors ──────────────────────────────────────────────────
  const missingLienWaivers = Number(draw.missing_lien_waivers);
  if (!Number.isNaN(missingLienWaivers) && missingLienWaivers > 0) {
    addFactor('Draw Compliance', 6,
      `${missingLienWaivers} missing lien waiver(s) — disbursement at risk.`, 'medium');
  }

  if (draw.inspector_cert === false) {
    addFactor('Draw Compliance', 8,
      'Inspector certification not received — draw disbursement on hold.', 'high');
  }

  const sovVariance = Number(draw.sov_variance_pct);
  if (!Number.isNaN(sovVariance) && sovVariance > 5) {
    addFactor('SOV Variance', 5,
      `SOV vs. inspector variance of ${sovVariance.toFixed(1)}% exceeds acceptable threshold.`, 'medium');
  }

  // ── 4. Delinquency risk factors ───────────────────────────────────────────
  const dpd = Number(delinq.days_past_due);
  if (!Number.isNaN(dpd) && dpd > 0) {
    if (dpd >= 90) addFactor('Delinquency', 30, `Loan ${dpd} days past due — potential default.`, 'high');
    else if (dpd >= 30) addFactor('Delinquency', 18, `Loan ${dpd} days past due — collection action may be required.`, 'high');
    else addFactor('Delinquency', 8, `Loan ${dpd} days past due — monitor closely.`, 'medium');
  }

  const missedPayments = Number(delinq.missed_payments_12m);
  if (!Number.isNaN(missedPayments) && missedPayments >= 2) {
    addFactor('Payment History', missedPayments >= 3 ? 15 : 8,
      `${missedPayments} missed payment(s) in the past 12 months.`,
      missedPayments >= 3 ? 'high' : 'medium');
  }

  // ── 5. Escrow risk factors ────────────────────────────────────────────────
  const escrowShortage = Number(escrow.shortage_amount);
  if (!Number.isNaN(escrowShortage) && escrowShortage > 0) {
    addFactor('Escrow', escrowShortage > 50000 ? 10 : 5,
      `Escrow shortage of $${escrowShortage.toLocaleString()} projected.`,
      escrowShortage > 50000 ? 'medium' : 'low');
  }

  const monthsToZero = Number(escrow.months_to_zero);
  if (!Number.isNaN(monthsToZero) && monthsToZero <= 3) {
    addFactor('Escrow', 12,
      `Escrow balance will reach zero in ${monthsToZero} month(s) — cure required.`, 'high');
  }

  // ── 6. Cap score and classify ─────────────────────────────────────────────
  const finalScore = Math.min(100, score);
  proposedUpdates.risk_score = finalScore;
  proposedUpdates.scoring_factors = scoringFactors;

  let classification;
  let recommendation;
  let watchlist;

  if (finalScore >= 80) {
    classification = 'special_servicing';
    recommendation = 'Refer to special servicing team immediately. Initiate formal default prevention protocol.';
    watchlist = true;
  } else if (finalScore >= 60) {
    classification = 'watchlist';
    recommendation = 'Add to watchlist. Increase reporting frequency. Schedule borrower call within 10 business days.';
    watchlist = true;
  } else if (finalScore >= 35) {
    classification = 'monitor';
    recommendation = 'Elevated risk — monitor closely. Review at next scheduled inspection. Flag for Q3 portfolio review.';
    watchlist = false;
  } else {
    classification = 'performing';
    recommendation = 'Loan performing within acceptable parameters. Maintain standard servicing.';
    watchlist = false;
  }

  proposedUpdates.classification = classification;
  proposedUpdates.recommendation = recommendation;
  proposedUpdates.watchlist = watchlist;

  // ── 7. Confidence score ───────────────────────────────────────────────────
  const dataPointCount = [fin.dscr, fin.occupancy, insp.open_life_safety, delinq.days_past_due]
    .filter((v) => v !== undefined && v !== null).length;
  const confidence = Math.min(0.95, 0.55 + dataPointCount * 0.10);

  const status = finalScore >= 60 ? 'fail' : finalScore >= 35 ? 'needs_review' : 'pass';

  // ── 8. Recommended actions ────────────────────────────────────────────────
  const recommendedActions = [];

  if (watchlist) {
    recommendedActions.push({
      action_type: 'add_to_watchlist',
      label: 'Add loan to servicer watchlist',
      payload: { loan_id: context.loan_id, risk_score: finalScore, classification },
      requires_approval: true,
    });
  }

  if (finalScore >= 80) {
    recommendedActions.push({
      action_type: 'refer_special_servicing',
      label: 'Refer to special servicing team',
      payload: { loan_id: context.loan_id, risk_score: finalScore },
      requires_approval: true,
    });
  }

  if (lifeS > 0) {
    recommendedActions.push({
      action_type: 'issue_life_safety_notice',
      label: 'Issue life-safety cure notice to borrower',
      payload: { loan_id: context.loan_id, open_items: lifeS },
      requires_approval: true,
    });
  }

  recommendedActions.push({
    action_type: 'generate_risk_memo',
    label: 'Generate risk assessment memo for committee review',
    payload: { loan_id: context.loan_id, classification, risk_score: finalScore },
    requires_approval: true,
  });

  // ── 9. Title & summary ────────────────────────────────────────────────────
  const prop = context.property_name || 'Property';
  const title = `${prop} — Risk Score: ${finalScore}/100 — ${classification.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`;
  const summary = `Composite risk score of ${finalScore}/100 based on ${scoringFactors.length} factor(s). ` +
    `Classification: ${classification.replace(/_/g, ' ')}. ${recommendation}`;

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

module.exports = { runRiskAgent };
