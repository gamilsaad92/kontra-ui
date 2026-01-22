const DEFAULTS = {
  occupancyThreshold: 80,
  paymentLateDays: 35,
  maturityWindowDays: 120,
  drawPendingDays: 14,
  insuranceWindowDays: 60,
  taxWindowDays: 60
};

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(num) ? num : null;
}

function daysBetween(date, reference = new Date()) {
  if (!date) return null;
  const diff = date.getTime() - reference.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function evaluateServicingExceptions(snapshot, options = {}) {
  const rules = { ...DEFAULTS, ...options };
  const exceptions = [];
  const metrics = snapshot?.metrics || {};
  const loan = snapshot?.loan || {};

  if (metrics.dscr !== null && metrics.target_dscr !== null) {
    if (metrics.dscr < metrics.target_dscr) {
      exceptions.push({
        code: 'DSCR_BELOW_THRESHOLD',
        severity: 'high',
        message: `DSCR ${metrics.dscr} is below target ${metrics.target_dscr}.`,
        recommended_next_step: 'Review cashflow drivers and consider covenant notice.'
      });
    }
  }

  if (metrics.occupancy_rate !== null && metrics.occupancy_rate < rules.occupancyThreshold) {
    exceptions.push({
      code: 'OCCUPANCY_LOW',
      severity: 'medium',
      message: `Occupancy is ${metrics.occupancy_rate}% (below ${rules.occupancyThreshold}%).`,
      recommended_next_step: 'Confirm leasing plan and request updated rent roll.'
    });
  }

  const latestPayment = Array.isArray(snapshot?.payments)
    ? snapshot.payments[0]
    : null;
  if (latestPayment?.date) {
    const lastPaymentDate = new Date(latestPayment.date);
    const ageDays = daysBetween(lastPaymentDate, new Date()) * -1;
    if (ageDays > rules.paymentLateDays) {
      exceptions.push({
        code: 'PAYMENT_LATE',
        severity: 'high',
        message: `Last payment was ${ageDays} days ago.`,
        recommended_next_step: 'Confirm delinquency status and trigger borrower outreach.'
      });
    }
  } else if (loan.status === 'delinquent') {
    exceptions.push({
      code: 'PAYMENT_LATE',
      severity: 'high',
      message: 'Loan is marked delinquent without recent payment activity.',
      recommended_next_step: 'Confirm delinquency status and trigger borrower outreach.'
    });
  }

  if (loan.maturity_date) {
    const daysToMaturity = daysBetween(new Date(loan.maturity_date), new Date());
    if (daysToMaturity !== null && daysToMaturity <= rules.maturityWindowDays) {
      exceptions.push({
        code: 'MATURITY_SOON',
        severity: 'medium',
        message: `Maturity is in ${daysToMaturity} days.`,
        recommended_next_step: 'Confirm extension/refinance plan and update maturity checklist.'
      });
    }
  }

  const nextInsurance = metrics.next_insurance_due ? new Date(metrics.next_insurance_due) : null;
  const nextTax = metrics.next_tax_due ? new Date(metrics.next_tax_due) : null;

  if (nextInsurance) {
    const daysToInsurance = daysBetween(nextInsurance, new Date());
    if (daysToInsurance !== null && daysToInsurance <= rules.insuranceWindowDays) {
      exceptions.push({
        code: 'INSURANCE_EXPIRING',
        severity: 'medium',
        message: `Insurance renewal due in ${daysToInsurance} days.`,
        recommended_next_step: 'Request updated insurance certificate and confirm escrow coverage.'
      });
    }
  }

  if (nextTax) {
    const daysToTax = daysBetween(nextTax, new Date());
    if (daysToTax !== null && daysToTax <= rules.taxWindowDays) {
      exceptions.push({
        code: 'TAX_DUE',
        severity: 'medium',
        message: `Property tax due in ${daysToTax} days.`,
        recommended_next_step: 'Verify tax bill and escrow sufficiency.'
      });
    }
  }

  const escrowBalance = toNumber(metrics.escrow_balance);
  const taxAmount = toNumber(metrics.tax_amount);
  const insuranceAmount = toNumber(metrics.insurance_amount);
  if (escrowBalance !== null && (taxAmount !== null || insuranceAmount !== null)) {
    const expected = (taxAmount || 0) + (insuranceAmount || 0);
    if (expected > 0 && escrowBalance < expected) {
      exceptions.push({
        code: 'ESCROW_SHORTFALL',
        severity: 'medium',
        message: `Escrow balance ${escrowBalance} is below next tax/insurance total ${expected}.`,
        recommended_next_step: 'Review escrow funding and consider borrower remittance.'
      });
    }
  }

  const openDraws = Array.isArray(snapshot?.draws) ? snapshot.draws : [];
  openDraws.forEach((draw) => {
    const submittedAt = draw.submitted_at ? new Date(draw.submitted_at) : null;
    if (!submittedAt) return;
    const ageDays = daysBetween(submittedAt, new Date()) * -1;
    if (ageDays > rules.drawPendingDays) {
      exceptions.push({
        code: 'DRAW_PENDING',
        severity: 'low',
        message: `Draw ${draw.id} has been pending for ${ageDays} days.`,
        recommended_next_step: 'Follow up with inspections or missing documents.'
      });
    }
  });

  return exceptions;
}

module.exports = {
  evaluateServicingExceptions
};
