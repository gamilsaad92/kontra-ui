function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function forecastDelinquency({ credit_score, months_since_origination, ltv, dti }) {
  const risk30 = logistic(-5 + 0.01 * (720 - credit_score) + 0.5 * ltv + 0.3 * dti + 0.02 * months_since_origination);
  const risk60 = logistic(-4 + 0.02 * (720 - credit_score) + 0.7 * ltv + 0.5 * dti + 0.03 * months_since_origination);
  const risk90 = logistic(-3 + 0.03 * (720 - credit_score) + 1.0 * ltv + 0.8 * dti + 0.05 * months_since_origination);
  return { risk30, risk60, risk90 };
}

function optimizeLoanOffer({ current_rate, current_term_months, credit_score, yield_target }) {
  let best = null;
  for (let rate = current_rate - 1; rate <= current_rate + 1; rate += 0.25) {
    for (let term = current_term_months - 12; term <= current_term_months + 12; term += 6) {
      const acceptance = logistic(3 + (current_rate - rate) * 2 + (term - current_term_months) / 6 + (credit_score - 650) / 50);
      const expectedYield = rate / current_rate * (current_term_months / term);
      if (expectedYield >= yield_target) {
        if (!best || acceptance > best.acceptance) {
          best = { rate: parseFloat(rate.toFixed(2)), term_months: term, acceptance };
        }
      }
    }
  }
  return best;
}

module.exports = {
  forecastDelinquency,
  optimizeLoanOffer
};
