const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { triggerWebhooks } = require('../webhooks');
const authenticate = require('../middlewares/authenticate');

const router = express.Router();

router.use(authenticate);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FALLBACK_DSCR_LOANS = [
  {
    id: 'LN-2045',
    borrower: 'Redwood Capital Partners',
    principal: 12000000,
    dscr: 1.32,
    targetDscr: 1.25,
    baseCoupon: 6.1,
    rateFloor: 5.2,
    rateCap: 7.4,
    rateSensitivity: 1.6,
    interestAccruedMonth: 61250,
    lastRecalculated: '2024-09-30T09:00:00Z',
    nextReset: '2024-10-31T09:00:00Z',
    automationNotes:
      'Coupon stepped down 10 bps after DSCR beat target for two consecutive periods.',
  },
  {
    id: 'LN-2110',
    borrower: 'Hudson River Holdings',
    principal: 8800000,
    dscr: 1.11,
    targetDscr: 1.2,
    baseCoupon: 6.85,
    rateFloor: 6.35,
    rateCap: 8,
    rateSensitivity: 1.8,
    interestAccruedMonth: 53420,
    lastRecalculated: '2024-09-30T08:30:00Z',
    nextReset: '2024-10-31T08:30:00Z',
    automationNotes: 'Monitoring for step-up trigger; assigned to workout analyst for trend review.',
  },
  {
    id: 'LN-1988',
    borrower: 'Cedar Grove Apartments',
    principal: 15300000,
    dscr: 1.47,
    targetDscr: 1.25,
    baseCoupon: 5.95,
    rateFloor: 5.35,
    rateCap: 7.2,
    rateSensitivity: 1.4,
    interestAccruedMonth: 78110,
    lastRecalculated: '2024-09-30T07:45:00Z',
    nextReset: '2024-10-31T07:45:00Z',
    automationNotes: 'Eligible for green incentive stack; auto-applied blended step-down.',
  },
];

const FALLBACK_PERFORMANCE_LOANS = [
  {
    id: 'LN-2045',
    borrower: 'Redwood Capital Partners',
    profitSharePct: 0.18,
    noiTarget: 850000,
    actualNoi: 910000,
    prefReturn: 0.07,
    lenderSplit: 0.8,
    sponsorSplit: 0.2,
    reserveBalance: 135000,
    lastWaterfall: '2024-09-25T18:00:00Z',
  },
  {
    id: 'LN-2110',
    borrower: 'Hudson River Holdings',
    profitSharePct: 0.22,
    noiTarget: 620000,
    actualNoi: 574000,
    prefReturn: 0.065,
    lenderSplit: 0.78,
    sponsorSplit: 0.22,
    reserveBalance: 91000,
    lastWaterfall: '2024-09-26T17:00:00Z',
  },
  {
    id: 'LN-1988',
    borrower: 'Cedar Grove Apartments',
    profitSharePct: 0.2,
    noiTarget: 1320000,
    actualNoi: 1395000,
    prefReturn: 0.072,
    lenderSplit: 0.82,
    sponsorSplit: 0.18,
    reserveBalance: 210000,
    lastWaterfall: '2024-09-24T17:30:00Z',
  },
];

