const express = require('express');
const { z, ZodError } = require('../lib/zod');
const { supabase } = require('../db');
const authenticate = require('../middlewares/authenticate');
const requireRole = require('../middlewares/requireRole');
const { updateRecommendations } = require('../matchingEngine');
const { generateAndStore, sendForSignature } = require('../documentService');
const { v4: uuidv4 } = require('uuid');
const { sendEmail, sendSms } = require('../communications');
const { isFeatureEnabled } = require('../featureFlags');
const collabServer = require('../collabServer');
const { triggerWebhooks } = require('../webhooks');

const router = express.Router();

router.use((req, res, next) => {
  if (!isFeatureEnabled('trading')) {
    return res.status(404).json({ message: 'Trading module is disabled' });
  }
  next();
});

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
    const { data: tradeRow } = await supabase
    .from('exchange_trades')
    .select('id, trade_type, notional_amount, price, status')
    .eq('id', trade_id)
    .single();
  const event = { trade_id, status, payload, trade: tradeRow || null };
  await triggerWebhooks('exchange.trade.settlement', event);
  if (collabServer.broadcast) {
    collabServer.broadcast({ type: 'exchange.trade.settlement', ...event });
  }
  res.json({ received: true, status });
});

// All routes require authentication
router.use(authenticate);

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function cleanObject(obj, { dropNull = false } = {}) {
  if (!obj || typeof obj !== 'object') return {};
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      if (value === undefined) return false;
      if (dropNull && value === null) return false;
      return true;
    })
  );
}

async function fetchFirstRow(table, selectFields, organizationId, filters = []) {
  try {
    let query = supabase.from(table).select(selectFields);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    for (const apply of filters) {
      if (typeof apply === 'function') {
        query = apply(query);
      }
    }
    const { data, error } = await query.limit(1);
    if (error || !Array.isArray(data) || !data.length) return null;
    return data[0];
  } catch (err) {
    console.warn(`Failed to query ${table}`, err);
    return null;
  }
}

async function fetchWithFallbacks(table, selectFields, organizationId, filterSets = []) {
  for (const filters of filterSets) {
    const row = await fetchFirstRow(table, selectFields, organizationId, filters);
    if (row) return row;
  }
  return null;
}

function normalizeKpiShape(entry = {}) {
  const rawValue = entry.value ?? entry.current ?? entry.current_value;
  const rawTarget = entry.target ?? entry.target_value;
  const normalized = cleanObject(
    {
      name: entry.name ?? entry.kpi_name ?? entry.metric ?? 'KPI',
      value:
        typeof rawValue === 'number' || typeof rawValue === 'string'
          ? rawValue
          : undefined,
      target:
        typeof rawTarget === 'number' || typeof rawTarget === 'string'
          ? rawTarget
          : undefined,
      unit: entry.unit ?? entry.kpi_unit ?? entry.measure ?? undefined,
      trend: entry.trend ?? entry.direction ?? entry.directionality ?? undefined,
      delta_bps: toNumber(
        entry.delta_bps ?? entry.deltaBps ?? entry.rate_delta_bps ?? entry.rateDeltaBps
      ) ?? undefined,
    },
    { dropNull: true }
  );
  return normalized;
}

function buildLoanFilterSets({ loanId, borrowerName }) {
  const sets = [];
  if (loanId) {
    sets.push([query => query.eq('loan_id', loanId)]);
    sets.push([query => query.eq('id', loanId)]);
  }
  if (borrowerName) {
    sets.push([query => query.ilike('borrower_name', `%${borrowerName}%`)]);
    sets.push([query => query.ilike('borrower', `%${borrowerName}%`)]);
  }
  sets.push([]);
  return sets;
}

function buildAssetFilterSets({ assetId, borrowerName }) {
  const sets = [];
  if (assetId) {
    sets.push([query => query.eq('id', assetId)]);
  }
  if (borrowerName) {
    sets.push([query => query.ilike('name', `%${borrowerName}%`)]);
  }
  sets.push([]);
  return sets;
}

