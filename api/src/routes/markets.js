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

// ─── Pool loans ───────────────────────────────────────────────────────────────

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

// ─── Tokenize a pool ──────────────────────────────────────────────────────────
// POST /api/markets/pools/:id/tokenize
// Body: { symbol, token_supply, contract_address? }
// Sets ERC-20 token metadata and marks pool as tokenized.
// Financial logic (NAV, DSCR, distributions) stays fully off-chain.

const TokenizeSchema = z.object({
  symbol: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase letters/numbers'),
  token_supply: z.number().int().positive().max(1_000_000_000),
  contract_address: z.string().optional().nullable(),
  network: z.string().default('base'),
});

router.post('/pools/:id/tokenize', run(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: 'Invalid pool id' });

  const body = TokenizeSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Validation failed', issues: body.error.issues });

  const pool = await getEntity('pools', req.orgId, id.data);
  if (!pool) return res.status(404).json({ message: 'Pool not found' });

  if (pool.data?.token_status === 'tokenized') {
    return res.status(409).json({ message: 'Pool is already tokenized' });
  }

  const updatedData = {
    ...(pool.data || {}),
    token_symbol: body.data.symbol,
    token_supply: body.data.token_supply,
    token_contract_address: body.data.contract_address ?? null,
    token_network: body.data.network,
    token_status: 'tokenized',
    tokenized_at: new Date().toISOString(),
  };

  const { data: updated, error } = await supabase
    .from('pools')
    .update({ data: updatedData, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id.data)
    .eq('org_id', req.orgId)
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ pool: updated, token: { symbol: body.data.symbol, supply: body.data.token_supply, network: body.data.network, contract_address: body.data.contract_address ?? null } });
}));

// ─── Pool allocations ─────────────────────────────────────────────────────────
// Each allocation = one investor's wallet + number of tokens they own.
// Ownership % is calculated as token_amount / token_supply.

const AllocationSchema = z.object({
  investor_name: z.string().min(1).max(120),
  wallet_address: z.string().min(10).max(100),
  token_amount: z.number().int().positive(),
});

router.get('/pools/:id/allocations', run(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: 'Invalid pool id' });

  const { data, error } = await supabase
    .from('pool_allocations')
    .select('*')
    .eq('org_id', req.orgId)
    .eq('pool_id', id.data)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST204') return res.json({ items: [], total: 0 });
    return res.status(500).json({ message: error.message });
  }

  const pool = await getEntity('pools', req.orgId, id.data);
  const supply = pool?.data?.token_supply ?? 0;
  const items = (data || []).map((a) => ({
    ...a,
    ownership_pct: supply > 0 ? (a.token_amount / supply) : 0,
  }));

  res.json({ items, total: items.length, token_supply: supply });
}));

router.post('/pools/:id/allocations', run(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: 'Invalid pool id' });

  const body = AllocationSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Validation failed', issues: body.error.issues });

  const pool = await getEntity('pools', req.orgId, id.data);
  if (!pool) return res.status(404).json({ message: 'Pool not found' });
  if (pool.data?.token_status !== 'tokenized') {
    return res.status(409).json({ message: 'Pool must be tokenized before assigning allocations' });
  }

  const { token_supply } = pool.data;
  const { data: existing } = await supabase
    .from('pool_allocations')
    .select('token_amount')
    .eq('org_id', req.orgId)
    .eq('pool_id', id.data);

  const allocated = (existing || []).reduce((s, a) => s + (a.token_amount || 0), 0);
  if (allocated + body.data.token_amount > token_supply) {
    return res.status(400).json({
      message: `Exceeds token supply. Available: ${token_supply - allocated} tokens`,
    });
  }

  const { data, error } = await supabase
    .from('pool_allocations')
    .insert({
      org_id: req.orgId,
      pool_id: id.data,
      investor_name: body.data.investor_name,
      wallet_address: body.data.wallet_address,
      token_amount: body.data.token_amount,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST204') {
      return res.status(501).json({ message: 'Run the Supabase migration to enable allocations' });
    }
    return res.status(400).json({ message: error.message });
  }

  const ownership_pct = token_supply > 0 ? body.data.token_amount / token_supply : 0;
  res.status(201).json({ ...data, ownership_pct });
}));

router.delete('/pools/:id/allocations/:allocId', run(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const allocId = z.string().uuid().safeParse(req.params.allocId);
  if (!id.success || !allocId.success) return res.status(400).json({ message: 'Invalid id' });

  const { error } = await supabase
    .from('pool_allocations')
    .delete()
    .eq('id', allocId.data)
    .eq('pool_id', id.data)
    .eq('org_id', req.orgId);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ ok: true });
}));

// ─── Whitelist ────────────────────────────────────────────────────────────────
// Simple registry of investor wallets allowed to receive token allocations.

router.get('/whitelist', run(async (req, res) => {
  const { data, error } = await supabase
    .from('pool_whitelist')
    .select('*')
    .eq('org_id', req.orgId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST204') return res.json({ items: [] });
    return res.status(500).json({ message: error.message });
  }
  res.json({ items: data || [] });
}));

router.post('/whitelist', run(async (req, res) => {
  const body = z.object({
    wallet_address: z.string().min(10).max(100),
    investor_name: z.string().min(1).max(120).optional(),
    kyc_status: z.enum(['pending', 'approved', 'rejected']).default('approved'),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Validation failed', issues: body.error.issues });

  const { data, error } = await supabase
    .from('pool_whitelist')
    .upsert({
      org_id: req.orgId,
      wallet_address: body.data.wallet_address.toLowerCase(),
      investor_name: body.data.investor_name ?? null,
      kyc_status: body.data.kyc_status,
    }, { onConflict: 'org_id,wallet_address' })
    .select()
    .single();

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST204') {
      return res.status(501).json({ message: 'Run the Supabase migration to enable whitelist' });
    }
    return res.status(400).json({ message: error.message });
  }
  res.status(201).json(data);
}));

router.delete('/whitelist/:wallet', run(async (req, res) => {
  const { wallet } = req.params;
  const { error } = await supabase
    .from('pool_whitelist')
    .delete()
    .eq('org_id', req.orgId)
    .eq('wallet_address', wallet.toLowerCase());

  if (error) return res.status(400).json({ message: error.message });
  res.json({ ok: true });
}));

module.exports = router;
