/**
 * Narrative Generator — drafts Freddie Mac-style servicer comments, draw narratives,
 * financial analysis memos, inspection summaries, and escrow analyses.
 * All templates follow Freddie Mac Multifamily Seller/Servicer Guide conventions.
 */

const fmt = {
  currency: (v) => (v != null ? `$${Number(v).toLocaleString()}` : 'N/A'),
  pct: (v, decimals = 1) => (v != null ? `${Number(v).toFixed(decimals)}%` : 'N/A'),
  date: (d) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return d || 'N/A'; }
  },
};

/**
 * Generate a Freddie Mac-style inspection servicer comment.
 */
function inspectionComment({ property_name, inspection_date, inspector, status, findings = [], life_safety = [], repairs_completed = [], repairs_pending = [], deferral_amount, context = {} }) {
  const propRef = property_name || context.property_name || 'the subject property';
  const dateRef = inspection_date ? `on ${fmt.date(inspection_date)}` : 'during the reporting period';
  const inspectorRef = inspector ? `by ${inspector}` : '';

  const lifeSafetyBlock = life_safety.length > 0
    ? `\n\nLIFE-SAFETY ITEMS NOTED:\n${life_safety.map((item, i) => `  ${i + 1}. ${item}`).join('\n')}\n\nThe Borrower has been notified of the above life-safety deficiencies. Immediate cure is required per Loan Agreement Section ___. Servicer will monitor completion and update records upon receipt of inspector confirmation.`
    : '';

  const repairsBlock = repairs_completed.length > 0
    ? `\n\nCOMPLETED REPAIRS:\n${repairs_completed.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`
    : '';

  const pendingBlock = repairs_pending.length > 0
    ? `\n\nPENDING REPAIRS:\n${repairs_pending.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`
    : '';

  const findingsBlock = findings.length > 0
    ? `\n\nINSPECTION FINDINGS:\n${findings.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}`
    : '';

  const deferralBlock = deferral_amount != null
    ? `\n\nScorable deferred maintenance is estimated at ${fmt.currency(deferral_amount)}. Borrower has been advised of cure obligation timeline.`
    : '';

  const statusLine = status === 'pass'
    ? 'Property condition is satisfactory. No material deficiencies were observed.'
    : status === 'needs_review'
      ? 'Property inspection identified items requiring follow-up. Servicer action underway.'
      : 'Property inspection identified significant deficiencies. Borrower has been notified and corrective action is required.';

  return `PROPERTY INSPECTION — ${propRef.toUpperCase()}

An on-site inspection of ${propRef} was conducted ${dateRef}${inspectorRef ? ` ${inspectorRef}` : ''}. ${statusLine}${findingsBlock}${lifeSafetyBlock}${repairsBlock}${pendingBlock}${deferralBlock}

Inspection results have been logged in the servicing file. Next scheduled inspection: per loan agreement cadence.`.trim();
}

/**
 * Generate a Freddie Mac-style draw/restoration narrative.
 */
function drawComment({ property_name, draw_number, draw_amount, cumulative_disbursed, contract_amount, work_description = [], lien_waiver_status, inspector_cert, context = {} }) {
  const propRef = property_name || context.property_name || 'the subject property';
  const drawRef = draw_number ? `Draw Request No. ${draw_number}` : 'Draw Request';
  const cumulativePct = contract_amount > 0
    ? `(${((cumulative_disbursed / contract_amount) * 100).toFixed(1)}% of contract)` : '';

  const workBlock = work_description.length > 0
    ? `\n\nSCOPE OF WORK FUNDED:\n${work_description.map((item, i) => `  ${i + 1}. ${item}`).join('\n')}`
    : '';

  const waiverLine = lien_waiver_status
    ? `\n\nLien waivers: ${lien_waiver_status}.`
    : '';

  const certLine = inspector_cert
    ? `\nInspector certification status: ${inspector_cert}.`
    : '';

  return `DRAW DISBURSEMENT — ${propRef.toUpperCase()}

${drawRef} in the amount of ${fmt.currency(draw_amount)} has been reviewed and processed for disbursement at ${propRef}.

Cumulative disbursements to date: ${fmt.currency(cumulative_disbursed)} ${cumulativePct}.
Remaining contract balance: ${fmt.currency(contract_amount - cumulative_disbursed)}.${workBlock}${waiverLine}${certLine}

All required documentation has been reviewed per Servicer draw review requirements. Disbursement recommended for Lender approval.`.trim();
}

/**
 * Generate a Freddie Mac-style financial analysis servicer comment.
 */
