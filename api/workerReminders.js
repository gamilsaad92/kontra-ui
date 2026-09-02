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
     .select('due_date, loans(borrower_name, borrower_email, borrower_phone, status)')
    .lte('due_date', cutoff.toISOString())
    .eq('paid', false);

    const tasks = [];
   for (const sched of upcoming || []) {
      const loan = sched.loans;
     if (!loan) continue;

    const { emailText, smsText } = await generateReminder({
      borrower_name: loan.borrower_name,
      loan_status: loan.status,
      risk_score: 0,
      history: ''
    });
  const sends = [];
    if (loan.borrower_email) {
      sends.push(sendEmail(loan.borrower_email, 'Upcoming Payment Due', emailText));
    }
    if (loan.borrower_phone) {
         sends.push(sendSms(loan.borrower_phone, smsText));
    }
    if (sends.length) tasks.push(Promise.all(sends));
  }
    await Promise.all(tasks);
  console.log('✅ Reminders sent');
}

run().then(() => process.exit()).catch(err => {
  console.error(err);
  process.exit(1);
});