const FALLBACK_GREEN_LOANS = [
  {
    id: 'LN-2045',
    borrower: 'Redwood Capital Partners',
    baseCoupon: 5.85,
    rateFloor: 5.25,
    rateCap: 7,
    lastIngested: '2024-09-28T13:00:00Z',
    energyProvider: 'Aurora Energy Cloud',
    kpis: [
      {
        name: 'Energy Intensity',
        unit: 'kWh/sf',
        baseline: 22,
        current: 18,
        target: 17,
        direction: 'decrease',
        rateDeltaBps: -12,
        source: 'BMS telemetry',
      },
      {
        name: 'Water Usage',
        unit: 'gal/unit',
        baseline: 3200,
        current: 2950,
        target: 3000,
        direction: 'decrease',
        rateDeltaBps: -6,
        source: 'Utility API',
      },
      {
        name: 'Carbon Intensity',
        unit: 'kgCO₂e/sf',
        baseline: 18,
        current: 16.5,
        target: 15,
        direction: 'decrease',
        rateDeltaBps: -8,
        source: 'Energy Star Portfolio Manager',
      },
    ],
  },
  {
    id: 'LN-2110',
    borrower: 'Hudson River Holdings',
    baseCoupon: 6.45,
    rateFloor: 6,
    rateCap: 7.6,
    lastIngested: '2024-09-28T12:30:00Z',
    energyProvider: 'GridSync Monitoring',
    kpis: [
      {
        name: 'Solar Yield',
        unit: 'MWh',
        baseline: 0,
        current: 145,
        target: 160,
        direction: 'increase',
        rateDeltaBps: -10,
        source: 'PV monitoring',
      },
      {
        name: 'GHG Emissions',
        unit: 'tCO₂e',
        baseline: 420,
        current: 415,
        target: 380,
        direction: 'decrease',
        rateDeltaBps: -5,
        source: 'Utility API',
      },
    ],
  },
  {
    id: 'LN-1988',
    borrower: 'Cedar Grove Apartments',
    baseCoupon: 5.65,
    rateFloor: 5.1,
    rateCap: 6.9,
    lastIngested: '2024-09-28T11:45:00Z',
    energyProvider: 'Evergreen IoT',
    kpis: [
      {
        name: 'Energy Intensity',
        unit: 'kWh/sf',
        baseline: 24,
        current: 19,
        target: 18,
        direction: 'decrease',
        rateDeltaBps: -10,
        source: 'BMS telemetry',
      },
      {
        name: 'LEED Recertification',
        unit: 'score',
        baseline: 62,
        current: 68,
        target: 65,
        direction: 'increase',
        rateDeltaBps: -7,
        source: 'Certification upload',
      },
    ],
  },
];

const FALLBACK_DSCR_JOB = {
  lastRun: FALLBACK_DSCR_LOANS[0].lastRecalculated,
  nextRun: FALLBACK_DSCR_LOANS[0].nextReset,
  status: 'Simulated',
};

function cloneFallbackDscrLoans() {
  return FALLBACK_DSCR_LOANS.map(loan => ({ ...loan }));
}

function cloneFallbackPerformanceLoans() {
  return FALLBACK_PERFORMANCE_LOANS.map(loan => ({ ...loan }));
}

