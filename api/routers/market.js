const express = require('express');
  const { createClient } = require('@supabase/supabase-js');

  const router = express.Router();
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Bootstrap tables ─────────────────────────────────────────────────────────
  async function bootstrap() {
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS market_listings (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          loan_id          UUID,
          org_id           UUID,
          title            TEXT NOT NULL,
          property_type    TEXT DEFAULT 'Multifamily',
          location         TEXT,
          offering_type    TEXT DEFAULT 'Participation',
          loan_amount      BIGINT,
          target_raise     BIGINT,
          min_investment   BIGINT DEFAULT 100000,
          target_yield     NUMERIC(5,2),
          ltv              NUMERIC(5,2),
          term_months      INT,
          description      TEXT,
          status           TEXT DEFAULT 'active',
          listed_by        UUID,
          created_at       TIMESTAMPTZ DEFAULT now(),
          closes_at        TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS market_subscriptions (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          listing_id       UUID NOT NULL REFERENCES market_listings(id) ON DELETE CASCADE,
          investor_id      UUID,
          investor_email   TEXT,
          amount           BIGINT NOT NULL,
          status           TEXT DEFAULT 'pending',
          notes            TEXT,
          created_at       TIMESTAMPTZ DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_market_listing ON market_subscriptions(listing_id);
      `
    }).catch(() => null);

    // Seed demo listings if table is empty
    const { count } = await supabase.from('market_listings').select('id', { count: 'exact', head: true });
    if (count === 0) {
      await supabase.from('market_listings').insert([
        {
          title: 'Skyline Multifamily — Denver CO',
          property_type: 'Multifamily', location: 'Denver, CO',
          offering_type: 'Participation', loan_amount: 18500000,
          target_raise: 6000000, min_investment: 250000,
          target_yield: 9.25, ltv: 68.5, term_months: 24,
          description: '192-unit Class B multifamily value-add bridge loan. Senior lien. Monthly pay. 12-mo IO period.',
          status: 'active',
          closes_at: new Date(Date.now() + 21 * 86400000).toISOString(),
        },
        {
          title: 'Harbor View Office Park — Miami FL',
          property_type: 'Office', location: 'Miami, FL',
          offering_type: 'Participation', loan_amount: 9200000,
          target_raise: 3000000, min_investment: 100000,
          target_yield: 10.50, ltv: 61.0, term_months: 18,
          description: 'Transitional office-to-mixed-use conversion. Strong sponsor with 3 prior exits. 90% occupied at funding.',
          status: 'active',
          closes_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        },
        {
          title: 'Crestview Industrial — Phoenix AZ',
          property_type: 'Industrial', location: 'Phoenix, AZ',
          offering_type: 'Preferred Equity', loan_amount: 22000000,
          target_raise: 8000000, min_investment: 500000,
          target_yield: 11.75, ltv: 70.0, term_months: 36,
          description: 'Preferred equity position in 340k SF last-mile logistics facility. Long-term NNN tenant in place.',
          status: 'active',
          closes_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
        {
          title: 'Pinnacle Mixed-Use — Nashville TN',
          property_type: 'Mixed-Use', location: 'Nashville, TN',
          offering_type: 'Whole Loan Sale', loan_amount: 14750000,
          target_raise: 14750000, min_investment: 1000000,
          target_yield: 8.90, ltv: 64.2, term_months: 24,
          description: 'Ground-up mixed-use (retail + 108 units). Fully entitled, permits in hand. Experienced Nashville developer.',
          status: 'active',
          closes_at: new Date(Date.now() + 45 * 86400000).toISOString(),
        },
      ]);
    }
  }
  bootstrap().catch(err => console.warn('[market] bootstrap warn:', err.message));

  // ── GET /api/market/listings ─────────────────────────────────────────────────
  router.get('/listings', async (req, res) => {
    try {
      const { status = 'active', property_type, offering_type } = req.query;
      let q = supabase
        .from('market_listings')
        .select(`*, subscriptions:market_subscriptions(amount, status)`)
        .order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      if (property_type) q = q.eq('property_type', property_type);
      if (offering_type) q = q.eq('offering_type', offering_type);

      const { data, error } = await q;
      if (error) throw error;

      // Augment with subscription totals
      const listings = (data ?? []).map(l => {
        const subs = l.subscriptions ?? [];
        const raised = subs.filter(s => s.status !== 'rejected').reduce((t, s) => t + (s.amount || 0), 0);
        const pct = l.target_raise ? Math.min(100, Math.round(raised / l.target_raise * 100)) : 0;
        return { ...l, subscriptions: undefined, raised_amount: raised, fill_pct: pct, sub_count: subs.length };
      });

      res.json(listings);
    } catch (err) {
      console.error('[market] listings error:', err);
      res.status(500).json({ error: 'Failed to fetch listings' });
    }
  });

  // ── GET /api/market/listings/:id ─────────────────────────────────────────────
  router.get('/listings/:id', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('market_listings')
        .select(`*, subscriptions:market_subscriptions(*)`)
        .eq('id', req.params.id)
        .single();
      if (error || !data) return res.status(404).json({ error: 'Listing not found' });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch listing' });
    }
  });

  // ── POST /api/market/listings ─────────────────────────────────────────────────
  router.post('/listings', async (req, res) => {
    try {
      const required = ['title', 'loan_amount', 'target_raise', 'target_yield'];
      for (const f of required) {
        if (!req.body[f]) return res.status(400).json({ error: `Missing field: ${f}` });
      }
      const { data, error } = await supabase.from('market_listings').insert(req.body).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.status(201).json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create listing' });
    }
  });

  // ── POST /api/market/listings/:id/subscribe ───────────────────────────────────
  router.post('/listings/:id/subscribe', async (req, res) => {
    try {
      const { amount, investor_email, investor_id, notes } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

      // Check listing exists and is active
      const { data: listing, error: lErr } = await supabase
        .from('market_listings').select('id, status, min_investment, target_raise, title').eq('id', req.params.id).single();
      if (lErr || !listing) return res.status(404).json({ error: 'Listing not found' });
      if (listing.status !== 'active') return res.status(422).json({ error: 'Listing is not active' });
      if (listing.min_investment && amount < listing.min_investment) {
        return res.status(422).json({ error: `Minimum investment is $${listing.min_investment.toLocaleString()}` });
      }

      const { data, error } = await supabase.from('market_subscriptions').insert({
        listing_id: req.params.id, amount, investor_email, investor_id, notes, status: 'pending',
      }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.status(201).json({ subscription: data, listing_title: listing.title });
    } catch (err) {
      res.status(500).json({ error: 'Subscription failed' });
    }
  });

  // ── GET /api/market/listings/:id/subscriptions ───────────────────────────────
  router.get('/listings/:id/subscriptions', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('market_subscriptions')
        .select('*')
        .eq('listing_id', req.params.id)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data ?? []);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
  });

  // ── PATCH /api/market/listings/:id ──────────────────────────────────────────
  router.patch('/listings/:id', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('market_listings').update(req.body).eq('id', req.params.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Update failed' });
    }
  });

  module.exports = router;
  