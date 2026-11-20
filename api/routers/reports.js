const express = require('express');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { sendEmail, normalizeEmailRecipient } = require('../communications');
const authenticate = require('../middlewares/authenticate');
const { isAuthenticatedTenantMember } = require('../lib/tenantEmailAuthorization');
const { getReportOrganizationColumn } = require('../lib/scheduledReportScope');
const { handleMissingSchemaError, isMissingSchemaError } = require('../lib/schemaErrors');
const { logAuditEntry } = require('../auditLogger');
const {
  ROLE_TEMPLATES,
  SCHEMA_CATALOG,
  proposeReportPlan,
  validateReportSpec,
} = require('../ai/agents/reportAgent');

const router = express.Router();
const { supabase } = require('../db');

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

const REPORT_FIELDS = Object.freeze({
  loans: SCHEMA_CATALOG.tables.loans.columns.filter((field) =>
    !['organization_id', 'borrower_user_id'].includes(field)),
  payments: SCHEMA_CATALOG.tables.payments.columns,
});
const REPORT_TENANT_COLUMNS = Object.freeze({
  loans: 'organization_id',
  payments: 'org_id',
});
const SAFE_REPORT_CATALOG = Object.freeze({
  tables: Object.fromEntries(Object.keys(REPORT_FIELDS).map((table) => [
    table,
    { columns: REPORT_FIELDS[table], joins: [] },
  ])),
  joins: [],
});

const SCHEDULE_FILE = path.join(__dirname, '..', 'scheduledReports.json');
const SAVED_FILE = path.join(__dirname, '..', 'savedReports.json');

router.use((req, res, next) => {
  const membership = req.membership;
  if (
    !req.authContext?.verified ||
    !req.authUserId ||
    !req.orgId ||
    !membership ||
    membership.status !== 'active' ||
    membership.deleted_at ||
    String(membership.org_id) !== String(req.orgId)
  ) {
    return res.status(403).json({ code: 'ORG_MEMBERSHIP_REQUIRED' });
  }
  return next();
});

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

function forOrganization(items, orgId) {
  return items.filter((item) => String(item.organizationId || '') === String(orgId));
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
  return req.orgId;
}

