const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.get('/loans/:loanId/payoff-instructions', async (req, res) => {
  const { loanId } = req.params;
  if (isNaN(parseInt(loanId, 10))) {
    return res.status(400).json({ message: 'Invalid loan id' });
  }
  const { data: loan, error } = await supabase
    .from('loans')
    .select('id, amount')
    .eq('id', loanId)
    .maybeSingle();
  if (error) {
    return res.status(500).json({ message: 'Failed to fetch loan' });
  }
  if (!loan) {
    return res.status(404).json({ message: 'Loan not found' });
  }
  const instructions = `Payoff amount for loan ${loan.id} is ${loan.amount}. Please wire funds to account 123-456.`;
  res.json({ instructions });
});

module.exports = router;
