const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { triggerWebhooks } = require('../webhooks');
const authenticate = require('../middlewares/authenticate');

const router = express.Router();

router.use(authenticate);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function ensureOrganization(req, res) {
  if (!req.organizationId) {
    res.status(403).json({ message: 'Organization context required' });
    return false;
  }
  return true;
}

async function getLoanForOrg(loanId, organizationId, columns, res) {
  const selectColumns = columns || '*';
  const { data, error } = await supabase
    .from('loans')
    .select(selectColumns)
    .eq('id', loanId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ message: 'Failed to fetch loan' });
    return null;
  }

  if (!data) {
    res.status(404).json({ message: 'Loan not found' });
    return null;
  }

  return data;
}

function calcNextInsuranceDue(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const due = new Date(now.getFullYear(), start.getMonth(), start.getDate());
  if (due < now) due.setFullYear(due.getFullYear() + 1);
  return due.toISOString().slice(0, 10);
}

function calcNextTaxDue(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const due = new Date(now.getFullYear(), 11, start.getDate());
  if (due < now) due.setFullYear(due.getFullYear() + 1);
  return due.toISOString().slice(0, 10);
}

router.post('/loans', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { borrower_name, amount, interest_rate, term_months, start_date } = req.body;
  if (!borrower_name || !amount || !interest_rate || !term_months || !start_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('loans')
    .insert([
      {
        borrower_name,
        amount,
        interest_rate,
        term_months,
        start_date,
        organization_id: req.organizationId,
      },
    ])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create loan' });
  await triggerWebhooks('loan.created', data);
  res.status(201).json({ loan: data });
});

router.get('/loans', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { status, borrower, from, to, minRisk, maxRisk, search } = req.query;
  try {
    let q = supabase
      .from('loans')
      .select('id, borrower_name, amount, interest_rate, term_months, start_date, status, risk_score, created_at')
      .order('created_at', { ascending: false });
    q = q.eq('organization_id', req.organizationId);
    if (status) q = q.eq('status', status);
    if (borrower) q = q.ilike('borrower_name', `%${borrower}%`);
    if (from) q = q.gte('start_date', from);
    if (to) q = q.lte('start_date', to);
    if (minRisk) q = q.gte('risk_score', parseFloat(minRisk));
    if (maxRisk) q = q.lte('risk_score', parseFloat(maxRisk));
    if (search) q = q.textSearch('borrower_name', search, { type: 'plain' });
    const { data, error } = await q;
    if (error) throw error;
    res.json({ loans: data });
  } catch (err) {
    console.error('Loan list error:', err);
    res.status(500).json({ message: 'Failed to fetch loans' });
  }
});

router.get('/loans/export', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  req.headers.accept = 'text/csv';
  const { status, borrower } = req.query;
  let q = supabase.from('loans').select('id, borrower_name, amount, status, created_at');
  q = q.eq('organization_id', req.organizationId);
  if (status) q = q.eq('status', status);
  if (borrower) q = q.ilike('borrower_name', `%${borrower}%`);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to export loans' });
  const header = 'id,borrower_name,amount,status,created_at';
  const rows = data.map(l => [l.id, l.borrower_name, l.amount, l.status, l.created_at].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.send([header, ...rows].join('\n'));
});

router.get('/my-loans', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { user_id } = req.query || {};
  if (!user_id) return res.status(400).json({ message: 'Missing user_id' });
  const { data, error } = await supabase
    .from('loans')
    .select('id, amount, status, start_date')
    .eq('borrower_user_id', user_id)
    .eq('organization_id', req.organizationId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch loans' });
  res.json({ loans: data });
});

router.get('/my-applications', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { email, user_id } = req.query || {};
  if (!email && !user_id) return res.status(400).json({ message: 'Missing email or user_id' });
  let q = supabase.from('loan_applications').select('id, amount, credit_score, kyc_passed, submitted_at');
  q = q.eq('organization_id', req.organizationId);
  if (user_id) q = q.eq('user_id', user_id);
  else q = q.eq('email', email);
  const { data, error } = await q.order('submitted_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch applications' });
  res.json({ applications: data });
});

