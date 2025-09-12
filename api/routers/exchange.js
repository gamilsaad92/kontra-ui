const express = require('express');
const { z, ZodError } = require('../lib/zod');
const { supabase } = require('../db');
const authenticate = require('../middlewares/authenticate');
const requireRole = require('../middlewares/requireRole');
const { updateRecommendations } = require('../matchingEngine');
const { generateAndStore, sendForSignature } = require('../documentService');
const { v4: uuidv4 } = require('uuid');
const { sendEmail, sendSms } = require('../communications');

const router = express.Router();

// Settlement webhook from payment rails
router.post('/settlement/webhook', async (req, res) => {
  const { trade_id, funds_confirmed, assignments_confirmed, waterfall } = req.body || {};
  if (!trade_id) {
    return res.status(400).json({ error: 'trade_id required' });
  }
  const status = funds_confirmed && assignments_confirmed ? 'settled' : 'pending';
  const payload = { funds_confirmed, assignments_confirmed, waterfall };
  const { error: insertErr } = await supabase
    .from('exchange_trade_events')
    .insert([{ trade_id, status, event_payload: payload }]);
  if (insertErr) {
    return res.status(400).json({ error: insertErr.message });
  }
  if (status === 'settled') {
    await supabase
      .from('exchange_trades')
      .update({ status: 'settled', settled_at: new Date().toISOString() })
      .eq('id', trade_id);
  }
  res.json({ received: true, status });
});

// All routes require authentication
router.use(authenticate);

// Tokenization schema
const tokenSchema = z.object({
  asset: z.string(),
  supply: z.number().positive()
});

// Tokenize an asset
router.post('/tokenize', requireRole('lender_trader'), async (req, res) => {
  try {
    const { asset, supply } = tokenSchema.parse(req.body);
    const tokenId = uuidv4();
    // Mock persistence of the tokenized asset
    res.status(201).json({ token: { id: tokenId, asset, supply } });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Tokenize error:', err);
    res.status(500).json({ error: 'Failed to tokenize asset' });
  }
});

// Listing schemas
const listingSchema = z.object({
  asset_type: z.string(),
  title: z.string().min(3),
  description: z.string().optional(),
  par_amount: z.number().positive(),
  min_piece: z.number().optional(),
  currency: z.string().default('USD'),
  rate_type: z.enum(['fixed', 'floating']),
  index_rate: z.string().optional(),
  spread_bps: z.number().int().optional(),
  coupon_bps: z.number().int().optional(),
  maturity_date: z.string().optional(),
  borrower_name: z.string().optional(),
  sector: z.string().optional(),
  geography: z.string().optional(),
  risk_rating: z.string().optional(),
  ltv: z.number().optional(),
  dscr: z.number().optional(),
  visibility: z.enum(['network', 'private', 'invite_only']).default('network'),
  invitee_org_ids: z.array(z.string()).optional(),
  compliance_hold: z.boolean().default(true)
});
const listingUpdateSchema = listingSchema.omit({ compliance_hold: true }).partial();

async function notifySavedSearches(listing) {
  const { data: searches } = await supabase
    .from('exchange_saved_searches')
    .select('*');
  if (!searches) return;
  for (const s of searches) {
    const { search_text, filters, notify_email, notify_sms, user_id } = s;
    if (!matchesSearch(listing, search_text, filters)) continue;
    const { data: user } = await supabase
      .from('users')
      .select('email, phone')
      .eq('id', user_id)
      .single();
    const msg = `New listing matches your saved search: ${listing.title}`;
    if (notify_email && user?.email) {
      await sendEmail(user.email, 'New Listing Match', msg);
    }
    if (notify_sms && user?.phone) {
      await sendSms(user.phone, msg);
    }
  }
}

