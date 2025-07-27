const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function diffRatio(a, b) {
  if (!a) return 0;
  return Math.abs(b - a) / a;
}

module.exports = async function scanLoanAnomalies() {
  const { data: loans } = await supabase.from('loans').select('id');

  for (const loan of loans || []) {
    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount, date')
      .eq('loan_id', loan.id)
      .order('date', { ascending: true });

    for (let i = 1; i < (payments || []).length; i++) {
      const prev = parseFloat(payments[i - 1].amount || 0);
      const curr = parseFloat(payments[i].amount || 0);
      if (prev && diffRatio(prev, curr) >= 0.5) {
        await supabase.from('loan_anomalies').insert([
          {
            loan_id: loan.id,
            type: 'payment_jump',
            details: `Payment ${payments[i].id} amount ${curr} jumped from ${prev}`,
            reference_id: payments[i].id,
            created_at: new Date().toISOString()
          }
        ]);
      }
    }

    const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: addr } = await supabase
      .from('loan_address_history')
      .select('id, changed_at')
      .eq('loan_id', loan.id)
      .gte('changed_at', thirty.toISOString());

    if ((addr || []).length >= 2) {
      await supabase.from('loan_anomalies').insert([
        {
          loan_id: loan.id,
          type: 'address_changes',
          details: `${addr.length} address changes within 30 days`,
          created_at: new Date().toISOString()
        }
      ]);
    }
  }

  return new Response('Loan anomalies scanned');
};
