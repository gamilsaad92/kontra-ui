/**
 * Kontra Hybrid Billing Router
 * Endpoints:
 *   GET    /api/billing/pricing            – org pricing config
 *   PATCH  /api/billing/pricing            – update org pricing
 *   GET    /api/billing/transactions       – list transactions (paged)
 *   POST   /api/billing/transactions       – record a transaction
 *   GET    /api/billing/records            – list billing records
 *   GET    /api/billing/records/:id        – single billing record
 *   POST   /api/billing/records/run-cycle  – aggregate current period
 *   GET    /api/billing/summary            – current-month live summary
 */

const express = require('express');
const { supabase, replica } = require('../db');
const requireOrg = require('../middlewares/requireOrg');

const router = express.Router();
router.use(requireOrg);

// ─── helpers ────────────────────────────────────────────────────────────────

function currentPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  };
}

function toUUID(id) {
  if (!id) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id;
  if (/^\d+$/.test(id)) return `00000000-0000-0000-0000-${id.padStart(12, '0')}`;
  return id;
}

async function getOrgPricing(orgId) {
  const uuid = toUUID(orgId);
  const { data, error } = await replica
    .from('organizations')
    .select('id, name, per_loan_price, transaction_fee_pct, billing_email, stripe_customer_id')
    .eq('id', uuid)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    per_loan_price:      parseFloat(data.per_loan_price)      ?? 50.00,
    transaction_fee_pct: parseFloat(data.transaction_fee_pct) ?? 0.0025,
  };
}

async function countActiveLoans(orgId) {
  const uuid = toUUID(orgId);
  const { count, error } = await replica
    .from('loans')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', uuid)
    .in('status', ['active', 'current', 'performing']);
  if (error) return 0;
  return count ?? 0;
}

