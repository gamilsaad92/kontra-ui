const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// initialize your Supabase client (or import it if you have a shared lib)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  const header = req.headers['x-org-id'] || req.headers['X-Org-Id'];
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

async function fetchLoans(orgId) {
  let query = supabase
    .from('loans')
    .select('id, amount, outstanding_principal, interest_rate, status, risk_score, days_late');
  if (orgId) {
    query = query.eq('organization_id', orgId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchCollections(orgId) {
  let query = supabase
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
router.get('/', async (req, res) => {
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
});

// POST /api/dashboard-layout
router.post('/', async (req, res) => {
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
});

router.get('/overview', async (req, res) => {
  const orgId = resolveOrgId(req);
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
    console.error('Dashboard overview collections query failed', error);
  }

  res.json({ overview });
});

module.exports = router;
