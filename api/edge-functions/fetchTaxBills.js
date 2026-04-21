// fetchTaxBills.js - Supabase Edge Function (run monthly)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Placeholder external tax API fetch
async function getRealWorldTaxBill(loanId) {
  // In production this would call a county tax API
  return { amount: Math.floor(Math.random() * 2000) };
}

module.exports = async function fetchTaxBills() {
  const { data: escrows } = await supabase
    .from('escrows')
    .select('loan_id');

  for (const esc of escrows || []) {
    const bill = await getRealWorldTaxBill(esc.loan_id);
    await supabase
      .from('escrows')
      .update({ tax_amount: bill.amount, updated_at: new Date().toISOString() })
      .eq('loan_id', esc.loan_id);
  }

  return new Response('Tax bills updated');
};