router.post('/loans/batch-update', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { ids, status } = req.body || {};
  if (!Array.isArray(ids) || !ids.length || !status) {
    return res.status(400).json({ message: 'Missing ids or status' });
  }
  const { data, error } = await supabase
    .from('loans')
    .update({ status })
    .in('id', ids)
    .eq('organization_id', req.organizationId)
    .select('id');
  if (!error && (!data || !data.length)) {
    return res.status(404).json({ message: 'No loans updated' });
  }
  if (error) return res.status(500).json({ message: 'Failed to update loans' });
  res.json({ message: 'Updated' });
});

router.put('/loans/:loanId', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const updates = req.body || {};
  const sanitizedUpdates = { ...updates };
  delete sanitizedUpdates.organization_id;
  const { data, error } = await supabase
    .from('loans')
    .update(sanitizedUpdates)
    .eq('id', loanId)
    .eq('organization_id', req.organizationId)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to update loan' });
  if (!data) return res.status(404).json({ message: 'Loan not found' });
  if (updates.status === 'approved') {
    await triggerWebhooks('loan.approved', data);
  }
  res.json({ loan: data });
});

router.delete('/loans/:loanId', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { data, error } = await supabase
    .from('loans')
    .delete()
    .eq('id', req.params.loanId)
    .eq('organization_id', req.organizationId)
    .select('id')
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to delete loan' });
  if (!data) return res.status(404).json({ message: 'Loan not found' });
  res.json({ message: 'Deleted' });
});

router.post('/loans/:loanId/generate-schedule', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
   const loan = await getLoanForOrg(
    loanId,
    req.organizationId,
    'amount, interest_rate, term_months, start_date',
    res
  );
  if (!loan) return;
  
  const { data: existingSchedule, error: existingErr } = await supabase
    .from('amortization_schedules')
    .select('*')
    .eq('loan_id', loanId)
    .order('due_date', { ascending: true });

  if (existingErr) {
    return res.status(500).json({ message: 'Failed to generate schedule' });
  }

  if (Array.isArray(existingSchedule) && existingSchedule.length > 0) {
    return res.json({ schedule: existingSchedule });
  }

  const P = parseFloat(loan.amount);
  const r = parseFloat(loan.interest_rate) / 100 / 12;
  const n = parseInt(loan.term_months, 10);
 
  if (!Number.isFinite(P) || !Number.isFinite(r) || !Number.isFinite(n) || n <= 0) {
    return res.status(400).json({ message: 'Invalid loan terms' });
  }

  const payment =
    r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));

  if (!Number.isFinite(payment)) {
    return res.status(400).json({ message: 'Invalid loan terms' });
  }

  const inserts = [];
  let balance = P;
  let date = new Date(loan.start_date);
  
  for (let i = 1; i <= n; i++) {
    const interestDue = r === 0 ? 0 : balance * r;
    let principalDue = payment - interestDue;
    balance -= principalDue;
        if (i === n) {
      principalDue += balance;
      balance = 0;
    }
    inserts.push({
      loan_id: parseInt(loanId, 10),
      due_date: date.toISOString().slice(0, 10),
      principal_due: parseFloat(principalDue.toFixed(2)),
      interest_due: parseFloat(interestDue.toFixed(2)),
      balance_after: parseFloat(Math.max(balance, 0).toFixed(2)),
    });
    date.setMonth(date.getMonth() + 1);
  }
  
  const { data: scheduleData, error: insertErr } = await supabase
    .from('amortization_schedules')
    .insert(inserts)
    .select();

  if (insertErr) {
    return res.status(500).json({ message: 'Failed to generate schedule' });
  }

  res.json({ schedule: scheduleData });
});

router.get('/loans/:loanId/schedule', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const { data, error } = await supabase
    .from('amortization_schedules')
    .select('*')
    .eq('loan_id', loanId)
    .order('due_date', { ascending: true });
  if (error) return res.status(500).json({ message: 'Failed to fetch schedule' });
  res.json({ schedule: data });
});

