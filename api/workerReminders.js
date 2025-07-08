const { createClient } = require('@supabase/supabase-js');
const { generateReminder, sendEmail, sendSms } = require('./communications');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 3);
  const { data: upcoming } = await supabase
    .from('amortization_schedules')
    .select('loan_id, due_date')
    .lte('due_date', cutoff.toISOString())
    .eq('paid', false);

  for (const sched of upcoming || []) {
    const { data: loan } = await supabase
      .from('loans')
      .select('borrower_name, borrower_email, borrower_phone, status')
      .eq('id', sched.loan_id)
      .maybeSingle();
    if (!loan) continue;

    const { emailText, smsText } = await generateReminder({
      borrower_name: loan.borrower_name,
      loan_status: loan.status,
      risk_score: 0,
      history: ''
    });
    if (loan.borrower_email) {
      await sendEmail(loan.borrower_email, 'Upcoming Payment Due', emailText);
    }
    if (loan.borrower_phone) {
      await sendSms(loan.borrower_phone, smsText);
    }
  }
  console.log('✅ Reminders sent');
}

run().then(() => process.exit()).catch(err => {
  console.error(err);
  process.exit(1);
});
