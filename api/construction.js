function parseInvoiceBuffer(buffer) {
  const text = buffer.toString('utf8');
  const numbers = text.match(/\d+(?:\.\d+)?/g) || [];
  return numbers.map(Number).reduce((a, b) => a + b, 0);
}

function validateInvoiceAgainstBudget(buffer, budget = 0, spent = 0) {
  const total = parseInvoiceBuffer(buffer);
  const remaining = budget - spent;
  return { invoiceTotal: total, withinBudget: total <= remaining, remainingBudget: remaining };
}

function forecastProject({ progress_history = [], budget_history = [] }) {
  const pct = progress_history[progress_history.length - 1] || 0;
  const rate = progress_history.length > 1 ? progress_history[progress_history.length - 1] - progress_history[0] : 0;
  const remaining = 100 - pct;
  const periodsNeeded = rate > 0 ? remaining / rate : Infinity;
  const predicted_delay = periodsNeeded > progress_history.length * 1.2;

  const avgBudget = budget_history.length ? budget_history.reduce((a, b) => a + b, 0) / budget_history.length : 0;
  const predicted_overrun = avgBudget > 0 && avgBudget * progress_history.length > 1.1 * avgBudget;
  return { predicted_delay, predicted_overrun };
}

function auditLienWaiverText(text) {
  const required = ['unconditional waiver', 'payment received'];
  const missing = required.filter(clause => !new RegExp(clause, 'i').test(text));
  const nonStandard = /\bhold harmless\b/i.test(text) ? ['hold harmless'] : [];
  return { missing_clauses: missing, non_standard_terms: nonStandard };
}

function financeScorecard({ bureau_score = 0, on_time_rate = 0, budget_variance = 0, payment_history = [] }) {
  const historyAvg = payment_history.length ? payment_history.reduce((a, b) => a + b, 0) / payment_history.length : 0;
  let score = bureau_score / 8 + on_time_rate * 20 - budget_variance * 10 + historyAvg * 10;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score };
}

module.exports = {
  validateInvoiceAgainstBudget,
  forecastProject,
  auditLienWaiverText,
  financeScorecard
};
