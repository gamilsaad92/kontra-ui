// index.js
const express = require('express');
const Sentry = require('@sentry/node');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');          // ← v4+ default export
const fs = require('fs');
const path = require('path');
const http = require('http');
const attachChatServer = require('./chatServer');
const { forecastProject } = require('./construction');
require('dotenv').config();
["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","OPENAI_API_KEY","SENTRY_DSN"].forEach(k => {
  if (!process.env[k]) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
});

const app = express();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
// ✅ Use middleware only if available
if (Sentry.Handlers?.requestHandler) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
} else if (Sentry.expressMiddleware) {
  app.use(Sentry.expressMiddleware());
}
const upload = multer({ storage: multer.memoryStorage() });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── OpenAI Client (v4+ SDK) ────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const { handleVoice, handleVoiceQuery } = require('./voiceBot');
const { recordFeedback, retrainModel } = require('./feedback');
const authenticate = require('./middlewares/authenticate');
const assetsRouter = require("./routers/assets");
const inspectionsRouter = require("./routers/inspections");
const dashboard = require('./routers/dashboard');

// ── Webhook & Integration State ────────────────────────────────────────────
const webhooks = [];
const integrations = { quickbooks: false, yardi: false, procore: false };

async function triggerWebhooks(event, payload) {
  const hooks = webhooks.filter(h => h.event === event);
  await Promise.all(
    hooks.map(h =>
      fetch(h.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, payload })
      }).catch(err => console.error('Webhook error:', err))
    )
  );
}

// Define the functions that the assistant can “call.”
const functions = [
  {
    name: 'get_loans',
    description: 'Retrieve a list of active loans',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_draws',
    description: 'Fetch the five most recent draw requests',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
    },
  {
    name: 'get_escrow_balance',
    description: 'Retrieve escrow balance for a given loan id',
    parameters: {
      type: 'object',
      properties: {
        loan_id: { type: 'integer', description: 'Loan id' }
      },
      required: ['loan_id']
    }
  },
  {
    name: 'get_payoff_instructions',
    description: 'Provide instructions for requesting a payoff quote',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
    },
  {
    name: 'get_next_insurance_due',
    description: 'Fetch the next insurance premium due date for a borrower',
    parameters: {
      type: 'object',
      properties: {
        borrower_name: { type: 'string', description: 'Borrower name' }
      },
      required: ['borrower_name']
    }
   },
  {
    name: 'get_troubled_assets',
    description: 'List assets at highest foreclosure risk',
    parameters: {
      type: 'object',
      properties: { topN: { type: 'number' } },
      required: []
    }
  },
  {
    name: 'get_revived_assets',
    description: 'Fetch recently revived-for-sale assets',
    parameters: { type: 'object', properties: {}, required: [] }
      },
  {
    name: 'get_asset_info',
    description: 'Retrieve summary info for an asset by id',
    parameters: {
      type: 'object',
      properties: { asset_id: { type: 'integer' } },
      required: ['asset_id']
    }
  },
  {
    name: 'get_loan_details',
    description: 'Fetch loan details by id',
    parameters: {
      type: 'object',
      properties: { loan_id: { type: 'integer' } },
      required: ['loan_id']
    }
  },
  {
    name: 'get_guest_profile',
    description: 'Return guest profile by id',
    parameters: {
      type: 'object',
      properties: { guest_id: { type: 'integer' } },
      required: ['guest_id']
    }
  }
];

const chatOpsFunctions = [
  {
    name: 'list_past_due_loans',
    description:
      'List loans with payments overdue more than a specified number of days. Optional state filter.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Days past due' },
        state: { type: 'string', description: 'State abbreviation' }
      },
      required: ['days']
    }
  },
  {
    name: 'get_overall_occupancy',
    description: 'Calculate average occupancy rate across all assets',
    parameters: { type: 'object', properties: {}, required: [] }
      },
  {
    name: 'get_asset_info',
    description: 'Retrieve summary info for an asset by id',
    parameters: {
      type: 'object',
      properties: { asset_id: { type: 'integer' } },
      required: ['asset_id']
    }
  },
  {
    name: 'get_loan_details',
    description: 'Fetch loan details by id',
    parameters: {
      type: 'object',
      properties: { loan_id: { type: 'integer' } },
      required: ['loan_id']
    }
  },
  {
    name: 'get_guest_profile',
    description: 'Return guest profile by id',
    parameters: {
      type: 'object',
      properties: { guest_id: { type: 'integer' } },
      required: ['guest_id']
    }
  }
];

// Helper implementations for those functions:
async function get_loans() {
  const { data } = await supabase
    .from('loans')
    .select('id, borrower_name, amount, status')
    .order('created_at', { ascending: false });
  return data;
}

async function get_draws() {
  const { data } = await supabase
    .from('draw_requests')
    .select('id, project, amount, status')
    .order('submitted_at', { ascending: false })
    .limit(5);
  return data;
}

async function get_escrow_balance({ loan_id }) {
  const { data } = await supabase
    .from('escrows')
    .select('escrow_balance')
    .eq('loan_id', loan_id)
    .maybeSingle();
  return data;
}

async function get_payoff_instructions() {
  const text = fs.readFileSync(
    path.join(__dirname, 'docs', 'payoff_instructions.txt'),
    'utf8'
  );
  return { instructions: text };
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
  const due = new Date(now.getFullYear(), 11, start.getDate()); // Dec each year
  if (due < now) due.setFullYear(due.getFullYear() + 1);
  return due.toISOString().slice(0, 10);
}

async function get_next_insurance_due({ borrower_name }) {
  const { data: loan } = await supabase
    .from('loans')
    .select('id, start_date')
    .eq('borrower_name', borrower_name)
    .maybeSingle();
  if (!loan) return null;
  const { data: escrow } = await supabase
    .from('escrows')
    .select('insurance_amount')
    .eq('loan_id', loan.id)
    .maybeSingle();
  const due_date = calcNextInsuranceDue(loan.start_date);
  return { loan_id: loan.id, due_date, insurance_amount: escrow?.insurance_amount };
}

async function list_past_due_loans({ days, state }) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  let query = supabase
    .from('collections')
    .select('loan_id, due_date, status, loans(id, borrower_name, amount, state)')
    .lt('due_date', cutoff.toISOString().slice(0, 10))
    .neq('status', 'paid');
  if (state) query = query.eq('loans.state', state);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(c => ({
    loan_id: c.loan_id,
    borrower_name: c.loans?.borrower_name,
    amount: c.loans?.amount,
    state: c.loans?.state,
    due_date: c.due_date
  }));
}

async function get_overall_occupancy() {
  const { data, error } = await supabase.from('assets').select('occupancy');
  if (error || !data) return { occupancy_rate: 0 };
  const vals = data
    .map(a => parseFloat(a.occupancy))
    .filter(v => !isNaN(v));
  if (!vals.length) return { occupancy_rate: 0 };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { occupancy_rate: parseFloat(avg.toFixed(2)) };
}

async function get_troubled_assets({ topN } = {}) {
  const { data } = await supabase
    .from('troubled_assets')
    .select('*')
    .order('predicted_risk', { ascending: false })
    .limit(topN || 5);
  return data || [];
}

async function get_revived_assets() {
  const { data } = await supabase
    .from('assets')
    .select('*')
    .eq('status', 'revived')
    .order('updated_at', { ascending: false });
  return data || [];
}

async function get_asset_info({ asset_id }) {
  const { data } = await supabase
    .from('assets')
    .select('*')
    .eq('id', asset_id)
    .maybeSingle();
  return data;
}

async function get_loan_details({ loan_id }) {
  const { data } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loan_id)
    .maybeSingle();
  return data;
}

async function get_guest_profile({ guest_id }) {
  const { data } = await supabase
    .from('guests')
    .select('*')
    .eq('id', guest_id)
    .maybeSingle();
  return data;
}

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/api/dashboard-layout', authenticate, dashboard);
app.use("/api/assets", assetsRouter);
app.use("/api/inspections", inspectionsRouter);

// ── Health Checks ──────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('Sentry test running!'));
app.get('/api/test', (req, res) => res.send('✅ API is alive'));
// Health check for deployment platforms
app.get('/health', (req, res) => res.json({ status: 'ok' }));
// Serve OpenAPI spec and Swagger UI
app.get('/openapi.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.json'));
});
app.get('/api-docs', (req, res) => {
  res.send(`<!DOCTYPE html>
  <html>
    <head>
      <title>API Docs</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui' });
        };
      </script>
    </body>
  </html>`);
});

