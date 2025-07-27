const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function maturityDate(start, months) {
  if (!start || !months) return null;
  const d = new Date(start);
  d.setMonth(d.getMonth() + parseInt(months, 10));
  return d;
}

module.exports = async function checkLoanAlerts() {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() + 7);

  // Upcoming payments due within 7 days
  const { data: schedules } = await supabase
    .from('amortization_schedules')
    .select('loan_id, due_date, paid, loans(borrower_user_id)')
    .gte('due_date', now.toISOString().slice(0, 10))
    .lte('due_date', cutoff.toISOString().slice(0, 10));

  for (const sched of schedules || []) {
    if (sched.paid) continue;
    const userId = sched.loans?.borrower_user_id;
    if (!userId) continue;
    await supabase.from('notifications').insert([
      {
        user_id: userId,
        loan_id: sched.loan_id,
        message: `Payment for Loan #${sched.loan_id} due on ${sched.due_date}.`,
        link: `/loans/${sched.loan_id}`
      }
    ]);
  }

  // Loans nearing maturity or high risk
  const { data: loans } = await supabase
    .from('loans')
    .select('id, start_date, term_months, risk_score, borrower_user_id');

  for (const loan of loans || []) {
    const maturity = maturityDate(loan.start_date, loan.term_months);
    const highRisk = parseFloat(loan.risk_score || 0) >= 0.8;
    const nearingMaturity = maturity && maturity >= now && maturity <= cutoff;
    if (!nearingMaturity && !highRisk) continue;
    const parts = [];
    if (nearingMaturity) parts.push(`matures on ${maturity.toISOString().slice(0, 10)}`);
    if (highRisk) parts.push(`high risk score ${loan.risk_score}`);
    await supabase.from('notifications').insert([
      {
        user_id: loan.borrower_user_id,
        loan_id: loan.id,
        message: `Loan #${loan.id} ${parts.join(' and ')}.`,
        link: `/loans/${loan.id}`
      }
    ]);
  }

  return new Response('Loan alerts generated');
};
