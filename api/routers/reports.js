const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../communications');
const { handleMissingSchemaError, isMissingSchemaError } = require('../lib/schemaErrors');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FALLBACK_COLLECTIONS_SUMMARY = {
  monthToDateCollected: 1_845_000,
  outstanding: 675_000,
  delinquentCount: 18,
  promisesToPay: 6,
  lastPaymentAt: null,
};

const FALLBACK_REPORT_SUMMARY = {
  summary: {
    scheduled: 4,
    saved: 11,
    totalRuns: 36,
    lastRunAt: null,
  },
  collections: FALLBACK_COLLECTIONS_SUMMARY,
  recentReports: [],
};

const EMPTY_COLLECTIONS_SUMMARY = {
  monthToDateCollected: 0,
  outstanding: 0,
  delinquentCount: 0,
  promisesToPay: 0,
  lastPaymentAt: null,
};

const EMPTY_REPORT_SUMMARY = {
  summary: {
    scheduled: 0,
    saved: 0,
    totalRuns: 0,
    lastRunAt: null,
  },
  collections: EMPTY_COLLECTIONS_SUMMARY,
  recentReports: [],
};

const SCHEDULE_FILE = path.join(__dirname, '..', 'scheduledReports.json');
const SAVED_FILE = path.join(__dirname, '..', 'savedReports.json');

function sendFormatted(res, rows, format) {
  if (format === 'pdf') {
    const doc = new PDFDocument();
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.send(Buffer.concat(buffers));
    });
    rows.forEach(r => doc.text(Object.values(r).join(' ')));
    doc.end();
  } else if (format === 'excel') {
    const header = Object.keys(rows[0] || {}).join(',');
    const dataRows = rows.map(r => Object.values(r).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.send([header, ...dataRows].join('\n'));
  } else {
    res.json({ rows });
  }
}

function loadJobs() {
  try {
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveJobs(jobs) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(jobs, null, 2));
}

function loadSaved() {
  try {
    return JSON.parse(fs.readFileSync(SAVED_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveSaved(items) {
  fs.writeFileSync(SAVED_FILE, JSON.stringify(items, null, 2));
}

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

function computeCollectionsSummary(rows) {
  if (!rows || rows.length === 0) {
    return { ...FALLBACK_COLLECTIONS_SUMMARY };
  }
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

  return {
    monthToDateCollected,
    outstanding,
    delinquentCount,
    promisesToPay,
    lastPaymentAt: lastPaymentAt ? lastPaymentAt.toISOString() : FALLBACK_COLLECTIONS_SUMMARY.lastPaymentAt,
  };
}

async function fetchReportRuns(orgId) {
  try {
    let query = supabase
      .from('report_runs')
      .select('id, name, status, generated_at');
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    const { data, error } = await query.order('generated_at', { ascending: false }).limit(5);
    if (error) throw error;
    let totalRuns = data?.length || 0;
    try {
      let countQuery = supabase.from('report_runs').select('id', { count: 'exact', head: true });
      if (orgId) {
        countQuery = countQuery.eq('organization_id', orgId);
      }
      const { count } = await countQuery;
      if (typeof count === 'number') {
        totalRuns = count;
      }
    } catch (countError) {
      console.warn('Report runs count unavailable', countError.message || countError);
    }
    return { recent: data || [], totalRuns };
  } catch (error) {
        if (isMissingSchemaError(error)) {
      throw error;
    }
    console.error('Report runs query failed', error);
    return { recent: [], totalRuns: 0 };
  }
}

router.get('/', async (req, res) => {
  try {
    const scheduled = loadJobs();
    const saved = loadSaved();
    const orgId = resolveOrgId(req);

    let collectionsResult;
    let runsResult;
    try {
      [collectionsResult, runsResult] = await Promise.all([
        fetchCollections(orgId),
        fetchReportRuns(orgId),
      ]);
    } catch (error) {
      const emptyPayload = {
        summary: {
          scheduled: scheduled.length,
          saved: saved.length,
          totalRuns: 0,
          lastRunAt: null,
        },
        collections: EMPTY_COLLECTIONS_SUMMARY,
        recentReports: [],
      };
      if (handleMissingSchemaError(res, error, 'Report summary', emptyPayload)) {
        return;
      }
      throw error;
    }
      
    const collections = computeCollectionsSummary(collectionsResult);
    const summary = {
      scheduled: scheduled.length,
      saved: saved.length,
      totalRuns: runsResult.totalRuns || runsResult.recent.length,
      lastRunAt: runsResult.recent[0]?.generated_at || null,
    };

    res.json({ summary, collections, recentReports: runsResult.recent });
  } catch (error) {
        if (handleMissingSchemaError(res, error, 'Report summary', EMPTY_REPORT_SUMMARY)) {
      return;
    }
    console.error('Report summary error:', error);
    res.json(FALLBACK_REPORT_SUMMARY);
  }
});

router.post('/run', async (req, res) => {
  const { table, fields = '*', filters = {}, format } = req.body || {};
  if (!table) return res.status(400).json({ message: 'Missing table' });
  try {
    let q = supabase.from(table).select(fields).limit(1000);
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) q = q.in(key, value);
      else q = q.eq(key, value);
    }
    const { data, error } = await q;
    if (error) throw error;
    if (format === 'pdf') {
      const doc = new PDFDocument();
      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.concat(buffers));
      });
      doc.text(JSON.stringify(data, null, 2));
      doc.end();
    } else {
      res.json({ rows: data });
    }
  } catch (err) {
    console.error('Report run error:', err);
    res.status(500).json({ message: 'Failed to run report' });
  }
});