function cloneFallbackGreenLoans() {
  return FALLBACK_GREEN_LOANS.map(loan => ({
    ...loan,
    kpis: loan.kpis.map(kpi => ({ ...kpi })),
  }));
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeDscrLoans(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map((row, index) => {
    const fallback = FALLBACK_DSCR_LOANS[index % FALLBACK_DSCR_LOANS.length];
    return {
      id: String(row.loan_id ?? row.id ?? row.loanId ?? fallback.id),
      borrower: row.borrower_name ?? row.borrower ?? fallback.borrower,
      principal: toNumber(row.principal ?? row.balance ?? row.outstanding_principal, fallback.principal),
      dscr: toNumber(row.dscr ?? row.current_dscr ?? row.dscr_ratio, fallback.dscr),
      targetDscr: toNumber(row.target_dscr ?? row.targetDscr, fallback.targetDscr),
      baseCoupon: toNumber(row.base_coupon ?? row.baseCoupon ?? row.base_rate, fallback.baseCoupon),
      rateFloor: toNumber(row.rate_floor ?? row.rateFloor ?? row.floor_rate, fallback.rateFloor),
      rateCap: toNumber(row.rate_cap ?? row.rateCap ?? row.cap_rate, fallback.rateCap),
      rateSensitivity: toNumber(row.rate_sensitivity ?? row.rateSensitivity ?? row.coupon_sensitivity, fallback.rateSensitivity),
      interestAccruedMonth: toNumber(
        row.interest_accrued_month ?? row.monthly_interest_accrued ?? row.interestAccruedMonth,
        fallback.interestAccruedMonth
      ),
      lastRecalculated: normalizeDate(row.last_recalculated ?? row.lastRecalculated) ?? fallback.lastRecalculated,
      nextReset: normalizeDate(row.next_reset ?? row.nextReset ?? row.next_recalculation) ?? fallback.nextReset,
      automationNotes: row.automation_notes ?? row.automationNotes ?? fallback.automationNotes,
    };
  });
}

function normalizePerformanceLoans(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map((row, index) => {
    const fallback = FALLBACK_PERFORMANCE_LOANS[index % FALLBACK_PERFORMANCE_LOANS.length];
    return {
      id: String(row.loan_id ?? row.id ?? row.loanId ?? fallback.id),
      borrower: row.borrower_name ?? row.borrower ?? fallback.borrower,
      profitSharePct: toNumber(row.profit_share_pct ?? row.profitSharePct ?? row.profit_share, fallback.profitSharePct),
      noiTarget: toNumber(row.noi_target ?? row.noiTarget ?? row.target_noi, fallback.noiTarget),
      actualNoi: toNumber(row.actual_noi ?? row.actualNoi ?? row.current_noi, fallback.actualNoi),
      prefReturn: toNumber(row.pref_return ?? row.prefReturn ?? row.preferred_return, fallback.prefReturn),
      lenderSplit: toNumber(row.lender_split ?? row.lenderSplit ?? row.lender_share, fallback.lenderSplit),
      sponsorSplit: toNumber(row.sponsor_split ?? row.sponsorSplit ?? row.sponsor_share, fallback.sponsorSplit),
      reserveBalance: toNumber(row.reserve_balance ?? row.reserveBalance ?? row.reserves, fallback.reserveBalance),
      lastWaterfall: normalizeDate(row.last_waterfall ?? row.lastWaterfall ?? row.last_run) ?? fallback.lastWaterfall,
    };
  });
}

function normalizeKpi(entry, fallback) {
  return {
    name: entry.name ?? entry.kpi_name ?? fallback.name,
    unit: entry.unit ?? entry.kpi_unit ?? fallback.unit,
    baseline: toNumber(entry.baseline ?? entry.baseline_value, fallback.baseline),
    current: toNumber(entry.current ?? entry.current_value, fallback.current),
    target: toNumber(entry.target ?? entry.target_value, fallback.target),
    direction: entry.direction ?? entry.directionality ?? fallback.direction,
    rateDeltaBps: toNumber(entry.rate_delta_bps ?? entry.rateDeltaBps ?? entry.rate_delta, fallback.rateDeltaBps),
    source: entry.source ?? entry.data_source ?? fallback.source,
  };
}

function normalizeGreenLoans(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const rowsWithArrays = rows.filter(row => Array.isArray(row.kpis) && row.kpis.length);
  if (rowsWithArrays.length === rows.length && rowsWithArrays.length > 0) {
    return rowsWithArrays.map((row, index) => {
      const fallback = FALLBACK_GREEN_LOANS[index % FALLBACK_GREEN_LOANS.length];
      const rawKpis = Array.isArray(row.kpis) && row.kpis.length ? row.kpis : fallback.kpis;
      return {
        id: String(row.loan_id ?? row.id ?? row.loanId ?? fallback.id),
        borrower: row.borrower_name ?? row.borrower ?? fallback.borrower,
        baseCoupon: toNumber(row.base_coupon ?? row.baseCoupon ?? row.base_rate, fallback.baseCoupon),
        rateFloor: toNumber(row.rate_floor ?? row.rateFloor ?? row.floor_rate, fallback.rateFloor),
        rateCap: toNumber(row.rate_cap ?? row.rateCap ?? row.cap_rate, fallback.rateCap),
        lastIngested: normalizeDate(row.last_ingested ?? row.lastIngested ?? row.last_sync) ?? fallback.lastIngested,
        energyProvider: row.energy_provider ?? row.energyProvider ?? fallback.energyProvider,
        kpis: rawKpis.map((kpi, kIndex) =>
          normalizeKpi(kpi, fallback.kpis[kIndex % fallback.kpis.length])
        ),
      };
    });
  }

  const grouped = new Map();
  rows.forEach(row => {
    const identifier = String(row.loan_id ?? row.id ?? row.loanId ?? row.reference ?? '');
    const key = identifier || `loan-${grouped.size + 1}`;
    if (!grouped.has(key)) {
      grouped.set(key, { base: row, entries: [] });
    }
    grouped.get(key).entries.push(row);
  });

  return Array.from(grouped.values()).map((group, index) => {
    const fallback = FALLBACK_GREEN_LOANS[index % FALLBACK_GREEN_LOANS.length];
    const base = group.base;
    return {
      id: String(base.loan_id ?? base.id ?? base.loanId ?? fallback.id),
      borrower: base.borrower_name ?? base.borrower ?? fallback.borrower,
      baseCoupon: toNumber(base.base_coupon ?? base.baseCoupon ?? base.base_rate, fallback.baseCoupon),
      rateFloor: toNumber(base.rate_floor ?? base.rateFloor ?? base.floor_rate, fallback.rateFloor),
      rateCap: toNumber(base.rate_cap ?? base.rateCap ?? base.cap_rate, fallback.rateCap),
      lastIngested: normalizeDate(base.last_ingested ?? base.lastIngested ?? base.last_sync) ?? fallback.lastIngested,
      energyProvider: base.energy_provider ?? base.energyProvider ?? fallback.energyProvider,
      kpis: group.entries.map((entry, kIndex) =>
        normalizeKpi(entry, fallback.kpis[kIndex % fallback.kpis.length])
      ),
    };
  });
}

function normalizeDscrJob(row) {
  if (!row) return { ...FALLBACK_DSCR_JOB };
  return {
    lastRun: normalizeDate(row.last_run ?? row.lastRun) ?? FALLBACK_DSCR_JOB.lastRun,
    nextRun: normalizeDate(row.next_run ?? row.nextRun) ?? FALLBACK_DSCR_JOB.nextRun,
    status: row.status ?? FALLBACK_DSCR_JOB.status,
  };
}

function normalizeGreenFeed(feed, loans) {
  const fallbackLoan = loans[0] ?? FALLBACK_GREEN_LOANS[0];
  if (!feed) {
    return {
      provider: fallbackLoan.energyProvider,
      lastSync: fallbackLoan.lastIngested,
      status: 'Simulated',
    };
  }
  return {
    provider: feed.provider ?? feed.name ?? fallbackLoan.energyProvider,
    lastSync: normalizeDate(feed.last_sync ?? feed.lastSync) ?? fallbackLoan.lastIngested,
    status: feed.status ?? 'Streaming',
  };
}

function ensureOrganization(req, res) {
  if (!req.organizationId) {
    res.status(403).json({ message: 'Organization context required' });
    return false;
  }
  return true;
}

async function getLoanForOrg(loanId, organizationId, columns, res) {
  const selectColumns = columns || '*';
  const { data, error } = await supabase
    .from('loans')
    .select(selectColumns)
    .eq('id', loanId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ message: 'Failed to fetch loan' });
    return null;
  }

  if (!data) {
    res.status(404).json({ message: 'Loan not found' });
    return null;
  }

  return data;
}