function assignEnriched(target, enrichments) {
  if (!enrichments || typeof enrichments !== 'object') return;
  for (const [key, value] of Object.entries(enrichments)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      if (Array.isArray(target[key]) && target[key].length) {
        const mergedMap = new Map();
        for (const item of target[key]) {
          const identifier =
            item && typeof item === 'object' && 'name' in item
              ? item.name
              : JSON.stringify(item);
          mergedMap.set(identifier, item);
        }
        for (const entry of value) {
          const identifier =
            entry && typeof entry === 'object' && 'name' in entry
              ? entry.name
              : JSON.stringify(entry);
          mergedMap.set(identifier, entry);
        }
        target[key] = Array.from(mergedMap.values());
      } else {
        target[key] = value;
      }
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = cleanObject(value, { dropNull: true });
      if (!Object.keys(cleaned).length) continue;
      if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        target[key] = { ...target[key], ...cleaned };
      } else {
        target[key] = cleaned;
      }
      continue;
    }
    target[key] = value;
  }
}

async function gatherListingMetrics({ loan_id: loanId, asset_id: assetId, borrower_name: borrowerName, organizationId }) {
  const metrics = {};
  const loanFilterSets = buildLoanFilterSets({ loanId, borrowerName });

  const dscrRow = await fetchWithFallbacks(
    'loan_dscr_metrics',
    'loan_id,id,borrower_name,borrower,dscr,current_dscr,currentDscr,target_dscr,targetDscr,interest_accrued_month,interestAccruedMonth,last_recalculated,lastRecalculated,next_reset,nextReset',
    organizationId,
    loanFilterSets
  );
  if (dscrRow) {
    const currentDscr = toNumber(dscrRow.dscr ?? dscrRow.current_dscr ?? dscrRow.currentDscr);
    const targetDscr = toNumber(dscrRow.target_dscr ?? dscrRow.targetDscr);
    if (currentDscr !== null) {
      metrics.dscr = currentDscr;
    }
    if (currentDscr !== null || targetDscr !== null) {
      const dscrTrend = [];
      if (currentDscr !== null) dscrTrend.push({ period: 'current', dscr: currentDscr });
      if (targetDscr !== null) dscrTrend.push({ period: 'target', dscr: targetDscr });
      if (dscrTrend.length) metrics.dscr_trend = dscrTrend;
    }
    const paymentSummary = cleanObject(
      {
        lastRecalculated: dscrRow.last_recalculated ?? dscrRow.lastRecalculated ?? null,
        nextReset: dscrRow.next_reset ?? dscrRow.nextReset ?? null,
        interestAccruedMonth: toNumber(
          dscrRow.interest_accrued_month ?? dscrRow.interestAccruedMonth
        ),
      },
      { dropNull: true }
    );
    if (Object.keys(paymentSummary).length) {
      metrics.payment_history_summary = paymentSummary;
    }
    const dscrBuffer =
      currentDscr !== null && targetDscr !== null
        ? Number((currentDscr - targetDscr).toFixed(3))
        : null;
    if (dscrBuffer !== null) {
      metrics.marketplace_metrics = {
        ...(metrics.marketplace_metrics || {}),
        dscrBuffer,
        targetDscr,
      };
    } else if (targetDscr !== null) {
      metrics.marketplace_metrics = {
        ...(metrics.marketplace_metrics || {}),
        targetDscr,
      };
    }
  }

  const perfRow = await fetchWithFallbacks(
    'loan_performance_fees',
    'loan_id,id,borrower_name,borrower,profit_share_pct,profitSharePct,noi_target,noiTarget,actual_noi,actualNoi,pref_return,prefReturn,lender_split,lenderSplit,sponsor_split,sponsorSplit,reserve_balance,reserveBalance,last_waterfall,lastWaterfall',
    organizationId,
    loanFilterSets
  );
  if (perfRow) {
    const cashflowSummary = cleanObject(
      {
        profitSharePct: toNumber(perfRow.profit_share_pct ?? perfRow.profitSharePct),
        noiTarget: toNumber(perfRow.noi_target ?? perfRow.noiTarget),
        actualNoi: toNumber(perfRow.actual_noi ?? perfRow.actualNoi),
        prefReturn: toNumber(perfRow.pref_return ?? perfRow.prefReturn),
        lenderSplit: toNumber(perfRow.lender_split ?? perfRow.lenderSplit),
        sponsorSplit: toNumber(perfRow.sponsor_split ?? perfRow.sponsorSplit),
        reserveBalance: toNumber(perfRow.reserve_balance ?? perfRow.reserveBalance),
        lastWaterfall: perfRow.last_waterfall ?? perfRow.lastWaterfall ?? undefined,
      },
      { dropNull: true }
    );
    if (Object.keys(cashflowSummary).length) {
      metrics.cashflow_summary = cashflowSummary;
      if (
        typeof cashflowSummary.actualNoi === 'number' &&
        typeof cashflowSummary.noiTarget === 'number' &&
        cashflowSummary.noiTarget !== 0
      ) {
        const noiMargin = Number(
          (
            (cashflowSummary.actualNoi - cashflowSummary.noiTarget) /
            Math.abs(cashflowSummary.noiTarget)
          ).toFixed(3)
        );
        metrics.marketplace_metrics = {
          ...(metrics.marketplace_metrics || {}),
          noiMargin,
        };
      }
    }
  }

  const kpiRow = await fetchWithFallbacks(
    'loan_green_kpis',
    'loan_id,id,borrower_name,borrower,kpis,energy_provider,energyProvider,last_ingested,lastIngested',
    organizationId,
    loanFilterSets
  );
  if (kpiRow) {
    let borrowerKpis = [];
    if (Array.isArray(kpiRow.kpis) && kpiRow.kpis.length) {
      borrowerKpis = kpiRow.kpis.map(normalizeKpiShape).filter(kpi => Object.keys(kpi).length);
    }
    if (borrowerKpis.length) {
      metrics.borrower_kpis = borrowerKpis;
    }
    metrics.marketplace_metrics = {
      ...(metrics.marketplace_metrics || {}),
      sustainabilityProvider: kpiRow.energy_provider ?? kpiRow.energyProvider ?? undefined,
      lastSustainabilitySync: kpiRow.last_ingested ?? kpiRow.lastIngested ?? undefined,
    };
  }

  const assetRow = await fetchWithFallbacks(
    'assets',
    'id,name,occupancy,status,value,occupancy_trend,occupancyTrend',
    null,
    buildAssetFilterSets({ assetId, borrowerName })
  );
  if (assetRow) {
    const occupancyRaw = toNumber(assetRow.occupancy);
    let occupancyRate = occupancyRaw;
    if (occupancyRaw !== null && occupancyRaw <= 1 && occupancyRaw >= 0) {
      occupancyRate = Number((occupancyRaw * 100).toFixed(2));
    }
    if (occupancyRate !== null) {
      metrics.occupancy_rate = occupancyRate;
    }
    metrics.marketplace_metrics = {
      ...(metrics.marketplace_metrics || {}),
      occupancyStatus: assetRow.status ?? undefined,
      occupancyTrend: assetRow.occupancy_trend ?? assetRow.occupancyTrend ?? undefined,
      assetValue: toNumber(assetRow.value) ?? undefined,
      occupancyScore:
        occupancyRate !== null && occupancyRate !== undefined
          ? Number((occupancyRate / 100).toFixed(3))
          : undefined,
    };
  }

  if (metrics.marketplace_metrics) {
    const cleaned = cleanObject(metrics.marketplace_metrics, { dropNull: true });
    metrics.marketplace_metrics = Object.fromEntries(
      Object.entries(cleaned).filter(([, value]) => value !== undefined)
    );
    if (!Object.keys(metrics.marketplace_metrics).length) {
      delete metrics.marketplace_metrics;
    }
  }

  if (metrics.payment_history_summary) {
    if (!Object.keys(metrics.payment_history_summary).length) {
      delete metrics.payment_history_summary;
    }
  }

  return metrics;
}

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
const borrowerKpiSchema = z.object({
  name: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  unit: z.string().optional(),
  target: z.union([z.number(), z.string()]).optional(),
  trend: z.string().optional(),
  delta_bps: z.number().optional()
});
const dscrTrendPointSchema = z.object({ period: z.string(), dscr: z.number() });
const jsonRecordSchema = z.record(z.any());

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
    loan_id: z.string().optional(),
  asset_id: z.string().optional(),
  occupancy_rate: z.number().min(0).max(100).optional(),
  cashflow_summary: jsonRecordSchema.optional(),
  borrower_kpis: z.array(borrowerKpiSchema).optional(),
  marketplace_metrics: jsonRecordSchema.optional(),
  dscr_trend: z.array(dscrTrendPointSchema).optional(),
  payment_history_summary: jsonRecordSchema.optional(),
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
    const occupancy = typeof listing.occupancy_rate === 'number' ? listing.occupancy_rate : null;
  if (filters?.occupancy_min && (occupancy ?? 0) < filters.occupancy_min) return false;
  if (filters?.occupancy_max && (occupancy ?? 100) > filters.occupancy_max) return false;
  const dscrBuffer = listing?.marketplace_metrics?.dscrBuffer;
  if (
    filters?.dscr_buffer_min !== undefined &&
    (typeof dscrBuffer !== 'number' || dscrBuffer < filters.dscr_buffer_min)
  )
    return false;
  if (
    filters?.dscr_buffer_max !== undefined &&
    (typeof dscrBuffer !== 'number' || dscrBuffer > filters.dscr_buffer_max)
  )
    return false;
  const noiMargin = listing?.marketplace_metrics?.noiMargin;
  if (
    filters?.noi_margin_min !== undefined &&
    (typeof noiMargin !== 'number' || noiMargin < filters.noi_margin_min)
  )
    return false;
  if (
    filters?.noi_margin_max !== undefined &&
    (typeof noiMargin !== 'number' || noiMargin > filters.noi_margin_max)
  )
    return false;
  if (Array.isArray(filters?.focus_kpis) && filters.focus_kpis.length) {
    const hasFocusMatch = Array.isArray(listing.borrower_kpis)
      ? listing.borrower_kpis.some(kpi => filters.focus_kpis.includes(kpi.name))
      : false;
    if (!hasFocusMatch) return false;
  }
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
    const metrics = await gatherListingMetrics({
      loan_id: input.loan_id,
      asset_id: input.asset_id,
      borrower_name: input.borrower_name,
      organizationId: orgId
    });
    const insertPayload = {
      ...input,
      compliance_hold: hold,
      organization_id: orgId,
      created_by: userId,
      status: 'listed'
    };
    assignEnriched(insertPayload, metrics);
    const { data, error } = await supabase
      .from('exchange_listings')
     .insert([insertPayload])
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
    dscr_max,
    occupancy_min,
    occupancy_max,
    dscr_buffer_min,
    dscr_buffer_max,
    noi_margin_min,
    noi_margin_max
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
  const occMin = toNumber(occupancy_min);
  const occMax = toNumber(occupancy_max);
  if (occMin !== null) query = query.gte('occupancy_rate', occMin);
  if (occMax !== null) query = query.lte('occupancy_rate', occMax);
  const from = (Number(page) - 1) * Number(pageSize);
  const to = from + Number(pageSize) - 1;
  const { data, error } = await query.range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  let listings = data || [];
  const dscrBufferMin = toNumber(dscr_buffer_min);
  const dscrBufferMax = toNumber(dscr_buffer_max);
  if (dscrBufferMin !== null) {
    listings = listings.filter(item =>
      typeof item?.marketplace_metrics?.dscrBuffer === 'number' &&
      item.marketplace_metrics.dscrBuffer >= dscrBufferMin
    );
  }
  if (dscrBufferMax !== null) {
    listings = listings.filter(item =>
      typeof item?.marketplace_metrics?.dscrBuffer === 'number' &&
      item.marketplace_metrics.dscrBuffer <= dscrBufferMax
    );
  }
  const noiMarginMinVal = toNumber(noi_margin_min);
  const noiMarginMaxVal = toNumber(noi_margin_max);
  if (noiMarginMinVal !== null) {
    listings = listings.filter(item =>
      typeof item?.marketplace_metrics?.noiMargin === 'number' &&
      item.marketplace_metrics.noiMargin >= noiMarginMinVal
    );
  }
  if (noiMarginMaxVal !== null) {
    listings = listings.filter(item =>
      typeof item?.marketplace_metrics?.noiMargin === 'number' &&
      item.marketplace_metrics.noiMargin <= noiMarginMaxVal
    );
  }
  res.json({ listings });
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
    const { refresh_metrics, ...rawBody } = req.body || {};
    const updates = listingUpdateSchema.parse(rawBody);
    const refreshMetrics = refresh_metrics === true || refresh_metrics === 'true';
    const { data: existing, error: existingErr } = await supabase
      .from('exchange_listings')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (existingErr || !existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const merged = { ...existing, ...updates };
    let metricUpdates = {};
    if (refreshMetrics || updates.loan_id || updates.asset_id || updates.borrower_name) {
      metricUpdates = await gatherListingMetrics({
        loan_id: merged.loan_id,
        asset_id: merged.asset_id,
        borrower_name: merged.borrower_name,
        organizationId: existing.organization_id
      });
    }

    const payload = { ...updates };
    assignEnriched(payload, metricUpdates);

    const { data, error } = await supabase
      .from('exchange_listings')
      .update(payload)
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
