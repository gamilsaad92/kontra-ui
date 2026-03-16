const express = require('express');
const authenticate = require('../middlewares/authenticate');
const rateLimit = require('../middlewares/rateLimit');
const asyncHandler = require('../lib/asyncHandler');
const { supabase } = require('../db');
const {
  getTenantId,
  getUserWallet,
  getUserGroups,
  isSellerRole,
  isComplianceRole,
  ensureTenantContext,
  ensureSellerRole,
  ensureWhitelistAccess,
  ensureKycApproved,
  ensureOfferingOwnership,
  ensureTradeAccess,
} = require('../services/marketPolicyGate');
const { recordMarketAuditEvent } = require('../services/marketAudit');

const router = express.Router();

function wrapRouter(routerInstance) {
  const methods = ['get', 'post', 'put', 'patch', 'delete'];
  methods.forEach((method) => {
    const original = routerInstance[method].bind(routerInstance);
    routerInstance[method] = (path, ...handlers) =>
      original(
        path,
        ...handlers.map((handler) =>
          typeof handler === 'function' ? asyncHandler(handler) : handler
        )
      );
  });
}

router.use(authenticate);
wrapRouter(router);

async function resolveMarketId(tenantId) {
  const { data: existing } = await supabase
    .from('markets')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'internal')
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('markets')
    .insert({ tenant_id: tenantId, name: 'Internal', type: 'internal' })
    .select('id')
    .single();

  if (error) {
    throw new Error('Unable to create default market');
  }

  return data.id;
}

async function getTradeApprovalThreshold(tenantId) {
  const { data } = await supabase
    .from('tenant_settings')
    .select('trade_approval_min_amount')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return Number(data?.trade_approval_min_amount || 0);
}

router.post('/market/tokenize', async (req, res) => {
  await ensureSellerRole(req);
  const tenantId = await ensureTenantContext(req);
  const {
    loan_id,
    asset_type,
    token_symbol,
    token_name,
    chain,
    contract_address,
    decimals = 0,
    total_supply,
    metadata = {},
  } = req.body || {};

  if (!loan_id || !asset_type || !token_symbol || !token_name || !chain || total_supply === undefined) {
    return res.status(400).json({ message: 'Missing required fields for tokenization' });
  }

  const payload = {
    tenant_id: tenantId,
    loan_id,
    asset_type,
    token_symbol,
    token_name,
    chain,
    contract_address: contract_address || null,
    decimals,
    total_supply,
    status: 'draft',
    metadata,
    created_by: req.user?.id || null,
  };

  const { data, error } = await supabase
    .from('tokenized_assets')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ message: 'Unable to create tokenized asset' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'tokenized_asset.created',
    objectType: 'tokenized_asset',
    objectId: data.id,
    afterStatus: data.status,
    metadata: { loan_id },
  });

  res.status(201).json({ tokenized_asset: data });
});

router.post('/market/offerings', async (req, res) => {
  await ensureSellerRole(req);
  const tenantId = await ensureTenantContext(req);
  const {
    tokenized_asset_id,
    offering_type,
    min_ticket,
    max_ticket,
    price_type,
    price_value,
    target_yield_bps,
    settlement_terms,
    starts_at,
    ends_at,
    market_id,
  } = req.body || {};

  if (!tokenized_asset_id || !offering_type || !price_type) {
    return res.status(400).json({ message: 'Missing required offering fields' });
  }

  const { data: asset, error: assetError } = await supabase
    .from('tokenized_assets')
    .select('id, tenant_id')
    .eq('id', tokenized_asset_id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (assetError || !asset) {
    return res.status(404).json({ message: 'Tokenized asset not found for tenant' });
  }

  const resolvedMarketId = market_id || (await resolveMarketId(tenantId));

  const payload = {
    tenant_id: tenantId,
    tokenized_asset_id,
    offering_type,
    min_ticket,
    max_ticket,
    price_type,
    price_value,
    target_yield_bps,
    settlement_terms: settlement_terms || {},
    status: 'draft',
    starts_at,
    ends_at,
    created_by: req.user?.id || null,
    market_id: resolvedMarketId,
  };

  const { data, error } = await supabase
    .from('offering')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ message: 'Unable to create offering' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'offering.created',
    objectType: 'offering',
    objectId: data.id,
    afterStatus: data.status,
  });

  res.status(201).json({ offering: data });
});