// ─── GET /billing/pricing ────────────────────────────────────────────────────
router.get('/pricing', async (req, res) => {
  try {
    const pricing = await getOrgPricing(req.orgId);
    if (!pricing) return res.status(404).json({ error: 'Organization not found' });
    res.json({ pricing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /billing/pricing ──────────────────────────────────────────────────
router.patch('/pricing', async (req, res) => {
  try {
    const uuid = toUUID(req.orgId);
    const { per_loan_price, transaction_fee_pct, billing_email } = req.body ?? {};

    const updates = {};
    if (per_loan_price      !== undefined) updates.per_loan_price      = parseFloat(per_loan_price);
    if (transaction_fee_pct !== undefined) updates.transaction_fee_pct = parseFloat(transaction_fee_pct);
    if (billing_email       !== undefined) updates.billing_email       = billing_email;

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: 'No valid fields provided' });

    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', uuid)
      .select('id, name, per_loan_price, transaction_fee_pct, billing_email')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ pricing: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /billing/transactions ───────────────────────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const uuid   = toUUID(req.orgId);
    const limit  = Math.min(parseInt(req.query.limit  ?? '50',  10), 200);
    const offset = parseInt(req.query.offset ?? '0',  10);
    const from   = req.query.from;
    const to     = req.query.to;
    const type   = req.query.type;

    let q = replica
      .from('billing_transactions')
      .select('*', { count: 'exact' })
      .eq('org_id', uuid)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (from) q = q.gte('created_at', from);
    if (to)   q = q.lte('created_at', to);
    if (type) q = q.eq('type', type);

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ transactions: data ?? [], total: count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /billing/transactions ──────────────────────────────────────────────
router.post('/transactions', async (req, res) => {
  try {
    const uuid = toUUID(req.orgId);
    const { loan_id, transaction_amount, type, description, reference_id } = req.body ?? {};

    if (!transaction_amount || isNaN(parseFloat(transaction_amount)))
      return res.status(400).json({ error: 'transaction_amount is required and must be a number' });
    if (!type)
      return res.status(400).json({ error: 'type is required' });

    const pricing = await getOrgPricing(req.orgId);
    const fee_pct = pricing?.transaction_fee_pct ?? 0.0025;
    const amount  = parseFloat(transaction_amount);
    const fee     = parseFloat((amount * fee_pct).toFixed(2));

    const { data, error } = await supabase
      .from('billing_transactions')
      .insert([{
        org_id: uuid,
        loan_id: loan_id ?? null,
        transaction_amount: amount,
        fee_amount: fee,
        type,
        description: description ?? null,
        reference_id: reference_id ?? null,
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ transaction: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /billing/records ────────────────────────────────────────────────────
router.get('/records', async (req, res) => {
  try {
    const uuid  = toUUID(req.orgId);
    const limit = Math.min(parseInt(req.query.limit ?? '12', 10), 60);
    const { data, error } = await replica
      .from('billing_records')
      .select('*')
      .eq('org_id', uuid)
      .order('period_start', { ascending: false })
      .limit(limit);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ records: data ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /billing/records/:id ────────────────────────────────────────────────
router.get('/records/:id', async (req, res) => {
  try {
    const uuid = toUUID(req.orgId);
    const { data, error } = await replica
      .from('billing_records')
      .select('*')
      .eq('id', req.params.id)
      .eq('org_id', uuid)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'Not found' });
    res.json({ record: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /billing/records/run-cycle ────────────────────────────────────────
// Aggregates active loans + transactions for the given (or current) period
// and upserts a billing_record.
router.post('/records/run-cycle', async (req, res) => {
  try {
    const uuid = toUUID(req.orgId);
    const period = req.body?.period ?? currentPeriod();

    const pricing = await getOrgPricing(req.orgId);
    if (!pricing) return res.status(404).json({ error: 'Organization not found' });

    // Count active loans
    const loanCount = await countActiveLoans(req.orgId);
    const loanCharges = parseFloat((loanCount * pricing.per_loan_price).toFixed(2));

    // Sum transactions in period
    const { data: txData, error: txError } = await replica
      .from('billing_transactions')
      .select('transaction_amount, fee_amount')
      .eq('org_id', uuid)
      .gte('created_at', period.start)
      .lte('created_at', period.end + 'T23:59:59Z');

    if (txError) return res.status(500).json({ error: txError.message });

    const txVolume = (txData ?? []).reduce((s, r) => s + parseFloat(r.transaction_amount), 0);
    const txFees   = (txData ?? []).reduce((s, r) => s + parseFloat(r.fee_amount),         0);

    const totalAmount = parseFloat((loanCharges + txFees).toFixed(2));

    const record = {
      org_id:             uuid,
      period_start:       period.start,
      period_end:         period.end,
      loan_count:         loanCount,
      loan_charges:       loanCharges,
      transaction_volume: parseFloat(txVolume.toFixed(2)),
      transaction_fees:   parseFloat(txFees.toFixed(2)),
      total_amount:       totalAmount,
      status:             req.body?.finalize ? 'finalized' : 'draft',
      updated_at:         new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('billing_records')
      .upsert([record], { onConflict: 'org_id,period_start' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ record: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /billing/summary ────────────────────────────────────────────────────
// Live current-month summary (no DB write — always fresh)
router.get('/summary', async (req, res) => {
  try {
    const uuid   = toUUID(req.orgId);
    const period = currentPeriod();
    const pricing = await getOrgPricing(req.orgId);

    if (!pricing) {
      return res.json({
        period,
        pricing: { per_loan_price: 50, transaction_fee_pct: 0.0025 },
        loan_count: 0,
        loan_charges: 0,
        transaction_volume: 0,
        transaction_fees: 0,
        total_amount: 0,
        transaction_count: 0,
      });
    }

    const [loanCount, txResult] = await Promise.all([
      countActiveLoans(req.orgId),
      replica
        .from('billing_transactions')
        .select('transaction_amount, fee_amount')
        .eq('org_id', uuid)
        .gte('created_at', period.start)
        .lte('created_at', period.end + 'T23:59:59Z'),
    ]);

    const txRows     = txResult.data ?? [];
    const txVolume   = txRows.reduce((s, r) => s + parseFloat(r.transaction_amount), 0);
    const txFees     = txRows.reduce((s, r) => s + parseFloat(r.fee_amount), 0);
    const loanCharge = parseFloat((loanCount * pricing.per_loan_price).toFixed(2));

    res.json({
      period,
      pricing: {
        per_loan_price:      pricing.per_loan_price,
        transaction_fee_pct: pricing.transaction_fee_pct,
      },
      loan_count:         loanCount,
      loan_charges:       loanCharge,
      transaction_volume: parseFloat(txVolume.toFixed(2)),
      transaction_fees:   parseFloat(txFees.toFixed(2)),
      total_amount:       parseFloat((loanCharge + txFees).toFixed(2)),
      transaction_count:  txRows.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
