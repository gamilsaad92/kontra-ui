function predictBills({ property_value, tax_history = [], insurance_history = [], tax_month = 7, insurance_month = 1 }) {
  const now = new Date();
  let nextTax = new Date(now.getFullYear(), tax_month - 1, 1);
  if (nextTax < now) nextTax.setFullYear(nextTax.getFullYear() + 1);
  let nextInsurance = new Date(now.getFullYear(), insurance_month - 1, 1);
  if (nextInsurance < now) nextInsurance.setFullYear(nextInsurance.getFullYear() + 1);

  const taxAvg = Array.isArray(tax_history) && tax_history.length
    ? tax_history.reduce((a, b) => a + b, 0) / tax_history.length
    : property_value * 0.012;

  const insAvg = Array.isArray(insurance_history) && insurance_history.length
    ? insurance_history.reduce((a, b) => a + b, 0) / insurance_history.length
    : property_value * 0.004;

  return {
    next_tax_due: nextTax.toISOString().slice(0, 10),
    predicted_tax_amount: parseFloat(taxAvg.toFixed(2)),
    next_insurance_due: nextInsurance.toISOString().slice(0, 10),
    predicted_insurance_amount: parseFloat(insAvg.toFixed(2))
  };
}

module.exports = { predictBills };
