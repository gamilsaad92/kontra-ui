function runFinancialAgent(financialData = {}) {
  const noi = Number(financialData.noi || 0);
  const annualDebtService = Number(financialData.annual_debt_service || 1);
  const occupancyRate = Number(financialData.occupancy_rate || 0);
  const reportingPeriod = financialData.reporting_period || 'unknown';
  const recentTransactions = Array.isArray(financialData.transactions) ? financialData.transactions : [];

  const reasons = [];
  const evidence = [];

  const dscr = annualDebtService > 0 ? noi / annualDebtService : null;

  if (dscr !== null && dscr < 1.2) {
    reasons.push({
      code: 'LOW_DSCR',
      message: `DSCR of ${dscr.toFixed(2)} is below the 1.20 covenant threshold.`,
      severity: 'high',
    });
  }

  if (occupancyRate < 80) {
    reasons.push({
      code: 'LOW_OCCUPANCY',
      message: `Occupancy at ${occupancyRate.toFixed(1)}% is below acceptable 80% threshold.`,
      severity: 'high',
    });
  } else if (occupancyRate < 90) {
    reasons.push({
      code: 'BELOW_COVENANT_OCCUPANCY',
      message: `Occupancy at ${occupancyRate.toFixed(1)}% warrants monitoring (covenant: 90%).`,
      severity: 'medium',
    });
  }

  if (recentTransactions.length === 0) {
    reasons.push({
      code: 'NO_TRANSACTIONS',
      message: `No transactions provided for period ${reportingPeriod}.`,
      severity: 'low',
    });
  }

  const status = reasons.length > 0 ? 'needs_review' : 'pass';

  return {
    status,
    confidence: status === 'pass' ? 0.87 : 0.65,
    title: status === 'pass' ? 'Financials passed AI review' : 'Financials require AI exception review',
    summary:
      status === 'pass'
        ? `DSCR of ${dscr !== null ? dscr.toFixed(2) : 'N/A'} and ${occupancyRate}% occupancy meet covenants.`
        : `Detected ${reasons.length} financial exception(s) requiring human review.`,
    reasons,
    evidence,
    recommended_actions:
      status === 'pass'
        ? [
            {
              action_type: 'approve_financials',
              label: 'Approve financial review',
              payload: { dscr, occupancy_rate: occupancyRate },
              requires_approval: true,
            },
          ]
        : [
            {
              action_type: 'request_updated_rent_roll',
              label: 'Request updated rent roll',
              payload: { period: reportingPeriod },
              requires_approval: true,
            },
            {
              action_type: 'flag_for_workout',
              label: 'Flag for workout review',
              payload: { dscr, occupancy_rate: occupancyRate },
              requires_approval: true,
            },
          ],
    proposed_updates: {
      dscr: dscr !== null ? Number(dscr.toFixed(4)) : null,
      occupancy_rate: occupancyRate,
      reporting_period: reportingPeriod,
    },
  };
}

module.exports = { runFinancialAgent };