router.post('/loans/:loanId/payments', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const { amount, date } = req.body;
  if (!amount || !date) return res.status(400).json({ message: 'Missing amount or date' });
  const loan = await getLoanForOrg(loanId, req.organizationId, 'amount, interest_rate', res);
  if (!loan) return;
  const { data: lastPayment } = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevBalance = lastPayment ? parseFloat(lastPayment.remaining_balance) : null;
  let balance = prevBalance !== null ? prevBalance : parseFloat(loan.amount);
  const r = parseFloat(loan.interest_rate) / 100 / 12;
  const interest = balance * r;
  const principal = Math.max(0, amount - interest);
  const remaining = balance - principal;
  const { data: paymentData, error: paymentErr } = await supabase
    .from('payments')
    .insert([
      {
        loan_id: parseInt(loanId, 10),
        date,
        amount,
        applied_principal: principal,
        applied_interest: interest,
        remaining_balance: remaining,
        organization_id: req.organizationId,
      },
    ])
    .select()
    .single();
  await triggerWebhooks('payment.created', paymentData);
  if (paymentErr) return res.status(500).json({ message: 'Failed to record payment' });
  res.status(201).json({ payment: paymentData });
});

router.get('/loans/:loanId/payments', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .order('date', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch payments' });
  res.json({ payments: data });
});

router.get('/loans/:loanId/balance', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const loan = await getLoanForOrg(loanId, req.organizationId, 'amount', res);
  if (!loan) return;
  const { data: last, error } = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to fetch balance' });
  if (last) return res.json({ balance: last.remaining_balance });
  res.json({ balance: loan.amount });
});

router.post('/loans/:loanId/payoff', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { payoff_date } = req.body || {};
  if (!payoff_date) return res.status(400).json({ message: 'Missing payoff_date' });
  const { loanId } = req.params;
  const loan = await getLoanForOrg(loanId, req.organizationId, 'interest_rate', res);
  if (!loan) return;
  const balRes = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (balRes.error) return res.status(500).json({ message: 'Failed to fetch balance' });
  const balance = balRes.data ? parseFloat(balRes.data.remaining_balance) : 0;
  const rate = parseFloat(loan.interest_rate) / 100 / 365;
  const days = Math.max(0, (new Date(payoff_date) - new Date()) / (1000 * 60 * 60 * 24));
  const payoff = balance + balance * rate * days;
  res.json({ payoff });
});

router.post('/loans/:loanId/defer', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const { months } = req.body || {};
  const extra = parseInt(months, 10);
  if (isNaN(extra) || extra <= 0) {
    return res.status(400).json({ message: 'Missing or invalid months' });
  }
  const loan = await getLoanForOrg(loanId, req.organizationId, 'term_months', res);
  if (!loan) return;
  const newTerm = parseInt(loan.term_months, 10) + extra;
  const { data: updated, error: updateErr } = await supabase
    .from('loans')
    .update({ term_months: newTerm })
    .eq('id', loanId)
    .eq('organization_id', req.organizationId)
    .select()
    .maybeSingle();
  if (updateErr) {
    return res.status(500).json({ message: 'Failed to defer maturity' });
  }
  if (!updated) {
    return res.status(404).json({ message: 'Loan not found' });
  }
  try {
    await supabase.from('loan_modifications').insert({
      loan_id: parseInt(loanId, 10),
      type: 'deferral',
      delta_months: extra,
      created_at: new Date().toISOString(),
      organization_id: req.organizationId,
    });
  } catch (e) {
    // ignore if table missing
  }
  res.json({ loan: updated });
});

router.post('/loans/:loanId/payment-portal', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const { amount } = req.body || {};
  if (!amount) return res.status(400).json({ message: 'Missing amount' });
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const token = Math.random().toString(36).slice(2);
  const url = `https://payments.example.com/pay/${token}`;
  res.json({ url });
});

router.get('/escrows', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance')
    .eq('organization_id', req.organizationId);
  if (error) return res.status(500).json({ message: 'Failed to fetch escrows' });
  res.json({ escrows: data });
});