// ── Webhook Registration ─────────────────────────────────────────────────--
app.get('/api/webhooks', (req, res) => {
  res.json({ webhooks });
});
app.post('/api/webhooks', (req, res) => {
  const { event, url } = req.body || {};
  if (!event || !url) return res.status(400).json({ message: 'Missing event or url' });
  webhooks.push({ event, url });
  res.status(201).json({ message: 'Webhook registered' });
});
app.delete('/api/webhooks', (req, res) => {
  const { event, url } = req.body || {};
  const index = webhooks.findIndex(w => w.event === event && w.url === url);
  if (index !== -1) webhooks.splice(index, 1);
  res.json({ message: 'Webhook removed' });
});

// ── App Integrations ─────────────────────────────────────────────────────--
app.get('/api/integrations', (req, res) => {
  res.json({ integrations });
});
app.post('/api/integrations/:name/connect', (req, res) => {
  const { name } = req.params;
  if (!integrations.hasOwnProperty(name)) {
    return res.status(400).json({ message: 'Unknown integration' });
  }
  integrations[name] = true;
  res.json({ message: `${name} connected` });
});

// ── AI Photo Validation ────────────────────────────────────────────────────
app.post('/api/validate-photo', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ result: 'No file uploaded' });
  const fileSizeKB = req.file.size / 1024;
  const result =
    fileSizeKB < 30
      ? 'Image too small — likely blurry ❌'
      : 'Image passed validation ✅';
  res.json({ result });
});

// ── Mock KYC & Credit Checks ──────────────────────────────────────────────
async function runKycCheck(buffer) {
  // Placeholder for an identity verification service
  return { passed: true };
}

async function fetchCreditScore(ssn) {
  // Placeholder for credit bureau integration
  const score = 650 + Math.floor(Math.random() * 101); // 650-750
  return { score };
}

// ── Intelligent Underwriting Helpers ───────────────────────────────────────
function parseDocumentBuffer(buffer) {
  // Stub OCR/NLP logic. In reality this would call a service like Textract.
  const text = buffer.toString('utf8');
  const fields = {};
  if (/income/i.test(text)) fields.income = 100000;
  if (/tax/i.test(text)) fields.taxes = 20000;
  return fields;
}

async function summarizeDocumentBuffer(buffer) {
  const text = buffer.toString('utf8');
  let summary = text.slice(0, 200);
  let key_terms = {};
  if (process.env.OPENAI_API_KEY) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Provide a short executive summary and extract key terms (amounts, dates, parties) from the document. Return JSON {"summary": string, "key_terms": object}.'
          },
          { role: 'user', content: text.slice(0, 12000) }
        ]
      });
      const data = JSON.parse(resp.choices[0].message.content || '{}');
      if (typeof data.summary === 'string') summary = data.summary;
      if (data.key_terms) key_terms = data.key_terms;
    } catch (err) {
      console.error('OpenAI doc summary error:', err);
    }
  }
  return { summary, key_terms };
}

async function autoFillFields(buffer) {
  const fields = parseDocumentBuffer(buffer);
  if (process.env.OPENAI_API_KEY) {
    try {
      const text = buffer.toString('utf8');
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
  'Extract borrower or business details from IDs or W-9s as JSON {"name":string,"ssn":string,"ein":string,"address":string}'
          },
          { role: 'user', content: text.slice(0, 12000) }
        ]
      });
      const extra = JSON.parse(resp.choices[0].message.content || '{}');
      Object.assign(fields, extra);
    } catch (err) {
      console.error('OpenAI auto fill error:', err);
    }
  }
  return fields;
}

function advancedCreditScore(bureauScore, history) {
  let score = bureauScore;
  if (Array.isArray(history) && history.length) {
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    score += Math.round((avg - 650) / 10);
  }
  const explanation = `Base ${bureauScore} adjusted with ${history?.length || 0} historical points`;
  return { score, explanation };
}

function detectFraud(applicant) {
  const anomalies = [];
  if (applicant.address && /p\.o\. box/i.test(applicant.address)) {
    anomalies.push('PO boxes are suspicious');
  }
  if (applicant.income && applicant.income > 1000000) {
    anomalies.push('Income unusually high');
  }
  return { suspicious: anomalies.length > 0, anomalies };
}

async function inspectAssetBuffer(buffer) {
  const text = buffer.toString('utf8');
  let report = {
    outstanding_balance: null,
    code_violations: [],
    neglect_signs: []
  };
  if (process.env.OPENAI_API_KEY) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Extract outstanding balance, evidence of code violations and signs of neglect from the document or photo. Return JSON {"outstanding_balance": number, "code_violations": [string], "neglect_signs": [string] }.'
          },
          { role: 'user', content: text.slice(0, 12000) }
        ]
      });
      report = JSON.parse(resp.choices[0].message.content || '{}');
    } catch (err) {
      console.error('OpenAI asset inspect error:', err);
    }
  }
  if (/\$([0-9,]+)/.test(text)) {
    const m = text.match(/\$([0-9,]+)/);
    report.outstanding_balance = parseInt(m[1].replace(/,/g, ''), 10);
  }
  if (/violation/i.test(text)) report.code_violations.push('possible violation');
  if (/boarded/i.test(text)) report.neglect_signs.push('boarded windows');
  if (/overgrown/i.test(text)) report.neglect_signs.push('overgrown yard');
  return report;
}

async function summarizeTroubledAssetBuffer(buffer) {
  const text = buffer.toString('utf8');
  let notes = text.slice(0, 200);
  if (process.env.OPENAI_API_KEY) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Summarize the condition issues, outstanding amounts, and next legal deadlines from this document.'
          },
          { role: 'user', content: text.slice(0, 12000) }
        ]
      });
      notes = resp.choices[0].message.content.trim();
    } catch (err) {
      console.error('OpenAI troubled asset summary error:', err);
    }
  }
  return notes;
}

async function fetchRecentComps(asset) {
  // Placeholder for CRM or MLS integration
  const base = asset?.value ? parseFloat(asset.value) : 500000;
  return [
    { address: '123 Main St', sale_price: Math.round(base * 0.95) },
    { address: '456 Oak Ave', sale_price: Math.round(base * 1.05) }
  ];
}

async function suggestPriceAndBlurb(comps, features = {}) {
  let price_suggestion = null;
  let blurb = '';
  if (process.env.OPENAI_API_KEY) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a real estate marketing assistant.'
          },
          {
            role: 'user',
            content: `Given these sale comps ${JSON.stringify(
              comps
            )} and this property’s features ${JSON.stringify(
              features
            )}, recommend an asking price and compose a 2-sentence marketing blurb.`
          }
        ]
      });
      blurb = resp.choices[0].message.content.trim();
      const m = blurb.match(/\$([0-9,]+)/);
      if (m) price_suggestion = parseInt(m[1].replace(/,/g, ''), 10);
    } catch (err) {
      console.error('OpenAI price suggestion error:', err);
    }
  }
  return { price_suggestion, blurb };
}

