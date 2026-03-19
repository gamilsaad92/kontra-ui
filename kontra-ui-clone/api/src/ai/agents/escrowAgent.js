function runEscrowAgent(escrowData = {}) {
  const balance = Number(escrowData.balance || 0);
  const requiredBalance = Number(escrowData.required_balance || 0);
  const disbursements = Array.isArray(escrowData.disbursements) ? escrowData.disbursements : [];
  const projectedTaxBill = Number(escrowData.projected_tax_bill || 0);
  const projectedInsurancePremium = Number(escrowData.projected_insurance_premium || 0);
  const monthsUntilDue = Number(escrowData.months_until_due || 12);

  const reasons = [];
  const evidence = [];

  const projectedNeeds = projectedTaxBill + projectedInsurancePremium;
  const shortfall = projectedNeeds - balance;

  if (requiredBalance > 0 && balance < requiredBalance * 0.9) {
    reasons.push({
      code: 'ESCROW_SHORTAGE',
      message: `Balance $${balance.toFixed(2)} is below required $${requiredBalance.toFixed(2)} (shortage: $${(requiredBalance - balance).toFixed(2)}).`,
      severity: 'high',
    });
  }

  if (shortfall > 0 && monthsUntilDue <= 3) {
    reasons.push({
      code: 'PROJECTED_SHORTAGE',
      message: `Projected shortfall of $${shortfall.toFixed(2)} due within ${monthsUntilDue} month(s).`,
      severity: 'high',
    });
  } else if (shortfall > 0) {
    reasons.push({
      code: 'PROJECTED_SHORTAGE',
      message: `Projected shortfall of $${shortfall.toFixed(2)} in ${monthsUntilDue} month(s).`,
      severity: 'medium',
    });
  }

  const unauthorizedDisbursements = disbursements.filter((d) => !d.approved);
  if (unauthorizedDisbursements.length > 0) {
    reasons.push({
      code: 'UNAUTHORIZED_DISBURSEMENT',
      message: `${unauthorizedDisbursements.length} unapproved disbursement(s) detected.`,
      severity: 'high',
    });
  }

  const status = reasons.length > 0 ? 'needs_review' : 'pass';

  return {
    status,
    confidence: status === 'pass' ? 0.90 : 0.68,
    title: status === 'pass' ? 'Escrow passed AI review' : 'Escrow requires AI exception review',
    summary:
      status === 'pass'
        ? `Escrow balance of $${balance.toFixed(2)} is sufficient and disbursements are in order.`
        : `Detected ${reasons.length} escrow exception(s) requiring human review.`,
    reasons,
    evidence,
    recommended_actions:
      status === 'pass'
        ? [
            {
              action_type: 'approve_escrow',
              label: 'Approve escrow status',
              payload: { balance, required_balance: requiredBalance },
              requires_approval: true,
            },
          ]
        : [
            {
              action_type: 'collect_shortage',
              label: 'Collect shortage amount',
              payload: { shortage: Math.max(0, shortfall), months_until_due: monthsUntilDue },
              requires_approval: true,
            },
            {
              action_type: 'review_disbursements',
              label: 'Review unapproved disbursements',
              payload: { count: unauthorizedDisbursements.length },
              requires_approval: true,
            },
          ],
    proposed_updates: {
      balance,
      required_balance: requiredBalance,
      projected_shortfall: shortfall > 0 ? Number(shortfall.toFixed(2)) : 0,
    },
  };
}

module.exports = { runEscrowAgent };
