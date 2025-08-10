const express = require('express');
const { z } = require('../lib/zod');
const { supabase } = require('../db');
const authenticate = require('../middlewares/authenticate');
const requireRole = require('../middlewares/requireRole');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

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
  maturity_date: z.string().optional(),
  borrower_name: z.string().optional(),
  sector: z.string().optional(),
  geography: z.string().optional(),
  risk_rating: z.string().optional(),
  ltv: z.number().optional(),
  dscr: z.number().optional(),
  visibility: z.enum(['network', 'private', 'invite_only']).default('network'),
  invitee_org_ids: z.array(z.string()).optional()
});
const listingUpdateSchema = listingSchema.partial();

// Create listing
router.post('/listings', requireRole('lender_trader'), async (req, res) => {
  const orgId = req.organizationId;
  const userId = req.user.id;
  try {
    const input = listingSchema.parse(req.body);
    const { data, error } = await supabase
      .from('exchange_listings')
      .insert([{ ...input, organization_id: orgId, created_by: userId, status: 'listed' }])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Query listings
router.get('/listings', async (req, res) => {
  const { page = 1, pageSize = 20, status, asset_type } = req.query;
  let query = supabase
    .from('exchange_listings')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (asset_type) query = query.eq('asset_type', asset_type);
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
  if (error || !listing) return res.status(404).json({ error: 'Listing not found' });

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
    res.json(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
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
  message: z.string().optional()
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
    if (err instanceof z.ZodError) {
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
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Update offer error:', err);
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

// Trade schemas
const tradeSchema = z.object({
  offer_id: z.number()
});
const tradeUpdateSchema = z.object({
  settlement_date: z.string().optional(),
  documents: z.array(z.string()).optional(),
  status: z.string().optional()
});

// Create trade
router.post('/trades', requireRole('lender_trader'), async (req, res) => {
  const userId = req.user.id;
  const orgId = req.organizationId;
  try {
    const input = tradeSchema.parse(req.body);
    const { data, error } = await supabase
      .from('exchange_trades')
      .insert([{ ...input, created_by: userId, organization_id: orgId, status: 'pending' }])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
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
  if (error || !data) return res.status(404).json({ error: 'Trade not found' });
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
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Update trade error:', err);
    res.status(500).json({ error: 'Failed to update trade' });
  }
});

// Trigger e-sign workflow
router.post('/trades/:id/sign', requireRole('lender_trader'), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('exchange_trades')
    .update({ status: 'signing' })
    .eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ signed: true });
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
    if (err instanceof z.ZodError) {
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
    res.json({ preferences: data.preferences });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Save preferences error:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

module.exports = router;