function financialComment({ property_name, period, dscr, occupancy, noi, prior_dscr, prior_occupancy, dscr_covenant, occupancy_covenant, variance_explanations = [], watchlist = false, context = {} }) {
  const propRef = property_name || context.property_name || 'the subject property';
  const periodRef = period || 'the reporting period';

  const dscrLine = dscr != null
    ? `DSCR: ${Number(dscr).toFixed(2)}x (covenant: ${Number(dscr_covenant || 1.20).toFixed(2)}x)${prior_dscr != null ? ` vs. prior ${Number(prior_dscr).toFixed(2)}x` : ''}`
    : null;

  const occLine = occupancy != null
    ? `Occupancy: ${fmt.pct(occupancy * 100)}  (covenant: ${fmt.pct((occupancy_covenant || 0.85) * 100)})${prior_occupancy != null ? ` vs. prior ${fmt.pct(prior_occupancy * 100)}` : ''}`
    : null;

  const metricsBlock = [dscrLine, occLine, noi != null ? `NOI: ${fmt.currency(noi)}` : null]
    .filter(Boolean).map((line) => `  • ${line}`).join('\n');

  const covenantStatus = dscr != null && dscr < (dscr_covenant || 1.20)
    ? `\n\nDSCR COVENANT BREACH: Current DSCR of ${Number(dscr).toFixed(2)}x is below the required ${Number(dscr_covenant || 1.20).toFixed(2)}x. Borrower has been notified and a cure plan is required within 30 days per Loan Agreement Section ___.`
    : '';

  const explanationsBlock = variance_explanations.length > 0
    ? `\n\nBORROWER EXPLANATIONS:\n${variance_explanations.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`
    : '';

  const watchlistLine = watchlist
    ? '\n\nLoan has been recommended for Watchlist due to financial performance. Servicer will increase monitoring cadence to quarterly.'
    : '';

  return `ANNUAL/PERIODIC FINANCIAL ANALYSIS — ${propRef.toUpperCase()}

Borrower financial statements for ${periodRef} have been received and reviewed for ${propRef}.

KEY METRICS:\n${metricsBlock}${covenantStatus}${explanationsBlock}${watchlistLine}

Financial review logged in servicing file. ${watchlist ? 'Watchlist flag applied.' : 'No watchlist action required at this time.'} Next review due per loan agreement schedule.`.trim();
}

/**
 * Generate an escrow analysis memo.
 */
function escrowComment({ property_name, current_balance, monthly_deposit, projected_low, shortage_amount, scheduled_items = [], action_taken, context = {} }) {
  const propRef = property_name || context.property_name || 'the subject property';

  const scheduleBlock = scheduled_items.length > 0
    ? `\n\nSCHEDULED DISBURSEMENTS:\n${scheduled_items.map((item, i) => `  ${i + 1}. ${item.description || item.type}: ${fmt.currency(item.amount)} due ${item.due_date || 'TBD'}`).join('\n')}`
    : '';

  const shortageBlock = shortage_amount != null && shortage_amount > 0
    ? `\n\nSHORTAGE ANALYSIS: Projected escrow deficit of ${fmt.currency(shortage_amount)} identified. Borrower has been sent a shortage cure notice. Monthly deposit adjustment of ${fmt.currency(Math.ceil(shortage_amount / 12))} recommended.`
    : '';

  const actionBlock = action_taken
    ? `\n\nAction taken: ${action_taken}`
    : '';

  return `ESCROW ANALYSIS — ${propRef.toUpperCase()}

Escrow account review completed for ${propRef}.

Current escrow balance: ${fmt.currency(current_balance)}
Monthly borrower deposit: ${fmt.currency(monthly_deposit)}
Projected low balance (12-month): ${fmt.currency(projected_low)}${scheduleBlock}${shortageBlock}${actionBlock}

Escrow analysis recorded in servicing file. Servicer will monitor compliance with any required deposit adjustments.`.trim();
}

/**
 * Generate a payment exception comment.
 */
function paymentComment({ property_name, payment_amount, expected_amount, received_date, due_date, exception_type, remitter, allocation, context = {} }) {
  const propRef = property_name || context.property_name || 'the subject property';
  const exceptionRef = exception_type === 'short_pay' ? 'Short Payment'
    : exception_type === 'late_pay' ? 'Late Payment'
    : exception_type === 'remitter_mismatch' ? 'Remitter Mismatch'
    : 'Payment Exception';

  const allocationBlock = allocation && Object.keys(allocation).length > 0
    ? `\n\nProposed allocation:\n${Object.entries(allocation).map(([k, v]) => `  • ${k}: ${fmt.currency(v)}`).join('\n')}`
    : '';

  return `PAYMENT ${exceptionRef.toUpperCase()} — ${propRef.toUpperCase()}

Payment received from ${remitter || 'Borrower'} for ${propRef} on ${fmt.date(received_date)}.

Amount received: ${fmt.currency(payment_amount)}
Amount expected: ${fmt.currency(expected_amount)}
Due date: ${fmt.date(due_date)}
Exception type: ${exceptionRef}${allocationBlock}

Payment exception routed for servicer review. Borrower communication initiated per servicing protocol.`.trim();
}

module.exports = {
  inspectionComment,
  drawComment,
  financialComment,
  escrowComment,
  paymentComment,
};
