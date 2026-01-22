// index.js
const express = require('express');
const Sentry = require('@sentry/node');
const cors = require('cors');
const multer = require('multer');
const { supabase, replica } = require('./db');
const OpenAI = require('openai');          // ← v4+ default export
const cache = require('./cache');
const { addJob } = require('./jobQueue');
const fs = require('fs');
const { workflows, addWorkflow } = require('./workflowStore');
const { runWorkflow } = require('./hyperautomation');
const path = require('path');
const http = require('http');
const attachChatServer = require('./chatServer');
const attachCollabServer = require('./collabServer');
const { forecastProject } = require('./construction');
const { isFeatureEnabled } = require('./featureFlags');
const { scanForCompliance, gatherEvidence } = require('./compliance');
require('dotenv').config();
["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","OPENAI_API_KEY","SENTRY_DSN","STRIPE_SECRET_KEY","ENCRYPTION_KEY","PII_ENCRYPTION_KEY"].forEach(k => {
  if (!process.env[k]) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
});

const normalizeOrigin = (origin = '') => origin.replace(/\/$/, '');
const parseOrigins = (value = '') =>
  value
    .split(',')
    .map((part) => normalizeOrigin(part.trim()))
    .filter(Boolean);

const escapeForRegex = (value = '') => value.replace(/[-/\\^$+?.()|[\]{}*]/g, '\\$&');
const createOriginTester = (origin) => {
  if (origin.includes('*')) {
    const pattern = escapeForRegex(origin).replace(/\\\*/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return (candidate) => regex.test(candidate);
  }
  return (candidate) => candidate === origin;
};

const resolvedOrigins = [
  ...parseOrigins(process.env.CORS_ORIGINS || ''),
];

if (process.env.FRONTEND_URL) {
  resolvedOrigins.push(normalizeOrigin(process.env.FRONTEND_URL));
}

const previewWildcardOrigin = normalizeOrigin('https://kontra-*.vercel.app');

const fallbackOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://kontra.vercel.app',
  'https://kontra-ui.vercel.app',
   'https://kontraui.com',
  'https://www.kontraui.com',
  'https://kontra-*.vercel.app',
].map(normalizeOrigin);

const includePreviewWildcard = (origins) =>
  origins.includes(previewWildcardOrigin)
    ? origins
    : [...origins, previewWildcardOrigin];

const allowedOrigins = Array.from(
  new Set(
    (resolvedOrigins.length
      ? includePreviewWildcard([...resolvedOrigins])
      : [...fallbackOrigins])
  )
);

const originMatchers = allowedOrigins.map((origin) => ({
  origin,
  test: createOriginTester(origin),
}));

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (originMatchers.some(({ test }) => test(normalizedOrigin))) {
      return callback(null, true);
    }

    console.warn(`[CORS] Origin "${normalizedOrigin}" rejected`);
    return callback(null, false);
  },
  credentials: true,
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Org-Id',
    'X-Requested-With',
    'X-User-Id',
    'Accept',
    'Origin',
  ],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
};

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

// ── OpenAI Client (v4+ SDK) ────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const {
  parseDocumentBuffer,
  summarizeDocumentBuffer,
  autoFillFields,
  classifyDocumentBuffer,
  advancedCreditScore,
  detectFraud,
} = require('./services/underwriting');