router.post('/market/offerings/:id/submit', async (req, res) => {
  await ensureSellerRole(req);
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;

  const { data: offering, error } = await supabase
    .from('offering')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !offering) {
    return res.status(404).json({ message: 'Offering not found' });
  }

  if (offering.status !== 'draft') {
    return res.status(400).json({ message: 'Only draft offerings can be submitted' });
  }

  const { data: updated, error: updateError } = await supabase
    .from('offering')
    .update({ status: 'proposed' })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    return res.status(500).json({ message: 'Unable to submit offering' });
  }

  await supabase.from('approvals_queue').insert({
    tenant_id: tenantId,
    object_type: 'offering',
    object_id: id,
    action: 'approve',
    requested_by: req.user?.id || null,
    assigned_to_role: 'compliance',
    status: 'open',
  });

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'offering.submitted',
    objectType: 'offering',
    objectId: id,
    beforeStatus: offering.status,
    afterStatus: updated.status,
  });

  res.json({ offering: updated });
});

router.post('/market/approvals/:id/decide', async (req, res) => {
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;
  const { decision, notes } = req.body || {};

  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ message: 'Decision must be approved or rejected' });
  }

  if (!isComplianceRole(req.role)) {
    return res.status(403).json({ message: 'Approval role required' });
  }

  const { data: approval, error } = await supabase
    .from('approvals_queue')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !approval) {
    return res.status(404).json({ message: 'Approval request not found' });
  }

  const statusUpdate = {
    status: decision,
    notes: notes || null,
    decided_at: new Date().toISOString(),
  };

  await supabase.from('approvals_queue').update(statusUpdate).eq('id', id);

  let updatedObject = null;
  if (approval.object_type === 'offering') {
    const { data } = await supabase
      .from('offering')
      .update({ status: decision === 'approved' ? 'approved' : 'draft' })
      .eq('id', approval.object_id)
      .select('*')
      .single();
    updatedObject = data;
  }

  if (approval.object_type === 'trade') {
    const { data } = await supabase
      .from('trades')
      .update({ status: decision === 'approved' ? 'approved' : 'cancelled' })
      .eq('id', approval.object_id)
      .select('*')
      .single();
    updatedObject = data;
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'approval.decided',
    objectType: approval.object_type,
    objectId: approval.object_id,
    beforeStatus: approval.status,
    afterStatus: decision,
    metadata: { decision, notes },
  });

  res.json({ approval: { ...approval, ...statusUpdate }, object: updatedObject });
});

router.post('/market/offerings/:id/list', async (req, res) => {
  await ensureSellerRole(req);
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;

  const { data: offering, error } = await supabase
    .from('offering')
    .select('id, status, disclosure_pack_url')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !offering) {
    return res.status(404).json({ message: 'Offering not found' });
  }

  if (offering.status !== 'approved') {
    return res.status(400).json({ message: 'Offering must be approved before listing' });
  }

  if (!offering.disclosure_pack_url) {
    return res.status(400).json({ message: 'Disclosure pack required before listing' });
  }

  const { data: accessEntries } = await supabase
    .from('offering_access')
    .select('id')
    .eq('offering_id', id);

  if (!accessEntries || accessEntries.length === 0) {
    return res.status(400).json({ message: 'Whitelist access entries required before listing' });
  }

  const { data: updated, error: updateError } = await supabase
    .from('offering')
    .update({ status: 'listed' })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    return res.status(500).json({ message: 'Unable to list offering' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'offering.listed',
    objectType: 'offering',
    objectId: id,
    beforeStatus: offering.status,
    afterStatus: updated.status,
  });

  res.json({ offering: updated });
});

router.get('/market/offerings', async (req, res) => {
  const tenantId = await ensureTenantContext(req);
  const orgId = getTenantId(req);
  const walletAddress = getUserWallet(req);
  const groups = getUserGroups(req);

  const { data: offerings, error } = await supabase
    .from('offering')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ message: 'Unable to load offerings' });
  }

  let allowedOfferings = offerings || [];
  if (!isSellerRole(req.role) && !isComplianceRole(req.role)) {
    const filtered = [];
    for (const offering of allowedOfferings) {
      try {
        await ensureWhitelistAccess({
          offeringId: offering.id,
          tenantId,
          orgId,
          walletAddress,
          groups,
        });
        await ensureKycApproved({ tenantId, orgId, walletAddress });
        filtered.push(offering);
      } catch (err) {
        continue;
      }
    }
    allowedOfferings = filtered;
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'offering.list_viewed',
    objectType: 'offering',
    metadata: { count: allowedOfferings.length },
  });

  res.json({ offerings: allowedOfferings });
});