function matchesSearch(listing, text, filters = {}) {
  if (text) {
    const haystack = [
      listing.title,
      listing.description,
      listing.sector,
      listing.borrower_name,
      listing.geography
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(text.toLowerCase())) return false;
  }
  if (filters?.par_amount_min && listing.par_amount < filters.par_amount_min)
    return false;
  if (filters?.par_amount_max && listing.par_amount > filters.par_amount_max)
    return false;
  if (filters?.coupon_bps_min && (listing.coupon_bps || 0) < filters.coupon_bps_min)
    return false;
  if (filters?.coupon_bps_max && (listing.coupon_bps || 0) > filters.coupon_bps_max)
    return false;
  if (filters?.spread_bps_min && (listing.spread_bps || 0) < filters.spread_bps_min)
    return false;
  if (filters?.spread_bps_max && (listing.spread_bps || 0) > filters.spread_bps_max)
    return false;
  if (filters?.ltv_min && (listing.ltv || 0) < filters.ltv_min) return false;
  if (filters?.ltv_max && (listing.ltv || 0) > filters.ltv_max) return false;
  if (filters?.dscr_min && (listing.dscr || 0) < filters.dscr_min) return false;
  if (filters?.dscr_max && (listing.dscr || 0) > filters.dscr_max) return false;
  return true;
}

