const express = require('express');
const router = express.Router();
const { supabase, replica } = require('../db');
const cache = require('../cache');
const { isFeatureEnabled } = require('../featureFlags');
const asyncHandler = require('../lib/asyncHandler');
const { handleMissingSchemaError } = require('../lib/schemaErrors');

const EMPTY_MARKETPLACE_SUMMARY = {
  totals: null,
  highlights: [],
  borrowerKpiLeaders: [],
  updatedAt: null,
};

const EMPTY_OVERVIEW = {
  totals: null,
  riskScore: null,
  collections: {
    monthToDateCollected: 0,
    outstanding: 0,
    delinquentCount: 0,
    promisesToPay: 0,
    lastPaymentAt: null,
  },
};

const FALLBACK_OVERVIEW = {
  totals: {
    totalLoans: 1280,
    delinquencyRate: 0.038,
    avgInterestRate: 0.052,
    outstandingPrincipal: 52_500_000,
  },
  riskScore: 72,
  collections: {
    monthToDateCollected: 1_845_000,
    outstanding: 675_000,
    delinquentCount: 18,
    promisesToPay: 6,
    lastPaymentAt: null,
  },
};

function resolveOrgId(req) {
  const header =
    req.headers['x-organization-id'] || req.headers['X-Organization-Id'] || req.headers['x-org-id'];
  if (header) {
    const raw = Array.isArray(header) ? header[0] : header;
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (typeof req.organizationId === 'number') {
    return req.organizationId;
  }
  if (req.user && typeof req.user.organization_id === 'number') {
    return req.user.organization_id;
  }
  return null;
}

function toNumber(value) {
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(sum, count, precision = 3) {
  if (!count) return null;
  return Number((sum / count).toFixed(precision));
}

async function fetchLoans(orgId) {
  let query = replica
    .from('loans')
    .select('id, amount, outstanding_principal, interest_rate, status, risk_score, days_late');
  if (orgId) {
    query = query.eq('organization_id', orgId);
  }
   const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
}

async function fetchCollections(orgId) {
  let query = replica
    .from('collections')
    .select('amount, status, due_date, updated_at, paid_at, promise_date');
  if (orgId) {
    query = query.eq('organization_id', orgId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// GET /api/dashboard-layout?key=home
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;                        // make sure you have an auth middleware that sets req.user
  const key    = req.query.key || 'home';

  const { data, error } = await supabase
    .from('user_dashboard_layout')
    .select('layout_json')
    .eq('user_id', userId)
    .eq('layout_key', key)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Dashboard GET error:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ layout: data?.layout_json || [] });
}));

// POST /api/dashboard-layout
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { key, layout } = req.body;

  const { data, error } = await supabase
    .from('user_dashboard_layout')
    .upsert({
      user_id:     userId,
      layout_key:  key,
      layout_json: layout
    })
    .select()
    .single();

  if (error) {
    console.error('Dashboard POST error:', error);
    return res.status(500).json({ error: error.message });
 }

  res.json(data);
}));

router.get('/summary', asyncHandler(async (_req, res) => {
  res.json({
    roleView: 'lender',
    workQueueCounts: { payments: 0, inspections: 0, compliance: 0 },
    criticalAlerts: [],
    nextDeadlines: [],
    todaysActivity: [],
    aiBrief: [],
    quickActions: [
      { id: 'run_payment_review', label: 'Run Payment Review', href: '/servicing/payments' },
      { id: 'order_inspection', label: 'Order Inspection', href: '/servicing/inspections' },
      { id: 'request_rent_roll', label: 'Request Rent Roll', href: '/servicing/borrower-financials' },
      { id: 'create_compliance_review', label: 'Create Compliance Review', href: '/governance/compliance' }
    ]
  });
}));