function calcNextInsuranceDue(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const due = new Date(now.getFullYear(), start.getMonth(), start.getDate());
  if (due < now) due.setFullYear(due.getFullYear() + 1);
  return due.toISOString().slice(0, 10);
}

function calcNextTaxDue(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const due = new Date(now.getFullYear(), 11, start.getDate());
  if (due < now) due.setFullYear(due.getFullYear() + 1);
  return due.toISOString().slice(0, 10);
}

router.post('/loans', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { borrower_name, amount, interest_rate, term_months, start_date } = req.body;
  if (!borrower_name || !amount || !interest_rate || !term_months || !start_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('loans')
    .insert([
      {
        borrower_name,
        amount,
        interest_rate,
        term_months,
        start_date,
        organization_id: req.organizationId,
      },
    ])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create loan' });
  await triggerWebhooks('loan.created', data);
  res.status(201).json({ loan: data });
});

router.get('/loans', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { status, borrower, from, to, minRisk, maxRisk, search } = req.query;
  try {
    let q = supabase
      .from('loans')
      .select('id, borrower_name, amount, interest_rate, term_months, start_date, status, risk_score, created_at')
      .order('created_at', { ascending: false });
    q = q.eq('organization_id', req.organizationId);
    if (status) q = q.eq('status', status);
    if (borrower) q = q.ilike('borrower_name', `%${borrower}%`);
    if (from) q = q.gte('start_date', from);
    if (to) q = q.lte('start_date', to);
    if (minRisk) q = q.gte('risk_score', parseFloat(minRisk));
    if (maxRisk) q = q.lte('risk_score', parseFloat(maxRisk));
    if (search) q = q.textSearch('borrower_name', search, { type: 'plain' });
    const { data, error } = await q;
    if (!error) {
      return res.json({ loans: data });
    }
    if (error.code === '42703' && String(error.message).includes('risk_score')) {
      let fallbackQuery = supabase
        .from('loans')
        .select('id, borrower_name, amount, interest_rate, term_months, start_date, status, created_at')
        .order('created_at', { ascending: false });
      fallbackQuery = fallbackQuery.eq('organization_id', req.organizationId);
      if (status) fallbackQuery = fallbackQuery.eq('status', status);
      if (borrower) fallbackQuery = fallbackQuery.ilike('borrower_name', `%${borrower}%`);
      if (from) fallbackQuery = fallbackQuery.gte('start_date', from);
      if (to) fallbackQuery = fallbackQuery.lte('start_date', to);
      if (search) fallbackQuery = fallbackQuery.textSearch('borrower_name', search, { type: 'plain' });
      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) throw fallbackError;
      return res.json({
        loans: (fallbackData || []).map((row) => ({ ...row, risk_score: null })),
      });
    }
    throw error;
  } catch (err) {
    console.error('Loan list error:', err);
    res.status(500).json({ message: 'Failed to fetch loans' });
  }
});