// ── Loan Application Endpoints ─────────────────────────────────────────────
app.post('/api/loan-applications', upload.single('document'), async (req, res) => {
  const { name, email, ssn, amount } = req.body;
  if (!name || !email || !ssn || !amount) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const kyc = await runKycCheck(req.file ? req.file.buffer : null);
  const credit = await fetchCreditScore(ssn);

  const { data, error } = await supabase
    .from('loan_applications')
    .insert([
      {
        name,
        email,
        ssn,
        amount,
        credit_score: credit.score,
        kyc_passed: kyc.passed,
        submitted_at: new Date().toISOString()
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Insert application error:', error);
    return res.status(500).json({ message: 'Failed to save application' });
  }

  res.status(201).json({ application: data });
});

app.get('/api/loan-applications', async (req, res) => {
  const { data, error } = await supabase
    .from('loan_applications')
    .select('id, name, amount, credit_score, kyc_passed, submitted_at')
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('List applications error:', error);
    return res.status(500).json({ message: 'Failed to fetch applications' });
  }
  res.json({ applications: data });
});

// ── Risk-Scoring Logic ─────────────────────────────────────────────────────
function calculateRiskScore({ amount, description, lastSubmittedAt }) {
  let score = 100;
  if (amount > 100000) score -= 20;
  if (description.length < 15) score -= 10;
  if (lastSubmittedAt) {
    const lastDate = new Date(lastSubmittedAt);
    const now = new Date();
    const diffInDays = (now - lastDate) / (1000 * 60 * 60 * 24);
    if (diffInDays < 7) score -= 15;
  }
  return Math.max(score, 0);
}

// ── Draw Request Submission ─────────────────────────────────────────────────
app.post('/api/draw-request', async (req, res) => {
  const { project, amount, description, project_number, property_location } = req.body;
  if (!project || !amount || !description || !project_number || !property_location) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // 1) Fetch the very last draw for this project to compute risk
  const { data: lastDraw, error: lastDrawError } = await supabase
    .from('draw_requests')
    .select('submitted_at')
    .eq('project', project)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastDrawError) {
    console.error('Error fetching last draw:', lastDrawError);
   // Continue without previous draw information
  }

  // 2) Compute risk score
  const riskScore = calculateRiskScore({
    amount,
    description,
    lastSubmittedAt: lastDraw?.submitted_at
  });

  // 3) Insert new draw entry
  const { data, error } = await supabase
    .from('draw_requests')
    .insert([{
      project,
      amount,
      description,
      project_number,
      property_location,
      status: 'submitted',
      risk_score: riskScore,
      submitted_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('Insert error:', error);
    return res.status(500).json({ message: 'Failed to submit draw request' });
  }

  console.log('📥 Submitted draw with risk score:', data.risk_score);
  res.status(200).json({ message: 'Draw request submitted!', data });
});

// ── Review/Approve Draw ─────────────────────────────────────────────────────
app.post('/api/review-draw', async (req, res) => {
  const { id, status, comment } = req.body;
  if (!id || !status) return res.status(400).json({ message: 'Missing id or status' });

  const updates = { status, reviewed_at: new Date().toISOString() };
  if (status === 'approved') updates.approved_at = new Date().toISOString();
  if (status === 'funded') updates.funded_at = new Date().toISOString();
  if (status === 'rejected') {
    updates.rejected_at = new Date().toISOString();
    updates.review_comment = comment || '';
  }

  const { data, error } = await supabase
    .from('draw_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Update error:', error);
    return res.status(500).json({ message: 'Failed to update draw request' });
  }

  console.log('🔄 Updated draw request:', data);
   recordFeedback({
    decision_type: 'draw',
    entity_id: id,
    decision: status,
    comments: comment || ''
  });
  retrainModel();
  res.status(200).json({ message: 'Draw request updated', data });
});

// ── Get All Draws (flatten/alias fields) ────────────────────────────────────
app.get('/api/get-draws', async (req, res) => {
    const { status, project } = req.query;
  let q = supabase
    .from('draw_requests')
    .select(`
      id,
      project,
      amount,
      description,
      project_number,
      property_location,
      status,
      submitted_at    as submittedAt,
      reviewed_at     as reviewedAt,
      approved_at     as approvedAt,
      rejected_at     as rejectedAt,
      funded_at       as fundedAt,
      review_comment  as reviewComment,
      risk_score      as riskScore
    `)
    .order('submitted_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (project) q = q.eq('project', project);
  const { data, error } = await q;
  
  if (error) {
    console.error('Get draws error:', error);
    return res.status(500).json({ message: 'Failed to fetch draw requests' });
  }
  res.json({ draws: data });
});

// Get single Draw Request
app.get('/api/draw-requests/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('draw_requests')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ message: 'Failed to fetch draw request' });
  res.json({ draw: data });
});

// Export Draw Requests as CSV
app.get('/api/draw-requests/export', async (req, res) => {
  const { status } = req.query;
  let q = supabase
    .from('draw_requests')
    .select('id, project, amount, status, submitted_at');
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to export draws' });
  const header = 'id,project,amount,status,submitted_at';
  const rows = data.map(d =>
    [d.id, d.project, d.amount, d.status, d.submitted_at].join(',')
  );
  res.setHeader('Content-Type', 'text/csv');
  res.send([header, ...rows].join('\n'));
});

// Update a Draw Request
app.put('/api/draw-requests/:id', async (req, res) => {
  const updates = req.body || {};
  const { data, error } = await supabase
    .from('draw_requests')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update draw' });
  res.json({ draw: data });
});

// Delete a Draw Request
app.delete('/api/draw-requests/:id', async (req, res) => {
  const { error } = await supabase
    .from('draw_requests')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ message: 'Failed to delete draw' });
  res.json({ message: 'Deleted' });
});

// ── Upload & Verify Lien Waiver ───────────────────────────────────────────────
app.post('/api/upload-lien-waiver', upload.single('file'), async (req, res) => {
  const { draw_id, contractor_name, waiver_type } = req.body;
  if (!draw_id || !contractor_name || !waiver_type || !req.file) {
    return res.status(400).json({ message: 'Missing required fields or file' });
  }

  // 1) Upload file to Supabase Storage bucket “draw-inspections”
  const filePath = `lien-waivers/${draw_id}/${Date.now()}_${req.file.originalname}`;
  const { error: uploadError } = await supabase
    .storage
    .from('draw-inspections')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return res.status(500).json({ message: 'File upload failed' });
  }
  const fileUrl = supabase
    .storage
    .from('draw-inspections')
    .getPublicUrl(filePath)
    .publicURL;

  // 2) Call AI-service stub (could parse PDF, etc.)
  const aiReport = await Promise.resolve({ errors: [], fields: {} }); // replace with real aiService.verifyLienWaiver
  const passed = aiReport.errors.length === 0;

  // 3) Insert record into lien_waivers table
  const { data, error } = await supabase
    .from('lien_waivers')
    .insert([{
      draw_id: parseInt(draw_id, 10),
      contractor_name,
      waiver_type,
      file_url: fileUrl,
      verified_at: new Date().toISOString(),
      verification_passed: passed,
      verification_report: aiReport
    }])
    .select()
    .single();

  if (error) {
    console.error('Insert lien waiver error:', error);
    return res.status(500).json({ message: 'Failed to save waiver' });
  }

  res.status(200).json({ message: 'Lien waiver uploaded', data });
});

// ── List All Lien Waivers for a Given Draw ─────────────────────────────────
app.get('/api/list-lien-waivers', async (req, res) => {
    const { draw_id, project_id } = req.query;
  if (!draw_id && !project_id) {
    return res.status(400).json({ message: 'Missing draw_id or project_id' });
  }
  
   let q = supabase
    .from('lien_waivers')
      .select('id, contractor_name, waiver_type, file_url, verified_at, verification_passed, draw_id, project_id');
  if (draw_id) q = q.eq('draw_id', draw_id);
  if (project_id) q = q.eq('project_id', project_id);
  const { data, error } = await q.order('verified_at', { ascending: false });
  
  if (error) return res.status(500).json({ message: 'Failed to list waivers' });
  res.json({ waivers: data });
});

// Get single Lien Waiver
app.get('/api/lien-waivers/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('lien_waivers')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ message: 'Failed to fetch waiver' });
  res.json({ waiver: data });
});

// Update Lien Waiver
app.put('/api/lien-waivers/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('lien_waivers')
    .update(req.body || {})
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update waiver' });
  res.json({ waiver: data });
});

// Delete Lien Waiver
app.delete('/api/lien-waivers/:id', async (req, res) => {
  const { error } = await supabase
    .from('lien_waivers')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ message: 'Failed to delete waiver' });
  res.json({ message: 'Deleted' });
});

// Export Lien Waivers as CSV
app.get('/api/lien-waivers/export', async (req, res) => {
  const { draw_id, project_id } = req.query;
  let q = supabase
    .from('lien_waivers')
    .select('id, contractor_name, waiver_type, verification_passed, draw_id, project_id, verified_at');
  if (draw_id) q = q.eq('draw_id', draw_id);
  if (project_id) q = q.eq('project_id', project_id);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to export waivers' });
  const header = 'id,contractor_name,waiver_type,verification_passed,draw_id,project_id,verified_at';
  const rows = data.map(w =>
    [w.id, w.contractor_name, w.waiver_type, w.verification_passed, w.draw_id, w.project_id, w.verified_at].join(',')
  );
  res.setHeader('Content-Type', 'text/csv');
  res.send([header, ...rows].join('\n'));
});