router.get('/overview', asyncHandler(async (req, res) => {
  const orgId = resolveOrgId(req);
  const cacheKey = `dashboard:overview:${orgId || 'all'}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);
  const overview = JSON.parse(JSON.stringify(FALLBACK_OVERVIEW));

  try {
    const loans = await fetchLoans(orgId);
    if (loans.length > 0) {
      const outstandingPrincipal = loans.reduce(
        (sum, loan) => sum + toNumber(loan.outstanding_principal ?? loan.amount),
        0
      );
      const delinquentLoans = loans.filter((loan) => {
        const status = String(loan.status || '').toLowerCase();
        const daysLate = toNumber(loan.days_late);
        return daysLate >= 30 || status.includes('delin');
      }).length;
      const avgInterestRate = loans.reduce((sum, loan) => sum + toNumber(loan.interest_rate), 0) /
        (loans.length || 1);
      const riskScores = loans
        .map((loan) => toNumber(loan.risk_score))
        .filter((score) => Number.isFinite(score) && score > 0);

      overview.totals = {
        totalLoans: loans.length,
        delinquencyRate: loans.length ? delinquentLoans / loans.length : overview.totals.delinquencyRate,
        avgInterestRate: loans.length ? avgInterestRate / 100 : overview.totals.avgInterestRate,
        outstandingPrincipal,
      };
      overview.riskScore = riskScores.length
        ? Math.round(riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length)
        : overview.riskScore;
    }
  } catch (error) {
       if (handleMissingSchemaError(res, error, 'Dashboard overview', { overview: EMPTY_OVERVIEW })) {
      return;
    }
    console.error('Dashboard overview loan query failed', error);
  }

  try {
    const rows = await fetchCollections(orgId);
    if (rows.length > 0) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      let monthToDateCollected = 0;
      let outstanding = 0;
      let delinquentCount = 0;
      let promisesToPay = 0;
      let lastPaymentAt = null;

      for (const row of rows) {
        const amount = toNumber(row.amount);
        const status = String(row.status || '').toLowerCase();
        const dueDate = row.due_date ? new Date(row.due_date) : null;
        const paidAt = row.paid_at || row.updated_at || null;

        if (status === 'paid') {
          if (dueDate && dueDate >= startOfMonth && dueDate <= now) {
            monthToDateCollected += amount;
          }
          if (paidAt) {
            const paidDate = new Date(paidAt);
            if (!Number.isNaN(paidDate.getTime())) {
              if (!lastPaymentAt || paidDate > lastPaymentAt) {
                lastPaymentAt = paidDate;
              }
            }
          }
        } else {
          outstanding += amount;
          if (status.includes('promise')) {
            promisesToPay += 1;
          }
          if (dueDate && dueDate < now) {
            delinquentCount += 1;
          }
        }
      }

      overview.collections = {
        monthToDateCollected,
        outstanding,
        delinquentCount,
        promisesToPay,
        lastPaymentAt: lastPaymentAt ? lastPaymentAt.toISOString() : overview.collections.lastPaymentAt,
      };
    }
  } catch (error) {
        if (handleMissingSchemaError(res, error, 'Dashboard overview', { overview: EMPTY_OVERVIEW })) {
      return;
    }
    console.error('Dashboard overview collections query failed', error);
  }

  const payload = { overview };
  await cache.set(cacheKey, payload, 120);
  res.json(payload);
}));

router.get('/marketplace', asyncHandler(async (req, res) => {
  if (!isFeatureEnabled('trading')) {
    return res.status(404).json({ error: 'Trading module is disabled' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Marketplace unavailable: missing Supabase configuration');
    return res
      .status(503)
      .json({ error: 'Trading module is disabled', summary: EMPTY_MARKETPLACE_SUMMARY });
  }

  const orgId = resolveOrgId(req);
  try {
    const baseFields = [
      'id',
      'title',
      'par_amount',
      'occupancy_rate',
      'dscr',
      'marketplace_metrics',
      'borrower_kpis',
      'sector',
      'geography',
      'updated_at',
    ];
    let query = supabase
      .from('exchange_listings')
      .select(baseFields.join(','))
      .eq('compliance_hold', false)
      .order('updated_at', { ascending: false });

    if (orgId) {
      query = query.eq('organization_id', orgId);
    }

    const { data, error } = await query.limit(100);
    if (error) {
      throw error;
    }

    const listings = Array.isArray(data) ? data : [];
    let occupancySum = 0;
    let occupancyCount = 0;
    let dscrSum = 0;
    let dscrCount = 0;
    let dscrBufferSum = 0;
    let dscrBufferCount = 0;
    let noiMarginSum = 0;
    let noiMarginCount = 0;
    let parAmountSum = 0;

    const highlights = [];
    const kpiCounter = new Map();
    let latestTimestamp = 0;

    for (const listing of listings) {
      const occupancyRate = toNullableNumber(listing.occupancy_rate);
      if (occupancyRate !== null) {
        occupancySum += occupancyRate;
        occupancyCount += 1;
      }

      const dscr = toNullableNumber(listing.dscr);
      if (dscr !== null) {
        dscrSum += dscr;
        dscrCount += 1;
      }

      const metrics = listing.marketplace_metrics || {};
      const dscrBuffer = toNullableNumber(metrics.dscrBuffer ?? metrics.dscr_buffer);
      if (dscrBuffer !== null) {
        dscrBufferSum += dscrBuffer;
        dscrBufferCount += 1;
      }

      const noiMargin = toNullableNumber(metrics.noiMargin ?? metrics.noi_margin);
      if (noiMargin !== null) {
        noiMarginSum += noiMargin;
        noiMarginCount += 1;
      }

      const parAmount = toNullableNumber(listing.par_amount);
      if (parAmount !== null) {
        parAmountSum += parAmount;
      }

      const highlight = {
        id: listing.id,
        title: listing.title,
        sector: listing.sector ?? null,
        geography: listing.geography ?? null,
        parAmount: parAmount,
        occupancyRate,
        dscr,
        dscrBuffer,
        noiMargin,
      };
      highlights.push(highlight);

      if (Array.isArray(listing.borrower_kpis)) {
        for (const kpi of listing.borrower_kpis) {
          if (!kpi || typeof kpi !== 'object') continue;
          const label = typeof kpi.name === 'string' && kpi.name.trim() ? kpi.name.trim() : 'KPI';
          kpiCounter.set(label, (kpiCounter.get(label) || 0) + 1);
        }
      }

      if (listing.updated_at) {
        const ts = new Date(listing.updated_at).getTime();
        if (!Number.isNaN(ts)) {
          latestTimestamp = Math.max(latestTimestamp, ts);
        }
      }
    }

    highlights.sort((a, b) => {
      const scoreA = (a.dscrBuffer ?? 0) * 2 + (a.noiMargin ?? 0) + ((a.occupancyRate ?? 0) / 100);
      const scoreB = (b.dscrBuffer ?? 0) * 2 + (b.noiMargin ?? 0) + ((b.occupancyRate ?? 0) / 100);
      return scoreB - scoreA;
    });

    const borrowerKpiLeaders = Array.from(kpiCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({
      totals: {
        activeListings: listings.length,
        avgOccupancyRate: average(occupancySum, occupancyCount, 2),
        avgDscr: average(dscrSum, dscrCount, 3),
        avgDscrBuffer: average(dscrBufferSum, dscrBufferCount, 3),
        avgNoiMargin: average(noiMarginSum, noiMarginCount, 3),
        totalParAmount: parAmountSum ? Number(parAmountSum.toFixed(2)) : null,
      },
      highlights: highlights.slice(0, 5),
      borrowerKpiLeaders,
      updatedAt: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
    });
  } catch (error) {
    if (handleMissingSchemaError(res, error, 'Marketplace metrics', EMPTY_MARKETPLACE_SUMMARY)) {
      return;
    }

    const authError = error?.status === 401 || error?.status === 403;
    if (authError) {
      console.warn('Marketplace unavailable: Supabase credentials rejected');
      return res
        .status(400)
        .json({ error: 'Trading module is disabled', summary: EMPTY_MARKETPLACE_SUMMARY });
    }

    console.error('Dashboard marketplace metrics error', error);
    res.status(500).json({ error: 'Failed to load marketplace metrics' });
  }
}));

module.exports = router;