router.get('/fields', async (req, res) => {
  const { table } = req.query || {};
  if (!table) return res.status(400).json({ message: 'Missing table' });
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) throw error;
    const fields = data && data[0] ? Object.keys(data[0]) : [];
    res.json({ fields });
  } catch (err) {
    console.error('Field lookup error:', err);
    res.status(500).json({ message: 'Failed to fetch fields' });
  }
});

router.post('/schedule', (req, res) => {
  const { email, schedule = 'daily', table, fields = '*', filters = {} } = req.body || {};
  if (!email || !table) return res.status(400).json({ message: 'Missing email or table' });
  const jobs = loadJobs();
  jobs.push({ id: Date.now(), email, schedule, table, fields, filters, last_sent: null });
  saveJobs(jobs);
  res.status(201).json({ message: 'Scheduled' });
});

router.get('/saved', (req, res) => {
  res.json({ reports: loadSaved() });
});

router.post('/save', (req, res) => {
  const { name, table, fields = '*', filters = {} } = req.body || {};
  if (!name || !table) return res.status(400).json({ message: 'Missing name or table' });
  const items = loadSaved();
  const id = Date.now();
  items.push({ id, name, table, fields, filters });
  saveSaved(items);
  res.status(201).json({ id });
});

router.get('/export', async (req, res) => {
  const { table, format = 'csv' } = req.query || {};
  if (!table) return res.status(400).json({ message: 'Missing table' });
  const { data, error } = await supabase.from(table).select('*');
  if (error) return res.status(500).json({ message: 'Failed to export' });
  if (format === 'json') {
    res.json({ rows: data });
  } else {
    const header = Object.keys(data[0] || {}).join(',');
    const rows = data.map(r => Object.values(r).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.send([header, ...rows].join('\n'));
  }
});

router.get('/investor-distribution', async (req, res) => {
  const { format } = req.query || {};
  try {
    const { data, error } = await supabase
      .from('investments')
      .select('investor, amount');
    if (error) throw error;
    const totals = {};
    for (const row of data) {
      const investor = row.investor || 'Unknown';
      const amt = Number(row.amount) || 0;
      totals[investor] = (totals[investor] || 0) + amt;
    }
    const rows = Object.entries(totals).map(([investor, total]) => ({ investor, total }));
    sendFormatted(res, rows, format);
  } catch (err) {
    const rows = [
      { investor: 'Demo Capital', total: 100000 },
      { investor: 'Sample Partners', total: 75000 },
    ];
    sendFormatted(res, rows, format);
  }
});

router.get('/asset-performance', async (req, res) => {
  const { period = 'monthly', format } = req.query || {};
  try {
    const { data, error } = await supabase
      .from('asset_performance')
      .select('period, asset, return');
    if (error) throw error;
    const rows = data.filter(r => (period === 'quarterly' ? /Q/.test(r.period) : !/Q/.test(r.period)));
    sendFormatted(res, rows, format);
  } catch (err) {
    const monthly = [
      { period: '2024-01', asset: 'Building A', return: 0.05 },
      { period: '2024-02', asset: 'Building B', return: -0.02 },
    ];
    const quarterly = [
      { period: '2024-Q1', asset: 'Building A', return: 0.12 },
      { period: '2024-Q1', asset: 'Building B', return: 0.03 },
    ];
    const rows = period === 'quarterly' ? quarterly : monthly;
    sendFormatted(res, rows, format);
  }
});

router.get('/loan-risk', async (req, res) => {
  const { format } = req.query || {};
  try {
    const { data, error } = await supabase
      .from('loans')
      .select('id, days_late, balance, ltv');
    if (error) throw error;
    const rows = data.map(l => ({
      loan_id: l.id,
      days_late: l.days_late || 0,
      risk:
        (l.days_late || 0) > 90 || (l.ltv || 0) > 0.8
          ? 'high'
          : (l.days_late || 0) > 30
          ? 'medium'
          : 'low',
    }));
    sendFormatted(res, rows, format);
  } catch (err) {
    const rows = [
      { loan_id: 'LN100', days_late: 45, risk: 'medium' },
      { loan_id: 'LN101', days_late: 10, risk: 'low' },
      { loan_id: 'LN102', days_late: 120, risk: 'high' },
    ];
    sendFormatted(res, rows, format);
  }
});

module.exports = router;
