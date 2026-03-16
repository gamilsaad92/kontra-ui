/**
 * Escrow Agent — analyzes escrow accounts for CRE loans.
 * Projects balances, detects shortages, validates disbursements,
 * and recommends cure actions. Follows Freddie Mac guide standards.
 *
 * @param {object}   input
 * @param {number}   input.current_balance    - current escrow balance
 * @param {object[]} input.scheduled_items    - upcoming obligations [{type, amount, due_date, description}]
 * @param {object[]} input.transactions       - recent transactions    [{date, type, amount, description}]
 * @param {number}   [input.monthly_deposit]  - borrower's monthly escrow deposit
 * @param {number}   [input.cushion_months]   - required cushion in months (default 2)
 * @param {object}   [input.context]          - { loan_id, property_name, period }
 * @returns {object} AiReviewOutput
 */
const runEscrowAgent = (input = {}) => {
  const balance = Number(input.current_balance) || 0;
  const items = input.scheduled_items || [];
  const transactions = input.transactions || [];
  const monthlyDeposit = Number(input.monthly_deposit) || 0;
  const cushionMonths = Number(input.cushion_months) || 2;
  const context = input.context || {};

  const reasons = [];
  const evidence = [];
  const proposedUpdates = {};

  const currency = (v) => `$${Number(v).toLocaleString()}`;

  // ── 1. Sort and project upcoming obligations ──────────────────────────────
  const sortedItems = [...items].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const totalObligations = sortedItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  proposedUpdates.total_scheduled_obligations = totalObligations;
  proposedUpdates.current_balance = balance;

  // 12-month projection
  const projectionMonths = 12;
  const projection = [];
  let runningBalance = balance;

  for (let m = 0; m < projectionMonths; m++) {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() + m);
    const monthStr = monthDate.toISOString().slice(0, 7);

    const monthObligations = sortedItems
      .filter((item) => {
        if (!item.due_date) return false;
        const d = new Date(item.due_date);
        return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
      })
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    runningBalance += monthlyDeposit - monthObligations;
    projection.push({
      month: monthStr,
      deposits: monthlyDeposit,
      disbursements: monthObligations,
      ending_balance: Math.round(runningBalance),
    });
  }

  proposedUpdates.projection = projection;

  // ── 2. Shortage detection ────────────────────────────────────────────────
  const shortageMonths = projection.filter((p) => p.ending_balance < 0);
  const lowestBalance = Math.min(...projection.map((p) => p.ending_balance), balance);
  proposedUpdates.projected_low_balance = lowestBalance;

  if (lowestBalance < 0) {
    reasons.push({
      code: 'escrow_shortage_projected',
      message: `Escrow projected to reach ${currency(Math.abs(lowestBalance))} deficit in ${shortageMonths[0]?.month || 'upcoming months'}.`,
      severity: Math.abs(lowestBalance) > totalObligations * 0.25 ? 'high' : 'medium',
    });
  }

  // ── 3. Cushion check ─────────────────────────────────────────────────────
  const requiredCushion = monthlyDeposit * cushionMonths;
  proposedUpdates.required_cushion = requiredCushion;

  if (balance < requiredCushion && requiredCushion > 0) {
    reasons.push({
      code: 'insufficient_cushion',
      message: `Current balance ${currency(balance)} is below required ${cushionMonths}-month cushion of ${currency(requiredCushion)}.`,
      severity: balance < requiredCushion * 0.5 ? 'high' : 'medium',
    });
  }

  // ── 4. Past-due items ────────────────────────────────────────────────────
  const today = new Date();
  const overdueItems = sortedItems.filter((i) => i.due_date && new Date(i.due_date) < today);
  if (overdueItems.length > 0) {
    reasons.push({
      code: 'overdue_escrow_items',
      message: `${overdueItems.length} escrow obligation(s) are past due: ${overdueItems.map((i) => i.description || i.type).join(', ')}.`,
      severity: 'high',
    });
    proposedUpdates.overdue_items = overdueItems;
  }

  // ── 5. Transaction anomaly detection ─────────────────────────────────────
  const disbursements = transactions.filter((t) => (Number(t.amount) || 0) < 0);
  const largeDisbursements = disbursements.filter((t) => Math.abs(Number(t.amount)) > totalObligations * 0.3 + 5000);
  if (largeDisbursements.length > 0) {
    reasons.push({
      code: 'large_unscheduled_disbursement',
      message: `${largeDisbursements.length} large disbursement(s) detected that may not correspond to scheduled items.`,
      severity: 'medium',
    });
  }

  // ── 6. Status, confidence, actions ──────────────────────────────────────
  const hasHigh = reasons.some((r) => r.severity === 'high');
  const hasMed = reasons.some((r) => r.severity === 'medium');
  const status = hasHigh ? 'fail' : hasMed ? 'needs_review' : 'pass';
  const confidence = status === 'pass' ? 0.89 : status === 'fail' ? 0.30 : 0.62;

  const recommendedActions = [];

  if (lowestBalance < 0) {
    const shortage = Math.abs(lowestBalance);
    recommendedActions.push({
      action_type: 'send_escrow_cure_notice',
      label: 'Send escrow shortage cure notice to borrower',
      payload: { shortage_amount: shortage, loan_id: context.loan_id },
      requires_approval: true,
    });
    recommendedActions.push({
      action_type: 'adjust_monthly_deposit',
      label: 'Adjust monthly escrow deposit to cover shortfall',
      payload: {
        current_deposit: monthlyDeposit,
        suggested_increase: Math.ceil(shortage / 12),
      },
      requires_approval: true,
    });
  }

  if (overdueItems.length > 0) {
    recommendedActions.push({
      action_type: 'process_overdue_disbursement',
      label: 'Process overdue escrow disbursements',
      payload: { items: overdueItems },
      requires_approval: true,
    });
  }

  recommendedActions.push({
    action_type: 'generate_escrow_analysis',
    label: 'Generate escrow analysis memo',
    payload: { balance, projection: projection.slice(0, 6) },
    requires_approval: true,
  });

  // ── 7. Title & summary ────────────────────────────────────────────────────
  const propName = context.property_name || 'Property';

  let title;
  if (status === 'pass') {
    title = `${propName} — escrow analysis: adequate balance (${currency(balance)})`;
  } else if (lowestBalance < 0) {
    title = `${propName} — escrow shortage projected: ${currency(Math.abs(lowestBalance))} deficit`;
  } else {
    title = `${propName} — escrow review: ${reasons.length} exception(s) identified`;
  }

  const summary =
    status === 'pass'
      ? `Escrow balance of ${currency(balance)} is sufficient to cover all scheduled obligations with adequate cushion.`
      : `Escrow analysis identified ${reasons.length} issue(s). ${lowestBalance < 0 ? `Projected deficit of ${currency(Math.abs(lowestBalance))} requires immediate action.` : 'See recommended actions for next steps.'}`;

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

module.exports = { runEscrowAgent };