router.get('/market/tokenized-assets', async (req, res) => {
  const tenantId = await ensureTenantContext(req);

  const { data, error } = await supabase
    .from('tokenized_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ message: 'Unable to load tokenized assets' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'tokenized_asset.list_viewed',
    objectType: 'tokenized_asset',
    metadata: { count: (data || []).length },
  });

  res.json({ tokenized_assets: data || [] });
});

router.get('/market/offerings/:id', async (req, res) => {
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;
  const orgId = getTenantId(req);
  const walletAddress = getUserWallet(req);
  const groups = getUserGroups(req);

  const { data: offering, error } = await supabase
    .from('offering')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !offering) {
    return res.status(404).json({ message: 'Offering not found' });
  }

  if (!isSellerRole(req.role) && !isComplianceRole(req.role)) {
    await ensureWhitelistAccess({ offeringId: id, tenantId, orgId, walletAddress, groups });
    await ensureKycApproved({ tenantId, orgId, walletAddress });
  }

  const { data: tokenizedAsset } = await supabase
    .from('tokenized_assets')
    .select('*')
    .eq('id', offering.tokenized_asset_id)
    .maybeSingle();

  let rfqs = [];
  const rfqQuery = supabase
    .from('rfq')
    .select('*')
    .eq('offering_id', id)
    .order('created_at', { ascending: false });

  if (!isSellerRole(req.role) && !isComplianceRole(req.role)) {
    rfqQuery.eq('buyer_org_id', orgId);
  }

  const { data: rfqData } = await rfqQuery;
  rfqs = rfqData || [];

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'offering.viewed',
    objectType: 'offering',
    objectId: id,
  });

  res.json({ offering, tokenized_asset: tokenizedAsset, rfqs });
});

router.post('/market/offerings/:id/rfq', rateLimit, async (req, res) => {
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;
  const orgId = getTenantId(req);
  const walletAddress = getUserWallet(req);
  const groups = getUserGroups(req);
  const { requested_amount, requested_price_value, message } = req.body || {};

  if (!requested_amount) {
    return res.status(400).json({ message: 'requested_amount is required' });
  }

  const { data: offering, error } = await supabase
    .from('offering')
    .select('id, status, min_ticket, max_ticket')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !offering) {
    return res.status(404).json({ message: 'Offering not found' });
  }

  if (offering.status !== 'listed') {
    return res.status(400).json({ message: 'Offering is not listed' });
  }

  await ensureWhitelistAccess({ offeringId: id, tenantId, orgId, walletAddress, groups });
  await ensureKycApproved({ tenantId, orgId, walletAddress });

  if (offering.min_ticket && requested_amount < offering.min_ticket) {
    return res.status(400).json({ message: 'Requested amount below minimum ticket' });
  }

  if (offering.max_ticket && requested_amount > offering.max_ticket) {
    return res.status(400).json({ message: 'Requested amount above maximum ticket' });
  }

  const payload = {
    offering_id: id,
    buyer_org_id: orgId,
    buyer_user_id: req.user?.id || null,
    requested_amount,
    requested_price_value,
    message: message || null,
    status: 'submitted',
  };

  const { data, error: insertError } = await supabase
    .from('rfq')
    .insert(payload)
    .select('*')
    .single();

  if (insertError) {
    return res.status(500).json({ message: 'Unable to submit RFQ' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'rfq.submitted',
    objectType: 'rfq',
    objectId: data.id,
    afterStatus: data.status,
    metadata: { offering_id: id },
  });

  res.status(201).json({ rfq: data });
});