// ── List Inspections by Draw or Project ─────────────────────────────────────
app.get('/api/list-inspections', async (req, res) => {
  const { draw_id, project_id } = req.query;
  if (!draw_id && !project_id) {
    return res.status(400).json({ message: 'Missing draw_id or project_id' });
  }

  let query = supabase
    .from('inspections')
    .select('id, inspection_date, notes, draw_id, project_id');

  if (draw_id) query = query.eq('draw_id', draw_id);
  if (project_id) query = query.eq('project_id', project_id);

  query = query.order('inspection_date', { ascending: false });

  const { data, error } = await query;
  if (error) return res.status(500).json({ message: 'Failed to list inspections' });
  res.json({ inspections: data });
});

// ── Record Hazard Loss Information ─────────────────────────────────────────
app.post('/api/hazard-loss', async (req, res) => {
  const { draw_id, part_i, follow_up, restoration } = req.body || {};
  if (!draw_id || !part_i) {
    return res.status(400).json({ message: 'Missing draw_id or Part I data' });
  }
  const { data, error } = await supabase
    .from('hazard_losses')
    .insert([{ draw_id, part_i, follow_up: follow_up || null, restoration: restoration || null }])
    .select()
    .single();
  if (error) {
    console.error('Hazard loss insert error:', error);
    return res.status(500).json({ message: 'Failed to record hazard loss' });
  }
  res.status(201).json({ hazard_loss: data });
});

// ── Projects CRUD ───────────────────────────────────────────────────────────
app.post('/api/projects', async (req, res) => {
  const { name, number, address, owner_id } = req.body || {};
  if (!name || !number || !address || !owner_id) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('projects')
    .insert([{ name, number, address, owner_id }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create project' });
  res.status(201).json({ project: data });
});

app.get('/api/projects', async (req, res) => {
   const { owner_id, status } = req.query;
  let q = supabase.from('projects').select('*');
  if (owner_id) q = q.eq('owner_id', owner_id);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to list projects' });
  res.json({ projects: data });
});

app.get('/api/projects/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(500).json({ message: 'Failed to fetch project' });
  res.json({ project: data });
});

app.get('/api/projects/export', async (req, res) => {
    const { owner_id, status } = req.query;
  let q = supabase
    .from('projects')
    .select('id, name, number, status, created_at');
  if (owner_id) q = q.eq('owner_id', owner_id);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to export projects' });
  const header = 'id,name,number,status,created_at';
  const rows = data.map(p => [p.id, p.name, p.number, p.status, p.created_at].join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.send([header, ...rows].join('\n'));
});

app.put('/api/projects/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('projects')
    .update(req.body || {})
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update project' });
  res.json({ project: data });
});

app.delete('/api/projects/:id', async (req, res) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ message: 'Failed to delete project' });
  res.json({ message: 'Deleted' });
});

