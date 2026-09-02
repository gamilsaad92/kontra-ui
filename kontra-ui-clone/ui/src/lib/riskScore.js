export function calculateRiskScore(project) {
  const budget = Number(project.budget || project.budget_total || 0);
  const actual = Number(project.actual_cost || project.actual_spent || 0);
  if (budget <= 0) return 'low';
  const ratio = actual / budget;
  if (ratio > 1.2) return 'high';
  if (ratio > 1.0) return 'medium';
  return 'low';
}