router.post('/market/rfq/:id/counter', async (req, res) => {
  await ensureSellerRole(req);
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;
  const { requested_price_value, message } = req.body || {};

  const { data: rfq, error } = await supabase
    .from('rfq')
    .select('id, status, offering_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !rfq) {
    return res.status(404).json({ message: 'RFQ not found' });
  }

  await ensureOfferingOwnership({ offeringId: rfq.offering_id, tenantId });

  const { data: updated, error: updateError } = await supabase
    .from('rfq')
    .update({
      status: 'countered',
      requested_price_value,
      message: message || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    return res.status(500).json({ message: 'Unable to counter RFQ' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'rfq.countered',
    objectType: 'rfq',
    objectId: id,
    beforeStatus: rfq.status,
    afterStatus: updated.status,
  });

  res.json({ rfq: updated });
});

router.post('/market/rfq/:id/accept', async (req, res) => {
  await ensureSellerRole(req);
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;

  const { data: rfq, error } = await supabase
    .from('rfq')
    .select('id, status, offering_id, requested_amount, requested_price_value, buyer_org_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !rfq) {
    return res.status(404).json({ message: 'RFQ not found' });
  }

  if (!['submitted', 'countered'].includes(rfq.status)) {
    return res.status(400).json({ message: 'RFQ cannot be accepted in current status' });
  }

  await ensureOfferingOwnership({ offeringId: rfq.offering_id, tenantId });

  const threshold = await getTradeApprovalThreshold(tenantId);
  const requiresApproval = Number(rfq.requested_amount || 0) >= threshold && threshold > 0;

  const tradeStatus = requiresApproval ? 'pending' : 'approved';

  const { data: trade, error: tradeError } = await supabase
    .from('trades')
    .insert({
      offering_id: rfq.offering_id,
      rfq_id: rfq.id,
      buyer_org_id: rfq.buyer_org_id,
      seller_org_id: tenantId,
      amount: rfq.requested_amount,
      price_value: rfq.requested_price_value,
      status: tradeStatus,
    })
    .select('*')
    .single();

  if (tradeError) {
    return res.status(500).json({ message: 'Unable to create trade' });
  }

  await supabase
    .from('rfq')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (requiresApproval) {
    await supabase.from('approvals_queue').insert({
      tenant_id: tenantId,
      object_type: 'trade',
      object_id: trade.id,
      action: 'approve',
      requested_by: req.user?.id || null,
      assigned_to_role: 'compliance',
      status: 'open',
    });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'rfq.accepted',
    objectType: 'trade',
    objectId: trade.id,
    afterStatus: trade.status,
    metadata: { rfq_id: id },
  });

  res.json({ trade, approval_required: requiresApproval });
});

router.post('/market/trades/:id/settle', async (req, res) => {
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;
  const { settlement_ref } = req.body || {};

  if (!settlement_ref) {
    return res.status(400).json({ message: 'settlement_ref is required' });
  }

  const trade = await ensureTradeAccess({ tradeId: id, tenantId, orgId: tenantId, role: req.role });

  if (trade.status !== 'approved') {
    return res.status(400).json({ message: 'Trade must be approved before settlement' });
  }

  const { data: updated, error } = await supabase
    .from('trades')
    .update({ status: 'settled', settlement_ref })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ message: 'Unable to settle trade' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'trade.settled',
    objectType: 'trade',
    objectId: id,
    beforeStatus: trade.status,
    afterStatus: updated.status,
    metadata: { settlement_ref },
  });

  res.json({ trade: updated });
});