router.get('/loans/export', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  req.headers.accept = 'text/csv';
  const { status, borrower } = req.query;
  let q = supabase.from('loans').select('id, borrower_name, amount, status, created_at');
  q = q.eq('organization_id', req.organizationId);
  if (status) q = q.eq('status', status);
  if (borrower) q = q.ilike('borrower_name', `%${borrower}%`);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to export loans' });
  const header = 'id,borrower_name,amount,status,created_at';
  const rows = data.map(l => [l.id, l.borrower_name, l.amount, l.status, l.created_at].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.send([header, ...rows].join('\n'));
});

router.get('/my-loans', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { user_id } = req.query || {};
  if (!user_id) return res.status(400).json({ message: 'Missing user_id' });
  const { data, error } = await supabase
    .from('loans')
    .select('id, amount, status, start_date')
    .eq('borrower_user_id', user_id)
    .eq('organization_id', req.organizationId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch loans' });
  res.json({ loans: data });
});

router.get('/my-applications', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { email, user_id } = req.query || {};
  if (!email && !user_id) return res.status(400).json({ message: 'Missing email or user_id' });
  let q = supabase.from('loan_applications').select('id, amount, credit_score, kyc_passed, submitted_at');
  q = q.eq('organization_id', req.organizationId);
  if (user_id) q = q.eq('user_id', user_id);
  else q = q.eq('email', email);
  const { data, error } = await q.order('submitted_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch applications' });
  res.json({ applications: data });
});

router.get('/loans/dscr-metrics', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const organizationId = req.organizationId;

  let dscrRows = [];
  try {
    let query = supabase.from('loan_dscr_metrics').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    dscrRows = Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('loan_dscr_metrics unavailable, using fallback', error?.message || error);
    dscrRows = [];
  }

  let jobRow = null;
  try {
    let jobQuery = supabase
      .from('loan_dscr_jobs')
      .select('last_run, next_run, status');
    if (organizationId) {
      jobQuery = jobQuery.eq('organization_id', organizationId);
    }
    jobQuery = jobQuery.order('last_run', { ascending: false }).limit(1);
    const { data, error } = await jobQuery.maybeSingle();
    if (error) throw error;
    jobRow = data || null;
  } catch (error) {
    console.warn('loan_dscr_jobs unavailable, using fallback job data', error?.message || error);
    jobRow = null;
  }

  const normalizedLoans = normalizeDscrLoans(dscrRows);
  const loans = normalizedLoans.length ? normalizedLoans : cloneFallbackDscrLoans();
  const job = normalizeDscrJob(jobRow);

  res.json({
    loans,
    job,
    lastRun: job.lastRun,
    nextRun: job.nextRun,
  });
});

router.get('/loans/performance-fees', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const organizationId = req.organizationId;

  let rows = [];
  try {
    let query = supabase.from('loan_performance_fees').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    rows = Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('loan_performance_fees unavailable, using fallback', error?.message || error);
    rows = [];
  }

  const normalized = normalizePerformanceLoans(rows);
  const loans = normalized.length ? normalized : cloneFallbackPerformanceLoans();

  res.json({ loans });
});

router.get('/loans/green-kpis', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const organizationId = req.organizationId;

  let rows = [];
  try {
    let query = supabase.from('loan_green_kpis').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    rows = Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('loan_green_kpis unavailable, using fallback', error?.message || error);
    rows = [];
  }

  const normalizedLoans = normalizeGreenLoans(rows);
  const loans = normalizedLoans.length ? normalizedLoans : cloneFallbackGreenLoans();

  let feedRow = null;
  try {
    let feedQuery = supabase
      .from('loan_green_feed_status')
      .select('provider, last_sync, status');
    if (organizationId) {
      feedQuery = feedQuery.eq('organization_id', organizationId);
    }
    feedQuery = feedQuery.order('last_sync', { ascending: false }).limit(1);
    const { data, error } = await feedQuery.maybeSingle();
    if (error) throw error;
    feedRow = data || null;
  } catch (error) {
    console.warn('loan_green_feed_status unavailable, using fallback feed', error?.message || error);
    feedRow = null;
  }

  const feed = normalizeGreenFeed(feedRow, loans);

  res.json({ loans, feed });
});

