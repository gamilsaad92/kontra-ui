const express = require('express');
const { z } = require('zod');
const { supabase } = require('../../db');
const { createEntityRouter } = require('./entityRouter');
const { getEntity } = require('../lib/crud');
const { selectFor } = require('../lib/selectColumns');

const router = express.Router();
router.use(createEntityRouter('/pools', 'pools'));
router.use(createEntityRouter('/tokens', 'tokens'));
router.use(createEntityRouter('/trades', 'trades'));
router.use(createEntityRouter('/exchange-listings', 'exchange_listings'));

const run = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/pools/:id/loans', run(async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  const bodyResult = z.object({ loan_id: z.string().uuid() }).safeParse(req.body);
  if (!idResult.success || !bodyResult.success) {
    return res.status(400).json({ message: 'Validation failed' });
  }

  const pool = await getEntity('pools', req.orgId, idResult.data);
  if (!pool) return res.status(404).json({ message: 'Pool not found' });

  const loan = await getEntity('loans', req.orgId, bodyResult.data.loan_id);
  if (!loan) return res.status(404).json({ message: 'Loan not found' });

  const { data, error } = await supabase
    .from('pool_loans')
    .insert({ org_id: req.orgId, pool_id: idResult.data, loan_id: bodyResult.data.loan_id })
    .select(selectFor('pool_loans'))
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json(data);
}));

router.delete('/pools/:id/loans/:loanId', run(async (req, res) => {
  const idResult = z.string().uuid().safeParse(req.params.id);
  const loanIdResult = z.string().uuid().safeParse(req.params.loanId);
  if (!idResult.success || !loanIdResult.success) {
    return res.status(400).json({ message: 'Validation failed' });
  }

  const { data, error } = await supabase
    .from('pool_loans')
    .delete()
    .eq('org_id', req.orgId)
    .eq('pool_id', idResult.data)
    .eq('loan_id', loanIdResult.data)
    .select(selectFor('pool_loans'))
    .maybeSingle();

  if (error) return res.status(400).json({ message: error.message });
  if (!data) return res.status(404).json({ message: 'Membership not found' });
  res.json({ ok: true });
}));

module.exports = router;
