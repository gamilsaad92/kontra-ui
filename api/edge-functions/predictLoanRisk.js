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
  const score = logistic(
    -3 + 0.00001 * balance + 0.05 * interest_rate - 0.01 * term_months + 0.4 * delinquencies
  );
  return parseFloat(score.toFixed(4));
}

module.exports = async function predictLoanRisk() {
  const { data: loans } = await supabase.from('loans').select('id, amount, interest_rate, term_months, delinquencies');

  for (const loan of loans || []) {
    const predicted_risk = scoreLoan({
      balance: parseFloat(loan.amount || 0),
      interest_rate: parseFloat(loan.interest_rate || 0),
      term_months: parseInt(loan.term_months || 0, 10),
      delinquencies: parseInt(loan.delinquencies || 0, 10)
    });

    await supabase
      .from('loans')
      .update({ risk_score: predicted_risk, updated_at: new Date().toISOString() })
      .eq('id', loan.id);
  }

  return new Response('Loan risks scored');
};
