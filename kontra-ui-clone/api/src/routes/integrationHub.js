/**
 * Kontra Integration Hub API — Phase 4
 *
 * Endpoints for document intelligence and legacy system normalization.
 *
 * POST /api/integration/classify       — auto-classify a document
 * POST /api/integration/extract        — OCR + structured extraction (file upload)
 * POST /api/integration/ingest         — normalize via adapter
 * POST /api/integration/email-parse    — parse email text → servicing request
 * GET  /api/integration/adapters       — list all registered adapters
 * GET  /api/integration/jobs           — list recent integration jobs
 * GET  /api/integration/jobs/:id       — get a single job
 * POST /api/integration/csv-preview    — parse CSV and preview columns/rows
 * GET  /api/integration/stats          — overall stats for dashboard
 */

const express = require('express');
const multer  = require('multer');

const { extractFromDocument, classifyDocument } = require('../../lib/documentIntelligence');
const { ADAPTERS, runAdapter, parseCSV }         = require('../../lib/legacyAdapters');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB max

const { supabase: adminDb } = require('../../db');

// ── In-memory job queue (backed by DB when available) ─────────────────────────

const JOB_STORE = new Map();
let JOB_SEQ = 1000;

function newJob(data) {
  const id = `JOB-${++JOB_SEQ}`;
  const job = { id, status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...data };
  JOB_STORE.set(id, job);
  persistJob(job).catch(() => {});
  return job;
}

function updateJob(id, patch) {
  const job = JOB_STORE.get(id);
  if (!job) return null;
  const updated = { ...job, ...patch, updated_at: new Date().toISOString() };
  JOB_STORE.set(id, updated);
  persistJob(updated).catch(() => {});
  return updated;
}

async function persistJob(job) {
  try {
    await adminDb.from('kontra_integration_jobs').upsert({
      id:          job.id,
      status:      job.status,
      source:      job.source,
      doc_type:    job.doc_type,
      filename:    job.filename,
      adapter_id:  job.adapter_id,
      org_id:      job.org_id || null,
      result_data: job.result || null,
      error_msg:   job.error || null,
      created_at:  job.created_at,
      updated_at:  job.updated_at,
    }, { onConflict: 'id' });
  } catch (_) {}
}

// ── Seed demo jobs ────────────────────────────────────────────────────────────

