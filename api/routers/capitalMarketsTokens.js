const express = require('express');
const { z, ZodError } = require('../lib/zod');
const authenticate = require('../middlewares/authenticate');
const { orgContext } = require('../middleware/orgContext');
const { supabase } = require('../db');

const router = express.Router();

const HolderSchema = z.object({
  holder_type: z.enum(['wallet', 'borrower', 'lender', 'investor', 'internal']).default('wallet'),
  holder_ref: z.string().min(1),
});

const CreateTokenSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  decimals: z.number().int().min(0).max(18).default(0),
  metadata: z.record(z.any()).optional(),
});

const MintBurnSchema = HolderSchema.extend({
  amount: z.number().positive(),
  memo: z.string().optional(),
});

const TransferSchema = z.object({
  from: HolderSchema,
  to: HolderSchema,
  amount: z.number().positive(),
  memo: z.string().optional(),
});

async function getOrCreateAllocation(orgId, tokenId, holderType, holderRef) {
  const { data: existing, error: exErr } = await supabase
    .from('cm_token_allocations')
    .select('*')
    .eq('org_id', orgId)
    .eq('token_id', tokenId)
    .eq('holder_type', holderType)
    .eq('holder_ref', holderRef)
    .maybeSingle();

  if (exErr) throw exErr;
  if (existing) return existing;

  const { data: created, error: crErr } = await supabase
    .from('cm_token_allocations')
    .insert({
      org_id: orgId,
      token_id: tokenId,
      holder_type: holderType,
      holder_ref: holderRef,
      balance: 0,
    })
    .select('*')
    .single();

  if (crErr) throw crErr;
  return created;
}

router.use(authenticate);
router.use(orgContext);

router.get('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { data, error } = await supabase
      .from('cm_tokens')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ message: error.message });

    return res.json({ tokens: data || [] });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const body = CreateTokenSchema.parse(req.body);

    const { data: token, error } = await supabase
      .from('cm_tokens')
      .insert({
        org_id: orgId,
        symbol: body.symbol.toUpperCase(),
        name: body.name,
        decimals: body.decimals ?? 0,
        metadata: body.metadata ?? {},
        total_supply: 0,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) return res.status(500).json({ message: error.message });

    await supabase.from('cm_token_events').insert({
      org_id: orgId,
      token_id: token.id,
      event_type: 'create',
      amount: 0,
      memo: 'Token created',
      created_by: req.userId || null,
    });

    return res.json({ token });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid payload', issues: err.issues });
    }
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const tokenId = req.params.id;

    const { data: token, error: tErr } = await supabase
      .from('cm_tokens')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', tokenId)
      .single();

    if (tErr || !token) return res.status(404).json({ message: 'Token not found' });

    const { data: allocations, error: aErr } = await supabase
      .from('cm_token_allocations')
      .select('*')
      .eq('org_id', orgId)
      .eq('token_id', tokenId)
      .order('balance', { ascending: false });

    if (aErr) return res.status(500).json({ message: aErr.message });

    return res.json({ token, allocations: allocations || [] });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

