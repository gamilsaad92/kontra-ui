const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendNotice(collection) {
  await supabase.from('notifications').insert([
    {
      user_id: '<BorrowerUserId>',
      message: `Payment of $${collection.amount} for Loan #${collection.loan_id} is past due`,
      link: `/loans/${collection.loan_id}`
    }
  ]);
}

async function run() {
  const { data: overdue } = await supabase
    .from('collections')
    .select('*')
    .eq('status', 'pending')
    .lte('due_date', new Date().toISOString());

  for (const col of overdue || []) {
    await sendNotice(col);
  }
  console.log('✅ Collection notices sent');
}

run().then(() => process.exit()).catch(console.error);
