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

module.exports = router;