const { handleVoice, handleVoiceQuery } = require('./voiceBot');
const { recordFeedback, retrainModel } = require('./feedback');
const auditLogger = require('./middlewares/auditLogger');
const authenticate = require('./middlewares/authenticate');
const requireRole = require('./middlewares/requireRole');
const assetsRouter = require('./routers/assets');
const inspectionsRouter = require('./routers/inspections');
const dashboard = require('./routers/dashboard');
const loansRouter = require('./routers/loans');
const drawsRouter = require('./routers/draws');
const projectsRouter = require('./routers/projects');
const organizationsRouter = require('./routers/organizations');
const invitesRouter = require('./routers/invites');
const documentReviewRouter = require('./routers/documentReview');
// Optional routers for unfinished modules
const ssoRouter = require('./routers/sso');
const reportsRouter = require('./routers/reports');
const { router: menuRouter } = require('./routers/menu');
const { logUserEvent, suggestNextFeature } = require('./personalization');
const { router: ordersRouter } = require('./routers/orders');
const { router: paymentsRouter } = require('./routers/payments');
const paymentsStripeRouter = require('./routers/paymentsStripe');
const analyzeFinancialsRouter = require('./analyze-financials');
const inspectReviewRouter = require('./inspect-review');
const payoffsRouter = require('./routers/payoffs');
const escrowDisbursementsRouter = require('./routers/escrowDisbursements');
const delinquencyAlertsRouter = require('./routers/delinquencyAlerts');
const communicationsLogRouter = require('./routers/communicationsLog');
const poolInvestmentsRouter = require('./routers/poolInvestments');
const { router: assetDigitizationRouter } = require('./routers/assetDigitization');
const tradesRouter = require('./routers/trades');
const exchangeRouter = require('./routers/exchange');
const exchangeProgramsRouter = require('./routers/exchangePrograms');
const marketplaceRouter = require('./routers/marketplace');
const { router: analyticsRouter } = require('./routers/analytics');
const restaurantRouter = require('./routers/restaurant');
const restaurantsRouter = require('./routers/restaurants');
const applicationsRouter = require('./routers/applications');
const riskRouter = require('./routers/risk');
const { router: tokenizationRouter } = require('./routers/tokenization');
const { router: blockchainRouter } = require('./routers/blockchain');
const servicingRouter = require('./routers/servicing');
const insightsRouter = require('./routers/insights');
const { triggerWebhooks } = require('./webhooks');
const webhooksRouter = require('./routers/webhookRoutes');
const { router: integrationsRouter } = require('./routers/integrations');
const rateLimit = require('./middlewares/rateLimit');
const subscriptionsRouter = require('./routers/subscriptions');
const siteAnalysisRouter = require('./routers/siteAnalysis');
const savedSearchesRouter = require('./routers/savedSearches');
const creditGraphRouter = require('./routers/creditGraph');
const investorsRouter = require('./routers/investors');
// Compliance automation is still experimental
const complianceRouter = require('./routers/compliance');
const legalRouter = require('./routers/legal');
const otpRouter = require('./routers/otp');
const mobileRouter = require('./routers/mobile');

const JOB_SCHEDULES = [
  { type: 'score-assets', intervalMs: 6 * 60 * 60 * 1000 },
  { type: 'score-loans', intervalMs: 6 * 60 * 60 * 1000 },
  { type: 'score-troubled', intervalMs: 12 * 60 * 60 * 1000 }
];
let jobSchedulersStarted = false;

function startJobSchedulers() {
  if (jobSchedulersStarted || !JOB_SCHEDULES.length) return;
  jobSchedulersStarted = true;
  JOB_SCHEDULES.forEach(({ type, intervalMs }) => {
    // Kick off immediately on boot to hydrate dashboards, then schedule interval.
    addJob(type);
    setInterval(() => addJob(type), intervalMs);
  });
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
     },
  {
    name: 'get_hospitality_stats',
    description: 'Return occupancy and revenue metrics',
    parameters: { type: 'object', properties: {}, required: [] }
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
     },
  {
    name: 'get_hospitality_stats',
    description: 'Return occupancy and revenue metrics',
    parameters: { type: 'object', properties: {}, required: [] }
     },
  {
    name: 'get_troubled_assets',
    description: 'List assets at highest foreclosure risk',
    parameters: { type: 'object', properties: { topN: { type: 'number' } }, required: [] }
  },
  {
    name: 'get_revived_assets',
    description: 'Fetch recently revived-for-sale assets',
    parameters: { type: 'object', properties: {}, required: [] }
  }
];

// Helper implementations for those functions:
async function get_loans() {
   const cached = await cache.get('loans_all');
  if (cached) return cached;
  const { data } = await replica
    .from('loans')
    .select('id, borrower_name, amount, status')
    .order('created_at', { ascending: false });
   if (data) await cache.set('loans_all', data, 30);
  return data;
}

async function get_draws() {
  const cached = await cache.get('draws_recent');
  if (cached) return cached;
  const { data } = await replica
    .from('draw_requests')
    .select('id, project, amount, status')
    .order('submitted_at', { ascending: false })
    .limit(5);
   if (data) await cache.set('draws_recent', data, 30);
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

async function get_hospitality_stats() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const occDaily = days.map((d, i) => ({ day: d, occupancy: 70 + i }));
  const adrData = days.map((d, i) => ({ day: d, adr: 120 + i * 2 }));
  const revParData = days.map((d, i) => ({ day: d, revpar: 80 + i * 3 }));
  return { occDaily, adrData, revParData };
}