router.post('/market/offerings/:id/disclosures/generate', async (req, res) => {
  await ensureSellerRole(req);
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;

  const { data: offering, error } = await supabase
    .from('offering')
    .select('id, tokenized_asset_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !offering) {
    return res.status(404).json({ message: 'Offering not found' });
  }

  const { data: tokenized } = await supabase
    .from('tokenized_assets')
    .select('loan_id, metadata')
    .eq('id', offering.tokenized_asset_id)
    .maybeSingle();

  const loanId = tokenized?.loan_id;
  const { data: loanSnapshot } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .maybeSingle();

  const disclosurePayload = {
    generated_at: new Date().toISOString(),
    offering_id: id,
    loan_snapshot: loanSnapshot || null,
    collateral_summary: tokenized?.metadata?.collateral_summary || {},
    servicing_status: tokenized?.metadata?.servicing_status || {},
    dscr_noi_history: tokenized?.metadata?.dscr_noi_history || [],
    escrow: tokenized?.metadata?.escrow || {},
    inspections: tokenized?.metadata?.inspections || [],
    hazard_loss: tokenized?.metadata?.hazard_loss || [],
    covenant_exceptions: tokenized?.metadata?.covenant_exceptions || [],
  };

  const filePath = `offering-${id}-${Date.now()}.json`;
  const { error: uploadError } = await supabase.storage
    .from('disclosure-packs')
    .upload(filePath, JSON.stringify(disclosurePayload, null, 2), {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadError) {
    return res.status(500).json({ message: 'Unable to upload disclosure pack' });
  }

  const { data: publicUrl } = supabase.storage
    .from('disclosure-packs')
    .getPublicUrl(filePath);

  const disclosureUrl = publicUrl?.publicUrl || publicUrl?.publicURL;

  const { data: updated, error: updateError } = await supabase
    .from('offering')
    .update({ disclosure_pack_url: disclosureUrl })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    return res.status(500).json({ message: 'Unable to save disclosure pack URL' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'offering.disclosures.generated',
    objectType: 'offering',
    objectId: id,
    metadata: { disclosure_pack_url: disclosureUrl },
  });

  res.json({ offering: updated, disclosure_pack_url: disclosureUrl });
});

router.post('/market/offerings/:id/ai/summary', async (req, res) => {
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;

  const { data: offering, error } = await supabase
    .from('offering')
    .select('id, price_type, price_value, target_yield_bps, status, disclosure_pack_url')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !offering) {
    return res.status(404).json({ message: 'Offering not found' });
  }

  const summary = {
    executive_summary: 'Advisory risk summary based on available loan snapshot and disclosures.',
    key_risks: [
      offering.disclosure_pack_url ? 'Disclosure pack available; review servicing and collateral sections.' : 'Disclosure pack missing; risk due to incomplete documentation.',
      offering.price_type === 'discount' ? 'Discounted pricing implies market risk expectations.' : 'Pricing aligns with stated terms.',
    ],
    mitigants: [
      'Human compliance review required before listing.',
      'RFQ-only distribution limits public exposure.',
    ],
    data_gaps: offering.disclosure_pack_url ? [] : ['Disclosure pack not generated'],
    confidence: offering.disclosure_pack_url ? 'medium' : 'low',
  };

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'offering.ai_summary.generated',
    objectType: 'offering',
    objectId: id,
  });

  res.json({ summary });
});

router.get('/market/approvals', async (req, res) => {
  const tenantId = await ensureTenantContext(req);

  if (!isComplianceRole(req.role)) {
    return res.status(403).json({ message: 'Approval role required' });
  }

  const { data, error } = await supabase
    .from('approvals_queue')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ message: 'Unable to load approvals queue' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'approvals.viewed',
    objectType: 'approvals_queue',
    metadata: { count: (data || []).length },
  });

  res.json({ approvals: data || [] });
});

router.get('/market/trades', async (req, res) => {
  const tenantId = await ensureTenantContext(req);
  const query = supabase.from('trades').select('*').order('created_at', { ascending: false });

  if (!isComplianceRole(req.role)) {
    query.or(`buyer_org_id.eq.${tenantId},seller_org_id.eq.${tenantId}`);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ message: 'Unable to load trades' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'trades.viewed',
    objectType: 'trade',
    metadata: { count: (data || []).length },
  });

  res.json({ trades: data || [] });
});

router.post('/market/offerings/:id/access', async (req, res) => {
  await ensureSellerRole(req);
  const tenantId = await ensureTenantContext(req);
  const { id } = req.params;
  const { access_type, org_id, wallet_address, group_key, market_id } = req.body || {};

  if (!access_type) {
    return res.status(400).json({ message: 'access_type is required' });
  }

  const payload = {
    offering_id: id,
    tenant_id: tenantId,
    access_type,
    org_id: org_id || null,
    wallet_address: wallet_address || null,
    group_key: group_key || null,
    market_id: market_id || null,
  };

  const { data, error } = await supabase
    .from('offering_access')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ message: 'Unable to add offering access' });
  }

  await recordMarketAuditEvent({
    tenantId,
    actorId: req.user?.id,
    action: 'offering_access.added',
    objectType: 'offering',
    objectId: id,
  });

  res.status(201).json({ access: data });
});

module.exports = { router };