router.post('/loans/batch-update', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { ids, status } = req.body || {};
  if (!Array.isArray(ids) || !ids.length || !status) {
    return res.status(400).json({ message: 'Missing ids or status' });
  }
  const { data, error } = await supabase
    .from('loans')
    .update({ status })
    .in('id', ids)
    .eq('organization_id', req.organizationId)
    .select('id');
  if (!error && (!data || !data.length)) {
    return res.status(404).json({ message: 'No loans updated' });
  }
  if (error) return res.status(500).json({ message: 'Failed to update loans' });
  res.json({ message: 'Updated' });
});

router.put('/loans/:loanId', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const updates = req.body || {};
  const sanitizedUpdates = { ...updates };
  delete sanitizedUpdates.organization_id;
  const { data, error } = await supabase
    .from('loans')
    .update(sanitizedUpdates)
    .eq('id', loanId)
    .eq('organization_id', req.organizationId)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to update loan' });
  if (!data) return res.status(404).json({ message: 'Loan not found' });
  if (updates.status === 'approved') {
    await triggerWebhooks('loan.approved', data);
  }
  res.json({ loan: data });
});

router.delete('/loans/:loanId', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { data, error } = await supabase
    .from('loans')
    .delete()
    .eq('id', req.params.loanId)
    .eq('organization_id', req.organizationId)
    .select('id')
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to delete loan' });
  if (!data) return res.status(404).json({ message: 'Loan not found' });
  res.json({ message: 'Deleted' });
});

router.post('/loans/:loanId/generate-schedule', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
   const loan = await getLoanForOrg(
    loanId,
    req.organizationId,
    'amount, interest_rate, term_months, start_date',
    res
  );
  if (!loan) return;
  
  const { data: existingSchedule, error: existingErr } = await supabase
    .from('amortization_schedules')
    .select('*')
    .eq('loan_id', loanId)
    .order('due_date', { ascending: true });

  if (existingErr) {
    return res.status(500).json({ message: 'Failed to generate schedule' });
  }

  if (Array.isArray(existingSchedule) && existingSchedule.length > 0) {
    return res.json({ schedule: existingSchedule });
  }

  const P = parseFloat(loan.amount);
  const r = parseFloat(loan.interest_rate) / 100 / 12;
  const n = parseInt(loan.term_months, 10);
 
  if (!Number.isFinite(P) || !Number.isFinite(r) || !Number.isFinite(n) || n <= 0) {
    return res.status(400).json({ message: 'Invalid loan terms' });
  }

  const payment =
    r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));

  if (!Number.isFinite(payment)) {
    return res.status(400).json({ message: 'Invalid loan terms' });
  }

  const inserts = [];
  let balance = P;
  let date = new Date(loan.start_date);
  
  for (let i = 1; i <= n; i++) {
    const interestDue = r === 0 ? 0 : balance * r;
    let principalDue = payment - interestDue;
    balance -= principalDue;
        if (i === n) {
      principalDue += balance;
      balance = 0;
    }
    inserts.push({
      loan_id: parseInt(loanId, 10),
      due_date: date.toISOString().slice(0, 10),
      principal_due: parseFloat(principalDue.toFixed(2)),
      interest_due: parseFloat(interestDue.toFixed(2)),
      balance_after: parseFloat(Math.max(balance, 0).toFixed(2)),
    });
    date.setMonth(date.getMonth() + 1);
  }
  
  const { data: scheduleData, error: insertErr } = await supabase
    .from('amortization_schedules')
    .insert(inserts)
    .select();

  if (insertErr) {
    return res.status(500).json({ message: 'Failed to generate schedule' });
  }

  res.json({ schedule: scheduleData });
});

router.get('/loans/:loanId/schedule', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const { data, error } = await supabase
    .from('amortization_schedules')
    .select('*')
    .eq('loan_id', loanId)
    .order('due_date', { ascending: true });
  if (error) return res.status(500).json({ message: 'Failed to fetch schedule' });
  res.json({ schedule: data });
});