// ── Middleware ─────────────────────────────────────────────────────────────
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(auditLogger);
app.use(rateLimit);
app.use('/api/dashboard-layout', authenticate, dashboard);
app.use('/api/dashboard', authenticate, dashboard);
if (isFeatureEnabled('assets')) {
  app.use("/api/assets", assetsRouter);
}
app.use('/api/applications', applicationsRouter);
app.use('/api/loan-applications', applicationsRouter);
app.use("/api/inspections", inspectionsRouter);
app.use('/api', loansRouter);
app.use('/api', drawsRouter);
app.use('/api', projectsRouter);
app.use('/api', servicingRouter);
app.use('/api', insightsRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/invites', invitesRouter);
app.use('/api/analyze-financials', analyzeFinancialsRouter);
app.use('/api/inspect-review', inspectReviewRouter);
app.use('/api/document-review', documentReviewRouter);
if (isFeatureEnabled('sso')) {
  app.use('/api/sso', ssoRouter);
}
app.use('/api/risk', riskRouter);
app.use('/api/credit-graph', creditGraphRouter);
app.use('/api/reports', reportsRouter);
app.use('/api', menuRouter);
app.use('/api', ordersRouter);
app.use('/api', paymentsRouter);
app.use('/api', paymentsStripeRouter);
app.use('/api', payoffsRouter);
app.use('/api', escrowDisbursementsRouter);
app.use('/api', poolInvestmentsRouter);
app.use('/api', assetDigitizationRouter);
app.use('/api', tokenizationRouter);
app.use('/api', blockchainRouter);
app.use('/api', delinquencyAlertsRouter);
app.use('/api', communicationsLogRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/exchange', exchangeRouter);
app.use('/api/exchange-programs', exchangeProgramsRouter);
app.use('/api/investors', investorsRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/legal', legalRouter);
app.use('/api', subscriptionsRouter);
app.use('/api/searches', savedSearchesRouter);
app.use('/api/site-analysis', siteAnalysisRouter);
app.use('/api', analyticsRouter);
app.use('/api', mobileRouter);
app.use('/api', restaurantRouter);
app.use('/api', restaurantsRouter);

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

// ── Webhooks & Integrations ────────────────────────────────────────────────
app.use('/api', webhooksRouter);
app.use('/api', integrationsRouter);
app.use('/api/otp', otpRouter);
if (isFeatureEnabled('compliance')) {
  app.use('/api', authenticate, requireRole('admin'), complianceRouter);
}

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

// ── Document & Photo Ingestion ─────────────────────────────────────────────
app.post('/api/parse-document', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File required' });
  const fields = parseDocumentBuffer(req.file.buffer);
  res.json({ fields });
});

app.post('/api/document-summary', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File required' });
  const result = await summarizeDocumentBuffer(req.file.buffer);
  res.json(result);
});

app.post('/api/auto-fill', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File required' });
  const fields = await autoFillFields(req.file.buffer);
  res.json({ fields });
});

app.post('/api/classify-document', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File required' });
  const type = await classifyDocumentBuffer(req.file.buffer);
  res.json({ type });
});

app.post('/api/credit-score', async (req, res) => {
  const { bureauScore, history } = req.body || {};
  if (!bureauScore) return res.status(400).json({ message: 'Missing bureauScore' });
  const parsedHistory = Array.isArray(history) ? history.map(Number) : [];
  const { score, explanation } = advancedCreditScore(Number(bureauScore), parsedHistory);
  res.json({ score, explanation });
});

app.post('/api/detect-fraud', async (req, res) => {
  const result = detectFraud(req.body || {});
  res.json(result);
});