// Create listing
router.post('/listings', requireRole('lender_trader'), async (req, res) => {
  const orgId = req.organizationId;
  const userId = req.user.id;
  try {
    const input = listingSchema.parse(req.body);
    const { data: org } = await supabase
      .from('organizations')
      .select('kyc_approved')
      .eq('id', orgId)
      .single();
    const hold = org?.kyc_approved ? false : true;
    const { data, error } = await supabase
      .from('exchange_listings')
     .insert([{ ...input, compliance_hold: hold, organization_id: orgId, created_by: userId, status: 'listed' }])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    
    // Trigger recommendation refresh for this organization
    updateRecommendations(orgId).catch(err =>
      console.error('Update recos error:', err)
    );

      notifySavedSearches(data).catch(err =>
      console.error('Notify saved search error:', err)
    );

    res.status(201).json(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Query listings
router.get('/listings', async (req, res) => {
  const {
    page = 1,
    pageSize = 20,
    status,
    asset_type,
    q,
    par_min,
    par_max,
    coupon_min,
    coupon_max,
    spread_min,
    spread_max,
    ltv_min,
    ltv_max,
    dscr_min,
    dscr_max
  } = req.query;
  let query = supabase
    .from('exchange_listings')
    .select('*')
    .order('created_at', { ascending: false })
    .eq('compliance_hold', false);
  if (status) query = query.eq('status', status);
  if (asset_type) query = query.eq('asset_type', asset_type);
 if (q) query = query.textSearch('search_vector', q);
  if (par_min) query = query.gte('par_amount', Number(par_min));
  if (par_max) query = query.lte('par_amount', Number(par_max));
  if (coupon_min) query = query.gte('coupon_bps', Number(coupon_min));
  if (coupon_max) query = query.lte('coupon_bps', Number(coupon_max));
  if (spread_min) query = query.gte('spread_bps', Number(spread_min));
  if (spread_max) query = query.lte('spread_bps', Number(spread_max));
  if (ltv_min) query = query.gte('ltv', Number(ltv_min));
  if (ltv_max) query = query.lte('ltv', Number(ltv_max));
  if (dscr_min) query = query.gte('dscr', Number(dscr_min));
  if (dscr_max) query = query.lte('dscr', Number(dscr_max));
  const from = (Number(page) - 1) * Number(pageSize);
  const to = from + Number(pageSize) - 1;
  const { data, error } = await query.range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ listings: data || [] });
});

// Listing detail
router.get('/listings/:id', async (req, res) => {
  const { id } = req.params;
  const { data: listing, error } = await supabase
    .from('exchange_listings')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !listing || listing.compliance_hold) return res.status(404).json({ error: 'Listing not found' });

  const { count: offerCount } = await supabase
    .from('exchange_offers')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', id);

  const { count: watchCount } = await supabase
    .from('exchange_watchlist')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', id);

  res.json({
    ...listing,
    metrics: { offers: offerCount || 0, watchers: watchCount || 0 }
  });
});

// Update listing
router.patch('/listings/:id', requireRole('lender_trader'), async (req, res) => {
  try {
    const updates = listingUpdateSchema.parse(req.body);
    const { data, error } = await supabase
      .from('exchange_listings')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    
    updateRecommendations(req.organizationId).catch(err =>
      console.error('Update recos error:', err)
    );

    res.json(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

router.post('/listings/:id/clear_hold', requireRole('compliance_officer'), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('exchange_listings')
    .update({ compliance_hold: false })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Add to watchlist
router.post('/listings/:id/watch', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { error } = await supabase
    .from('exchange_watchlist')
    .insert([{ listing_id: id, user_id: userId }]);
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ watched: true });
});

// Offer schemas
const offerSchema = z.object({
  listing_id: z.number(),
  amount: z.number().positive(),
  price: z.number().positive(),
  message: z.string().optional(),
  compliance_hold: z.boolean().default(true)
});
const offerUpdateSchema = z.object({
  amount: z.number().positive().optional(),
  price: z.number().positive().optional(),
  status: z.enum(['countered', 'accepted', 'rejected', 'withdrawn']).optional()
});

// Create offer
router.post('/offers', requireRole('lender_trader'), async (req, res) => {
  const userId = req.user.id;
  try {
    const input = offerSchema.parse(req.body);
    const { data, error } = await supabase
      .from('exchange_offers')
      .insert([{ ...input, created_by: userId, status: 'open' }])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
   if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Create offer error:', err);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// List offers
router.get('/offers', async (req, res) => {
  const { listingId } = req.query;
  if (!listingId) return res.status(400).json({ error: 'listingId required' });
  const { data, error } = await supabase
    .from('exchange_offers')
    .select('*')
    .eq('listing_id', listingId)
    .eq('compliance_hold', false)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ offers: data || [] });
});

// Update offer
router.patch('/offers/:id', requireRole('lender_trader'), async (req, res) => {
  try {
    const updates = offerUpdateSchema.parse(req.body);
    const { data, error } = await supabase
      .from('exchange_offers')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
     if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Update offer error:', err);
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

router.post('/offers/:id/clear_hold', requireRole('compliance_officer'), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('exchange_offers')
    .update({ compliance_hold: false })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Trade schemas
const tradeSchema = z.object({
  offer_id: z.number()
});
const tradeUpdateSchema = z.object({
  settlement_date: z.string().optional(),
  documents: z.array(z.string()).optional(),
  status: z.string().optional(),
  docs_folder_id: z.string().optional()
});

// Create trade
router.post('/trades', requireRole('lender_trader'), async (req, res) => {
  const userId = req.user.id;
  const orgId = req.organizationId;
  try {
    const input = tradeSchema.parse(req.body);
    const escrow_account_id = uuidv4();
    const { data, error } = await supabase
      .from('exchange_trades')
       .insert([
        {
          ...input,
          escrow_account_id,
          created_by: userId,
          organization_id: orgId,
          status: 'pending',
          compliance_hold: true
        }
      ])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
       if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Create trade error:', err);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// Trade detail
router.get('/trades/:id', requireRole('lender_trader'), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('exchange_trades')
    .select('*')
    .eq('id', id)
    .single();
 if (error || !data || data.compliance_hold) return res.status(404).json({ error: 'Trade not found' });
  res.json(data);
});

// Update trade
router.patch('/trades/:id', requireRole('lender_trader'), async (req, res) => {
  try {
    const updates = tradeUpdateSchema.parse(req.body);
    const { data, error } = await supabase
      .from('exchange_trades')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
  if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Update trade error:', err);
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

router.post('/trades/:id/clear_hold', requireRole('compliance_officer'), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('exchange_trades')
    .update({ compliance_hold: false })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Generate trade documents from templates
const docGenSchema = z.object({
  template: z.string()
});

router.post('/trades/:id/documents', requireRole('lender_trader'), async (req, res) => {
  try {
    const { template } = docGenSchema.parse(req.body);
    const { id } = req.params;
    const data = req.body.data || {};
   const { path, url } = await generateAndStore(id, template, data);
    const folder = `trades/${id}`;
    await supabase
      .from('exchange_trades')
      .update({ docs_folder_id: folder })
      .eq('id', id);
    res.json({ path, url });
  } catch (err) {
   if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Doc generation error:', err);
    res.status(500).json({ error: 'Failed to generate document' });
  }
});

// Trigger e-sign workflow
const signSchema = z.object({
  path: z.string()
});

router.post('/trades/:id/sign', requireRole('lender_trader'), async (req, res) => {
   try {
    const { path } = signSchema.parse(req.body);
    const { id } = req.params;
     const { path: signedPath, url } = await sendForSignature(id, path);
    const { error } = await supabase
      .from('exchange_trades')
      .update({ status: 'signing' })
      .eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
     res.json({ signedPath, url });
  } catch (err) {
      if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Sign error:', err);
    res.status(500).json({ error: 'Failed to sign document' });
  }
});

// Settle trade
router.post('/trades/:id/settle', requireRole('lender_trader'), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('exchange_trades')
    .update({ status: 'settled', settled_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ settled: true });
});


// Messaging
const messageSchema = z.object({
  threadType: z.enum(['listing', 'offer', 'trade']),
  threadId: z.number(),
  body: z.string().min(1)
});

router.post('/messages', async (req, res) => {
  const userId = req.user.id;
  try {
    const input = messageSchema.parse(req.body);
    const { data, error } = await supabase
      .from('exchange_messages')
      .insert([
        {
          thread_type: input.threadType,
          thread_id: input.threadId,
          body: input.body,
          user_id: userId
        }
      ])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Create message error:', err);
    res.status(500).json({ error: 'Failed to post message' });
  }
});

router.get('/messages', async (req, res) => {
  const { threadType, id } = req.query;
  if (!threadType || !id) return res.status(400).json({ error: 'threadType and id required' });
  const { data, error } = await supabase
    .from('exchange_messages')
    .select('*')
    .eq('thread_type', threadType)
    .eq('thread_id', id)
    .order('created_at', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ messages: data || [] });
});

// Preferences
const prefsSchema = z.record(z.any());

router.get('/me/preferences', async (req, res) => {
  const userId = req.user.id;
  const { data, error } = await supabase
    .from('exchange_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }
  res.json({ preferences: data?.preferences || {} });
});

router.put('/me/preferences', async (req, res) => {
  const userId = req.user.id;
  try {
    const prefs = prefsSchema.parse(req.body);
    const { data, error } = await supabase
      .from('exchange_preferences')
      .upsert({ user_id: userId, preferences: prefs }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    
    updateRecommendations(req.organizationId).catch(err =>
      console.error('Update recos error:', err)
    );

    res.json({ preferences: data.preferences });
  } catch (err) {
   if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Save preferences error:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// Get recommendations for this organization
router.get('/recommendations', async (req, res) => {
  const orgId = req.organizationId;
  const { data, error } = await supabase
    .from('exchange_recos')
    .select('listing_id, score')
    .eq('organization_id', orgId)
    .order('score', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ recommendations: data || [] });
});

// On-demand matching
router.post('/match', async (req, res) => {
  const orgId = req.organizationId;
  try {
    const recos = await updateRecommendations(orgId);
    res.json({ recommendations: recos });
  } catch (err) {
    console.error('Match error:', err);
    res.status(500).json({ error: 'Failed to run matching' });
  }
});

module.exports = router;