router.get('/escrows/upcoming', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance')
    .eq('organization_id', req.organizationId);
  if (error) return res.status(500).json({ message: 'Failed to fetch escrows' });
  const results = [];
  for (const row of data || []) {
    const { data: loan } = await supabase
      .from('loans')
      .select('start_date')
      .eq('id', row.loan_id)
      .eq('organization_id', req.organizationId)
      .maybeSingle();
    const next_tax_due = loan ? calcNextTaxDue(loan.start_date) : null;
    const next_insurance_due = loan ? calcNextInsuranceDue(loan.start_date) : null;
    const projected_balance = parseFloat(row.escrow_balance || 0) - parseFloat(row.tax_amount || 0) - parseFloat(row.insurance_amount || 0);
    results.push({ ...row, next_tax_due, next_insurance_due, projected_balance });
  }
  res.json({ escrows: results });
});

router.get('/loans/:loanId/escrow', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  if (isNaN(parseInt(loanId, 10))) return res.status(400).json({ message: 'Invalid loan id' });
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to fetch escrow' });
  if (!data) return res.status(404).json({ message: 'Escrow not found' });
  res.json({ escrow: data });
});

router.post('/loans/:loanId/escrow/pay', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const { type, amount } = req.body || {};
  if (isNaN(parseInt(loanId, 10))) return res.status(400).json({ message: 'Invalid loan id' });
  if (!type || amount === undefined) return res.status(400).json({ message: 'Missing type or amount' });
  if (!['tax', 'insurance'].includes(type)) return res.status(400).json({ message: 'Invalid type' });

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;

  const { data: esc } = await supabase
    .from('escrows')
    .select('escrow_balance, tax_amount, insurance_amount')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .maybeSingle();
  if (!esc) return res.status(404).json({ message: 'Escrow not found' });

  const column = type === 'tax' ? 'tax_amount' : 'insurance_amount';
  const outstanding = parseFloat(esc[column] || 0);
  const payment = Math.min(amt, outstanding);
  const newBal = parseFloat(esc.escrow_balance) - payment;

  const { error: updateErr, data: updated } = await supabase
    .from('escrows')
    .update({
      escrow_balance: newBal,
      [column]: Math.max(0, outstanding - payment),
    })
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .select('escrow_balance')
    .single();
  if (updateErr) return res.status(500).json({ message: 'Failed to update escrow' });

  res.json({ balance: updated.escrow_balance });
});

router.get('/loans/:loanId/escrow/projection', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  if (isNaN(parseInt(loanId, 10))) return res.status(400).json({ message: 'Invalid loan id' });
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const { data, error } = await supabase
    .from('escrows')
    .select('escrow_balance, tax_amount, insurance_amount')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to fetch escrow' });
  if (!data) return res.status(404).json({ message: 'Escrow not found' });
  const projection = [];
  let bal = parseFloat(data.escrow_balance || 0);
  const tax = parseFloat(data.tax_amount || 0) / 12;
  const ins = parseFloat(data.insurance_amount || 0) / 12;
  for (let i = 1; i <= 12; i++) {
    bal -= tax + ins;
    projection.push({ month: i, balance: parseFloat(bal.toFixed(2)) });
  }
  res.json({ projection });
});

router.get('/loans/:loanId/details', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  try {
    const loan = await getLoanForOrg(loanId, req.organizationId, '*', res);
    if (!loan) return;
    const { data: schedule, error: scheduleErr } = await supabase
      .from('amortization_schedules')
      .select('*')
      .eq('loan_id', loanId)
      .eq('organization_id', req.organizationId)
      .order('due_date');
    if (scheduleErr) throw scheduleErr;
    const { data: payments, error: paymentsErr } = await supabase
      .from('payments')
      .select('*')
      .eq('loan_id', loanId)
      .eq('organization_id', req.organizationId)
      .order('date', { ascending: false });
    if (paymentsErr) throw paymentsErr;
    const { data: collateral, error: collateralErr } = await supabase
      .from('asset_collateral')
      .select('*')
      .eq('asset_id', loan.asset_id || 0)
      .eq('organization_id', req.organizationId);
    if (collateralErr) throw collateralErr;
    res.json({ loan, schedule, payments, collateral });
  } catch (err) {
    console.error('Loan detail error:', err);
    res.status(500).json({ message: 'Failed to fetch loan details' });
  }
});

module.exports = router;