router.get('/:id/events', async (req, res) => {
  try {
    const orgId = req.orgId;
    const tokenId = req.params.id;

    const { data, error } = await supabase
      .from('cm_token_events')
      .select('*')
      .eq('org_id', orgId)
      .eq('token_id', tokenId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return res.status(500).json({ message: error.message });

    return res.json({ events: data || [] });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

router.post('/:id/mint', async (req, res) => {
  try {
    const orgId = req.orgId;
    const tokenId = req.params.id;
    const body = MintBurnSchema.parse(req.body);

    const { data: token, error: tErr } = await supabase
      .from('cm_tokens')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', tokenId)
      .single();

    if (tErr || !token) return res.status(404).json({ message: 'Token not found' });

    const alloc = await getOrCreateAllocation(orgId, tokenId, body.holder_type, body.holder_ref);

    const newBalance = Number(alloc.balance) + Number(body.amount);
    const newSupply = Number(token.total_supply) + Number(body.amount);

    const { error: u1 } = await supabase
      .from('cm_token_allocations')
      .update({ balance: newBalance })
      .eq('id', alloc.id)
      .eq('org_id', orgId);

    if (u1) return res.status(500).json({ message: u1.message });

    const { error: u2 } = await supabase
      .from('cm_tokens')
      .update({ total_supply: newSupply })
      .eq('id', tokenId)
      .eq('org_id', orgId);

    if (u2) return res.status(500).json({ message: u2.message });

    await supabase.from('cm_token_events').insert({
      org_id: orgId,
      token_id: tokenId,
      event_type: 'mint',
      to_holder_type: body.holder_type,
      to_holder_ref: body.holder_ref,
      amount: body.amount,
      memo: body.memo ?? null,
      created_by: req.userId || null,
    });

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid payload', issues: err.issues });
    }
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

router.post('/:id/burn', async (req, res) => {
  try {
    const orgId = req.orgId;
    const tokenId = req.params.id;
    const body = MintBurnSchema.parse(req.body);

    const { data: token, error: tErr } = await supabase
      .from('cm_tokens')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', tokenId)
      .single();

    if (tErr || !token) return res.status(404).json({ message: 'Token not found' });

    const alloc = await getOrCreateAllocation(orgId, tokenId, body.holder_type, body.holder_ref);
    const currentBalance = Number(alloc.balance);
    const burnAmount = Number(body.amount);

    if (currentBalance < burnAmount) {
      return res.status(400).json({ message: 'Insufficient balance to burn' });
    }

    const newBalance = currentBalance - burnAmount;
    const newSupply = Number(token.total_supply) - burnAmount;

    const { error: u1 } = await supabase
      .from('cm_token_allocations')
      .update({ balance: newBalance })
      .eq('id', alloc.id)
      .eq('org_id', orgId);

    if (u1) return res.status(500).json({ message: u1.message });

    const { error: u2 } = await supabase
      .from('cm_tokens')
      .update({ total_supply: newSupply })
      .eq('id', tokenId)
      .eq('org_id', orgId);

    if (u2) return res.status(500).json({ message: u2.message });

    await supabase.from('cm_token_events').insert({
      org_id: orgId,
      token_id: tokenId,
      event_type: 'burn',
      from_holder_type: body.holder_type,
      from_holder_ref: body.holder_ref,
      amount: body.amount,
      memo: body.memo ?? null,
      created_by: req.userId || null,
    });

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid payload', issues: err.issues });
    }
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

router.post('/:id/transfer', async (req, res) => {
  try {
    const orgId = req.orgId;
    const tokenId = req.params.id;
    const body = TransferSchema.parse(req.body);

    const { data: token, error: tErr } = await supabase
      .from('cm_tokens')
      .select('id')
      .eq('org_id', orgId)
      .eq('id', tokenId)
      .single();

    if (tErr || !token) return res.status(404).json({ message: 'Token not found' });

    const fromAlloc = await getOrCreateAllocation(
      orgId,
      tokenId,
      body.from.holder_type,
      body.from.holder_ref
    );
    const toAlloc = await getOrCreateAllocation(
      orgId,
      tokenId,
      body.to.holder_type,
      body.to.holder_ref
    );

    const amount = Number(body.amount);
    const fromBalance = Number(fromAlloc.balance);

    if (fromBalance < amount) {
      return res.status(400).json({ message: 'Insufficient balance to transfer' });
    }

    const { error: u1 } = await supabase
      .from('cm_token_allocations')
      .update({ balance: fromBalance - amount })
      .eq('id', fromAlloc.id)
      .eq('org_id', orgId);

    if (u1) return res.status(500).json({ message: u1.message });

    const { error: u2 } = await supabase
      .from('cm_token_allocations')
      .update({ balance: Number(toAlloc.balance) + amount })
      .eq('id', toAlloc.id)
      .eq('org_id', orgId);

    if (u2) return res.status(500).json({ message: u2.message });

    await supabase.from('cm_token_events').insert({
      org_id: orgId,
      token_id: tokenId,
      event_type: 'transfer',
      from_holder_type: body.from.holder_type,
      from_holder_ref: body.from.holder_ref,
      to_holder_type: body.to.holder_type,
      to_holder_ref: body.to.holder_ref,
      amount,
      memo: body.memo ?? null,
      created_by: req.userId || null,
    });

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid payload', issues: err.issues });
    }
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

module.exports = router;