router.post('/loans/:loanId/payments', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const { amount, date } = req.body;
  if (!amount || !date) return res.status(400).json({ message: 'Missing amount or date' });
  const loan = await getLoanForOrg(loanId, req.organizationId, 'amount, interest_rate', res);
  if (!loan) return;
  const { data: lastPayment } = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevBalance = lastPayment ? parseFloat(lastPayment.remaining_balance) : null;
  let balance = prevBalance !== null ? prevBalance : parseFloat(loan.amount);
  const r = parseFloat(loan.interest_rate) / 100 / 12;
  const interest = balance * r;
  const principal = Math.max(0, amount - interest);
  const remaining = balance - principal;
  const { data: paymentData, error: paymentErr } = await supabase
    .from('payments')
    .insert([
      {
        loan_id: parseInt(loanId, 10),
        date,
        amount,
        applied_principal: principal,
        applied_interest: interest,
        remaining_balance: remaining,
        organization_id: req.organizationId,
      },
    ])
    .select()
    .single();
  await triggerWebhooks('payment.created', paymentData);
  if (paymentErr) return res.status(500).json({ message: 'Failed to record payment' });
  res.status(201).json({ payment: paymentData });
});

router.get('/loans/:loanId/payments', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .order('date', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch payments' });
  res.json({ payments: data });
});

router.get('/loans/:loanId/balance', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const loan = await getLoanForOrg(loanId, req.organizationId, 'amount', res);
  if (!loan) return;
  const { data: last, error } = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to fetch balance' });
  if (last) return res.json({ balance: last.remaining_balance });
  res.json({ balance: loan.amount });
});

router.post('/loans/:loanId/payoff', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { payoff_date } = req.body || {};
  if (!payoff_date) return res.status(400).json({ message: 'Missing payoff_date' });
  const { loanId } = req.params;
  const loan = await getLoanForOrg(loanId, req.organizationId, 'interest_rate', res);
  if (!loan) return;
  const balRes = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (balRes.error) return res.status(500).json({ message: 'Failed to fetch balance' });
  const balance = balRes.data ? parseFloat(balRes.data.remaining_balance) : 0;
  const rate = parseFloat(loan.interest_rate) / 100 / 365;
  const days = Math.max(0, (new Date(payoff_date) - new Date()) / (1000 * 60 * 60 * 24));
  const payoff = balance + balance * rate * days;
  res.json({ payoff });
});

router.post('/loans/:loanId/defer', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const { months } = req.body || {};
  const extra = parseInt(months, 10);
  if (isNaN(extra) || extra <= 0) {
    return res.status(400).json({ message: 'Missing or invalid months' });
  }
  const loan = await getLoanForOrg(loanId, req.organizationId, 'term_months', res);
  if (!loan) return;
  const newTerm = parseInt(loan.term_months, 10) + extra;
  const { data: updated, error: updateErr } = await supabase
    .from('loans')
    .update({ term_months: newTerm })
    .eq('id', loanId)
    .eq('organization_id', req.organizationId)
    .select()
    .maybeSingle();
  if (updateErr) {
    return res.status(500).json({ message: 'Failed to defer maturity' });
  }
  if (!updated) {
    return res.status(404).json({ message: 'Loan not found' });
  }
  try {
    await supabase.from('loan_modifications').insert({
      loan_id: parseInt(loanId, 10),
      type: 'deferral',
      delta_months: extra,
      created_at: new Date().toISOString(),
      organization_id: req.organizationId,
    });
  } catch (e) {
    // ignore if table missing
  }
  res.json({ loan: updated });
});

router.post('/loans/:loanId/payment-portal', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const { amount } = req.body || {};
  if (!amount) return res.status(400).json({ message: 'Missing amount' });
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const token = Math.random().toString(36).slice(2);
  const url = `https://payments.example.com/pay/${token}`;
  res.json({ url });
});

router.get('/escrows', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance')
    .eq('organization_id', req.organizationId);
  if (error) return res.status(500).json({ message: 'Failed to fetch escrows' });
  res.json({ escrows: data });
});