const DEMO_JOBS = [
  { id: 'JOB-0001', status: 'completed', source: 'file_upload', doc_type: 'inspection_report',  filename: 'inspection-LN0094-Q1.pdf', adapter_id: 'inspection_vendor', created_at: '2026-04-11T10:00:00Z', updated_at: '2026-04-11T10:00:45Z', confidence: 0.94 },
  { id: 'JOB-0002', status: 'completed', source: 'file_upload', doc_type: 'operating_statement', filename: 'T12-HarborView-2025.xlsx',  adapter_id: 'spreadsheet_csv',   created_at: '2026-04-10T14:22:00Z', updated_at: '2026-04-10T14:22:30Z', confidence: 0.89 },
  { id: 'JOB-0003', status: 'completed', source: 'email',       doc_type: 'email_request',       filename: 'email-payoff-LN0094.eml', adapter_id: 'email_text',         created_at: '2026-04-10T09:15:00Z', updated_at: '2026-04-10T09:15:12Z', confidence: 0.97 },
  { id: 'JOB-0004', status: 'completed', source: 'file_upload', doc_type: 'insurance_acord',     filename: 'ACORD-HarborView-2026.pdf',adapter_id: 'insurance_acord',    created_at: '2026-04-09T16:00:00Z', updated_at: '2026-04-09T16:01:10Z', confidence: 0.91 },
  { id: 'JOB-0005', status: 'completed', source: 'api_ingest',  doc_type: 'rent_roll',           filename: 'RentRoll-Apr-2026.csv',   adapter_id: 'yardi_json',          created_at: '2026-04-08T11:30:00Z', updated_at: '2026-04-08T11:30:55Z', confidence: 0.88 },
  { id: 'JOB-0006', status: 'failed',    source: 'file_upload', doc_type: 'appraisal_report',    filename: 'appraisal-corrupted.pdf', adapter_id: null,                  created_at: '2026-04-07T13:00:00Z', updated_at: '2026-04-07T13:00:08Z', error: 'PDF could not be parsed — file appears corrupted or encrypted' },
  { id: 'JOB-0007', status: 'pending',   source: 'api_ingest',  doc_type: 'loan_document',       filename: 'LoanAgreement-LN3301.pdf',adapter_id: 'fics_export',         created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];
DEMO_JOBS.forEach((j) => { if (!JOB_STORE.has(j.id)) JOB_STORE.set(j.id, j); });

// ── GET /api/integration/adapters ─────────────────────────────────────────────

router.get('/adapters', async (req, res) => {
  const adapters = Object.values(ADAPTERS).map((a) => ({
    id:          a.id,
    name:        a.name,
    category:    a.category,
    formats:     a.formats,
    description: a.description,
    fields_mapped: a.fields_mapped,
    icon:        a.icon,
    status:      'active',
  }));
  return res.json({ adapters, total: adapters.length });
});

// ── GET /api/integration/stats ────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
  const jobs = [...JOB_STORE.values()];
  const completed = jobs.filter((j) => j.status === 'completed');
  const failed    = jobs.filter((j) => j.status === 'failed');
  const pending   = jobs.filter((j) => j.status === 'pending' || j.status === 'processing');

  const docTypeCounts = {};
  for (const j of completed) {
    docTypeCounts[j.doc_type] = (docTypeCounts[j.doc_type] || 0) + 1;
  }

  const avgConfidence = completed.length > 0
    ? completed.reduce((s, j) => s + (j.confidence || 0.9), 0) / completed.length
    : 0;

  return res.json({
    total_jobs:        jobs.length,
    completed:         completed.length,
    failed:            failed.length,
    pending:           pending.length,
    adapters_available:Object.keys(ADAPTERS).length,
    avg_confidence:    Math.round(avgConfidence * 100) / 100,
    doc_type_breakdown:docTypeCounts,
  });
});

// ── GET /api/integration/jobs ─────────────────────────────────────────────────

router.get('/jobs', async (req, res) => {
  const { status, limit = 50, page = 1 } = req.query;
  let jobs = [...JOB_STORE.values()];
  if (status) jobs = jobs.filter((j) => j.status === status);
  jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const total = jobs.length;
  const offset = (Number(page) - 1) * Number(limit);
  jobs = jobs.slice(offset, offset + Number(limit));

  return res.json({ jobs, total, page: Number(page), limit: Number(limit) });
});

// ── GET /api/integration/jobs/:id ─────────────────────────────────────────────

router.get('/jobs/:id', (req, res) => {
  const job = JOB_STORE.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json(job);
});

// ── POST /api/integration/classify ───────────────────────────────────────────