// ── LLM-Powered Workflows ──────────────────────────────────────────────────
app.post('/api/workflows/ingest', upload.single('file'), async (req, res) => {
  const { type, asset_id } = req.body || {};
  if (!req.file || !type) {
    return res.status(400).json({ message: 'Missing file or type' });
  }

  try {
    const summary = await summarizeDocumentBuffer(req.file.buffer);
    let record = null;

    if (type === 'inspection' && asset_id) {
      const { data, error } = await supabase
        .from('asset_inspections')
        .insert([{ asset_id: parseInt(asset_id, 10), report_json: summary }])
        .select()
        .single();
      if (error) throw error;
      record = data;
    } else if (type === 'w9') {
      const fields = await autoFillFields(req.file.buffer);
      summary.fields = fields;
    } else if (type === 'contract') {
      summary.key_terms = Object.assign(
        {},
        summary.key_terms,
        parseDocumentBuffer(req.file.buffer)
      );
    }

    res.json({ summary, record });
  } catch (err) {
    console.error('Workflow ingest error:', err);
    res.status(500).json({ message: 'Failed to process file' });
  }
});

app.get('/api/smart-recommendations', async (_req, res) => {
  try {
    const { data: pending } = await supabase
      .from('loans')
      .select('id, borrower_name, amount, risk_score, interest_rate, status')
      .eq('status', 'pending')
      .order('risk_score', { ascending: true })
      .limit(5);

    const { data: refinance } = await supabase
      .from('loans')
      .select('id, borrower_name, amount, interest_rate, risk_score')
      .eq('status', 'active')
      .gt('interest_rate', 6)
      .lt('risk_score', 0.5)
      .order('interest_rate', { ascending: false })
      .limit(5);

    let recommendation = '';
    if (process.env.OPENAI_API_KEY) {
      try {
        const resp = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'Give a short recommendation on which loans to approve first and which could be refinanced.'
            },
            {
              role: 'user',
              content: JSON.stringify({ pending, refinance })
            }
          ]
        });
        recommendation = resp.choices[0].message.content.trim();
      } catch (err) {
        console.error('AI recommendation error:', err);
      }
    }

    res.json({
      approve_first: (pending || []).slice(0, 3),
      refinance_candidates: (refinance || []).slice(0, 3),
      recommendation
    });
  } catch (err) {
    console.error('Smart recommendations error:', err);
    res.status(500).json({
      approve_first: [],
      refinance_candidates: [],
      recommendation: ''
    });
  }
});

// ── Loan Application Endpoints ─────────────────────────────────────────────


// ── Projects CRUD ───────────────────────────────────────────────────────────

// ── Create a Loan ───────────────────────────────────────────────────────────
// ── Underwriting Tasks CRUD ───────────────────────────────────────────────

function requireCsrf(req, res, next) {
  const token = req.headers['x-csrf-token'];
  if (!token || token !== process.env.CSRF_TOKEN) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  next();
}

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

app.put('/api/tasks/:id', authenticate, requireCsrf, async (req, res) => {
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
            } else if (msg.function_call.name === 'get_hospitality_stats') {
        result = await get_hospitality_stats();
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
      } else if (msg.function_call.name === 'get_hospitality_stats') {
        result = await get_hospitality_stats();
             } else if (msg.function_call.name === 'get_troubled_assets') {
        result = await get_troubled_assets(args);
      } else if (msg.function_call.name === 'get_revived_assets') {
        
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
app.get('/api/investor-reports', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('investor_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Failed to fetch reports' });
  res.json({ reports: data });
});

app.post('/api/investor-reports', authenticate, async (req, res) => {
  const { title, file_url } = req.body;
  if (!title || !file_url) return res.status(400).json({ message: 'Missing title or file_url' });

   // Validate file_url format
  try {
    new URL(file_url);
  } catch {
    return res.status(400).json({ message: 'Invalid file_url format' });
  }

  // Validate file size (max 10MB)
  try {
    const head = await fetch(file_url, { method: 'HEAD' });
    if (!head.ok) {
      return res.status(400).json({ message: 'Invalid file_url' });
    }
    const size = parseInt(head.headers.get('content-length') || '0', 10);
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (size && size > MAX_SIZE) {
      return res.status(400).json({ message: 'File too large' });
    }
  } catch (err) {
    return res.status(400).json({ message: 'Unable to verify file_url' });
  }

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
if (isFeatureEnabled('hospitality')) {
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

  app.get('/api/hospitality/forecast', (_req, res) => {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + i + 1);
    return dt.toISOString().slice(0, 10);
  });
  const occupancy = dates.map((d, i) => ({ date: d, occupancy: 75 + i }));
  const revenue = dates.map((d, i) => ({ date: d, revenue: 10000 + i * 500 }));
  res.json({ occupancy, revenue });
});

} // end hospitality feature block

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

