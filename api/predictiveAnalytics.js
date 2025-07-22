function forecastNextValue(history = []) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const diffs = history.slice(1).map((v, i) => v - history[i]);
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return parseFloat((history[history.length - 1] + avgDiff).toFixed(2));
}

function detectAnomalies(values = []) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  return values
    .map((v, idx) => (Math.abs(v - mean) > 2 * std ? idx : -1))
    .filter(i => i !== -1);
}

function predictChurn({ logins = 0, days_since_login = 0, tickets = 0 }) {
  const logit = -3 + 0.04 * days_since_login - 0.05 * logins + 0.3 * tickets;
  const probability = 1 / (1 + Math.exp(-logit));
  const reasons = [];
  if (days_since_login > 14) reasons.push('inactive');
  if (logins < 5) reasons.push('low usage');
  if (tickets > 3) reasons.push('high support volume');
  return { probability: parseFloat(probability.toFixed(4)), reasons };
}

function suggestPlan({ usage = 0, threshold = 100 }) {
  return usage > threshold
    ? `Usage approaching limit. Consider upgrading next month.`
    : `Current usage within plan.`;
}

module.exports = { forecastNextValue, detectAnomalies, suggestPlan, predictChurn };