router.post('/classify', upload.single('file'), async (req, res) => {
  try {
    const text = req.file
      ? req.file.buffer.toString('utf8')
      : (req.body.text || req.body.content || '');

    if (!text && !req.file) {
      return res.status(400).json({ error: 'Provide a file upload or text field' });
    }

    const classification = await classifyDocument(text || req.body.text || '');
    return res.json(classification);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/integration/extract ────────────────────────────────────────────

router.post('/extract', upload.single('file'), async (req, res) => {
  try {
    const { doc_type: bodyDocType } = req.body;
    const file = req.file;

    if (!file && !req.body.text && !req.body.content) {
      return res.status(400).json({ error: 'Provide a file upload, text, or content field' });
    }

    // Create job record
    const job = newJob({
      status: 'processing',
      source: file ? 'file_upload' : 'text_input',
      filename: file?.originalname || 'inline_text',
      doc_type: bodyDocType || 'unknown',
      org_id: req.orgId,
    });

    let docType = bodyDocType;
    let content;
    let contentType = 'text';

    if (file) {
      const mime = file.mimetype || '';
      if (mime.startsWith('image/')) {
        contentType = mime;
        content = file.buffer.toString('base64');
      } else {
        // Treat as text (PDF text extraction fallback, CSV, etc.)
        content = file.buffer.toString('utf8');
        contentType = 'text';
      }
    } else {
      content = req.body.text || req.body.content || '';
    }

    // Auto-classify if no type specified
    if (!docType || docType === 'unknown') {
      const classification = await classifyDocument(String(content).slice(0, 3000));
      docType = classification.doc_type || 'email_request';
    }

    const result = await extractFromDocument({
      content,
      docType,
      contentType,
      filename: file?.originalname || 'inline',
    });

    updateJob(job.id, {
      status:     result.error ? 'failed' : 'completed',
      doc_type:   result.doc_type,
      result:     result,
      confidence: result.confidence,
      error:      result.error || null,
    });

    return res.json({ job_id: job.id, ...result });
  } catch (err) {
    console.error('[integrationHub] extract error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/integration/ingest ─────────────────────────────────────────────

router.post('/ingest', async (req, res) => {
  const { adapter_id, data, source_system } = req.body;

  if (!adapter_id || !data) {
    return res.status(400).json({ error: 'adapter_id and data are required' });
  }

  const job = newJob({
    status:     'processing',
    source:     source_system || 'api_ingest',
    adapter_id,
    org_id:     req.orgId,
    doc_type:   ADAPTERS[adapter_id]?.category || 'unknown',
  });

  const result = runAdapter(adapter_id, data);

  if (!result.success) {
    updateJob(job.id, { status: 'failed', error: result.error });
    return res.status(400).json({ error: result.error, job_id: job.id });
  }

  updateJob(job.id, { status: 'completed', result: result.normalized });

  return res.json({
    job_id:    job.id,
    success:   true,
    adapter:   result.adapter_name,
    normalized:result.normalized,
    normalized_at: result.normalized_at,
  });
});

// ── POST /api/integration/email-parse ────────────────────────────────────────

router.post('/email-parse', async (req, res) => {
  const { text, subject, sender } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const job = newJob({
    status: 'processing',
    source: 'email',
    doc_type: 'email_request',
    adapter_id: 'email_text',
    org_id: req.orgId,
    filename: subject ? `email: ${subject}` : 'email_input',
  });

  // First normalize via adapter for quick structural fields
  const adapterResult = runAdapter('email_text', { body: text, subject, sender });

  // Then run full AI extraction for deeper parsing
  const extractResult = await extractFromDocument({
    content: `Subject: ${subject || '(none)'}\nFrom: ${sender || '(unknown)'}\n\n${text}`,
    docType: 'email_request',
    contentType: 'text',
    filename: 'email',
  });

  const combined = {
    ...adapterResult.normalized?.request,
    ...(extractResult.extracted || {}),
  };

  updateJob(job.id, { status: 'completed', result: combined, confidence: extractResult.confidence });

  return res.json({
    job_id:    job.id,
    extracted: combined,
    confidence:extractResult.confidence,
    model:     extractResult.model,
    extracted_at: extractResult.extracted_at,
  });
});

// ── POST /api/integration/csv-preview ────────────────────────────────────────

router.post('/csv-preview', upload.single('file'), async (req, res) => {
  try {
    const text = req.file ? req.file.buffer.toString('utf8') : (req.body.text || '');
    if (!text) return res.status(400).json({ error: 'No CSV content provided' });

    const rows = parseCSV(text);
    if (rows.length === 0) return res.status(400).json({ error: 'Could not parse CSV — no rows found' });

    const headers = Object.keys(rows[0]);
    const preview = rows.slice(0, 5);
    const rowCount = rows.length;

    // Detect likely adapter
    const headerStr = headers.join(' ').toLowerCase();
    let recommended_adapter = 'spreadsheet_csv';
    if (/cusip|trepp|cmbs/.test(headerStr)) recommended_adapter = 'riskmetrics_csv';
    else if (/yardi|voyager/.test(headerStr)) recommended_adapter = 'yardi_json';
    else if (/loan.?no|borrower.?name/.test(headerStr) && /fics|pac|servicer/.test(headerStr)) recommended_adapter = 'fics_export';
    else if (/loan.*number.*upb|situs|amc/.test(headerStr)) recommended_adapter = 'situs_csv';
    else if (/tenant.?name|lease.?start|mri/.test(headerStr)) recommended_adapter = 'mri_csv';

    return res.json({
      headers,
      row_count:          rowCount,
      preview_rows:       preview,
      recommended_adapter,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