router.get('/escrows/upcoming', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance')
    .eq('organization_id', req.organizationId);
  if (error) return res.status(500).json({ message: 'Failed to fetch escrows' });
  const results = [];
  for (const row of data || []) {
    const { data: loan } = await supabase
      .from('loans')
      .select('start_date')
      .eq('id', row.loan_id)
      .eq('organization_id', req.organizationId)
      .maybeSingle();
    const next_tax_due = loan ? calcNextTaxDue(loan.start_date) : null;
    const next_insurance_due = loan ? calcNextInsuranceDue(loan.start_date) : null;
    const projected_balance = parseFloat(row.escrow_balance || 0) - parseFloat(row.tax_amount || 0) - parseFloat(row.insurance_amount || 0);
    results.push({ ...row, next_tax_due, next_insurance_due, projected_balance });
  }
  res.json({ escrows: results });
});

router.get('/loans/:loanId/escrow', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  if (isNaN(parseInt(loanId, 10))) return res.status(400).json({ message: 'Invalid loan id' });
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to fetch escrow' });
  if (!data) return res.status(404).json({ message: 'Escrow not found' });
  res.json({ escrow: data });
});

router.post('/loans/:loanId/escrow/pay', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  const { type, amount } = req.body || {};
  if (isNaN(parseInt(loanId, 10))) return res.status(400).json({ message: 'Invalid loan id' });
  if (!type || amount === undefined) return res.status(400).json({ message: 'Missing type or amount' });
  if (!['tax', 'insurance'].includes(type)) return res.status(400).json({ message: 'Invalid type' });

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;

  const { data: esc } = await supabase
    .from('escrows')
    .select('escrow_balance, tax_amount, insurance_amount')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .maybeSingle();
  if (!esc) return res.status(404).json({ message: 'Escrow not found' });

  const column = type === 'tax' ? 'tax_amount' : 'insurance_amount';
  const outstanding = parseFloat(esc[column] || 0);
  const payment = Math.min(amt, outstanding);
  const newBal = parseFloat(esc.escrow_balance) - payment;

  const { error: updateErr, data: updated } = await supabase
    .from('escrows')
    .update({
      escrow_balance: newBal,
      [column]: Math.max(0, outstanding - payment),
    })
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .select('escrow_balance')
    .single();
  if (updateErr) return res.status(500).json({ message: 'Failed to update escrow' });

  res.json({ balance: updated.escrow_balance });
});

router.get('/loans/:loanId/escrow/projection', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  if (isNaN(parseInt(loanId, 10))) return res.status(400).json({ message: 'Invalid loan id' });
  const loan = await getLoanForOrg(loanId, req.organizationId, 'id', res);
  if (!loan) return;
  const { data, error } = await supabase
    .from('escrows')
    .select('escrow_balance, tax_amount, insurance_amount')
    .eq('loan_id', loanId)
    .eq('organization_id', req.organizationId)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to fetch escrow' });
  if (!data) return res.status(404).json({ message: 'Escrow not found' });
  const projection = [];
  let bal = parseFloat(data.escrow_balance || 0);
  const tax = parseFloat(data.tax_amount || 0) / 12;
  const ins = parseFloat(data.insurance_amount || 0) / 12;
  for (let i = 1; i <= 12; i++) {
    bal -= tax + ins;
    projection.push({ month: i, balance: parseFloat(bal.toFixed(2)) });
  }
  res.json({ projection });
});

router.get('/loans/:loanId/details', async (req, res) => {
  if (!ensureOrganization(req, res)) return;
  const { loanId } = req.params;
  try {
    const loan = await getLoanForOrg(loanId, req.organizationId, '*', res);
    if (!loan) return;
    const { data: schedule, error: scheduleErr } = await supabase
      .from('amortization_schedules')
      .select('*')
      .eq('loan_id', loanId)
      .eq('organization_id', req.organizationId)
      .order('due_date');
    if (scheduleErr) throw scheduleErr;
    const { data: payments, error: paymentsErr } = await supabase
      .from('payments')
      .select('*')
      .eq('loan_id', loanId)
      .eq('organization_id', req.organizationId)
      .order('date', { ascending: false });
    if (paymentsErr) throw paymentsErr;
    const { data: collateral, error: collateralErr } = await supabase
      .from('asset_collateral')
      .select('*')
      .eq('asset_id', loan.asset_id || 0)
      .eq('organization_id', req.organizationId);
    if (collateralErr) throw collateralErr;
    res.json({ loan, schedule, payments, collateral });
  } catch (err) {
    console.error('Loan detail error:', err);
    res.status(500).json({ message: 'Failed to fetch loan details' });
  }
});

module.exports = router;
