const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function scoreLoan({ balance = 0, interest_rate = 0, term_months = 0, delinquencies = 0 }) {
 const logit =
    -3 + 0.00001 * balance + 0.05 * interest_rate - 0.01 * term_months + 0.4 * delinquencies;
  const score = logistic(logit);
  const reasons = [];
  if (balance > 500000) reasons.push('large balance');
  if (interest_rate > 10) reasons.push('high interest');
  if (delinquencies > 0) reasons.push(`${delinquencies} delinquencies`);
  const explanation = reasons.length ? `Higher risk due to ${reasons.join(', ')}` : 'Low risk based on inputs';
  return { score: parseFloat(score.toFixed(4)), explanation }; 
}

module.exports = async function predictLoanRisk() {
  const { data: loans } = await supabase.from('loans').select('id, amount, interest_rate, term_months, delinquencies');

  for (const loan of loans || []) {
    const { score: predicted_risk, explanation } = scoreLoan({
      balance: parseFloat(loan.amount || 0),
      interest_rate: parseFloat(loan.interest_rate || 0),
      term_months: parseInt(loan.term_months || 0, 10),
      delinquencies: parseInt(loan.delinquencies || 0, 10)
    });

    await supabase
      .from('loans')
      .update({ risk_score: predicted_risk, updated_at: new Date().toISOString() })
      .eq('id', loan.id);
    if (predicted_risk > 0.8) {
      console.log('⚠️ High loan risk', loan.id, 'score:', predicted_risk, explanation);
    }
  }

  return new Response('Loan risks scored');
};