// ── Create a Loan ───────────────────────────────────────────────────────────
app.post('/api/loans', async (req, res) => {
  const { borrower_name, amount, interest_rate, term_months, start_date } = req.body;
  if (!borrower_name || !amount || !interest_rate || !term_months || !start_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('loans')
    .insert([{ borrower_name, amount, interest_rate, term_months, start_date }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create loan' });
  await triggerWebhooks('loan.created', data);
  res.status(201).json({ loan: data });
});

// ── List All Loans ──────────────────────────────────────────────────────────
app.get('/api/loans', async (req, res) => {
   const { status, borrower, from, to, minRisk, maxRisk, search } = req.query;
  try {
    let q = supabase
      .from('loans')
      .select('id, borrower_name, amount, interest_rate, term_months, start_date, status, risk_score, created_at')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (borrower) q = q.ilike('borrower_name', `%${borrower}%`);
    if (from) q = q.gte('start_date', from);
    if (to) q = q.lte('start_date', to);
    if (minRisk) q = q.gte('risk_score', parseFloat(minRisk));
    if (maxRisk) q = q.lte('risk_score', parseFloat(maxRisk));
    if (search) q = q.textSearch('borrower_name', search, { type: 'plain' });
    const { data, error } = await q;
    if (error) throw error;
    res.json({ loans: data });
  } catch (err) {
    console.error('Loan list error:', err);
    res.status(500).json({ message: 'Failed to fetch loans' });
  }
});

// Export Loans as CSV
app.get('/api/loans/export', async (req, res) => {
  req.headers.accept = 'text/csv';
  const { status, borrower } = req.query;
  let q = supabase
    .from('loans')
    .select('id, borrower_name, amount, status, created_at');
  if (status) q = q.eq('status', status);
  if (borrower) q = q.ilike('borrower_name', `%${borrower}%`);
  const { data, error } = await q;
  if (error) return res.status(500).json({ message: 'Failed to export loans' });
  const header = 'id,borrower_name,amount,status,created_at';
  const rows = data.map(l =>
    [l.id, l.borrower_name, l.amount, l.status, l.created_at].join(',')
  );
  res.setHeader('Content-Type', 'text/csv');
  res.send([header, ...rows].join('\n'));
});

// Return loans for a specific borrower user
app.get('/api/my-loans', async (req, res) => {
  const { user_id } = req.query || {};
  if (!user_id) return res.status(400).json({ message: 'Missing user_id' });
  const { data, error } = await supabase
    .from('loans')
    .select('id, amount, status, start_date')
    .eq('borrower_user_id', user_id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch loans' });
  res.json({ loans: data });
});

// Return loan applications for the current user by email or id
app.get('/api/my-applications', async (req, res) => {
  const { email, user_id } = req.query || {};
  if (!email && !user_id)
    return res.status(400).json({ message: 'Missing email or user_id' });
  let q = supabase
    .from('loan_applications')
    .select('id, amount, credit_score, kyc_passed, submitted_at');
  if (user_id) q = q.eq('user_id', user_id);
  else q = q.eq('email', email);
  const { data, error } = await q.order('submitted_at', { ascending: false });
  if (error)
    return res.status(500).json({ message: 'Failed to fetch applications' });
  res.json({ applications: data });
});

 // Batch update loan status
app.post('/api/loans/batch-update', async (req, res) => {
  const { ids, status } = req.body || {};
  if (!Array.isArray(ids) || !ids.length || !status) {
    return res.status(400).json({ message: 'Missing ids or status' });
  }
  const { error } = await supabase
    .from('loans')
    .update({ status })
    .in('id', ids);
  if (error) {
    console.error('Batch update error:', error);
    return res.status(500).json({ message: 'Failed to update loans' });
  }
  res.json({ message: 'Updated' });
});

// Update a Loan
app.put('/api/loans/:loanId', async (req, res) => {
  const { loanId } = req.params;
  const updates = req.body || {};
  const { data, error } = await supabase
    .from('loans')
    .update(updates)
    .eq('id', loanId)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update loan' });
  res.json({ loan: data });
});

// Delete a Loan
app.delete('/api/loans/:loanId', async (req, res) => {
  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', req.params.loanId);
  if (error) return res.status(500).json({ message: 'Failed to delete loan' });
  res.json({ message: 'Deleted' });
});

// ── Generate Amortization Schedule ──────────────────────────────────────────
app.post('/api/loans/:loanId/generate-schedule', async (req, res) => {
  const { loanId } = req.params;

  // Fetch loan details
  const { data: loan, error: loanErr } = await supabase
    .from('loans')
    .select('amount, interest_rate, term_months, start_date')
    .eq('id', loanId)
    .single();

  if (loanErr || !loan) return res.status(404).json({ message: 'Loan not found' });

  const P = parseFloat(loan.amount);
  const r = parseFloat(loan.interest_rate) / 100 / 12; // monthly rate
  const n = parseInt(loan.term_months, 10);
  const A = P * r / (1 - Math.pow(1 + r, -n)); // standard amortization formula

  const inserts = [];
  let balance = P;
  let date = new Date(loan.start_date);

  for (let i = 1; i <= n; i++) {
    const interestDue = balance * r;
    const principalDue = A - interestDue;
    balance -= principalDue;

    inserts.push({
      loan_id: parseInt(loanId, 10),
      due_date: date.toISOString().slice(0, 10),
      principal_due: principalDue,
      interest_due: interestDue,
      balance_after: balance
    });

    // Advance one month
    date.setMonth(date.getMonth() + 1);
  }

  const { data: scheduleData, error: insertErr } = await supabase
    .from('amortization_schedules')
    .insert(inserts)
    .select();

  if (insertErr) return res.status(500).json({ message: 'Failed to generate schedule' });
  res.json({ schedule: scheduleData });
});

// ── List Amortization Schedule ─────────────────────────────────────────────
app.get('/api/loans/:loanId/schedule', async (req, res) => {
  const { data, error } = await supabase
    .from('amortization_schedules')
    .select('*')
    .eq('loan_id', req.params.loanId)
    .order('due_date', { ascending: true });

  if (error) return res.status(500).json({ message: 'Failed to fetch schedule' });
  res.json({ schedule: data });
});

// ── Record a Payment ───────────────────────────────────────────────────────
app.post('/api/loans/:loanId/payments', async (req, res) => {
   const { amount, date } = req.body;
  if (!amount || !date) {
    return res.status(400).json({ message: 'Missing amount or date' });
  }
  const { data: lastPayment, error: lastErr } = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', req.params.loanId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) return res.status(500).json({ message: 'Failed to fetch last payment' });

  const prevBalance = lastPayment ? parseFloat(lastPayment.remaining_balance) : null;

  // If no previous payment, fetch loan principal
  const { data: loan, error: loanErr } = await supabase
    .from('loans')
    .select('amount')
    .eq('id', req.params.loanId)
    .single();

  if (!loan) return res.status(404).json({ message: 'Loan not found' });

  let balance = prevBalance !== null ? prevBalance : parseFloat(loan.amount);

  // Get the loan’s interest rate for interest calculation
  const { data: loan2 } = await supabase
    .from('loans')
    .select('interest_rate')
    .eq('id', req.params.loanId)
    .single();

  const r = parseFloat(loan2.interest_rate) / 100 / 12;
  const interest = balance * r;
  const principal = Math.max(0, amount - interest);
  const remaining = balance - principal;

  const { data: paymentData, error: paymentErr } = await supabase
    .from('payments')
    .insert([{
      loan_id: parseInt(req.params.loanId, 10),
      date,
      amount,
      applied_principal: principal,
      applied_interest: interest,
      remaining_balance: remaining
    }])
    .select()
    .single();
  await triggerWebhooks('payment.created', paymentData);
  
  if (paymentErr) return res.status(500).json({ message: 'Failed to record payment' });
  res.status(201).json({ payment: paymentData });
});

// List Payments for a Loan
app.get('/api/loans/:loanId/payments', async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', req.params.loanId)
    .order('date', { ascending: false });

  if (error) return res.status(500).json({ message: 'Failed to fetch payments' });
  res.json({ payments: data });
});

// Get current loan balance for payoff calculations
app.get('/api/loans/:loanId/balance', async (req, res) => {
  const { loanId } = req.params;
  const { data: last, error } = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', loanId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ message: 'Failed to fetch balance' });

  if (last) return res.json({ balance: last.remaining_balance });

  const { data: loan, error: loanErr } = await supabase
    .from('loans')
    .select('amount')
    .eq('id', loanId)
    .single();

  if (loanErr) return res.status(500).json({ message: 'Failed to fetch loan' });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });
  res.json({ balance: loan.amount });
});

// Calculate payoff amount for a given date
app.post('/api/loans/:loanId/payoff', async (req, res) => {
  const { payoff_date } = req.body || {};
  if (!payoff_date) return res.status(400).json({ message: 'Missing payoff_date' });

  const { data: loan, error } = await supabase
    .from('loans')
    .select('interest_rate')
    .eq('id', req.params.loanId)
    .single();
  if (error) return res.status(500).json({ message: 'Failed to fetch loan' });

  const balRes = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', req.params.loanId)
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

// ── Create Payment Portal Link ────────────────────────────────────────────
app.post('/api/loans/:loanId/payment-portal', (req, res) => {
  const { amount } = req.body || {};
  if (!amount) return res.status(400).json({ message: 'Missing amount' });
  const token = Math.random().toString(36).slice(2);
  const url = `https://payments.example.com/pay/${token}`;
  res.json({ url });
});

// ── Escrow Routes ──────────────────────────────────────────────────────────
app.get('/api/escrows', async (req, res) => {
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance');

  if (error) return res.status(500).json({ message: 'Failed to fetch escrows' });
  res.json({ escrows: data });
});

app.get('/api/escrows/upcoming', async (req, res) => {
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance');
  if (error) return res.status(500).json({ message: 'Failed to fetch escrows' });

  const results = [];
  for (const row of data || []) {
    const { data: loan } = await supabase
      .from('loans')
      .select('start_date')
      .eq('id', row.loan_id)
      .maybeSingle();
    const next_tax_due = loan ? calcNextTaxDue(loan.start_date) : null;
    const next_insurance_due = loan ? calcNextInsuranceDue(loan.start_date) : null;
    const projected_balance =
      parseFloat(row.escrow_balance || 0) -
      parseFloat(row.tax_amount || 0) -
      parseFloat(row.insurance_amount || 0);
    results.push({
      ...row,
      next_tax_due,
      next_insurance_due,
      projected_balance
    });
  }

  res.json({ escrows: results });
});

app.get('/api/loans/:loanId/escrow', async (req, res) => {
  const { loanId } = req.params;
  if (isNaN(parseInt(loanId, 10))) {
    return res.status(400).json({ message: 'Invalid loan id' });
  }
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance')
    .eq('loan_id', loanId)
    .maybeSingle();

  if (error) return res.status(500).json({ message: 'Failed to fetch escrow' });
  if (!data) return res.status(404).json({ message: 'Escrow not found' });
  res.json({ escrow: data });
});

app.post('/api/loans/:loanId/escrow/pay', async (req, res) => {
  const { loanId } = req.params;
  const { type, amount } = req.body || {};
  if (isNaN(parseInt(loanId, 10))) {
    return res.status(400).json({ message: 'Invalid loan id' });
  }
  if (!type || !amount) {
    return res.status(400).json({ message: 'Missing type or amount' });
  }
  if (!['tax', 'insurance'].includes(type)) {
    return res.status(400).json({ message: 'Invalid type' });
  }
  const { data: esc, error } = await supabase
    .from('escrows')
    .select('escrow_balance')
    .eq('loan_id', loanId)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to fetch escrow' });
  if (!esc) return res.status(404).json({ message: 'Escrow not found' });
  const newBal = parseFloat(esc.escrow_balance) - parseFloat(amount);
  const column = type === 'tax' ? 'tax_amount' : 'insurance_amount';
  await supabase
    .from('escrows')
    .update({ escrow_balance: newBal, [column]: 0 })
    .eq('loan_id', loanId);
  res.json({ balance: newBal });
});

app.get('/api/loans/:loanId/escrow/projection', async (req, res) => {
  const { loanId } = req.params;
  if (isNaN(parseInt(loanId, 10))) {
    return res.status(400).json({ message: 'Invalid loan id' });
  }
  const { data, error } = await supabase
    .from('escrows')
    .select('escrow_balance, tax_amount, insurance_amount')
    .eq('loan_id', loanId)
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

// Loan detail including schedule, payments and collateral
app.get('/api/loans/:loanId/details', async (req, res) => {
  const { loanId } = req.params;
  try {
    const { data: loan, error: loanErr } = await supabase
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .single();
    if (loanErr) throw loanErr;
    if (!loan) return res.status(404).json({ message: 'Loan not found' });

    const { data: schedule } = await supabase
      .from('amortization_schedules')
      .select('*')
      .eq('loan_id', loanId)
      .order('due_date');
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('loan_id', loanId)
      .order('date', { ascending: false });
    const { data: collateral } = await supabase
      .from('asset_collateral')
      .select('*')
      .eq('asset_id', loan.asset_id || 0);

    res.json({ loan, schedule, payments, collateral });
  } catch (err) {
    console.error('Loan detail error:', err);
    res.status(500).json({ message: 'Failed to fetch loan details' });
  }
});

// ── Underwriting Tasks CRUD ───────────────────────────────────────────────
app.get('/api/tasks', async (req, res) => {
  const { data, error } = await supabase
    .from('underwriting_tasks')
    .select('*')
    .order('id');

  if (error) return res.status(500).json({ message: 'Failed to fetch tasks' });
  res.json({ tasks: data });
});

app.post('/api/tasks', async (req, res) => {
  const { assign, comment, status } = req.body;
  if (!assign) return res.status(400).json({ message: 'Missing assign' });

  const { data, error } = await supabase
    .from('underwriting_tasks')
    .insert([{ assign, comment: comment || '', status: status || 'Underwriting' }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create task' });
  res.status(201).json({ task: data });
});

app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { assign, comment, status } = req.body;
  const updates = {};
  if (assign !== undefined) updates.assign = assign;
  if (comment !== undefined) updates.comment = comment;
  if (status !== undefined) updates.status = status;

  const { data, error } = await supabase
    .from('underwriting_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to update task' });
  res.json({ task: data });
});

app.get('/api/decision-history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('underwriting_tasks')
      .select('id, assign, comment, status, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ history: data });
  } catch (err) {
    console.error('Decision history error:', err);
    res.status(500).json({ history: [] });
  }
});

// ── Document Generation from Templates ─────────────────────────────────────
const Handlebars = require('handlebars');
const PDFDocument = require('pdfkit');

app.post('/api/documents', async (req, res) => {
  const { template, data } = req.body;
  if (!template) return res.status(400).json({ message: 'Missing template' });

  const templatePath = path.join(__dirname, 'templates', `${template}.hbs`);
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ message: 'Template not found' });
  }

  const source = fs.readFileSync(templatePath, 'utf8');
  const compiled = Handlebars.compile(source);
  const text = compiled(data || {});

  const doc = new PDFDocument();
  const buffers = [];
  doc.on('data', b => buffers.push(b));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfData);
  });

  doc.text(text);
  doc.end();
});

