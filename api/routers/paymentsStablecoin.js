const express = require('express');
const crypto = require('crypto');
const { z, ZodError } = require('../lib/zod');
const authenticate = require('../middlewares/authenticate');
const { orgContext } = require('../middleware/orgContext');
const { supabase } = require('../db');

const router = express.Router();

const makeReference = () => `PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const providerCreateDepositAddress = async ({ token, chain }) => {
  const fake = `0x${crypto.randomBytes(20).toString('hex')}`;
  return {
    destination_address: fake,
    provider_payment_id: `stub_${crypto.randomBytes(8).toString('hex')}`,
    token,
    chain,
  };
};

const CreateSchema = z.object({
  loan_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  draw_id: z.string().uuid().optional(),
  expected_amount: z.number().positive(),
  token: z.string().default(process.env.STABLECOIN_DEFAULT_TOKEN || 'USDC'),
  chain: z.string().default(process.env.STABLECOIN_DEFAULT_CHAIN || 'base'),
  auto_convert_to_usd: z.boolean().default(true),
  expires_in_minutes: z.number().int().min(5).max(10080).optional(),
  metadata: z.record(z.any()).optional(),
});

router.use(authenticate);
router.use(orgContext);

router.get('/payments/stablecoin', async (req, res) => {
  const orgId = req.orgId;
  const { data, error } = await supabase
    .from('pay_stablecoin_requests')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ message: error.message });
  return res.json({ payments: data || [] });
});

router.post('/payments/stablecoin', async (req, res) => {
  try {
    const orgId = req.orgId;
    const body = CreateSchema.parse(req.body);

    if (String(body.token).toUpperCase() !== 'USDC') {
      return res.status(400).json({ message: 'Only USDC is supported in MVP' });
    }
    if (String(body.chain).toLowerCase() !== 'base') {
      return res.status(400).json({ message: 'Only Base chain is supported in MVP' });
    }

    const dep = await providerCreateDepositAddress({ token: 'USDC', chain: 'base' });
    const expiresAt = body.expires_in_minutes
      ? new Date(Date.now() + body.expires_in_minutes * 60_000).toISOString()
      : null;

    const reference = makeReference();

    const { data: created, error } = await supabase
      .from('pay_stablecoin_requests')
      .insert({
        org_id: orgId,
        loan_id: body.loan_id ?? null,
        invoice_id: body.invoice_id ?? null,
        draw_id: body.draw_id ?? null,
        reference,
        status: 'requested',
        token: 'USDC',
        chain: 'base',
        expected_amount: body.expected_amount,
        received_amount: 0,
        destination_address: dep.destination_address,
        provider: 'custodial',
        provider_payment_id: dep.provider_payment_id,
        auto_convert_to_usd: body.auto_convert_to_usd ?? true,
        expires_at: expiresAt,
        metadata: body.metadata ?? {},
        created_by: req.user?.id || req.userId || null,
      })
      .select('*')
      .single();

    if (error) return res.status(500).json({ message: error.message });

    await supabase.from('pay_stablecoin_events').insert({
      org_id: orgId,
      request_id: created.id,
      event_type: 'create',
      old_status: null,
      new_status: 'requested',
      raw: { reference, token: 'USDC', chain: 'base' },
    });

    return res.json({ payment: created });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid payload', issues: err.issues });
    }
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

router.get('/payments/stablecoin/:id', async (req, res) => {
  const orgId = req.orgId;
  const id = req.params.id;

  const { data: payment, error: pErr } = await supabase
    .from('pay_stablecoin_requests')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .single();

  if (pErr || !payment) return res.status(404).json({ message: 'Payment not found' });

  const { data: events, error: eErr } = await supabase
    .from('pay_stablecoin_events')
    .select('*')
    .eq('org_id', orgId)
    .eq('request_id', id)
    .order('created_at', { ascending: false })
    .limit(300);

  if (eErr) return res.status(500).json({ message: eErr.message });

  return res.json({ payment, events: events || [] });
});

module.exports = { router };