function toNumber(value) {
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hashSpec(spec) {
  return crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex');
}

function normalizeFilters(filters) {
  if (!filters || typeof filters !== 'object') return {};
  return Object.entries(filters).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function buildScopedReportQuery(req, table, fields = '*', filters = {}) {
  const orgId = resolveOrgId(req);
  const tenantColumn = REPORT_TENANT_COLUMNS[table];
  const allowedFields = REPORT_FIELDS[table];
  if (!orgId || !tenantColumn || !allowedFields) {
    const error = new Error('Unsupported or unscoped report table');
    error.status = 400;
    throw error;
  }

  const selectedFields = fields === '*' || fields == null
    ? allowedFields
    : (Array.isArray(fields) ? fields : String(fields).split(',')).map((field) => String(field).trim());
  if (
    !selectedFields.length ||
    selectedFields.some((field) => !allowedFields.includes(field)) ||
    Object.keys(filters || {}).some((field) =>
      !allowedFields.includes(field) || field === tenantColumn ||
      ['org_id', 'organization_id', 'tenant_id'].includes(field))
  ) {
    const error = new Error('Report fields or filters are not allowed');
    error.status = 400;
    throw error;
  }

  let query = supabase.from(table).select(selectedFields.join(',')).eq(tenantColumn, orgId).limit(1000);
  for (const [key, value] of Object.entries(filters || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const error = new Error('Invalid report filter');
      error.status = 400;
      throw error;
    }
    query = Array.isArray(value) ? query.in(key, value) : query.eq(key, value);
  }
  return query;
}

function validateScopedReportSpec(spec) {
  const validation = validateReportSpec(spec);
  if (!validation.valid) return validation;
  try {
    buildScopedReportQuery({ orgId: 'validation-only' }, spec.table, spec.fields, spec.filters);
    return validation;
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

async function fetchCollections(orgId) {
  if (!orgId) throw new Error('Verified organization context is required');
  let query = supabase
    .from('collections')
    .select('amount, status, due_date, updated_at, paid_at, promise_date');
  query = query.eq('organization_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function computeCollectionsSummary(rows) {
  if (!rows || rows.length === 0) {
    return { ...EMPTY_COLLECTIONS_SUMMARY };
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
  if (!orgId) throw new Error('Verified organization context is required');
  try {
    let query = supabase
      .from('report_runs')
      .select('id, name, status, generated_at');
    query = query.eq('organization_id', orgId);
    const { data, error } = await query.order('generated_at', { ascending: false }).limit(5);
    if (error) throw error;
    let totalRuns = data?.length || 0;
    try {
      let countQuery = supabase.from('report_runs').select('id', { count: 'exact', head: true });
      countQuery = countQuery.eq('organization_id', orgId);
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
    const orgId = resolveOrgId(req);
    const scheduled = forOrganization(loadJobs(), orgId);
    const saved = forOrganization(loadSaved(), orgId);

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
    res.status(503).json({ message: 'Report summary is unavailable' });
  }
});

router.post('/run', async (req, res) => {
  const { table, fields = '*', filters = {}, format } = req.body || {};
  if (!table) return res.status(400).json({ message: 'Missing table' });
  try {
    const q = buildScopedReportQuery(req, table, fields, filters);
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
    if (err.status === 400) return res.status(400).json({ message: err.message });
    console.error('Report run error:', err);
    res.status(500).json({ message: 'Failed to run report' });
  }
});

router.get('/ai/catalog', (req, res) => {
  const templates = Object.entries(ROLE_TEMPLATES)
    .filter(([, template]) => Object.hasOwn(REPORT_FIELDS, template.table))
    .map(([name]) => name);
  res.json({ catalog: SAFE_REPORT_CATALOG, templates });
});

router.post('/ai/propose', (req, res) => {
  const { description, role, outlook_days, include_executive_summary } = req.body || {};
  const plan = proposeReportPlan({
    description,
    role,
    outlook_days,
    include_executive_summary,
  });
  const validation = validateScopedReportSpec(plan.spec);
  if (!validation.valid) {
    return res.status(400).json({ message: 'Invalid report spec', errors: validation.errors });
  }
  const specHash = hashSpec(plan.spec);
  logAuditEntry({
    event: 'ai_report_plan',
    tenant_id: resolveOrgId(req),
    spec_hash: specHash,
    explanation: plan.explanation,
    confidence: plan.confidence,
    warnings: plan.warnings,
    role: plan.roleUsed,
  });
  res.json({
    spec: plan.spec,
    explanation: plan.explanation,
    confidence: plan.confidence,
    warnings: plan.warnings,
    executiveSummary: plan.executiveSummary,
    automationHooks: plan.automationHooks,
    roleUsed: plan.roleUsed,
    specHash,
  });
});

router.post('/ai/run', async (req, res) => {
  const {
    spec,
    approved,
    explanation,
    confidence,
    selectedAutomationHooks = [],
    include_executive_summary,
  } = req.body || {};
  if (!approved) {
    return res.status(400).json({ message: 'Approval is required to run this report.' });
  }
  const validation = validateScopedReportSpec(spec);
  if (!validation.valid) {
    return res.status(400).json({ message: 'Invalid report spec', errors: validation.errors });
  }
  const start = Date.now();
  try {
    const fields = Array.isArray(spec.fields) ? spec.fields : '*';
    const filters = normalizeFilters(spec.filters);
    const q = buildScopedReportQuery(req, spec.table, fields, filters);
    const { data, error } = await q;
    if (error) throw error;
    const durationMs = Date.now() - start;
    const specHash = hashSpec(spec);
    logAuditEntry({
      event: 'ai_report_execution',
      tenant_id: resolveOrgId(req),
      spec_hash: specHash,
      rows_returned: data?.length || 0,
      duration_ms: durationMs,
      explanation,
      confidence,
      approved: true,
      selected_automation_hooks: selectedAutomationHooks,
      include_executive_summary: Boolean(include_executive_summary),
    });
    res.json({ rows: data, durationMs, specHash });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
    logAuditEntry({
      event: 'ai_report_execution_failed',
      tenant_id: resolveOrgId(req),
      spec_hash: spec ? hashSpec(spec) : null,
      explanation,
      confidence,
      error: error.message || String(error),
    });
    console.error('AI report run error:', error);
    res.status(500).json({ message: 'Failed to run report' });
  }
});

router.post('/ai/save', (req, res) => {
  const { name, spec, approved, explanation, confidence } = req.body || {};
  if (!approved) {
    return res.status(400).json({ message: 'Approval is required to save this report.' });
  }
  if (!name || !spec?.table) {
    return res.status(400).json({ message: 'Missing name or table' });
  }
  const validation = validateScopedReportSpec(spec);
  if (!validation.valid) {
    return res.status(400).json({ message: 'Invalid report spec', errors: validation.errors });
  }
  const items = loadSaved();
  const id = Date.now();
  items.push({
    id,
    name,
    table: spec.table,
    fields: Array.isArray(spec.fields) ? spec.fields.join(',') : '*',
    filters: spec.filters || {},
    groupBy: spec.groupBy || '',
    organizationId: resolveOrgId(req),
  });
  saveSaved(items);
  logAuditEntry({
    event: 'ai_report_saved',
    tenant_id: resolveOrgId(req),
    spec_hash: hashSpec(spec),
    explanation,
    confidence,
    approved: true,
  });
  res.status(201).json({ id });
});

router.get('/fields', async (req, res) => {
  const { table } = req.query || {};
  if (!table) return res.status(400).json({ message: 'Missing table' });
  const fields = REPORT_FIELDS[table];
  if (!fields) return res.status(400).json({ message: 'Unsupported report table' });
  res.json({ fields });
});

router.post('/schedule', authenticate, async (req, res) => {
  const { email, schedule = 'daily', table, fields = '*', filters = {} } = req.body || {};
  if (!email || !table) return res.status(400).json({ message: 'Missing email or table' });
  const organizationColumn = getReportOrganizationColumn(table);
  if (!organizationColumn || !REPORT_FIELDS[table]) {
    return res.status(400).json({ message: 'Unsupported report table' });
  }
  try {
    buildScopedReportQuery(req, table, fields, filters);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  if (!await isAuthenticatedTenantMember(supabase, req)) {
    return res.status(403).json({ message: 'Organization access denied' });
  }
  let recipient;
  try {
    recipient = normalizeEmailRecipient(email);
  } catch {
    return res.status(400).json({ message: 'Invalid recipient email' });
  }
  if (!req.user?.email || recipient.toLowerCase() !== req.user.email.trim().toLowerCase()) {
    return res.status(403).json({ message: 'Scheduled reports can only be sent to your verified account email' });
  }
  const jobs = loadJobs();
  jobs.push({
    id: Date.now(),
    email: recipient,
    schedule,
    table,
    organizationId: req.orgId,
    organizationColumn,
    fields,
    filters,
    last_sent: null,
  });
  saveJobs(jobs);
  res.status(201).json({ message: 'Scheduled' });
});

router.get('/saved', (req, res) => {
  res.json({ reports: forOrganization(loadSaved(), resolveOrgId(req)) });
});

router.post('/save', (req, res) => {
  const { name, table, fields = '*', filters = {} } = req.body || {};
  if (!name || !table) return res.status(400).json({ message: 'Missing name or table' });
  try {
    buildScopedReportQuery(req, table, fields, filters);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const items = loadSaved();
  const id = Date.now();
  items.push({ id, name, table, fields, filters, organizationId: resolveOrgId(req) });
  saveSaved(items);
  res.status(201).json({ id });
});

router.get('/export', async (req, res) => {
  const { table, format = 'csv' } = req.query || {};
  if (!table) return res.status(400).json({ message: 'Missing table' });
  let query;
  try {
    query = buildScopedReportQuery(req, table);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const { data, error } = await query;
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

router.get('/investor-distribution', (req, res) => {
  res.status(501).json({ message: 'This report has no verified organization scope' });
});

router.get('/asset-performance', (req, res) => {
  res.status(501).json({ message: 'This report has no verified organization scope' });
});

router.get('/loan-risk', async (req, res) => {
  const { format } = req.query || {};
  try {
    const { data, error } = await buildScopedReportQuery(req, 'loans', ['id', 'status', 'risk_score']);
    if (error) throw error;
    return sendFormatted(res, (data || []).map((loan) => ({
      loan_id: loan.id,
      status: loan.status,
      risk_score: loan.risk_score,
    })), format);
  } catch (error) {
    return res.status(error.status || 500).json({ message: 'Failed to run scoped loan-risk report' });
  }
});

module.exports = router;