app.post('/api/sign-document', async (req, res) => {
  const { text, signer } = req.body || {};
  if (!text || !signer) {
    return res.status(400).json({ message: 'Missing text or signer' });
  }
  try {
    const doc = new PDFDocument();
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', async () => {
      const pdf = Buffer.concat(buffers);
      const filePath = `signed/${Date.now()}_${signer.replace(/\s+/g, '_')}.pdf`;
      const { error } = await supabase
        .storage
        .from('signed-docs')
        .upload(filePath, pdf, { contentType: 'application/pdf' });
      if (error) {
        console.error('Upload sign doc error:', error);
        return res.status(500).json({ message: 'Failed to store signed doc' });
      }
      const url = supabase.storage.from('signed-docs').getPublicUrl(filePath).publicURL;
      res.json({ url });
    });
    doc.text(text);
    doc.moveDown();
    doc.text(`Signed by ${signer} on ${new Date().toLocaleDateString()}`, {
      align: 'right'
    });
    doc.end();
  } catch (err) {
    console.error('Sign document error:', err);
    res.status(500).json({ message: 'Failed to sign document' });
  }
});

// ── Closing & Tax Document Generation ─────────────────────────────────────-
app.post('/api/generate-closing-doc', (req, res) => {
  const { borrower, property, loan_amount, closing_date } = req.body || {};
  if (!borrower || !property || !loan_amount || !closing_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const tpl = path.join(__dirname, 'templates', 'closing.hbs');
  const source = fs.readFileSync(tpl, 'utf8');
  const compiled = Handlebars.compile(source);
  const text = compiled({ borrower, property, loan_amount, closing_date });

  const doc = new PDFDocument();
  const buffers = [];
  doc.on('data', b => buffers.push(b));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.concat(buffers));
  });
  doc.text(text);
  doc.end();
});

app.post('/api/generate-tax-form', (req, res) => {
  const { form_type, data } = req.body || {};
  if (!form_type || !data) {
    return res.status(400).json({ message: 'Missing form_type or data' });
  }
  const allowed = ['1098', '1099'];
  if (!allowed.includes(form_type)) {
    return res.status(400).json({ message: 'Invalid form_type' });
  }
  const tpl = path.join(__dirname, 'templates', `${form_type}.hbs`);
  const source = fs.readFileSync(tpl, 'utf8');
  const compiled = Handlebars.compile(source);
  const text = compiled(data);
  const doc = new PDFDocument();
  const buffers = [];
  doc.on('data', b => buffers.push(b));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.concat(buffers));
  });
  doc.text(text);
  doc.end();
});

// ── Portfolio Summary as PDF ───────────────────────────────────────────────
app.post('/api/portfolio-summary', async (req, res) => {
  const { period } = req.body || {};
  if (!period) return res.status(400).json({ message: 'Missing period' });

  try {
    const { data: loans } = await supabase.from('loans').select('id');
    const { data: collections } = await supabase
      .from('collections')
      .select('due_date, status, loan_id');
    const { data: projects } = await supabase.from('projects').select('address');

    const now = new Date();
    const delinquents = (collections || []).filter(c =>
      c.due_date && new Date(c.due_date) < now && c.status !== 'paid'
    ).length;
    const delinquency = loans && loans.length ? delinquents / loans.length : 0;

    const stateCounts = {};
    for (const p of projects || []) {
      const m = p.address && p.address.match(/,\s*([A-Z]{2})\b/);
      if (m) stateCounts[m[1]] = (stateCounts[m[1]] || 0) + 1;
    }
    const topState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    let summary = `Portfolio has ${loans?.length || 0} loans. Delinquency rate ${
      (delinquency * 100).toFixed(2)
    }%. Highest concentration in ${topState}.`;

    if (process.env.OPENAI_API_KEY) {
      try {
        const resp = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You summarize portfolio performance.' },
            {
              role: 'user',
              content: `Generate a ${period} portfolio summary. There are ${
                loans.length
              } loans with a delinquency rate of ${(delinquency * 100).toFixed(
                2
              )}%. Highest concentration in ${topState}.`
            }
          ]
        });
        summary = resp.choices[0].message.content || summary;
      } catch (err) {
        console.error('OpenAI summary error:', err);
      }
    }

    const doc = new PDFDocument();
    const buffers = [];
    doc.on('data', b => buffers.push(b));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.send(Buffer.concat(buffers));
    });
    doc.text(summary);
    doc.end();
  } catch (err) {
    console.error('Summary generation failed:', err);
    res.status(500).json({ message: 'Failed to generate summary' });
  }
});

app.post('/api/underwriter-chat', async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ message: 'Missing question' });

  const match = question.match(/borrower\s+([^?]+?)\s*(?:'s|\?|$)/i);
  const borrower = match ? match[1].trim() : null;
  if (!borrower) {
    return res.status(400).json({ message: 'Borrower not identified' });
  }

  try {
    const result = await get_next_insurance_due({ borrower_name: borrower });
    if (!result) return res.status(404).json({ message: 'Borrower not found' });
    res.json({ answer: `Next insurance premium due on ${result.due_date}.`, result });
  } catch (err) {
    console.error('Underwriter chat error:', err);
    res.status(500).json({ message: 'Failed to answer question' });
  }
});

// ── Query Loans via LLM ─────────────────────────────────────────────────────
app.post('/api/query-loans', async (req, res) => {
  const { query } = req.body || {};
  if (!query) return res.status(400).json({ message: 'Missing query' });

  let filters = {};
  if (process.env.OPENAI_API_KEY) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Translate loan search queries into JSON with keys min_amount, max_amount, min_interest_rate, max_interest_rate, start_date_from, start_date_to.'
          },
          { role: 'user', content: query }
        ]
      });
      filters = JSON.parse(resp.choices[0].message.content || '{}');
    } catch (err) {
      console.error('OpenAI query parse error:', err);
    }
  }

  try {
    let sb = supabase.from('loans').select('*');
    if (filters.min_amount) sb = sb.gte('amount', filters.min_amount);
    if (filters.max_amount) sb = sb.lte('amount', filters.max_amount);
    if (filters.min_interest_rate)
      sb = sb.gte('interest_rate', filters.min_interest_rate);
    if (filters.max_interest_rate)
      sb = sb.lte('interest_rate', filters.max_interest_rate);
    if (filters.start_date_from) sb = sb.gte('start_date', filters.start_date_from);
    if (filters.start_date_to) sb = sb.lte('start_date', filters.start_date_to);
    const { data, error } = await sb;
    if (error) throw error;
    res.json({ loans: data });
  } catch (err) {
    console.error('Loan query error:', err);
    res.status(500).json({ message: 'Failed to query loans' });
  }
});

