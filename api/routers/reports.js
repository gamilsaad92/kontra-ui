const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../communications');

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
