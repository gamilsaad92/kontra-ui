const express = require('express');
const crypto = require('crypto');
const { z, ZodError } = require('../lib/zod');
const { supabase } = require('../db');

const router = express.Router();

const verifyWebhook = req => {
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
  const sig = req.headers['x-ktra-signature'];
  if (!secret || !sig) return false;
  const raw = req.rawBody || JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(String(sig)));
  } catch (err) {
    return false;
  }
};

const WebhookSchema = z.object({
  provider_payment_id: z.string().min(1),
  token: z.string(),
  chain: z.string(),
  destination_address: z.string().min(1),
  tx_hash: z.string().min(1),
  amount: z.number().positive(),
  confirmations: z.number().int().min(0).default(0),
  block_time: z.string().optional(),
  status: z.enum(['pending', 'settled']).default('pending'),
});

router.post('/payments/stablecoin/webhook', async (req, res) => {
  try {
    if (!verifyWebhook(req)) return res.status(401).json({ message: 'Invalid signature' });

    const evt = WebhookSchema.parse(req.body);

    const { data: reqRow, error: fErr } = await supabase
      .from('pay_stablecoin_requests')
      .select('*')
      .eq('provider_payment_id', evt.provider_payment_id)
      .maybeSingle();

    if (fErr || !reqRow) {
      return res.json({ ok: true });
    }

    const orgId = reqRow.org_id;

    await supabase.from('pay_stablecoin_events').insert({
      org_id: orgId,
      request_id: reqRow.id,
      event_type: 'webhook_received',
      old_status: reqRow.status,
      new_status: reqRow.status,
      tx_hash: evt.tx_hash,
      amount: evt.amount,
      raw: evt,
    });

    const expected = Number(reqRow.expected_amount);
    const received = Number(evt.amount);

    const eventTime = evt.block_time ? new Date(evt.block_time) : new Date();
    const createdAt = new Date(reqRow.created_at);
    const expiresAt = reqRow.expires_at ? new Date(reqRow.expires_at) : null;
    const withinWindow =
      eventTime >= createdAt && (!expiresAt || eventTime <= expiresAt);

    const isMatch =
      String(evt.token).toUpperCase() === 'USDC' &&
      String(evt.chain).toLowerCase() === 'base' &&
      String(evt.destination_address).toLowerCase() ===
        String(reqRow.destination_address).toLowerCase() &&
      received === expected &&
      withinWindow;

    let newStatus = reqRow.status;

    if (!isMatch) {
      newStatus = 'flagged';
    } else if (evt.status === 'pending') {
      newStatus = 'pending';
    } else if (evt.status === 'settled') {
      newStatus = 'reconciled';
    }

    const { error: uErr } = await supabase
      .from('pay_stablecoin_requests')
      .update({
        status: newStatus,
        received_amount: received,
        tx_hash: evt.tx_hash,
        confirmations: evt.confirmations ?? 0,
        block_time: evt.block_time ?? null,
      })
      .eq('id', reqRow.id);

    if (uErr) return res.status(500).json({ message: uErr.message });

    await supabase.from('pay_stablecoin_events').insert({
      org_id: orgId,
      request_id: reqRow.id,
      event_type: 'status_change',
      old_status: reqRow.status,
      new_status: newStatus,
      tx_hash: evt.tx_hash,
      amount: received,
      raw: { reason: isMatch ? 'match' : 'mismatch', withinWindow },
    });

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid webhook payload', issues: err.issues });
    }
    return res.status(400).json({ message: err.message || 'Bad webhook payload' });
  }
});

module.exports = { router };