// ── Virtual-Assistant Endpoint: `/api/ask` ───────────────────────────────────
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  try {
    // ← v4+ chat completion call:
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
         { role: 'system', content: 'You are Kontra AI, a customer care assistant for loan servicing.' },
        { role: 'user', content: question }
      ],
      functions,
      function_call: 'auto'
    });

    const msg = response.choices[0].message;

    // If OpenAI is instructing a function call, run it
    if (msg.function_call) {
      let result;
      if (msg.function_call.name === 'get_loans') {
        result = await get_loans();
      } else if (msg.function_call.name === 'get_draws') {
        result = await get_draws();
        } else if (msg.function_call.name === 'get_escrow_balance') {
        const args = JSON.parse(msg.function_call.arguments || '{}');
        result = await get_escrow_balance(args);
      } else if (msg.function_call.name === 'get_payoff_instructions') {
        result = await get_payoff_instructions();
      } else if (msg.function_call.name === 'get_next_insurance_due') {
        const args = JSON.parse(msg.function_call.arguments || '{}');
        result = await get_next_insurance_due(args);
            } else if (msg.function_call.name === 'get_troubled_assets') {
        const args =
          typeof msg.function_call.arguments === 'string'
            ? JSON.parse(msg.function_call.arguments || '{}')
            : msg.function_call.arguments || {};
        result = await supabase
          .from('troubled_assets')
          .select('*')
          .order('predicted_risk', { ascending: false })
          .limit(args.topN || 5);
      } else if (msg.function_call.name === 'get_revived_assets') {
        result = await supabase
          .from('assets')
          .select('*')
          .eq('status', 'revived')
          .order('updated_at', { ascending: false });
       } else if (msg.function_call.name === 'get_asset_info') {
        const args = JSON.parse(msg.function_call.arguments || '{}');
        result = await get_asset_info(args);
      } else if (msg.function_call.name === 'get_loan_details') {
        const args = JSON.parse(msg.function_call.arguments || '{}');
        result = await get_loan_details(args);
      } else if (msg.function_call.name === 'get_guest_profile') {
        const args = JSON.parse(msg.function_call.arguments || '{}');
        result = await get_guest_profile(args);
      }
      return res.json({ assistant: msg, functionResult: result });
    }

    // Otherwise, return the assistant’s text
    res.json({ assistant: msg });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'AI service failed' });
  }
});

// ── ChatOps Endpoint ───────────────────────────────────────────────────────
app.post('/api/chatops', async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ message: 'Missing question' });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You assist internal operators with portfolio data and tasks.' },
        { role: 'user', content: question }
      ],
      functions: chatOpsFunctions,
      function_call: 'auto'
    });

    const msg = response.choices[0].message;
    if (msg.function_call) {
      const args = JSON.parse(msg.function_call.arguments || '{}');
      let result;
      if (msg.function_call.name === 'list_past_due_loans') {
        result = await list_past_due_loans(args);
      } else if (msg.function_call.name === 'get_overall_occupancy') {
        result = await get_overall_occupancy();
      } else if (msg.function_call.name === 'get_asset_info') {
        result = await get_asset_info(args);
      } else if (msg.function_call.name === 'get_loan_details') {
        result = await get_loan_details(args);
      } else if (msg.function_call.name === 'get_guest_profile') {
        result = await get_guest_profile(args);
      }
      return res.json({ assistant: msg, functionResult: result });
    }

    res.json({ assistant: msg });
  } catch (err) {
    console.error('ChatOps error:', err);
    res.status(500).json({ message: 'Failed to answer question' });
  }
});

app.post('/api/guest-chat', async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ message: 'Missing question' });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a hotel concierge assisting guests.' },
        { role: 'user', content: question }
      ]
    });

    const msg = response.choices[0].message;
    res.json({ assistant: msg });
  } catch (err) {
    console.error('Guest chat error:', err);
    res.status(500).json({ message: 'Failed to answer question' });
  }
});

// ── Collections CRUD ──────────────────────────────────────────────────────
app.get('/api/collections', async (req, res) => {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) return res.status(500).json({ message: 'Failed to fetch collections' });
  res.json({ collections: data });
});

app.post('/api/collections', async (req, res) => {
  const { loan_id, amount, due_date, status } = req.body;
  if (!loan_id || !amount || !due_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('collections')
    .insert([{ loan_id, amount, due_date, status: status || 'pending' }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create collection entry' });
  res.status(201).json({ collection: data });
});

// ── Investor Reports CRUD ─────────────────────────────────────────────────-
app.get('/api/investor-reports', async (req, res) => {
  const { data, error } = await supabase
    .from('investor_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Failed to fetch reports' });
  res.json({ reports: data });
});

app.post('/api/investor-reports', async (req, res) => {
  const { title, file_url } = req.body;
  if (!title || !file_url) return res.status(400).json({ message: 'Missing title or file_url' });

  const { data, error } = await supabase
    .from('investor_reports')
    .insert([{ title, file_url }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create report' });
  res.status(201).json({ report: data });
});

app.post('/api/financing-scorecard', (req, res) => {
  const { bureau_score, project_kpis = {}, payment_history = [] } = req.body || {};
  if (bureau_score === undefined) {
    return res.status(400).json({ message: 'Missing bureau_score' });
  }
  const result = financeScorecard({
    bureau_score: parseFloat(bureau_score),
    on_time_rate: parseFloat(project_kpis.on_time_rate || 0),
    budget_variance: parseFloat(project_kpis.budget_variance || 0),
    payment_history: Array.isArray(payment_history) ? payment_history.map(Number) : []
  });
  res.json(result);
});

app.post('/api/project-forecast', (req, res) => {
  const { progress_history = [], budget_history = [] } = req.body || {};
  if (!Array.isArray(progress_history) || !Array.isArray(budget_history)) {
    return res.status(400).json({ message: 'Missing arrays' });
  }
  const result = forecastProject({ progress_history, budget_history });
  res.json(result);
});

app.post('/api/match-invoice', upload.single('file'), async (req, res) => {
  const { project_id } = req.body || {};
  if (!project_id || !req.file) {
    return res.status(400).json({ message: 'Missing project_id or file' });
  }
  let items = [];
  try {
    const { data } = await supabase
      .from('budget_items')
      .select('id, description, amount')
      .eq('project_id', project_id);
    items = data || [];
  } catch (err) {
    console.error('Fetch budget items error:', err);
  }
  const text = req.file.buffer.toString('utf8');
  const matches = items.map((it) => ({
    id: it.id,
    description: it.description,
    amount: it.amount,
    matched: new RegExp(it.description, 'i').test(text)
  }));
  res.json({ matches });
});

app.post('/api/progress-photos/upload', upload.single('file'), async (req, res) => {
  const { project_id } = req.body || {};
  if (!project_id || !req.file) {
    return res.status(400).json({ message: 'Missing project_id or file' });
  }
  const filePath = `progress/${project_id}/${Date.now()}_${req.file.originalname}`;
  const { error: upErr } = await supabase.storage
    .from('project-photos')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
  if (upErr) {
    console.error('Upload error:', upErr);
    return res.status(500).json({ message: 'File upload failed' });
  }
  const fileUrl = supabase.storage.from('project-photos').getPublicUrl(filePath).publicURL;
  const { data, error } = await supabase
    .from('progress_photos')
    .insert([{ project_id: parseInt(project_id, 10), file_url: fileUrl, status: 'pending', uploaded_at: new Date().toISOString() }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to record photo' });
  res.status(201).json({ photo: data });
});

app.get('/api/progress-photos', async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ message: 'Missing project_id' });
  const { data, error } = await supabase
    .from('progress_photos')
    .select('*')
    .eq('project_id', project_id)
    .order('uploaded_at', { ascending: false });
  if (error) return res.status(500).json({ message: 'Failed to fetch photos' });
  res.json({ photos: data });
});

app.post('/api/progress-photos/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!id || !status) return res.status(400).json({ message: 'Missing id or status' });
  const { data, error } = await supabase
    .from('progress_photos')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update photo' });
  res.json({ photo: data });
});

// ── Hospitality Features ───────────────────────────────────────────────────
app.post('/api/guests', async (req, res) => {
  const { name, email, preferences } = req.body || {};
  if (!name || !email) return res.status(400).json({ message: 'Missing name or email' });
  try {
    const { data, error } = await supabase
      .from('guests')
      .insert([{ name, email, preferences }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ guest: data });
  } catch (err) {
    console.error('Guest create error:', err);
    res.status(500).json({ message: 'Failed to create guest' });
  }
});

app.get('/api/guests', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ guests: data });
  } catch (err) {
    console.error('List guests error:', err);
    res.status(500).json({ message: 'Failed to fetch guests' });
  }
});