// ── Room Block Endpoints ──────────────────────────────────────────────────
app.post('/api/room-blocks', async (req, res) => {
  const { rooms, start_date, end_date, reason } = req.body || {};
  if (!rooms || !start_date || !end_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const { data, error } = await supabase
    .from('room_blocks')
    .insert([{ rooms, start_date, end_date, reason }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: 'Failed to create room block' });
  res.status(201).json({ room_block: data });
});

app.get('/api/room-blocks', async (_req, res) => {
  const { data, error } = await supabase
    .from('room_blocks')
    .select('*')
    .order('start_date');
  if (error) return res.status(500).json({ message: 'Failed to fetch room blocks' });
  res.json({ room_blocks: data });
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

// ── Predictive Analytics ────────────────────────────────────────────────────
const {
  forecastNextValue,
  detectAnomalies,
  suggestPlan,
  predictChurn
} = require('./predictiveAnalytics');

app.post('/api/forecast-metrics', (req, res) => {
  const { history } = req.body || {};
  if (!Array.isArray(history) || history.length < 2) {
    return res.status(400).json({ message: 'Missing history' });
  }
  const next = forecastNextValue(history.map(Number));
  res.json({ next });
});

app.post('/api/detect-anomalies', (req, res) => {
  const { values } = req.body || {};
  if (!Array.isArray(values) || values.length < 2) {
    return res.status(400).json({ message: 'Missing values' });
  }
  const anomalies = detectAnomalies(values.map(Number));
  res.json({ anomalies });
});

app.post('/api/suggest-plan', (req, res) => {
  const { usage, threshold } = req.body || {};
  if (typeof usage !== 'number') {
    return res.status(400).json({ message: 'Missing usage' });
  }
  const suggestion = suggestPlan({ usage, threshold: Number(threshold) || 100 });
  res.json({ suggestion });
});

app.post('/api/predict-churn', (req, res) => {
  const { logins, days_since_login, tickets } = req.body || {};
  if (logins === undefined || days_since_login === undefined) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const result = predictChurn({
    logins: Number(logins),
    days_since_login: Number(days_since_login),
    tickets: Number(tickets) || 0
  });
  res.json(result);
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

app.post('/api/user-events', authenticate, (req, res) => {
  const userId = req.user.id;
  const { event } = req.body || {};
  if (!event) return res.status(400).json({ message: 'Missing event' });
  logUserEvent(userId, event);
  res.status(201).json({ logged: true });
  
});

app.get('/api/personalized-suggestion', authenticate, async (req, res) => {
  const userId = req.user.id;
  const suggestion = await suggestNextFeature(userId, openai);
  res.json({ suggestion });
});

// ── Background Job Queue ─────────────────────────────────────────────────--
app.post('/api/jobs/score-loans', (_req, res) => {
  addJob('score-loans');
  res.json({ queued: true });
});
app.post('/api/jobs/score-assets', (_req, res) => {
  addJob('score-assets');
  res.json({ queued: true });
});
app.post('/api/jobs/score-troubled', (_req, res) => {
  addJob('score-troubled');
  res.json({ queued: true });
});

// ── Workflow Automation Engine ─────────────────────────────────────────────
app.get("/api/workflows", (_req, res) => {
  res.json(workflows);
});
app.post("/api/workflows", (req, res) => {
  const { name, steps } = req.body || {};
  if (!name || !Array.isArray(steps)) {
    return res.status(400).json({ message: "Missing name or steps" });
  }
  const workflow = { id: workflows.length + 1, name, steps };
  addWorkflow(workflow);
  res.status(201).json(workflow);
});

app.post("/api/workflows/:id/run", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const workflow = workflows.find(w => w.id === id);
  if (!workflow) return res.status(404).json({ message: "Workflow not found" });
  try {
    const results = await runWorkflow(workflow);
    res.json({ results });
  } catch (err) {
    console.error("Workflow run error:", err);
    res.status(500).json({ message: "Failed to run workflow" });
  }
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
  if (process.env.NODE_ENV === 'production') {
    startJobSchedulers();
  }
  const server = http.createServer(app);
  attachChatServer(server);
  attachCollabServer(server);
  server.listen(PORT, () => {
     console.log('Kontra API listening on port 10000');
  });
}

module.exports = app;