app.post('/api/rate-recommendation', (req, res) => {
  const { property_id, date } = req.body || {};
  if (!property_id || !date)
    return res.status(400).json({ message: 'Missing property_id or date' });
  const base = 100;
  const day = new Date(date).getDay();
  const recommended_rate = base + (day === 5 || day === 6 ? 50 : 20);
  res.json({ recommended_rate });
});

app.post('/api/service-request', async (req, res) => {
  const { guest_id, request: reqText } = req.body || {};
  if (!guest_id || !reqText)
    return res.status(400).json({ message: 'Missing guest_id or request' });
  try {
    const { data, error } = await supabase
      .from('service_requests')
      .insert([
        { guest_id, request: reqText, status: 'pending', created_at: new Date().toISOString() }
      ])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ service_request: data });
  } catch (err) {
    console.error('Service request error:', err);
    res.status(500).json({ message: 'Failed to create request' });
  }
});

app.get('/api/service-requests', async (req, res) => {
  const { guest_id } = req.query || {};
  if (!guest_id) return res.status(400).json({ message: 'Missing guest_id' });
  try {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('guest_id', guest_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ requests: data });
  } catch (err) {
    console.error('Service requests fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch requests' });
  }
});

app.post('/api/forecast-inventory', (req, res) => {
  const { item, history } = req.body || {};
  if (!item || !Array.isArray(history)) {
    return res.status(400).json({ message: 'Missing item or history' });
  }
  const avg = history.length ? history.reduce((a, b) => a + b, 0) / history.length : 0;
  const forecast = avg * 1.1;
  res.json({ item, forecast });
});

app.post('/api/demand-forecast', (req, res) => {
  const { occupancy } = req.body || {};
  if (!Array.isArray(occupancy)) {
    return res.status(400).json({ message: 'Missing occupancy history' });
  }
  const avg = occupancy.reduce((a, b) => a + b, 0) / occupancy.length;
  const forecast = Array(7).fill(Math.round(avg));
  res.json({ forecast });
});

app.post('/api/suggest-upsells', (req, res) => {
  const { guest_id } = req.body || {};
  if (!guest_id) return res.status(400).json({ message: 'Missing guest_id' });
  const suggestions = ['Late checkout', 'Spa discount', 'Room upgrade'];
  res.json({ suggestions });
});

app.get('/api/hospitality/metrics', (_req, res) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const occDaily = days.map((d, i) => ({ day: d, occupancy: 70 + i }));
  const adrData = days.map((d, i) => ({ day: d, adr: 120 + i * 2 }));
  const revParData = days.map((d, i) => ({ day: d, revpar: 80 + i * 3 }));
  res.json({ occDaily, adrData, revParData });
});

// ── Booking Endpoints ─────────────────────────────────────────────────────
app.post('/api/bookings', async (req, res) => {
  const { guest_id, room, start_date, end_date } = req.body || {};
  if (!guest_id || !room || !start_date || !end_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('bookings')
    .insert([{ guest_id, room, start_date, end_date }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create booking' });
  await triggerWebhooks('booking.created', data);
  res.status(201).json({ booking: data });
});

app.get('/api/bookings', async (req, res) => {
   const { guest_id } = req.query || {};
  let query = supabase.from('bookings').select('*');
  if (guest_id) query = query.eq('guest_id', guest_id);
  const { data, error } = await query.order('start_date');
  if (error) return res.status(500).json({ message: 'Failed to fetch bookings' });
  res.json({ bookings: data });
});

app.patch('/api/bookings/:id', async (req, res) => {
  const { start_date, end_date } = req.body || {};
  if (!start_date && !end_date) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const updates = {};
  if (start_date) updates.start_date = start_date;
  if (end_date) updates.end_date = end_date;
  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to update booking' });
  res.json({ booking: data });
});

app.get('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Failed to fetch booking' });
  if (!data) return res.status(404).json({ message: 'Booking not found' });
  res.json({ booking: data });
});

// ── Personalization & Insights ─────────────────────────────────────────────
app.get('/api/next-due', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('amortization_schedules')
      .select('loan_id, due_date')
      .gt('due_date', new Date().toISOString().slice(0, 10))
      .order('due_date')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.json({ next_due: data || null });
  } catch (err) {
    console.error('Next due error:', err);
    res.status(500).json({ next_due: null });
  }
});

app.get('/api/recommendations', async (_req, res) => {
  try {
    const { data: loans } = await supabase
      .from('assets')
      .select('id, name, predicted_risk')
      .gt('predicted_risk', 0.5)
      .order('predicted_risk', { ascending: false })
      .limit(3);
    const { data: guests } = await supabase
      .from('guests')
      .select('id, name')
      .order('created_at', { ascending: false })
      .limit(3);
    res.json({ at_risk_loans: loans || [], upsell_guests: guests || [] });
  } catch (err) {
    console.error('Recommendation error:', err);
    res.status(500).json({ at_risk_loans: [], upsell_guests: [] });
  }
});

app.get('/api/faqs', async (req, res) => {
  const { user_id } = req.query || {};
  const faqs = [
    { q: 'How do I make a payment?', a: 'You can pay online or mail a check.' },
    {
      q: 'What is my payoff amount?',
      a: 'Contact support for an official payoff quote.'
    }
  ];
  if (user_id) {
    try {
      const { data: loan } = await supabase
        .from('loans')
        .select('id')
        .eq('borrower_user_id', user_id)
        .order('start_date')
        .limit(1)
        .maybeSingle();
      if (loan) {
        const { data: sched } = await supabase
          .from('amortization_schedules')
          .select('due_date')
          .eq('loan_id', loan.id)
          .gt('due_date', new Date().toISOString().slice(0, 10))
          .order('due_date')
          .limit(1)
          .maybeSingle();
        if (sched)
          faqs.push({
            q: 'When is my next payment due?',
            a: `Your next payment is due on ${sched.due_date}.`
          });
      }
    } catch (err) {
      console.error('FAQ fetch error:', err);
    }
  }
  res.json({ faqs });
});

app.get('/api/saved-loan-queries', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.json({ queries: [] });
  const { data, error } = await supabase
    .from('saved_loan_queries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) return res.status(500).json({ queries: [] });
  res.json({ queries: data });
});

app.post('/api/saved-loan-queries', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { name, query } = req.body || {};
  if (!userId || !name || !query)
    return res.status(400).json({ message: 'Missing fields' });
  const { data, error } = await supabase
    .from('saved_loan_queries')
    .insert([{ user_id: userId, name, query_json: query }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to save' });
  res.status(201).json({ query: data });
});

app.post('/api/feedback', (req, res) => {
  const { type, message } = req.body || {};
  if (!message) return res.status(400).json({ message: 'Missing message' });
  recordFeedback({ type: type || 'feature', message });
  retrainModel();
  res.status(201).json({ message: 'Feedback recorded' });
});

// ── Voice Bot Endpoints ────────────────────────────────────────────────────
app.post('/api/voice', express.urlencoded({ extended: false }), handleVoice);
app.post('/api/voice/query', express.urlencoded({ extended: false }), handleVoiceQuery);
if (Sentry.Handlers?.errorHandler) {
  app.use(Sentry.Handlers.errorHandler());
} else if (Sentry.errorHandler) {
  app.use(Sentry.errorHandler());
}

// ── Start Server ──────────────────────────────────────────────────────────
const PORT = 10000;
if (require.main === module) {
    const server = http.createServer(app);
  attachChatServer(server);
  server.listen(PORT, () => {
     console.log('Kontra API listening on port 10000');
  });
}

module.exports = app;
