// index.js
// In development, override: true lets .env win over the shell-level placeholder
// fallbacks set in the workflow command. In production (Render), we do NOT
// override so that env vars set in the Render dashboard take precedence.
require('dotenv').config(process.env.NODE_ENV !== 'production' ? { override: true } : {});
const express = require('express');
const Sentry = require('@sentry/node');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const { supabase, replica } = require('./db');
const {
  DEFAULT_PACK_ID,
  getPackStageConfig,
  getPackStageKeys,
  getPackStageLabel,
  getPackRoleConfig,
  getPackRoleLabel,
  getRoomPackId,
  sendResendEmail,
  uploadToStorage,
  logEvent,
  sealClosingRecord,
  notifyPartySubmitted,
  notifyLender,
  notifyStageAdvance,
  notifyStatusChange,
  notifyOwner,
  notifyVAPReady,
} = require('./lib/dealRoomHelpers');
const aiDealReviewRouter = require('./routers/aiDealReview');
const tasksRouter = require('./routers/tasks');
const operationsManagerRouter = require('./routers/operationsManager');
const verificationRouter = require('./routers/verification');
const { runVerification } = require('./lib/verificationEngine');
const verifiedAssetPackageRouter = require('./routers/verifiedAssetPackage');
const { generateAndStoreVAP } = require('./routers/verifiedAssetPackage');
const { evaluateDealRoomForTasks, evaluateReadinessTasks } = require('./lib/taskEngine');
const {
  recalculateTransactionState,
  computeTransactionReadiness,
  computeTransactionRecordState,
  readTransactionState,
  resolveSchemaKey: resolveTransactionSchemaKey,
} = require('./lib/transactionState');
const { emit: emitInternalEvent } = require('./lib/eventBus');
const {
  canonicalizeTransactionRecordKey,
  aliasKeysForCanonical,
  canonicalTransactionTypeLabel,
} = require('./lib/transactionRecordCanonicalization');
const {
  buildRoomParticipants,
  computeRoomDashboardState,
} = require('./lib/dashboardState');
const {
  hasDocumentRole,
  getChecklistItemAssignedRoles,
  getAssignedSectionsFromChecklist,
} = require('./lib/documentAssignmentAccess');
const {
  isTokenizationQuestion,
  buildTokenizationGuidance,
  buildTokenizationPrompt,
  buildTokenizationAnswerPrefix,
  buildFixtureTransactionContext,
} = require('./lib/tokenizationGuidance');
const { DEMO_AI_MAX_TOKENS, sanitizeDemoTokenizationAnswer } = require('./lib/demoRoomFixtures');
const {
  buildLegacyProposal,
  normalizeProposal,
  validateProposal,
  createGenerationId,
  PROPOSAL_VERSION,
  extractTransactionContext,
  inferGeneratedTransactionIdentity,
} = require('./lib/transactionRoomGenerator');

// Pack inference map — mirrors DEAL_TYPE_TO_PACK in dealRoomHelpers.js so that
// room creation writes the correct workflow_pack_id from day one.
const DEAL_TYPE_TO_PACK_INDEX = {
  full_acquisition:    'business_acquisition',
  asset_purchase:      'business_acquisition',
  stock_purchase:      'business_acquisition',
  business_acquisition:'business_acquisition',
  seed:                'fundraising',
  series_a:            'fundraising',
  series_b:            'fundraising',
  series_c:            'fundraising',
  debt_raise:          'fundraising',
  equity_raise:        'fundraising',
  fundraising:         'fundraising',
};

function isTokenizationTransaction(packId, transactionType, metadataValues = null) {
  const digitalAssetEnabled = metadataValues?.digital_asset_enabled === true
    || metadataValues?.digital_asset_enabled === 'true';
  return packId === 'tokenization'
    || transactionType === 'tokenization'
    || transactionType === 'token_issuance'
    || digitalAssetEnabled;
}

function buildDemoQaSystemPrompt(basePrompt, fixture, question) {
  if (!isTokenizationQuestion(question)) return basePrompt;
  const guidance = buildTokenizationGuidance({
    transactionContext: buildFixtureTransactionContext(fixture),
  });
  return `${basePrompt}\n\n${buildTokenizationPrompt(guidance)}`;
}

function formatDemoTokenizationAnswer(answer, fixture, question) {
  if (!isTokenizationQuestion(question)) return answer;
  const guidance = buildTokenizationGuidance({
    transactionContext: buildFixtureTransactionContext(fixture),
  });
  const safeAnswer = sanitizeDemoTokenizationAnswer(answer);
  return `${buildTokenizationAnswerPrefix(guidance)}\n\nKontra can assess technical or structural tokenization readiness and identify required information and documentation for external professional review; it does not determine securities-law or regulatory eligibility.\n\n${safeAnswer}`;
}

async function jurisdictionForTransaction(jurisdiction, packId, transactionType, metadataValues = null) {
  if (isTokenizationTransaction(packId, transactionType, metadataValues)) return jurisdiction || '';
  // Custom packs persist their transaction type in config. Resolve it here so
  // a custom tokenization room keeps its jurisdiction while a custom hotel,
  // business, or other room cannot surface a stale securities jurisdiction.
  if (packId && packId.startsWith('ws_')) {
    try {
      const { data } = await supabase
        .from('custom_workflow_packs')
        .select('config')
        .eq('id', packId)
        .maybeSingle();
      if (data?.config?.transactionType === 'tokenization') return jurisdiction || '';
    } catch (e) {
      console.warn('[jurisdiction] custom pack lookup failed:', e.message);
    }
  }
  return '';
}

// ── AI-powered pack classification ────────────────────────────────────────────
// Uses GPT-4o-mini to select the right workflow pack from a room's name, deal
// type, and address. Falls back to 'cre_acquisition' (the safe default) if AI
// is unavailable or returns an unknown value.
// Only called when neither an explicit workflowPackId nor a mapped deal_type is
// available — i.e. as a last resort before defaulting to CRE.
async function classifyTransactionPack(name, dealType, address) {
  // Explicit deal_type wins if it maps to a specific non-default pack
  if (dealType && DEAL_TYPE_TO_PACK_INDEX[dealType]) {
    return DEAL_TYPE_TO_PACK_INDEX[dealType];
  }
  if (!name) return 'cre_acquisition';
  try {
    const context = [
      name     && `Transaction name: ${name}`,
      dealType && `Deal type: ${dealType}`,
      address  && `Location: ${address}`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 60,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Classify this transaction into exactly one workflow pack. Return JSON: { "pack": "cre_acquisition" | "business_acquisition" | "fundraising" }

Definitions:
- cre_acquisition: ANY real estate or property transaction — buying, selling, financing, refinancing, or recapitalizing property. Includes: hotels, apartments, office, retail, industrial, land, hospitality, mixed-use, senior housing, data centers, warehouses. Hotel acquisitions, hotel refinancings, property refinancings, commercial mortgages, construction loans, and bridge loans are ALL cre_acquisition.
- business_acquisition: Buying or selling a company's operating business — M&A, management buyout, stock purchase (of a company, not a property-owning entity), merger, business sale. Must involve a company that is NOT primarily a real estate holding vehicle.
- fundraising: Raising capital — seed, Series A/B/C, VC, convertible notes, SAFE, debt raise, equity raise, fund formation.

Critical: any transaction involving a hotel, resort, property, or real estate asset is ALWAYS cre_acquisition, even if the word "acquisition" or "business" appears in the name.
When in doubt between CRE and business, default to cre_acquisition.`,
        },
        { role: 'user', content: context },
      ],
    });

    let result = {};
    try { result = JSON.parse(completion.choices[0].message.content); } catch (_) {}
    const valid = ['cre_acquisition', 'business_acquisition', 'fundraising'];
    if (valid.includes(result.pack)) {
      console.log(`[pack-classify] "${name}" → ${result.pack}`);
      return result.pack;
    }
  } catch (e) {
    console.warn('[pack-classify] AI unavailable, using CRE default:', e.message);
  }
  return 'cre_acquisition';
}
const OpenAI = require('openai');          // ← v4+ default export
const cache = require('./cache');
const { addJob } = require('./jobQueue');
const fs = require('fs');
const crypto = require('crypto');
const { workflows, addWorkflow } = require('./workflowStore');
const { runWorkflow } = require('./hyperautomation');
const path = require('path');
const http = require('http');
const attachChatServer = require('./chatServer');
const attachCollabServer = require('./collabServer');
const aiRateLimit = require('./middlewares/aiRateLimit');
const { forecastProject } = require('./construction');
const { isFeatureEnabled } = require('./featureFlags');
const { scanForCompliance, gatherEvidence } = require('./compliance');
require('dotenv').config();

const WORKFLOW_PROOF_TTL_MS = 2 * 60 * 60 * 1000;
const WORKFLOW_PROOF_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

function stableWorkflowValue(value) {
  if (Array.isArray(value)) return value.map(stableWorkflowValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableWorkflowValue(value[key]);
      return out;
    }, {});
  }
  return value;
}

function workflowConfigForProof(config) {
  const source = config && typeof config === 'object' ? config : {};
  return {
    roles: (Array.isArray(source.roles) ? source.roles : []).map(role => ({
      key: String(role?.key || '').trim(),
      label: String(role?.label || '').trim(),
      required: !!role?.required,
      needsDocs: role?.needsDocs !== false,
      invitable: role?.invitable !== false,
      canManage: !!role?.canManage,
    })),
    documents: (Array.isArray(source.documents) ? source.documents : []).map(document => ({
      id: String(document?.id || '').trim(),
      label: String(document?.label || document?.name || '').trim(),
      section: String(document?.section || document?.id || '').trim(),
      required: !!document?.required,
      ai: !!document?.ai,
      assignedTo: Array.isArray(document?.assignedTo)
        ? document.assignedTo.map(role => String(role || '').trim()).filter(Boolean)
        : document?.assignedRole
          ? [String(document.assignedRole).trim()]
          : [],
    })),
    stages: (Array.isArray(source.stages) ? source.stages : []).map(stage => ({
      key: String(stage?.key || '').trim(),
      label: String(stage?.label || '').trim(),
    })),
  };
}

function workflowConfigHash(config) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stableWorkflowValue(workflowConfigForProof(config))))
    .digest('hex');
}

function signWorkflowProof(kind, payload, ttlMs = WORKFLOW_PROOF_TTL_MS) {
  const body = Buffer.from(JSON.stringify({
    kind,
    ...payload,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', WORKFLOW_PROOF_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function verifyWorkflowProof(token, expectedKind) {
  if (!token || !WORKFLOW_PROOF_SECRET) return null;
  try {
    const [body, signature] = String(token).split('.');
    if (!body || !signature) return null;
    const expected = crypto.createHmac('sha256', WORKFLOW_PROOF_SECRET)
      .update(body)
      .digest('base64url');
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.kind !== expectedKind || !Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function normalizeGeneratedWorkflowConfig(raw) {
  return {
    roles: (Array.isArray(raw?.roles) ? raw.roles : []).map((role, index) => ({
      key: role?.key || `role_${index + 1}`,
      label: role?.label || '',
      icon: role?.icon || ['👤', '🏢', '⚖️', '📊'][index % 4],
      color: role?.color || ['#800020', '#1d4ed8', '#374151', '#16a34a'][index % 4],
      required: !!role?.required,
      needsDocs: role?.needsDocs !== false,
      invitable: role?.invitable !== false,
      canManage: index === 0 ? true : !!role?.canManage,
    })),
    documents: (Array.isArray(raw?.documents) ? raw.documents : []).map((document, index) => ({
      id: document?.id || `document_${index + 1}`,
      label: document?.label || document?.name || `Document ${index + 1}`,
      section: document?.section || document?.id || `document_${index + 1}`,
      required: !!document?.required,
      ai: !!document?.ai,
      assignedTo: Array.isArray(document?.assignedTo)
        ? document.assignedTo
        : document?.assignedRole
          ? [document.assignedRole]
          : [],
    })),
    stages: (Array.isArray(raw?.stages) ? raw.stages : []).map((stage, index) => ({
      key: stage?.key || `stage_${index + 1}`,
      label: stage?.label || `Stage ${index + 1}`,
    })),
  };
}

function workflowConfigNeedsApproval(config) {
  const normalized = workflowConfigForProof(config);
  return normalized.roles.length > 0 || normalized.documents.length > 0 || normalized.stages.length > 0;
}

function validateWorkflowApproval(meta = {}) {
  if (!workflowConfigNeedsApproval(meta.customConfig)) {
    return { ok: true, reviewed: false };
  }
  const proof = verifyWorkflowProof(meta.customConfigApprovalToken, 'workflow_approval');
  if (!proof || proof.configHash !== workflowConfigHash(meta.customConfig)) {
    return {
      ok: false,
      error: 'Workspace configuration approval is required',
      message: 'Review and approve the participants, documents, required status, and assignments before activation.',
    };
  }
  return { ok: true, reviewed: true, approval: proof };
}

async function savedPackMatchesApproval(packId, approvalHash) {
  if (!approvalHash || !String(packId || '').startsWith('ws_')) return true;
  const { data, error } = await supabase
    .from('custom_workflow_packs')
    .select('config')
    .eq('id', packId)
    .maybeSingle();
  if (error || !data) return false;
  return workflowConfigHash(data.config) === approvalHash;
}
// Allow OPENAI_API_KEY1 as the active key (e.g. after rotating to a new key)
if (process.env.OPENAI_API_KEY1) {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY1;
}
// Hard required — platform cannot function without these
["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","OPENAI_API_KEY"].forEach(k => {
  if (!process.env[k]) {
    console.error(`[FATAL] Missing required env var: ${k}`);
    process.exit(1);
  }
});
// Optional — warn but stay running; features degrade gracefully
["SENTRY_DSN","STRIPE_SECRET_KEY","ENCRYPTION_KEY","PII_ENCRYPTION_KEY"].forEach(k => {
  if (!process.env[k]) {
    console.warn(`[WARN] Optional env var not set: ${k} — related features disabled`);
  }
});

const normalizeOrigin = (origin = '') => origin.replace(/\/$/, '');
const parseOrigins = (value = '') =>
  value
    .split(',')
    .map((part) => normalizeOrigin(part.trim()))
    .filter(Boolean);

const envOrigins = [
  ...parseOrigins(process.env.CORS_ORIGINS || ''),
  normalizeOrigin(process.env.FRONTEND_URL || ''),
].filter(Boolean);

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://kontra.vercel.app',
  'https://kontra-ui.vercel.app',
  'https://kontraui.com',
  'https://www.kontraui.com',
  'https://kontraplatform.com',
  'https://www.kontraplatform.com',
];

const allowedOrigins = Array.from(new Set([
  ...defaultAllowedOrigins,
  ...envOrigins,
]));

// Canonical frontend base URL for building links in emails and notifications.
// Set FRONTEND_URL on Render (or any host) to match your deployed domain.
// Falls back to kontraplatform.com so existing emails continue working if
// the env var is not yet configured.
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://kontraplatform.com').replace(/\/$/, '');

const allowedOriginMatchers = [
  ...allowedOrigins,
  /\.vercel\.app$/,
  /\.replit\.dev(:\d+)?$/,
  /\.repl\.co(:\d+)?$/,
  /localhost(:\d+)?$/,
  /127\.0\.0\.1(:\d+)?$/,
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
   const isAllowed = allowedOriginMatchers.some((matcher) => (
      matcher instanceof RegExp
        ? matcher.test(normalizedOrigin)
        : matcher === normalizedOrigin
    ));
    
   if (isAllowed) {
      return callback(null, true);
    }

    console.warn(`[CORS] Origin "${normalizedOrigin}" rejected`);
   return callback(new Error(`CORS blocked: ${normalizedOrigin}`));
  },
  credentials: true,
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'X-Org-Id',
    'x-org-id',
    'X-Organization-Id',
    'x-organization-id',
    'X-Requested-With',
    'X-User-Id',
    'Accept',
    'Origin',
    // Kontra room-auth headers sent by getRoomAuthHeaders() in every room request
    'x-kontra-session',
    'X-Kontra-Session',
    'x-owner-write-token',
    'X-Owner-Write-Token',
  ],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
};

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, _res, next) => {
  const org = req.headers['x-organization-id'];
  if (req.path.includes('/api/servicing') || req.path.includes('/api/marketplace')) {
    console.log('[REQ]', req.method, req.path, 'org:', org || 'NONE');
  } else {
    console.log('[REQ]', req.method, req.path);
  }
  next();
});

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
const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12',   // .xlsm
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12', // .xlsb
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = (file.originalname || '').split('.').pop().toLowerCase();
    const ALLOWED_EXTS = new Set(['pdf','doc','docx','xlsx','xls','xlsm','xlsb','csv','txt','jpg','jpeg','png']);
    if (ALLOWED_MIMETYPES.has(file.mimetype) || ALLOWED_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype} (${file.originalname})`));
    }
  },
});

// ── OpenAI Client (v4+ SDK) ────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-not-configured',
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
const billingRouter = require('./routers/billing');
const loanGovernanceRouter = require('./routers/loanGovernance');
const onboardingRouter = require('./routers/onboarding');
const rulesRouter     = require('./routers/rules');
const invitesRouter = require('./routers/invites');
const dealRoomSecurityV2Router = require('./routers/dealRoomSecurityV2');
const documentReviewRouter = require('./routers/documentReview');
// Optional routers for unfinished modules
const ssoRouter = require('./routers/sso');
const reportsRouter = require('./routers/reports');
const { router: menuRouter } = require('./routers/menu');
const { logUserEvent, suggestNextFeature } = require('./personalization');
const { router: ordersRouter } = require('./routers/orders');
const { router: paymentsRouter } = require('./routers/payments');
const { router: paymentsStablecoinRouter } = require('./routers/paymentsStablecoin');
const { router: paymentsStablecoinWebhookRouter } = require('./routers/paymentsStablecoinWebhook');
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
const capitalMarketsTokensRouter = require('./routers/capitalMarketsTokens');
const { router: analyticsRouter } = require('./routers/analytics');
const { router: visitorsRouter } = require('./routers/visitors');
const { router: waitlistRouter } = require('./routers/waitlist');
const { router: workflowPacksRouter } = require('./routers/workflowPacks');
const { router: covenantAgentRouter } = require('./routers/covenantAgent');
const { router: underwritingRouter } = require('./routers/underwriting');
const { router: eventsRouter } = require('./routers/events');
const restaurantRouter = require('./routers/restaurant');
const restaurantsRouter = require('./routers/restaurants');
const applicationsRouter = require('./routers/applications');
const riskRouter = require('./routers/risk');
const { router: tokenizationRouter } = require('./routers/tokenization');
const { router: blockchainRouter } = require('./routers/blockchain');
const { router: aiReviewsRouter } = require('./routers/aiReviews');
const { router: marketDistributionRouter } = require('./routers/marketDistribution');
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
const investorRouter = require('./routers/investor');
const servicerRouter = require('./routers/servicer');
const aiDocsRouter  = require('./routers/aiDocs');
const borrowerRouter = require('./routers/borrower');
// Compliance automation is still experimental
const complianceRouter = require('./routers/compliance');
const legalRouter = require('./routers/legal');
const otpRouter = require('./routers/otp');
const mobileRouter = require('./routers/mobile');
const policyRouter = require('./routers/policy');
const { requireOrgContext } = require('./src/middleware/requireOrgContext');
const { errorHandler } = require('./src/middleware/errorHandler');
const portfolioSliceRouter = require('./src/routes/portfolio');
const servicingSliceRouter = require('./src/routes/servicing');
const governanceSliceRouter = require('./src/routes/governance');
const marketsSliceRouter = require('./src/routes/markets');
const reportsSliceRouter = require('./src/routes/reports');
const orgsSliceRouter = require('./src/routes/organizations');
const orgDiscoveryRouter = require('./src/routes/orgDiscovery');
const authBootstrapRouter = require('./src/routes/auth');
const aiSliceRouter = require('./src/routes/ai');
const workflowsSliceRouter = require('./src/routes/workflows');
const agentConsoleRouter   = require('./src/routes/agentConsole');
const integrationHubRouter = require('./src/routes/integrationHub');
const headlessApiRouter    = require('./src/routes/headlessApi');
const phase6TokenizationRouter = require('./src/routes/tokenizationApi');
const phase7CostGovernanceRouter = require('./src/routes/costGovernanceApi');
const phase8CommandCentersRouter = require('./src/routes/commandCentersApi');
const devSliceRouter = require('./src/routes/dev');

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
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use(auditLogger);
app.use(rateLimit);
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: 'v2-checkout-fix', deployed: new Date().toISOString() });
});

// ── Public deal room routes — registered EARLY, before any org/auth middleware ──
app.get('/api/public/my-rooms', async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const { data, error } = await supabase
      .from('deal_rooms')
      .select('property_id, property_name, property_type, deal_amount, deal_type, address, status, created_at, activated_at')
      .ilike('customer_email', email)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ rooms: data || [] });
  } catch (err) {
    console.error('[my-rooms-early]', err.message);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.get('/api/public/document-url', async (req, res) => {
  const storagePath = (req.query.path || '').trim();
  if (!storagePath) return res.status(400).json({ error: 'path required' });
  const [propertyId, section] = storagePath.split('/');
  const access = await getRoomAccessContext(req, propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  if (access.mode === 'participant') {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('workflow_pack_id, property_type')
      .eq('property_id', propertyId)
      .maybeSingle();
    const assignedSections = await getAssignedSectionsForAccess(
      propertyId,
      room?.workflow_pack_id || DEFAULT_PACK_ID,
      room?.property_type || 'Multifamily',
      access,
    );
    if (!assignedSections.has(section)) {
      return accessDenied(res, 'This document is not assigned to your role');
    }
  }
  try {
    const { data, error } = await supabase.storage
      .from('deal-documents')
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) return res.status(404).json({ error: 'Document not found or expired' });
    res.redirect(data.signedUrl);
  } catch (err) {
    console.error('[document-url-early]', err.message);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
});
// ── Verified Asset Package — registered here (before any auth middleware) so
// the public GET/POST endpoints are never intercepted by authenticate.js ─────
app.use(verifiedAssetPackageRouter);

// ── End early public routes ──────────────────────────────────────────────────

app.use('/api/auth', authBootstrapRouter);
app.use('/api/orgs', orgDiscoveryRouter);
app.use('/api/me', orgDiscoveryRouter);

// ── Kontra AI Copilot (public — no org or auth required) ──────────────────────
const COPILOT_SYSTEM_PROMPT = `You are Kontra AI Copilot, an expert commercial real estate loan servicing intelligence platform built for institutional lenders and servicers. You have deep knowledge of:

PORTFOLIO CONTEXT (always reference this):
- 847 loans under management | $2.41B total UPB
- Asset mix: Multifamily $1.02B (312 loans), Office $486M (89 loans), Industrial $398M (124 loans), Retail $312M (178 loans), Mixed-Use $192M (144 loans)
- 3 loans on Watchlist: LN-3011 (Harbor Point Mixed-Use, DSCR 0.94×, 45 days delinquent), LN-3204 (Riverview Office Tower, occupancy 81%), LN-2847 (Meridian Apts, insurance renewal due in 14 days)
- Current delinquency rate: 1.41% (threshold 3.0%)
- Q1 2026 investor report: ready for distribution

SPECIALIZED CAPABILITIES:
1. WATCHLIST COMMENT DRAFTING — Draft formal watchlist comments in Freddie Mac Multifamily Servicing Guide format. Include: loan ID, property name, UPB, trigger reason, financial metrics (DSCR, occupancy, LTV), borrower posture, servicer recommendation, and cure plan. Use structured paragraph format matching Freddie Mac §28.3 requirements.

2. DSCR ANALYSIS — Explain DSCR drops with root cause analysis (NOI compression, expense escalation, vacancy, rent roll erosion), compare to covenant floor, project cure timeline, and recommend specific servicer actions.

3. FREDDIE MAC GUIDE RECOMMENDATIONS — Cite specific Freddie Mac Multifamily Servicing Guide sections (e.g., Chapter 28 Watchlist, Chapter 60 Default, Chapter 66 Assumption) when recommending actions. Include applicable timelines and notification requirements.

4. DI (Deferred Interest) LOGIC — Advise on DI start/stop triggers, accrual mechanics, and PSA notification requirements.

5. HAZARD DISBURSEMENT — Evaluate insurance proceeds eligibility, holdback calculations, contractor bid requirements, and disbursement scheduling per PSA/GSE rules.

6. PRS (Property Condition Report Submission) — Guide on preparing PRS packages, inspection requirements, and submission timelines.

7. DRAW REQUEST ANALYSIS — Review construction draw requests against budget, inspection milestones, lien waiver status, and recommend approve/hold/reject.

8. INVESTOR REPORTING — Draft investor report sections, distribution notices, and PSA notifications.

FORMATTING RULES:
- Use **bold** for loan IDs, key metrics, and action items
- Use bullet points (•) for lists
- Use ## section headers for long responses
- Always include specific loan references (LN-XXXX) when discussing watchlist items
- Be precise with numbers — use exact UPB, DSCR, occupancy figures from portfolio context
- For watchlist comments, use formal regulatory language
- Keep responses focused and actionable
- Today's date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

// Copilot uses Replit AI Integration (auto-provisioned, no quota issues)
const copilotAI = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

app.post('/api/copilot/chat', async (req, res) => {
  const { messages, stream } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: 'Missing messages array' });
  }
  const safeMessages = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
    .slice(-20);
  try {
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const streamed = await copilotAI.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: COPILOT_SYSTEM_PROMPT }, ...safeMessages],
        max_tokens: 1200,
        temperature: 0.4,
        stream: true,
      });
      for await (const chunk of streamed) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    const response = await copilotAI.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: COPILOT_SYSTEM_PROMPT }, ...safeMessages],
      max_tokens: 1200,
      temperature: 0.4,
    });
    const msg = response.choices[0].message;
    return res.json({ content: msg.content, model: response.model, confidence: 0.96 });
  } catch (err) {
    console.error('[Copilot] OpenAI error:', err?.message || err);
    return res.status(500).json({ message: 'Copilot error', error: err?.message });
  }
});

// ── Tokenization Eligibility Gate ─────────────────────────────────────────────
// Public copilot route — must stay BEFORE the requireOrgContext middleware block
const DEMO_LOANS = {
  'LN-3011': {
    ref: 'LN-3011', name: 'Harbor Point Mixed-Use', type: 'Mixed-Use',
    upb: 24700000, rate: 5.85, maturity: '2026-09-01',
    dscr: 0.94, dscrFloor: 1.25,
    occupancy: 88, occupancyFloor: 85,
    delinquencyDays: 45,
    watchlist: true,
    escrowTaxes: 'current', escrowInsurance: 'current',
    covenantBreaches: ['DSCR below 1.25× floor (actual 0.94×)', 'Loan 45 days delinquent'],
    inspectionOverdue: false,
    complianceHolds: ['Freddie Mac §28.3 watchlist reporting active'],
  },
  'LN-3204': {
    ref: 'LN-3204', name: 'Riverview Office Tower', type: 'Office',
    upb: 18200000, rate: 6.10, maturity: '2027-03-01',
    dscr: 1.18, dscrFloor: 1.25,
    occupancy: 81, occupancyFloor: 85,
    delinquencyDays: 0,
    watchlist: true,
    escrowTaxes: 'current', escrowInsurance: 'current',
    covenantBreaches: ['DSCR below 1.25× floor (actual 1.18×)', 'Occupancy below 85% floor (actual 81%)'],
    inspectionOverdue: false,
    complianceHolds: ['Investor surveillance reporting overdue'],
  },
  'LN-2847': {
    ref: 'LN-2847', name: 'Meridian Apartments', type: 'Multifamily',
    upb: 31400000, rate: 4.95, maturity: '2029-12-01',
    dscr: 1.42, dscrFloor: 1.25,
    occupancy: 96, occupancyFloor: 85,
    delinquencyDays: 0,
    watchlist: false,
    escrowTaxes: 'current', escrowInsurance: 'current',
    covenantBreaches: [],
    inspectionOverdue: false,
    complianceHolds: [],
    warnings: ['Insurance renewal due in 14 days — confirm certificate before mint'],
  },
};

app.get('/api/copilot/tokenization-eligibility', (req, res) => {
  const ref = String(req.query.loan_ref || '').toUpperCase().trim();
  if (!ref) return res.status(400).json({ message: 'loan_ref is required' });

  const loan = DEMO_LOANS[ref];
  if (!loan) {
    // Unknown loan — return a generic eligible stub
    return res.json({
      loan_ref: ref,
      name: 'Unknown Loan',
      found: false,
      eligible: true,
      status: 'eligible',
      checks: [
        { key: 'dscr',        label: 'DSCR vs floor',          pass: true,  detail: 'No data — assumed compliant' },
        { key: 'occupancy',   label: 'Occupancy vs floor',      pass: true,  detail: 'No data — assumed compliant' },
        { key: 'delinquency', label: 'Payment current',         pass: true,  detail: 'No delinquency on record' },
        { key: 'watchlist',   label: 'Not on watchlist',        pass: true,  detail: 'Not on watchlist' },
        { key: 'escrow',      label: 'Escrow current',          pass: true,  detail: 'Taxes & insurance current' },
        { key: 'compliance',  label: 'No compliance holds',     pass: true,  detail: 'No holds on record' },
      ],
      blocks: [],
      warnings: [],
    });
  }

  const checks = [
    {
      key: 'dscr',
      label: 'DSCR vs covenant floor',
      pass: loan.dscr >= loan.dscrFloor,
      detail: `Actual ${loan.dscr}× — floor ${loan.dscrFloor}×`,
    },
    {
      key: 'occupancy',
      label: 'Occupancy vs floor',
      pass: loan.occupancy >= loan.occupancyFloor,
      detail: `Actual ${loan.occupancy}% — floor ${loan.occupancyFloor}%`,
    },
    {
      key: 'delinquency',
      label: 'Payment current',
      pass: loan.delinquencyDays === 0,
      detail: loan.delinquencyDays === 0 ? 'All payments current' : `${loan.delinquencyDays} days delinquent`,
    },
    {
      key: 'watchlist',
      label: 'Not on watchlist',
      pass: !loan.watchlist,
      detail: loan.watchlist ? 'Active watchlist loan — servicing remediation required' : 'Not on watchlist',
    },
    {
      key: 'escrow',
      label: 'Escrow current',
      pass: loan.escrowInsurance === 'current' && loan.escrowTaxes === 'current',
      detail: `Taxes: ${loan.escrowTaxes} · Insurance: ${loan.escrowInsurance}`,
    },
    {
      key: 'compliance',
      label: 'No compliance holds',
      pass: loan.complianceHolds.length === 0,
      detail: loan.complianceHolds.length === 0 ? 'No holds' : loan.complianceHolds.join('; '),
    },
  ];

  const blocks = loan.covenantBreaches || [];
  const warnings = loan.warnings || [];
  const eligible = checks.every(c => c.pass) && blocks.length === 0;
  const status = eligible ? (warnings.length > 0 ? 'eligible_with_warnings' : 'eligible') : 'blocked';

  return res.json({
    loan_ref: ref,
    name: loan.name,
    type: loan.type,
    upb: loan.upb,
    dscr: loan.dscr,
    occupancy: loan.occupancy,
    found: true,
    eligible,
    status,
    checks,
    blocks,
    warnings,
  });
});

// ── Workspace AI Generation ───────────────────────────────────────────────────
// Given a plain-language description of a transaction, returns a structured
// workspace config (roles, documents, stages) as a starting point.
app.post(['/api/workspace/generate', '/api/room-generator/analyze'], aiRateLimit, async (req, res) => {
  const { description, transactionType, currentStage } = req.body || {};
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  // The public form sends stable machine values. Convert them before building
  // the prompt; otherwise "business_acquisition" does not match the old
  // display-name rules and the model is left to infer the domain from scratch.
  const TRANSACTION_PROFILES = {
    business_acquisition: {
      label: 'Business Acquisition',
      packId: 'business_acquisition',
      rules: `
This is an operating-company acquisition, not a real-estate transaction.
Use roles such as buyer/acquirer, seller, M&A or financial adviser, legal
counsel, and quality-of-earnings accountant as appropriate. Prioritize
financial statements, tax returns, quality of earnings, letter of intent,
purchase agreement, material contracts, employee agreements, and disclosure
schedules. Do not include title, rent roll, environmental, survey, zoning,
property inspection, or other property documents unless the description
explicitly says the property itself is the asset being acquired.`,
    },
    cre_acquisition: {
      label: 'Commercial Real Estate Acquisition',
      packId: 'cre_acquisition',
      rules: `
This is a property/real-estate transaction. Use roles such as property owner,
buyer, lender or financial adviser, legal counsel, property manager, inspector,
and insurer as appropriate. Prioritize purchase and sale agreement, title,
survey, zoning, environmental, inspection, rent roll/operating statements,
insurance, and financing documents.`,
    },
    fundraising: {
      label: 'Fundraising Round',
      packId: 'fundraising',
      rules: `
This is a capital-raising transaction, not an acquisition. Use roles such as
founder/issuer, investor, securities counsel, financial adviser, and accountant
as appropriate. Prioritize term sheet, cap table, financial statements/model,
investor presentation, subscription or investment agreement, diligence
questionnaire, and legal opinion. Do not include property diligence documents
unless the description explicitly requires them.`,
    },
    tokenization: {
      label: 'Token Issuance / STO',
      packId: 'tokenization',
      rules: `
This is a token issuance or security-token offering. Use roles such as issuer,
investor, legal counsel, compliance/KYC provider, tokenization platform, and
custodian as appropriate. Prioritize token economics/ownership structure,
offering memorandum, subscription agreement, KYC/AML, accreditation,
regulatory filings, smart-contract/audit materials, and cap table. Do not use
property-acquisition documents unless the description explicitly says the
underlying asset is real estate.`,
    },
    lending: {
      label: 'Lending / Finance',
      packId: 'business_acquisition',
      rules: `
This is a lending or financing transaction, not automatically a property
acquisition. Use roles such as borrower, lender, financial adviser, legal
counsel, underwriter, and collateral/servicing provider as appropriate.
Prioritize loan application, borrower financials, debt schedule, collateral
documents, credit memo, term sheet, loan agreement, guarantees, and closing
conditions. Use property documents only when the description identifies real
estate collateral.`,
    },
    licensing: {
      label: 'Licensing Transaction',
      packId: 'business_acquisition',
      rules: `
This is a licensing transaction. Use roles such as licensor, licensee,
commercial counsel, technical owner, and compliance reviewer as appropriate.
Prioritize the license agreement, IP ownership evidence, technical
specifications, usage/royalty schedule, compliance materials, data-security
review, and implementation plan. Do not generate acquisition or property
diligence documents.`,
    },
    joint_venture: {
      label: 'Joint Venture',
      packId: 'business_acquisition',
      rules: `
This is a joint venture formation. Use roles such as participating sponsors,
investment committee, legal counsel, tax adviser, and operating manager as
appropriate. Prioritize the term sheet, joint-venture agreement, capitalization
table, contribution schedule, governance plan, budget, tax structure, and
operating agreements. Do not generate property documents unless the
description explicitly identifies a real-estate joint venture.`,
    },
    other: {
      label: 'Custom Transaction',
      packId: 'business_acquisition',
      rules: `
Treat this as a custom transaction. Infer the actual parties, documents, and
stages from the description. Do not assume it is commercial real estate and do
not introduce property documents unless the description explicitly requires
them.`,
    },
  };
  const profile = TRANSACTION_PROFILES[transactionType] || null;
  const normalizedType = profile?.label || (transactionType ? String(transactionType).trim() : '');
  const typeHint = normalizedType
    ? `\n\nAUTHORITATIVE TRANSACTION TYPE: ${normalizedType}. The transaction type is selected by the user and must control the structure.`
    : '';
  const stageHint = currentStage
    ? `\nCURRENT LIFECYCLE STAGE: ${currentStage}. Include that stage in the generated lifecycle and place it in the appropriate order.`
    : '';
  const domainRule = profile?.rules || `
Infer the transaction domain from the description. If the description is
ambiguous, ask the model to choose the least-assumptive structure rather than
defaulting to commercial real estate.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 1500,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are a transaction deal-room configurator. Given a description of a private transaction, generate a transaction-specific configuration as a JSON object.

Return exactly this shape:
{
  "name": "string — deal room name (e.g. Acme Manufacturing Acquisition)",
  "transactionType": "one of business_acquisition, cre_acquisition, fundraising, tokenization, lending, licensing, joint_venture, other",
  "transactionTypeLabel": "string — human-readable transaction type",
  "transactionStructure": "string|null — short structure such as Asset Purchase, Stock Purchase, Equity Round; null when not confidently supported",
  "transactionStructureConfidence": "high|low",
  "transactionValue": "number|null — only when an amount is explicitly supplied or confidently extracted; otherwise null",
  "transactionValueConfidence": "high|low",
  "roles": [{ "key": "snake_case_key", "label": "Display Name", "required": bool, "needsDocs": bool, "icon": "emoji", "color": "#hex" }],
  "documents": [{ "id": "snake_case_id", "label": "Document Name", "required": bool, "ai": bool, "assignedRole": "role_key" }],
  "stages": [{ "key": "snake_case_key", "label": "Stage Name" }]
}

Rules:
- 3–6 roles; first role is the deal-room owner / coordinator (canManage=true implied)
- 6–14 documents covering the key due-diligence areas for this transaction type
- 3–6 stages reflecting the actual lifecycle (e.g. NDA → LOI → Due Diligence → Closing)
- Mark key legal/financial docs required:true; mark docs where AI extraction adds value ai:true
- Use professional labels; avoid jargon unique to a single industry unless the description uses it
- Keep stage labels short (1–4 words)
- Return transactionValue only when the description explicitly states an amount or the amount is unambiguous; never guess or calculate it from unrelated figures.
- Return transactionStructure only when the description clearly supports it; otherwise return null with low confidence.
- When an authoritative transaction type is supplied, every role, document, and stage must fit that type. Never copy a default CRE checklist into another type.
${domainRule}

IMPORTANT: You are suggesting a starting point only. Do NOT claim completeness. The deal-room owner must review with qualified professional advisers.`,
        },
        { role: 'user', content: description.trim() + typeHint + stageHint },
      ],
    });

    let raw = {};
    try { raw = JSON.parse(completion.choices[0].message.content); } catch (_) {}
    const generatedIdentity = inferGeneratedTransactionIdentity({
      description,
      selectedType: transactionType,
      generatedType: raw.transactionType,
      generatedLabel: raw.transactionTypeLabel,
    });
    const resolvedTransactionType = generatedIdentity.type;
    const compatibilityPackId = profile?.packId
      || (['cre_acquisition', 'business_acquisition', 'fundraising', 'tokenization'].includes(resolvedTransactionType)
        ? resolvedTransactionType
        : 'business_acquisition');
    const transactionTypeLabels = {
      lending: 'Lending / Finance',
      licensing: 'Licensing Transaction',
      joint_venture: 'Joint Venture',
      other: 'Custom Transaction',
    };
    const canonicalTypeLabel = canonicalTransactionTypeLabel(
      resolvedTransactionType,
      profile?.packId,
      generatedIdentity.label || transactionTypeLabels[resolvedTransactionType] || 'Custom Transaction',
    );
    const generatedConfig = normalizeGeneratedWorkflowConfig(raw);
    const generationId = createGenerationId();
    const generationProof = signWorkflowProof('workflow_generation', {
      generationId,
      configHash: workflowConfigHash(generatedConfig),
    });
    const proposal = normalizeProposal(buildLegacyProposal({
      ...raw,
      ...generatedConfig,
      transactionType: resolvedTransactionType,
      transactionTypeLabel: canonicalTypeLabel,
      transactionStructure: generatedIdentity.subtype || raw.transactionStructure,
    }, { description: description.trim(), transactionType: resolvedTransactionType }));
    const proposalValidation = validateProposal(proposal);
    if (!proposalValidation.ok) {
      console.warn('[room-generator] normalized proposal warnings', proposalValidation.errors);
    }
    let generationSessionId = null;
    if (req.path === '/api/room-generator/analyze') {
      const { error: sessionError } = await supabase
        .from('transaction_generation_sessions')
        .insert({
          id: generationId,
          description: description.trim(),
          transaction_type: resolvedTransactionType,
          proposal,
          generation_proof: generationProof,
          model: 'gpt-4o-mini',
          generation_version: PROPOSAL_VERSION,
        });
      if (sessionError) {
        console.error('[room-generator/analyze] session persistence failed', sessionError.message);
        return res.status(503).json({ error: 'The room-generation session could not be saved. Apply migration 020 and try again.' });
      }
      generationSessionId = generationId;
      const sources = [...(proposal.requirements || []), ...(proposal.transaction_record_fields || [])]
        .filter(item => item.source_type)
        .map(item => ({
          session_id: generationId,
          requirement_key: item.key,
          source_type: item.source_type,
          source_title: item.source_title,
          source_url: item.source_url,
          source_excerpt: item.source_excerpt,
        }));
      if (sources.length) await supabase.from('transaction_generation_sources').insert(sources);
    }
    return res.json({
      name: raw.name || '',
      transactionType: resolvedTransactionType,
      transactionTypeLabel: canonicalTypeLabel,
      transactionStructure: generatedIdentity.subtype
        || (typeof raw.transactionStructure === 'string' && raw.transactionStructure.trim()
          && String(raw.transactionStructureConfidence || '').toLowerCase() === 'high'
          ? raw.transactionStructure.trim().slice(0, 120)
          : null),
      transactionStructureConfidence: (generatedIdentity.subtype
        || String(raw.transactionStructureConfidence || '').toLowerCase() === 'high') ? 'high' : 'low',
      transactionValue: String(raw.transactionValueConfidence || '').toLowerCase() === 'high'
        && Number.isFinite(Number(raw.transactionValue)) && Number(raw.transactionValue) > 0
        ? Number(raw.transactionValue)
        : null,
      transactionValueConfidence: String(raw.transactionValueConfidence || '').toLowerCase() === 'high' ? 'high' : 'low',
      packId: compatibilityPackId,
      roles: generatedConfig.roles,
      documents: generatedConfig.documents,
      stages: generatedConfig.stages,
      generationProof,
      generationSessionId,
      proposal,
      proposalValidation,
    });
  } catch (e) {
    console.error('[workspace/generate]', e.message);
    return res.status(500).json({ error: 'Failed to generate workspace config. Please try again.' });
  }
});

// ── Auditable proposal editing and approval ───────────────────────────────────
app.get('/api/room-generator/:sessionId', async (req, res) => {
  const { data, error } = await supabase
    .from('transaction_generation_sessions')
    .select('id, description, transaction_type, status, proposal, edited_proposal, approved_snapshot, generation_version, created_at, updated_at, approved_at')
    .eq('id', req.params.sessionId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to load generation session' });
  if (!data) return res.status(404).json({ error: 'Generation session not found' });
  return res.json({ ...data, proposal: data.edited_proposal || data.proposal });
});

app.patch('/api/room-generator/:sessionId', async (req, res) => {
  const proposal = normalizeProposal(req.body?.proposal || {}, { description: req.body?.description });
  const result = validateProposal(proposal);
  if (!result.ok) return res.status(400).json({ error: 'Proposal is invalid', details: result.errors });
  const { data, error } = await supabase
    .from('transaction_generation_sessions')
    .update({ edited_proposal: proposal, status: 'draft' })
    .eq('id', req.params.sessionId)
    .select('id, status, proposal, edited_proposal, updated_at')
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to save proposal draft' });
  if (!data) return res.status(404).json({ error: 'Generation session not found' });
  return res.json({ ...data, proposal: data.edited_proposal || data.proposal, validation: result });
});

app.post('/api/room-generator/:sessionId/regenerate', aiRateLimit, async (req, res) => {
  const { data: session, error } = await supabase
    .from('transaction_generation_sessions')
    .select('id, description, transaction_type, edited_proposal')
    .eq('id', req.params.sessionId)
    .maybeSingle();
  if (error || !session) return res.status(404).json({ error: 'Generation session not found' });
  // Regeneration is intentionally explicit: the client submits the new proposal
  // after the normal analyze call, so user edits can be merged deterministically.
  const preserved = req.body?.preserve || {};
  return res.json({
    sessionId: session.id,
    description: session.description,
    transactionType: session.transaction_type,
    preserved,
    next: '/api/room-generator/analyze',
    message: 'Run analyze with the revised description and merge preserved edits before saving.',
  });
});

app.post('/api/room-generator/:sessionId/approve', async (req, res) => {
  const proposal = normalizeProposal(req.body?.proposal || {}, {});
  const result = validateProposal(proposal);
  if (!result.ok) return res.status(400).json({ error: 'Proposal must be valid before approval', details: result.errors });
  const snapshot = JSON.parse(JSON.stringify(proposal));
  const { data, error } = await supabase
    .from('transaction_generation_sessions')
    .update({ edited_proposal: proposal, approved_snapshot: snapshot, status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', req.params.sessionId)
    .select('id, status, approved_snapshot, approved_at')
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Unable to approve proposal' });
  if (!data) return res.status(404).json({ error: 'Generation session not found' });
  return res.json({ ...data, proposal: snapshot, auditSnapshot: snapshot });
});

app.post('/api/room-generator/:sessionId/create-room', async (req, res) => {
  const { data: session, error } = await supabase
    .from('transaction_generation_sessions')
    .select('id, status, approved_snapshot')
    .eq('id', req.params.sessionId)
    .maybeSingle();
  if (error || !session) return res.status(404).json({ error: 'Generation session not found' });
  if (session.status !== 'approved' || !session.approved_snapshot) {
    return res.status(409).json({ error: 'Approve the validated proposal before creating a room' });
  }
  const { error: updateError } = await supabase
    .from('transaction_generation_sessions')
    .update({ status: 'created', created_room_id: req.body?.roomId || null })
    .eq('id', req.params.sessionId);
  if (updateError) return res.status(500).json({ error: 'Unable to record room creation' });
  return res.json({ ok: true, sessionId: session.id, proposal: session.approved_snapshot });
});

// ── Public: approve a workflow configuration before activation ───────────────
// The approval token is signed and bound to the exact final roles/documents/
// stages payload. AI-generated configs additionally require a valid generation
// proof, so callers cannot relabel an AI config as a template to skip review.
app.post('/api/workspace/approve', (req, res) => {
  const { customConfig, baselineConfig, generationProof, source = 'creator' } = req.body || {};
  if (!workflowConfigNeedsApproval(customConfig)) {
    return res.status(400).json({ error: 'Workflow configuration is empty' });
  }
  const generation = generationProof
    ? verifyWorkflowProof(generationProof, 'workflow_generation')
    : null;
  if (generationProof && !generation) {
    return res.status(400).json({ error: 'Workflow generation proof is invalid or expired' });
  }
  if (source === 'ai' && !generationProof) {
    return res.status(400).json({ error: 'AI workflow generation proof is required' });
  }
  if (generation && (!baselineConfig || generation.configHash !== workflowConfigHash(baselineConfig))) {
    return res.status(400).json({ error: 'Workflow generation proof does not match the generated configuration' });
  }
  const configHash = workflowConfigHash(customConfig);
  const approvalToken = signWorkflowProof('workflow_approval', {
    generationId: generation?.generationId || null,
    generationConfigHash: generation?.configHash || null,
    source: generation ? 'ai' : 'manual',
    configHash,
  });
  res.json({ ok: true, approvalToken, configHash, generationId: generation?.generationId || null });
});

// ── Public: classify a transaction into a workflow pack ───────────────────────
// Lightweight endpoint used by the deal room page on first open to detect
// when a stored pack doesn't match what the transaction actually is.
app.post('/api/public/classify-pack', async (req, res) => {
  const { name, dealType, address } = req.body || {};
  try {
    const packId = await classifyTransactionPack(name, dealType, address);
    res.json({ packId });
  } catch (e) {
    console.error('[classify-pack]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Public: update a deal room's workflow pack ────────────────────────────────
// Called when the coordinator accepts an AI-suggested pack correction.
// Requires owner_write_token (same auth contract as checklist PUT).
// Resets checklist_items to null so the next GET reseeds it from the new pack.
app.post('/api/public/deal-room/:propertyId/repack', async (req, res) => {
  const { propertyId } = req.params;
  const { packId, ownerWriteToken } = req.body || {};

  // Validate pack choice
  const validPacks = ['cre_acquisition', 'business_acquisition', 'fundraising'];
  if (!validPacks.includes(packId)) {
    return res.status(400).json({ error: `Invalid packId: ${packId}` });
  }
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can change the workflow pack');

  try {
    // Re-seed stages from the new pack
    const newStages = getPackStageConfig(packId).stages.map(({ key, label }) => ({ key, label }));

    // Reset checklist_items to null — the next GET will reseed from the new pack's schema.
    // Checklist state lives in deal_rooms.checklist_items (JSONB), not a separate table.
    const { error } = await supabase
      .from('deal_rooms')
      .update({ workflow_pack_id: packId, stages_config: newStages, checklist_items: null })
      .eq('property_id', propertyId);
    if (error) throw error;

    console.log(`[repack] ${propertyId} → ${packId}`);
    res.json({ ok: true, packId });
  } catch (e) {
    console.error('[repack]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Custom pack response normalization ───────────────────────────────────────
// Older workspace packs may have been generated before role/stage validation
// existed. Normalize them before exposing them to the public room UI so an
// older frontend bundle cannot crash on malformed generated JSON.
function normalizeCustomPackConfig(config, fallbackName = 'Custom Workspace') {
  const source = config && typeof config === 'object' ? config : {};
  const rawRoles = Array.isArray(source.roles) ? source.roles : [];
  const roles = rawRoles.length > 0
    ? rawRoles.map((r, i) => ({
        ...r,
        key: String(r?.key || `role_${i + 1}`).trim().replace(/\s+/g, '_'),
        label: String(r?.label || r?.shortLabel || `Participant ${i + 1}`).trim(),
        icon: r?.icon || '👤',
        color: r?.color || '#800020',
      }))
    : [{
        key: 'owner',
        label: 'Workspace Owner',
        required: true,
        needsDocs: false,
        invitable: false,
        icon: '🔑',
        color: '#800020',
        canManage: true,
      }];

  const roleKeys = new Set(roles.map(r => r.key));
  const rawDocuments = Array.isArray(source.documents) ? source.documents : [];
  const referencedRoleKeys = new Set(rawDocuments.flatMap(d => {
    const assigned = Array.isArray(d?.assignedTo)
      ? d.assignedTo
      : d?.assignedRole
        ? [d.assignedRole]
        : [];
    return assigned
      .map(role => String(role || '').trim().replace(/\s+/g, '_'))
      .filter(Boolean);
  }));
  for (const roleKey of referencedRoleKeys) {
    if (!roleKeys.has(roleKey)) {
      roles.push({
        key: roleKey,
        label: roleKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        required: false,
        needsDocs: true,
        invitable: true,
        icon: '👤',
        color: '#6b7280',
        canManage: false,
      });
      roleKeys.add(roleKey);
    }
  }

  const rawStages = Array.isArray(source.stages) ? source.stages : [];
  const stages = rawStages
    .map((s, i) => ({
      ...s,
      key: String(s?.key || `stage_${i + 1}`).trim().replace(/\s+/g, '_'),
      label: String(s?.label || `Stage ${i + 1}`).trim(),
    }))
    .filter((s, i, list) => s.key && list.findIndex(x => x.key === s.key) === i);
  const safeStages = stages.length >= 2
    ? stages
    : [
        { key: 'setup', label: 'Setup' },
        { key: 'active', label: 'Active' },
        { key: 'complete', label: 'Complete' },
      ];

  const documents = rawDocuments.map((d, i) => {
    const { assignedRole, ...rest } = d || {};
    const assigned = Array.isArray(d?.assignedTo)
      ? d.assignedTo
      : assignedRole
        ? [assignedRole]
        : [];
    return {
      ...rest,
      id: d?.id || `document_${i + 1}`,
      label: String(d?.label || d?.name || `Document ${i + 1}`).trim(),
      section: d?.section || d?.id || `document_${i + 1}`,
      assignedTo: [...new Set(
        assigned
          .map(role => String(role || '').trim().replace(/\s+/g, '_'))
          .filter(role => roleKeys.has(role)),
      )],
    };
  });

  return {
    ...source,
    name: source.name || fallbackName,
    description: source.description || '',
    roles,
    stages: safeStages,
    documents,
    onboardingSteps: Array.isArray(source.onboardingSteps) ? source.onboardingSteps : [],
  };
}

// ── Helper: auto-save a custom pack and return its ID ────────────────────────
// Always creates a pack — for blank workspaces, fills in minimal usable defaults
// so the workspace never falls back to CRE acquisition pack.
async function saveCustomPackForWorkspace(propertyId, propertyName, customConfig, transactionType = '') {
  if (!customConfig) return null;
  const customPackId = `ws_${(propertyId || 'w').replace(/[^a-z0-9]/g, '_').slice(0, 30)}_${Date.now().toString(36)}`;
  const packName = propertyName || 'Custom Workspace';

  // For blank workspaces the config arrays are empty — supply minimal defaults
  // so the room renders with a real (if sparse) pack instead of CRE defaults.
  const rawRoles = Array.isArray(customConfig.roles) && customConfig.roles.length > 0
    ? customConfig.roles
    : [];

  // Normalise roles: preserve canManage where present; ensure first role is always
  // the coordinator (canManage: true) so stage advancement / checklist management works.
  const hasCoordinator = rawRoles.some(r => r.canManage);
  const roles = rawRoles.length > 0
    ? rawRoles.map((r, i) => ({
        ...r,
        key: String(r.key || `role_${i + 1}`).trim().replace(/\s+/g, '_'),
        label: String(r.label || r.shortLabel || `Participant ${i + 1}`).trim(),
        icon: r.icon || '👤',
        color: r.color || '#800020',
        canManage: r.canManage !== undefined ? !!r.canManage : (!hasCoordinator && i === 0),
      }))
    : [{ key: 'owner', label: 'Workspace Owner', required: true, needsDocs: false,
         invitable: false, icon: '🔑', color: '#800020', canManage: true }];

  const rawStages = Array.isArray(customConfig.stages) ? customConfig.stages : [];
  const normalizedStages = rawStages.map((s, i) => ({
    ...s,
    key: String(s.key || `stage_${i + 1}`).trim().replace(/\s+/g, '_'),
    label: String(s.label || `Stage ${i + 1}`).trim(),
  })).filter((s, i, list) => s.key && list.findIndex(x => x.key === s.key) === i);
  const stages = normalizedStages.length >= 2
    ? normalizedStages
    : [
        { key: 'setup',    label: 'Setup' },
        { key: 'active',   label: 'Active' },
        { key: 'complete', label: 'Complete' },
      ];

  // Normalise documents: convert frontend's `assignedRole` string → `assignedTo` array
  // expected by runtime checklist/coordination panels.
  const rawDocuments = Array.isArray(customConfig.documents) ? customConfig.documents : [];
  const referencedRoleKeys = new Set(rawDocuments.flatMap(d => {
    const assigned = Array.isArray(d.assignedTo) ? d.assignedTo : d.assignedRole ? [d.assignedRole] : [];
    return assigned.map(role => String(role || '').trim().replace(/\s+/g, '_')).filter(Boolean);
  }));
  const existingRoleKeys = new Set(roles.map(r => r.key));
  for (const roleKey of referencedRoleKeys) {
    if (!existingRoleKeys.has(roleKey)) {
      roles.push({
        key: roleKey,
        label: roleKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        required: false,
        needsDocs: true,
        invitable: true,
        icon: '👤',
        color: '#6b7280',
        canManage: false,
      });
    }
  }
  const documents = rawDocuments.map((d, i) => {
    const { assignedRole, ...rest } = d;
    const assigned = Array.isArray(d.assignedTo) ? d.assignedTo : (assignedRole ? [assignedRole] : []);
    return {
      ...rest,
      id: d.id || `document_${i + 1}`,
      label: String(d.label || d.name || `Document ${i + 1}`).trim(),
      section: d.section || d.id || `document_${i + 1}`,
      assignedTo: [...new Set(assigned.map(role => String(role || '').trim().replace(/\s+/g, '_')).filter(Boolean))],
    };
  });

  try {
    const { error } = await supabase.from('custom_workflow_packs').insert({
      id: customPackId,
      name: packName,
      description: '',
      config: { name: packName, description: '', transactionType, roles, stages, documents },
    });
    if (error) { console.warn('[custom-pack] insert error:', error.message); return null; }
    return customPackId;
  } catch (e) {
    console.warn('[custom-pack] save failed:', e.message);
    return null;
  }
}

// Built-in stage definitions live in the API registry, but AI-generated
// workspace packs are stored as JSON in custom_workflow_packs. Never ask the
// built-in registry for a ws_* ID — that silently returns the CRE stages.
async function getInitialStagesForPack(packId, explicitStages = null) {
  const sourceStages = Array.isArray(explicitStages) && explicitStages.length >= 2
    ? explicitStages
    : (packId && packId.startsWith('ws_')
      ? (await supabase
        .from('custom_workflow_packs')
        .select('config')
        .eq('id', packId)
        .maybeSingle()).data?.config?.stages
      : null);

  const stages = Array.isArray(sourceStages) && sourceStages.length >= 2
    ? sourceStages
    : getPackStageConfig(packId).stages;

  return stages.map(({ key, label }) => ({ key, label }));
}

// ── Public: fetch all custom workflow packs ───────────────────────────────────
// Called by fetchCustomPacks() on the client to preload known custom packs.
app.get('/api/workflow-packs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('custom_workflow_packs')
      .select('id, name, description, config')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ packs: data || [] });
  } catch (e) {
    console.error('[workflow-packs] list error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Public: fetch a single custom workflow pack by ID ─────────────────────────
// Called by ensureWorkflowPackLoaded() so DealRoomPage can register the pack
// and render with the correct roles/stages/documents instead of falling back
// to the CRE default.
app.get('/api/workflow-packs/:packId', async (req, res) => {
  const { packId } = req.params;
  if (!packId || !packId.startsWith('ws_')) {
    return res.status(400).json({ error: 'Invalid pack ID — only ws_* custom packs are served here' });
  }
  try {
    const { data, error } = await supabase
      .from('custom_workflow_packs')
      .select('id, name, description, config')
      .eq('id', packId)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Pack not found' });
    res.json({ pack: data });
  } catch (e) {
    console.error('[workflow-packs] fetch error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Stripe Guest Checkout — PUBLIC, must stay BEFORE requireOrgContext ──────
// In-memory store for pending deal rooms (checkout → webhook bridge)
const pendingDealRooms = new Map();

app.post('/api/checkout/guest', async (req, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.startsWith('placeholder') || stripeKey.length < 20) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Payments are not yet enabled. Contact hello@kontraplatform.com to upgrade.',
      });
    }
    const stripe = require('stripe')(stripeKey);
    const { propertyId, propertyName, plan = 'deal', email, role = 'lender', meta = {} } = req.body;
    const generatedProposal = await getApprovedGenerationProposal(meta.generationSessionId);
    if (meta.generationSessionId && !generatedProposal) {
      return res.status(409).json({ error: 'An approved AI room proposal is required before checkout' });
    }
    const workflowApproval = validateWorkflowApproval(meta);
    if (!workflowApproval.ok) {
      return res.status(400).json({
        error: workflowApproval.error,
        message: workflowApproval.message,
      });
    }
    const workflowPackId = meta.workflowPackId
      || DEAL_TYPE_TO_PACK_INDEX[meta.dealType]
      || await classifyTransactionPack(propertyName, meta.dealType, meta.address);
    // Persist a generated workspace pack before creating the Stripe session.
    // The webhook may run on a different Render instance, so its ID must not
    // exist only in the in-memory pendingDealRooms map.
    let finalPackId = workflowPackId;
    if (meta.customConfig) {
      const savedId = await saveCustomPackForWorkspace(propertyId, propertyName, meta.customConfig, meta.transactionType);
      if (!savedId) {
        return res.status(503).json({
          error: 'Workspace configuration could not be saved',
          message: 'The workspace configuration store is unavailable. Please try again shortly.',
        });
      }
      finalPackId = savedId;
      if (!await savedPackMatchesApproval(finalPackId, workflowApproval.approval?.configHash)) {
        return res.status(409).json({
          error: 'Workspace configuration changed before activation',
          message: 'The approved workflow no longer matches the saved configuration. Please review it again.',
        });
      }
    }
    const normalizedJurisdiction = await jurisdictionForTransaction(
      meta.jurisdiction,
      finalPackId,
      meta.transactionType,
    );
    const normalizedTransactionTypeLabel = canonicalTransactionTypeLabel(
      meta.transactionType,
      finalPackId,
      meta.transactionTypeLabel,
    );
    const origin = req.headers.origin || 'https://kontraplatform.com';

    const PLANS = {
      deal: { name: 'Kontra Deal Room', amount: 49900, mode: 'payment' },
      pro_monthly: { name: 'Kontra Pro — Monthly', amount: 29900, mode: 'subscription', interval: 'month' },
      pro_annual: { name: 'Kontra Pro — Annual', amount: 249900, mode: 'subscription', interval: 'year' },
    };
    const cfg = PLANS[plan] || PLANS.deal;
    const description = propertyName ? `Deal room for ${propertyName}` : 'Per-deal access for all parties';

    const lineItem = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        product_data: { name: cfg.name, description },
        unit_amount: cfg.amount,
        ...(cfg.mode === 'subscription' ? { recurring: { interval: cfg.interval } } : {}),
      },
    };

    // Generate an unforgeable owner write token for this workspace. It is
    // embedded in the success URL so the coordinator can store it client-side
    // and use it to authorize server-side checklist mutations later.
    const ownerWriteToken = crypto.randomBytes(32).toString('hex');

    const sessionParams = {
      mode: cfg.mode,
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: `${origin}/checkout/success?plan=${plan}${propertyId ? `&property=${propertyId}` : ''}${propertyName ? `&name=${encodeURIComponent(propertyName)}` : ''}&session_id={CHECKOUT_SESSION_ID}&owner_token=${ownerWriteToken}`,
      cancel_url: `${origin}/checkout/cancel?plan=${plan}${propertyId ? `&property=${propertyId}` : ''}&role=${role}`,
      metadata: {
        plan,
        propertyId: propertyId || '',
        propertyName: propertyName || '',
        role,
        workflowPackId: finalPackId || '',
        dealType: meta.dealType || '',
        address: meta.address || '',
        propertyType: meta.type || '',
        propertySize: meta.size || '',
        dealAmount: meta.dealAmount || '',
        closingDate: meta.closingDate || '',
        firstName: meta.firstName || '',
        lastName: meta.lastName || '',
        jurisdiction: normalizedJurisdiction,
        transactionType: meta.transactionType || '',
        transactionTypeLabel: normalizedTransactionTypeLabel,
        transactionTypeSource: meta.transactionTypeSource || '',
        transactionDescription: meta.transactionDescription || '',
        transactionStructure: meta.transactionStructure || '',
        transactionValue: meta.transactionValue || '',
        transactionValueConfidence: meta.transactionValueConfidence || '',
        generationSessionId: meta.generationSessionId || '',
        customConfigReviewed: workflowApproval.reviewed ? 'true' : 'false',
        customConfigApprovalHash: workflowApproval.approval?.configHash || '',
        customConfigGenerationId: workflowApproval.approval?.generationId || '',
        customConfigApprovalSource: workflowApproval.approval?.source || '',
        customConfigApprovedAt: workflowApproval.approval?.iat ? new Date(workflowApproval.approval.iat).toISOString() : '',
      },
    };
    if (email) sessionParams.customer_email = email;

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store deal room data in memory (webhook picks it up within seconds)
    if (propertyId) {
      pendingDealRooms.set(session.id, {
        property_id: propertyId,
        property_name: propertyName || propertyId,
        email: email || '',
        role,
        address: meta.address || '',
        property_type: meta.type || '',
        property_size: meta.size || '',
        deal_type: meta.dealType || meta.transactionType || '',
        deal_amount: meta.dealAmount || '',
        closing_date: meta.closingDate || '',
        first_name: meta.firstName || '',
        last_name: meta.lastName || '',
        jurisdiction: normalizedJurisdiction,
        transaction_type: meta.transactionType || '',
         transaction_type_label: normalizedTransactionTypeLabel,
        transaction_type_source: meta.transactionTypeSource || '',
        transaction_description: meta.transactionDescription || '',
        transaction_structure: meta.transactionStructure || '',
        transaction_value: meta.transactionValue || '',
        transaction_value_confidence: meta.transactionValueConfidence || '',
          generation_session_id: meta.generationSessionId || '',
          generated_proposal: generatedProposal || null,
         custom_config_reviewed: workflowApproval.reviewed,
          custom_config_approval_hash: workflowApproval.approval?.configHash || '',
          custom_config_generation_id: workflowApproval.approval?.generationId || '',
          custom_config_approval_source: workflowApproval.approval?.source || '',
          custom_config_approved_at: workflowApproval.approval?.iat ? new Date(workflowApproval.approval.iat).toISOString() : '',
         workflow_pack_id: finalPackId,
        owner_write_token: ownerWriteToken,
        created_at: new Date().toISOString(),
      });
    }
    // (workflowPackId is also read back out of `pending` in the webhook handler above)

    res.json({ url: session.url });
  } catch (err) {
    console.error('[checkout/guest]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Demo Checkout — bypasses Stripe for local/internal testing ──────────────
app.post(['/api/checkout/demo', '/api/checkout/trial'], async (req, res) => {
  try {
    const { propertyId, propertyName, plan = 'deal', email, role = 'owner', meta = {} } = req.body;
    const generatedProposal = await getApprovedGenerationProposal(meta.generationSessionId);
    if (meta.generationSessionId && !generatedProposal) {
      return res.status(409).json({ error: 'An approved AI room proposal is required before creating a demo room' });
    }
    const workflowApproval = validateWorkflowApproval(meta);
    if (!workflowApproval.ok) {
      return res.status(400).json({
        error: workflowApproval.error,
        message: workflowApproval.message,
      });
    }
    const origin = req.headers.origin || 'https://kontraplatform.com';
    const fakeSessionId = 'demo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const pid = propertyId || (propertyName || 'demo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // If the owner customized the config, persist it as a custom pack so the
    // workspace loads with the owner's roles/documents/stages.
    const generatedBasePack = meta.workflowPackId || DEAL_TYPE_TO_PACK_INDEX[meta.dealType]
      || await classifyTransactionPack(propertyName, meta.dealType, meta.address);
    let demoPackId = generatedBasePack;
    if (meta.customConfig) {
      const savedId = await saveCustomPackForWorkspace(pid, propertyName, meta.customConfig, meta.transactionType);
      if (savedId) demoPackId = savedId;
      if (!await savedPackMatchesApproval(demoPackId, workflowApproval.approval?.configHash)) {
        return res.status(409).json({
          error: 'Workspace configuration changed before activation',
          message: 'The approved workflow no longer matches the saved configuration. Please review it again.',
        });
      }
    }

    // Seed stages_config from the pack's default stages (or custom config if provided).
    // Icon/desc are frontend-only; backend stores key+label only.
    const demoInitialStages = await getInitialStagesForPack(demoPackId, meta.customConfig?.stages);
    const generatedTransaction = generatedProposal?.transaction || {};
    const generatedType = generatedTransaction.category || meta.transactionType || '';
    const generatedSubtype = generatedTransaction.subtype || meta.transactionStructure || null;

    const normalizedJurisdiction = await jurisdictionForTransaction(
      meta.jurisdiction,
      demoPackId,
      meta.transactionType,
    );
    const dealRoomRecord = {
      stripe_session_id: fakeSessionId,
      plan,
      property_id: pid,
      property_name: propertyName || pid,
      role: role || 'owner',
      customer_email: email || '',
      amount_paid: 0,
      activated_at: new Date().toISOString(),
      status: 'active',
      address: meta.address || '',
      property_type: meta.type || '',
      property_size: meta.size || '',
       deal_type: generatedType,
      deal_amount: meta.dealAmount || '',
      closing_date: dateOnly(meta.closingDate),
      first_name: meta.firstName || '',
      last_name: meta.lastName || '',
      jurisdiction: normalizedJurisdiction,
      workflow_pack_id: demoPackId,
       base_pack: generatedProposal ? generatedBasePack : null,
       transaction_type: generatedProposal ? generatedType : null,
       transaction_subtype: generatedProposal ? generatedSubtype : null,
       transaction_context: generatedProposal?.transaction?.context_facts || null,
       generated_proposal: generatedProposal || null,
      stages_config: demoInitialStages,
      metadata_values: buildCreationMetadata({
        propertyName,
        workflowPackId: demoPackId,
        transactionDescription: meta.transactionDescription,
         transactionType: generatedType || demoPackId,
        transactionTypeLabel: meta.transactionTypeLabel,
        transactionTypeSource: meta.transactionTypeSource,
         transactionStructure: generatedSubtype,
        transactionValue: meta.transactionValue,
        transactionValueConfidence: meta.transactionValueConfidence,
        customConfigReviewed: workflowApproval.reviewed,
         customConfigApprovalHash: workflowApproval.approval?.configHash || '',
         customConfigGenerationId: workflowApproval.approval?.generationId || '',
         customConfigApprovalSource: workflowApproval.approval?.source || '',
         customConfigApprovedAt: workflowApproval.approval?.iat ? new Date(workflowApproval.approval.iat).toISOString() : '',
         generatedProposal,
         generatedBasePack,
         generatedSubtype,
        closingDate: meta.closingDate,
      }),
    };

    let roomCreated = false;
    try {
      const { error: upsertErr } = await supabase.from('deal_rooms').upsert(dealRoomRecord, { onConflict: 'property_id' });
      if (upsertErr) {
        // 42703 = raw Postgres "column does not exist"; PGRST204 = PostgREST
        // schema-cache miss for the column (what Supabase actually returns).
        // Either way workflow_pack_id/stages_config isn't migrated yet — retry without those columns.
        const isMissingColumn = upsertErr.code === '42703' || upsertErr.code === 'PGRST204' ||
          /column .*(workflow_pack_id|stages_config|base_pack|transaction_type|transaction_subtype|transaction_context|generated_proposal).* (does not exist|schema cache)/i.test(upsertErr.message || '');
        if (isMissingColumn) {
          // Keep workflow_pack_id whenever that column is available. A missing
          // stages_config column must not erase the custom ws_* pack link or
          // the room will render as CRE on the next page load.
          const baseRecord = { ...dealRoomRecord };
          // PostgREST reports only the first missing column. Remove the whole
          // optional generated-room group in one retry so older production
          // schemas can still create the room.
          for (const column of ['base_pack', 'transaction_type', 'transaction_subtype', 'transaction_context', 'generated_proposal']) {
            delete baseRecord[column];
          }
          if (/stages_config/i.test(upsertErr.message || '')) delete baseRecord.stages_config;
          if (/workflow_pack_id/i.test(upsertErr.message || '')) delete baseRecord.workflow_pack_id;
          const { error: retryErr } = await supabase.from('deal_rooms').upsert(baseRecord, { onConflict: 'property_id' });
          if (retryErr) throw retryErr;
          roomCreated = true;
          console.log(`[demo] ✅ Deal room created (no workflow_pack_id/stages_config col yet) — ${pid}`);
        } else {
          throw upsertErr;
        }
      } else {
        roomCreated = true;
        console.log(`[demo] ✅ Deal room created — ${pid}`);
      }
      // Set link_token in a separate step (graceful — no-op if column not yet migrated)
      supabase.from('deal_rooms').update({ link_token: crypto.randomBytes(16).toString('hex') })
        .eq('property_id', pid).is('link_token', null).then(() => {}).catch(() => {});
    } catch (dbErr) {
      console.error('[demo] deal_rooms upsert failed:', dbErr.message);
      return res.status(503).json({
        error: 'Workspace could not be created',
        message: 'The workspace database is not ready. No room was created; please try again after the database is updated.',
      });
    }

    if (!roomCreated) {
      return res.status(503).json({
        error: 'Workspace could not be created',
        message: 'The workspace database did not confirm the room. No room was created.',
      });
    }

    const creationMetadata = dealRoomRecord.metadata_values;
    try {
      if (generatedProposal) {
        await syncGeneratedProposalToTransactionRecord(pid, generatedProposal);
      } else {
        await syncMetadataToTransactionRecord(
          pid,
          creationMetadata,
          { workflow_pack_id: demoPackId, deal_type: meta.transactionType || '' },
          'Deal Owner',
          { inferredFieldIds: inferredCreationFieldIds(creationMetadata), skipHistory: true },
        );
      }
    } catch (recordErr) {
      console.warn('[demo] creation transaction record seed skipped:', recordErr.message);
    }

    // Generate owner write token and persist it — included in the redirect URL
    // so CheckoutSuccessPage can store it in localStorage for checklist authz.
    const demoOwnerToken = crypto.randomBytes(32).toString('hex');
    supabase.from('deal_rooms')
      .update({ owner_write_token: demoOwnerToken })
      .eq('property_id', pid)
      .then(() => {}).catch(() => {});

    const isTrial = req.path === '/api/checkout/trial';
    const successUrl = `${origin}/checkout/success?plan=${plan}&property=${pid}${propertyName ? `&name=${encodeURIComponent(propertyName)}` : ''}&session_id=${fakeSessionId}&demo=true&trial=${isTrial ? 'true' : 'false'}&owner_token=${demoOwnerToken}`;
    res.json({ url: successUrl });
  } catch (err) {
    console.error('[checkout/demo]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Session analytics — public event ingestion, IP rate-limited ───────────────
// Lightweight behaviour tracking (phase transitions, tab switches, page views).
// No PII stored — only anonymous session IDs that the browser generates.
const _analyticsIpBuckets = new Map();
function _analyticsRateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  let bucket = _analyticsIpBuckets.get(ip);
  if (!bucket || now - bucket.start > 60000) {
    bucket = { start: now, count: 0 };
  }
  bucket.count++;
  _analyticsIpBuckets.set(ip, bucket);
  if (bucket.count > 300) return res.status(429).end(); // 300 events/IP/min is plenty
  next();
}

app.post('/api/track', _analyticsRateLimit, async (req, res) => {
  // Always return 200 so analytics never break the user experience
  try {
    const { session_id, event_name, workspace_id, properties } = req.body || {};
    if (!session_id || !event_name) return res.json({ ok: false });
    await supabase.from('analytics_events').insert({
      session_id:  String(session_id).slice(0, 64),
      event_name:  String(event_name).slice(0, 80),
      workspace_id: workspace_id ? String(workspace_id).slice(0, 80) : null,
      properties:  properties || {},
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

app.get('/api/admin/analytics', async (req, res) => {
  if (!checkPilotPassword(req, res)) return;
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: events, error } = await supabase
      .from('analytics_events')
      .select('session_id, event_name, workspace_id, properties, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) throw error;

    const phaseCounts = {};
    const tabCounts   = {};
    const workspaceViews = new Set();

    for (const ev of events || []) {
      if (ev.event_name === 'workspace_creation_phase') {
        const p = ev.properties?.phase;
        if (p !== undefined) phaseCounts[p] = (phaseCounts[p] || 0) + 1;
      }
      if (ev.event_name === 'workspace_tab_viewed') {
        const t = ev.properties?.tab;
        if (t) tabCounts[t] = (tabCounts[t] || 0) + 1;
      }
      if (ev.event_name === 'workspace_viewed' && ev.workspace_id) {
        workspaceViews.add(ev.workspace_id);
      }
    }

    res.json({
      period_days: 7,
      total_events: events?.length || 0,
      funnel: [
        { phase: 0, label: 'Describe',   sessions: phaseCounts[0] || 0 },
        { phase: 1, label: 'Preview',    sessions: phaseCounts[1] || 0 },
        { phase: 2, label: 'Your Info',  sessions: phaseCounts[2] || 0 },
        { phase: 3, label: 'Activate',   sessions: phaseCounts[3] || 0 },
      ],
      tab_visits: Object.entries(tabCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tab, count]) => ({ tab, count })),
      unique_workspaces_viewed: workspaceViews.size,
    });
  } catch (err) {
    // Table doesn't exist yet — return empty payload
    if (err.code === '42P01' || /analytics_events.*(does not exist|schema cache)/i.test(err.message || '')) {
      return res.json({ period_days: 7, total_events: 0, funnel: [], tab_visits: [], unique_workspaces_viewed: 0, table_missing: true });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Pilot Admin — password-protected, no Stripe, is_pilot=true ───────────────
// Password is checked against the PILOT_ADMIN_PASSWORD env var on every request.
function checkPilotPassword(req, res) {
  const expected = process.env.PILOT_ADMIN_PASSWORD;
  if (!expected) {
    res.status(503).json({ error: 'PILOT_ADMIN_PASSWORD env var not set on server.' });
    return false;
  }
  const provided = req.headers['x-pilot-password'] || '';
  if (provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

const PILOT_PACK_LABELS = {
  cre_acquisition:      'CRE Acquisition',
  business_acquisition: 'Business Acquisition',
  fundraising:          'Fundraising Round',
};

app.post('/api/admin/create-pilot-workspace', async (req, res) => {
  if (!checkPilotPassword(req, res)) return;
  try {
    const { workspaceName, packId = 'business_acquisition', pilotName, pilotEmail, closingDate } = req.body;
    if (!workspaceName || !pilotName || !pilotEmail) {
      return res.status(400).json({ error: 'workspaceName, pilotName, pilotEmail are required' });
    }

    const origin = req.headers.origin || 'https://kontraplatform.com';
    const pid = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
      + '-' + Date.now().toString(36).slice(-4);

    const resolvedPackId = ['cre_acquisition', 'business_acquisition', 'fundraising'].includes(packId)
      ? packId : 'business_acquisition';

    const initialStages = getPackStageConfig(resolvedPackId).stages.map(({ key, label }) => ({ key, label }));
    const ownerToken    = crypto.randomBytes(32).toString('hex');
    const sessionId     = 'pilot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    const record = {
      stripe_session_id: sessionId,
      plan:              'deal',
      property_id:       pid,
      property_name:     workspaceName,
      role:              'owner',
      customer_email:    pilotEmail,
      amount_paid:       0,
      activated_at:      new Date().toISOString(),
      status:            'active',
      first_name:        pilotName.split(' ')[0] || pilotName,
      last_name:         pilotName.split(' ').slice(1).join(' ') || '',
      closing_date:      closingDate || '',
      workflow_pack_id:  resolvedPackId,
      stages_config:     initialStages,
      owner_write_token: ownerToken,
      is_pilot:          true,
    };

    // Upsert with graceful column fallback (same pattern as demo endpoint)
    try {
      const { error: upsertErr } = await supabase.from('deal_rooms').upsert(record, { onConflict: 'property_id' });
      if (upsertErr) {
        const isMissingCol = upsertErr.code === '42703' || upsertErr.code === 'PGRST204' ||
          /column .*(workflow_pack_id|stages_config|is_pilot).* (does not exist|schema cache)/i.test(upsertErr.message || '');
        if (isMissingCol) {
          const baseRecord = { ...record };
          if (/stages_config/i.test(upsertErr.message || '')) delete baseRecord.stages_config;
          if (/workflow_pack_id/i.test(upsertErr.message || '')) delete baseRecord.workflow_pack_id;
          if (/is_pilot/i.test(upsertErr.message || '')) delete baseRecord.is_pilot;
          const { error: retryErr } = await supabase.from('deal_rooms').upsert(baseRecord, { onConflict: 'property_id' });
          if (retryErr) throw retryErr;
        } else {
          throw upsertErr;
        }
      }
    } catch (dbErr) {
      console.error('[pilot] deal_rooms upsert failed:', dbErr.message);
      throw dbErr;
    }

    // Gracefully set link_token
    supabase.from('deal_rooms').update({ link_token: crypto.randomBytes(16).toString('hex') })
      .eq('property_id', pid).is('link_token', null).then(() => {}).catch(() => {});

    console.log(`[pilot] ✅ Pilot workspace created — ${pid} for ${pilotEmail}`);

    // Access URL goes through PilotAccessPage which stores token and redirects
    const accessUrl = `${origin}/pilot/access?property=${pid}&owner_token=${ownerToken}&name=${encodeURIComponent(workspaceName)}`;

    // Task #157 — auto-send the link to the pilot user at creation time
    let emailSent = false;
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (RESEND_KEY) {
      try {
        const firstName = pilotName.split(' ')[0] || pilotName;
        const packLabel = PILOT_PACK_LABELS[resolvedPackId] || resolvedPackId;
        await sendResendEmail(RESEND_KEY, {
          from: 'Kontra <notifications@kontraplatform.com>',
          to: pilotEmail,
          subject: `Your Kontra workspace is ready: ${workspaceName}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
              <div style="margin-bottom:24px">
                <span style="font-size:28px">🏢</span>
              </div>
              <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 8px">Your Kontra workspace is ready</h1>
              <p style="color:#555;font-size:15px;margin:0 0 6px">Hi ${firstName},</p>
              <p style="color:#555;font-size:14px;margin:0 0 24px">
                <strong>${workspaceName}</strong> (${packLabel}) has been set up for you.
                Click below to access your workspace — no login or payment needed.
              </p>
              <a href="${accessUrl}"
                style="display:inline-block;padding:14px 28px;background:#800020;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
                Open my workspace →
              </a>
              <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:10px;border:1px solid #eee">
                <p style="color:#888;font-size:12px;margin:0 0 4px">What is Kontra?</p>
                <p style="color:#555;font-size:13px;margin:0">
                  Kontra is a deal room platform — all parties upload documents, AI analyzes them instantly,
                  and you see everything in one place.
                </p>
              </div>
              <p style="color:#bbb;font-size:11px;margin-top:24px">
                This link is unique to your workspace session. Do not share it with others.
              </p>
            </div>`,
        });
        emailSent = true;
        console.log(`[pilot] 📧 Welcome email sent to ${pilotEmail}`);
      } catch (emailErr) {
        console.warn('[pilot] Email send failed (non-fatal):', emailErr.message);
      }
    }

    res.json({
      propertyId:    pid,
      workspaceName,
      packLabel:     PILOT_PACK_LABELS[resolvedPackId] || resolvedPackId,
      pilotName,
      pilotEmail,
      accessUrl,
      emailSent,
    });
  } catch (err) {
    console.error('[pilot/create]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Resend the pilot workspace link email (task #157 — resend from AccessLinkCard)
app.post('/api/admin/send-pilot-link', async (req, res) => {
  if (!checkPilotPassword(req, res)) return;
  const { pilotEmail, pilotName, workspaceName, accessUrl, packLabel } = req.body || {};
  if (!pilotEmail || !accessUrl) return res.status(400).json({ error: 'pilotEmail and accessUrl are required' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(503).json({ error: 'RESEND_API_KEY not configured on the server' });

  try {
    const firstName = (pilotName || pilotEmail).split(' ')[0];
    await sendResendEmail(RESEND_KEY, {
      from: 'Kontra <notifications@kontraplatform.com>',
      to: pilotEmail,
      subject: `Your Kontra workspace is ready: ${workspaceName || 'your workspace'}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <div style="margin-bottom:24px"><span style="font-size:28px">🏢</span></div>
          <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 8px">Your Kontra workspace is ready</h1>
          <p style="color:#555;font-size:15px;margin:0 0 6px">Hi ${firstName},</p>
          <p style="color:#555;font-size:14px;margin:0 0 24px">
            <strong>${workspaceName || 'Your workspace'}</strong>${packLabel ? ` (${packLabel})` : ''} has been set up for you.
            Click below to access it — no login or payment needed.
          </p>
          <a href="${accessUrl}"
            style="display:inline-block;padding:14px 28px;background:#800020;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Open my workspace →
          </a>
          <p style="color:#bbb;font-size:11px;margin-top:24px">
            This link is unique to your workspace session. Do not share it with others.
          </p>
        </div>`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[pilot/send-link]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/pilot-workspaces', async (req, res) => {
  if (!checkPilotPassword(req, res)) return;
  try {
    // Fetch all pilot workspaces (is_pilot=true). Fall back to matching the
    // stripe_session_id prefix if the column hasn't been migrated yet.
    let rooms = [];
    const { data: pilotData, error: pilotErr } = await supabase
      .from('deal_rooms')
      .select('property_id, property_name, customer_email, workflow_pack_id, activated_at, created_at, status')
      .eq('is_pilot', true)
      .order('activated_at', { ascending: false });

    if (pilotErr && (pilotErr.code === '42703' || pilotErr.code === 'PGRST204' ||
        /is_pilot.*(does not exist|schema cache)/i.test(pilotErr.message || ''))) {
      // Column not yet created — fall back to stripe_session_id prefix
      const { data: fallback } = await supabase
        .from('deal_rooms')
        .select('property_id, property_name, customer_email, workflow_pack_id, activated_at, created_at, status')
        .like('stripe_session_id', 'pilot_%')
        .order('activated_at', { ascending: false });
      rooms = fallback || [];
    } else if (pilotErr) {
      throw pilotErr;
    } else {
      rooms = pilotData || [];
    }

    // For each workspace, fetch document count and last activity in parallel
    const enriched = await Promise.all(rooms.map(async room => {
      const pid = room.property_id;
      const [docsRes, submissionsRes] = await Promise.all([
        supabase.from('deal-documents').select('id', { count: 'exact', head: true }).eq('property_id', pid),
        supabase.from('party_submissions').select('updated_at').eq('property_id', pid).order('updated_at', { ascending: false }).limit(1),
      ]);
      const docCount    = docsRes.count ?? 0;
      const lastActivity = submissionsRes.data?.[0]?.updated_at || null;
      return {
        ...room,
        pack_label:    PILOT_PACK_LABELS[room.workflow_pack_id] || room.workflow_pack_id,
        doc_count:     docCount,
        last_activity: lastActivity,
      };
    }));

    res.json({ workspaces: enriched });
  } catch (err) {
    console.error('[pilot/list]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Stripe Webhook — PUBLIC, must stay BEFORE requireOrgContext ──────────────
app.post('/api/webhook/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
      if (webhookSecret) {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        const stripe = require('stripe')(stripeKey);
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        event = JSON.parse(req.body.toString());
        console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      }
    } catch (err) {
      console.error('[webhook] Signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const {
        plan,
        propertyId,
        propertyName,
        role,
        workflowPackId: metadataPackId,
        dealType: metadataDealType,
        address: metadataAddress,
        propertyType: metadataPropertyType,
        propertySize: metadataPropertySize,
        dealAmount: metadataDealAmount,
        closingDate: metadataClosingDate,
        firstName: metadataFirstName,
        lastName: metadataLastName,
        jurisdiction: metadataJurisdiction,
        transactionType: metadataTransactionType,
        transactionTypeLabel: metadataTransactionTypeLabel,
        transactionTypeSource: metadataTransactionTypeSource,
        transactionDescription: metadataTransactionDescription,
        transactionStructure: metadataTransactionStructure,
        transactionValue: metadataTransactionValue,
        transactionValueConfidence: metadataTransactionValueConfidence,
        customConfigReviewed: metadataCustomConfigReviewed,
         customConfigApprovalHash: metadataCustomConfigApprovalHash,
         customConfigGenerationId: metadataCustomConfigGenerationId,
         customConfigApprovalSource: metadataCustomConfigApprovalSource,
         customConfigApprovedAt: metadataCustomConfigApprovedAt,
         generationSessionId: metadataGenerationSessionId,
      } = session.metadata || {};
      const customerEmail = session.customer_details?.email || session.customer_email || '';
      const amountPaid = (session.amount_total / 100).toFixed(2);

      console.log(`[webhook] ✅ Payment confirmed — $${amountPaid} | ${plan} | ${propertyId} | ${customerEmail}`);

      // Pull pending deal room data stored at checkout time
      const pending = pendingDealRooms.get(session.id) || {};
      pendingDealRooms.delete(session.id);
      const generationSessionId = metadataGenerationSessionId || pending.generation_session_id || '';
      const generatedProposal = await getApprovedGenerationProposal(generationSessionId);
      if (generationSessionId && !generatedProposal) {
        console.error('[webhook] approved AI proposal not found:', generationSessionId);
        return res.status(409).json({ error: 'Approved AI room proposal not found' });
      }

      const stripePackId = metadataPackId || pending.workflow_pack_id || DEAL_TYPE_TO_PACK_INDEX[metadataDealType || pending.deal_type]
        || await classifyTransactionPack(
          pending.property_name || propertyName,
          metadataDealType || pending.deal_type,
          metadataAddress || pending.address,
        );
      const approvalHash = metadataCustomConfigApprovalHash || pending.custom_config_approval_hash || '';
      if (!await savedPackMatchesApproval(stripePackId, approvalHash)) {
        console.error('[webhook] Approved workflow hash does not match the saved custom pack');
        return res.status(409).json({ error: 'Approved workflow does not match the saved configuration' });
      }
      const normalizedJurisdiction = await jurisdictionForTransaction(
        metadataJurisdiction || pending.jurisdiction || '',
        stripePackId,
        metadataTransactionType || pending.transaction_type || metadataDealType || pending.deal_type || '',
      );
      // Seed stages_config from the pack's default stages so the owner can start editing immediately.
      const stripeInitialStages = await getInitialStagesForPack(stripePackId);
      const generatedTransaction = generatedProposal?.transaction || {};
      const generatedBasePack = metadataPackId || pending.workflow_pack_id || stripePackId;
      const generatedType = generatedTransaction.category
        || metadataTransactionType || pending.transaction_type || metadataDealType || pending.deal_type || '';
      const generatedSubtype = generatedTransaction.subtype
        || metadataTransactionStructure || pending.transaction_structure || null;

      const dealRoomRecord = {
        stripe_session_id: session.id,
        plan,
        property_id: propertyId || pending.property_id || '',
        property_name: propertyName || pending.property_name || '',
        role: role || pending.role || 'owner',
        customer_email: customerEmail || pending.email || '',
        amount_paid: parseFloat(amountPaid),
        activated_at: new Date().toISOString(),
        status: 'active',
        address: metadataAddress || pending.address || '',
        property_type: metadataPropertyType || pending.property_type || '',
        property_size: metadataPropertySize || pending.property_size || '',
         deal_type: generatedType,
        deal_amount: metadataDealAmount || pending.deal_amount || '',
        closing_date: dateOnly(metadataClosingDate || pending.closing_date),
        first_name: metadataFirstName || pending.first_name || '',
        last_name: metadataLastName || pending.last_name || '',
        jurisdiction: normalizedJurisdiction,
        workflow_pack_id: stripePackId,
         base_pack: generatedProposal ? generatedBasePack : null,
         transaction_type: generatedProposal ? generatedType : null,
         transaction_subtype: generatedProposal ? generatedSubtype : null,
         transaction_context: generatedProposal?.transaction?.context_facts || null,
         generated_proposal: generatedProposal || null,
        stages_config: stripeInitialStages,
        metadata_values: buildCreationMetadata({
          propertyName: propertyName || pending.property_name || '',
          transactionDescription: metadataTransactionDescription || pending.transaction_description,
          workflowPackId: stripePackId,
           transactionType: generatedType || stripePackId,
          transactionTypeLabel: metadataTransactionTypeLabel || pending.transaction_type_label,
          transactionTypeSource: metadataTransactionTypeSource || pending.transaction_type_source,
           transactionStructure: generatedSubtype,
          transactionValue: metadataTransactionValue || pending.transaction_value,
          transactionValueConfidence: metadataTransactionValueConfidence || pending.transaction_value_confidence,
          customConfigReviewed: metadataCustomConfigReviewed === 'true' || pending.custom_config_reviewed === true,
           customConfigApprovalHash: metadataCustomConfigApprovalHash || pending.custom_config_approval_hash,
           customConfigGenerationId: metadataCustomConfigGenerationId || pending.custom_config_generation_id,
           customConfigApprovalSource: metadataCustomConfigApprovalSource || pending.custom_config_approval_source,
           customConfigApprovedAt: metadataCustomConfigApprovedAt || pending.custom_config_approved_at,
           generatedProposal,
           generatedBasePack,
           generatedSubtype,
          closingDate: metadataClosingDate || pending.closing_date,
        }),
      };

      try {
        const { error: wErr } = await supabase.from('deal_rooms').upsert(dealRoomRecord, { onConflict: 'property_id' });
        if (wErr) {
          // 42703 = raw Postgres "column does not exist"; PGRST204 = PostgREST
          // schema-cache miss for the column (what Supabase actually returns).
          // Either way workflow_pack_id/stages_config isn't migrated yet — retry without those columns.
          const isMissingColumn = wErr.code === '42703' || wErr.code === 'PGRST204' ||
            /column .*(workflow_pack_id|stages_config|base_pack|transaction_type|transaction_subtype|transaction_context|generated_proposal).* (does not exist|schema cache)/i.test(wErr.message || '');
          if (isMissingColumn) {
            const baseRecord = { ...dealRoomRecord };
            for (const column of ['base_pack', 'transaction_type', 'transaction_subtype', 'transaction_context', 'generated_proposal']) {
              delete baseRecord[column];
            }
            if (/stages_config/i.test(wErr.message || '')) delete baseRecord.stages_config;
            if (/workflow_pack_id/i.test(wErr.message || '')) delete baseRecord.workflow_pack_id;
            const { error: retryErr } = await supabase.from('deal_rooms').upsert(baseRecord, { onConflict: 'property_id' });
            if (retryErr) throw retryErr;
            console.log(`[webhook] ✅ Deal room saved (no workflow_pack_id/stages_config col yet) — ${dealRoomRecord.property_id}`);
          } else {
            throw wErr;
          }
        } else {
          console.log(`[webhook] ✅ Deal room saved — ${dealRoomRecord.property_id}`);
        }
        // Set link_token separately (graceful — skipped if column not yet migrated)
        supabase.from('deal_rooms').update({ link_token: crypto.randomBytes(16).toString('hex') })
          .eq('property_id', dealRoomRecord.property_id).is('link_token', null).then(() => {}).catch(() => {});
        // Persist owner_write_token from the pending record (generated at Stripe session creation)
        if (pending.owner_write_token) {
          supabase.from('deal_rooms')
            .update({ owner_write_token: pending.owner_write_token })
            .eq('property_id', dealRoomRecord.property_id)
            .then(() => {}).catch(() => {});
        }
      } catch (dbErr) {
        console.warn('[webhook] deal_rooms upsert skipped:', dbErr.message);
      }

      try {
        if (generatedProposal) {
          await syncGeneratedProposalToTransactionRecord(dealRoomRecord.property_id, generatedProposal);
        } else {
          await syncMetadataToTransactionRecord(
            dealRoomRecord.property_id,
            dealRoomRecord.metadata_values,
            { workflow_pack_id: stripePackId, deal_type: dealRoomRecord.deal_type },
            'Deal Owner',
            { inferredFieldIds: inferredCreationFieldIds(dealRoomRecord.metadata_values), skipHistory: true },
          );
        }
      } catch (recordErr) {
        console.warn('[webhook] creation transaction record seed skipped:', recordErr.message);
      }

      // Also log to activations table (legacy)
      try {
        await supabase.from('deal_room_activations').insert({
          stripe_session_id: session.id, plan, property_id: propertyId,
          property_name: propertyName, role, customer_email: customerEmail,
          amount_paid: parseFloat(amountPaid), activated_at: new Date().toISOString(),
        });
      } catch (_) {}
    }

    res.json({ received: true });
  }
);

// ── Demo deal room — always served without Supabase ──────────────────────────
// All /api/public/deal-room/kontra-demo/* routes are intercepted here before
// the real handlers so the demo always works regardless of DB state.
;(() => {
  const { PROPERTY, TASKS, BRIEFING, ANALYSES, DEMO_QA_CONTEXT } = require('./lib/demoData');
  const { getDemoFixture } = require('./lib/demoRoomFixtures');
  const openai = new OpenAI();
  const DEMO_ID = 'kontra-demo';
  const fixture = getDemoFixture('cre_acquisition', PROPERTY);

  app.get(`/api/public/deal-room/${DEMO_ID}`, (_req, res) => res.json(fixture.property));
  app.get(`/api/public/deal-room/${DEMO_ID}/checklist`, (_req, res) => res.json({ items: fixture.checklist }));
  app.get(`/api/public/deal-room/${DEMO_ID}/transaction-record`, (_req, res) => res.json(fixture.record));
  app.get(`/api/public/deal-room/${DEMO_ID}/readiness`, (_req, res) => res.json(fixture.readiness));
  app.get(`/api/public/deal-room/${DEMO_ID}/stages`, (_req, res) => res.json({
    stages: fixture.stages, currentStage: fixture.coordination.stage, packId: fixture.packId,
  }));
  app.get(`/api/public/deal-room/${DEMO_ID}/coordination`, (_req, res) => res.json(fixture.coordination));
  app.get(`/api/public/deal-room/${DEMO_ID}/events`, (_req, res) => res.json({ events: fixture.events }));
  app.get(`/api/public/deal-room/${DEMO_ID}/invites`, (_req, res) => res.json({ invites: fixture.coordination.participantInvites }));
  app.get(`/api/public/deal-room/${DEMO_ID}/comments`, (_req, res) => res.json({ comments: [] }));
  app.put(`/api/public/deal-room/${DEMO_ID}/checklist`, (_req, res) => res.json({ ok: true, demo: true, items: fixture.checklist }));
  app.post(`/api/public/deal-room/${DEMO_ID}/track-document`, (_req, res) => res.json({ ok: true, demo: true }));
  app.post(`/api/public/deal-room/${DEMO_ID}/request-document`, (_req, res) => res.json({ ok: true, demo: true, message: 'Demo mode — no request sent.' }));
  app.post(`/api/public/deal-room/${DEMO_ID}/submit`, (_req, res) => res.json({ ok: true, demo: true }));
  app.post(`/api/public/deal-room/${DEMO_ID}/advance`, (_req, res) => res.json({ ok: true, demo: true, message: 'Demo mode — stage did not change.' }));
  app.post(`/api/public/deal-room/${DEMO_ID}/invite`, (_req, res) => res.json({ ok: true, demo: true, message: 'Demo mode — invitation not sent.' }));
  app.post(`/api/public/deal-room/${DEMO_ID}/comments`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${DEMO_ID}/metadata`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${DEMO_ID}/metadata-merge`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${DEMO_ID}/stages`, (_req, res) => res.json({ ok: true, demo: true, stages: fixture.stages }));
  app.post(`/api/public/deal-room/${DEMO_ID}/transaction-record/fields/:fieldId/verify`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${DEMO_ID}/transaction-record/fields/:fieldId`, (_req, res) => res.json({ ok: true, demo: true }));

  app.get(`/api/public/deal-room/${DEMO_ID}/tasks`, (_req, res) =>
    res.json({ tasks: TASKS }));

  app.post(`/api/public/deal-room/${DEMO_ID}/tasks/refresh`, (_req, res) =>
    res.json({ tasks: TASKS }));

  app.get(`/api/public/deal-room/${DEMO_ID}/brain/briefing`, (_req, res) =>
    res.json(BRIEFING));

  app.post(`/api/public/deal-room/${DEMO_ID}/brain/ask`, async (req, res) => {
    const { question } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question required' });
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: buildDemoQaSystemPrompt(DEMO_QA_CONTEXT, fixture, question) },
          { role: 'user', content: question },
        ],
        max_tokens: DEMO_AI_MAX_TOKENS,
        temperature: 0.4,
      });
      res.json({
        answer: formatDemoTokenizationAnswer(completion.choices[0].message.content.trim(), fixture, question),
      });
    } catch (e) {
      const fallback = isTokenizationQuestion(question)
        ? 'AI explanation is temporarily unavailable; use the recorded facts and preparation gaps above.'
        : 'The inspection report is the critical item right now — everything else is secondary until Marcus Webb submits.';
      res.json({ answer: formatDemoTokenizationAnswer(fallback, fixture, question) });
    }
  });

  app.post(`/api/public/deal-room/${DEMO_ID}/tasks/demo-task-inspector/approve`, (_req, res) =>
    res.json({ ok: true, demo: true, message: 'Demo mode — email not sent. In a live deal room this would deliver the reminder to Marcus Webb.' }));

  app.post(`/api/public/deal-room/${DEMO_ID}/tasks/demo-task-insurer/approve`, (_req, res) =>
    res.json({ ok: true, demo: true, message: 'Demo mode — email not sent. In a live deal room this would deliver the reminder to Priya Nair.' }));

  app.post(`/api/tasks/:taskId/approve`, (req, res, next) => {
    if (String(req.params.taskId).startsWith('demo-')) {
      return res.json({ ok: true, demo: true, message: 'Demo mode — no action taken.' });
    }
    next();
  });

  app.post(`/api/tasks/:taskId/dismiss`, (req, res, next) => {
    if (String(req.params.taskId).startsWith('demo-')) {
      return res.json({ ok: true, demo: true });
    }
    next();
  });

  app.get(`/api/public/deal-room/${DEMO_ID}/coordination`, (_req, res) =>
    res.json({ stage: 'due-diligence', stageLabel: 'Due Diligence', parties: [
      { role: 'lender',    label: 'Lender',           status: 'submitted', name: 'First Republic Capital' },
      { role: 'inspector', label: 'Inspector',         status: 'invited',   name: 'Marcus Webb' },
      { role: 'insurer',   label: 'Insurance Broker',  status: 'invited',   name: 'Priya Nair' },
    ]}));

  app.get(`/api/public/deal-room/${DEMO_ID}/analyses`, (_req, res) => res.json({ analyses: ANALYSES }));
  app.get(`/api/public/deal-room/${DEMO_ID}/events`, (_req, res) => res.json({ events: [] }));
  app.get(`/api/public/deal-room/${DEMO_ID}/comments`, (_req, res) => res.json({ comments: [] }));
})();

// ── Business Acquisition demo — kontra-demo-biz ───────────────────────────────
;(() => {
  const { PROPERTY, TASKS, BRIEFING, ANALYSES, DEMO_QA_CONTEXT } = require('./lib/demoDataBiz');
  const { getDemoFixture } = require('./lib/demoRoomFixtures');
  const openai = new OpenAI();
  const BIZ_ID = 'kontra-demo-biz';
  const fixture = getDemoFixture('business_acquisition', PROPERTY);

  app.get(`/api/public/deal-room/${BIZ_ID}`, (_req, res) => res.json(fixture.property));
  app.get(`/api/public/deal-room/${BIZ_ID}/checklist`, (_req, res) => res.json({ items: fixture.checklist }));
  app.get(`/api/public/deal-room/${BIZ_ID}/transaction-record`, (_req, res) => res.json(fixture.record));
  app.get(`/api/public/deal-room/${BIZ_ID}/readiness`, (_req, res) => res.json(fixture.readiness));
  app.get(`/api/public/deal-room/${BIZ_ID}/stages`, (_req, res) => res.json({
    stages: fixture.stages, currentStage: fixture.coordination.stage, packId: fixture.packId,
  }));
  app.get(`/api/public/deal-room/${BIZ_ID}/coordination`, (_req, res) => res.json(fixture.coordination));
  app.get(`/api/public/deal-room/${BIZ_ID}/events`, (_req, res) => res.json({ events: fixture.events }));
  app.get(`/api/public/deal-room/${BIZ_ID}/invites`, (_req, res) => res.json({ invites: fixture.coordination.participantInvites }));
  app.get(`/api/public/deal-room/${BIZ_ID}/comments`, (_req, res) => res.json({ comments: [] }));
  app.put(`/api/public/deal-room/${BIZ_ID}/checklist`, (_req, res) => res.json({ ok: true, demo: true, items: fixture.checklist }));
  app.post(`/api/public/deal-room/${BIZ_ID}/track-document`, (_req, res) => res.json({ ok: true, demo: true }));
  app.post(`/api/public/deal-room/${BIZ_ID}/request-document`, (_req, res) => res.json({ ok: true, demo: true, message: 'Demo mode — no request sent.' }));
  app.post(`/api/public/deal-room/${BIZ_ID}/submit`, (_req, res) => res.json({ ok: true, demo: true }));
  app.post(`/api/public/deal-room/${BIZ_ID}/advance`, (_req, res) => res.json({ ok: true, demo: true, message: 'Demo mode — stage did not change.' }));
  app.post(`/api/public/deal-room/${BIZ_ID}/invite`, (_req, res) => res.json({ ok: true, demo: true, message: 'Demo mode — invitation not sent.' }));
  app.post(`/api/public/deal-room/${BIZ_ID}/comments`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${BIZ_ID}/metadata`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${BIZ_ID}/metadata-merge`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${BIZ_ID}/stages`, (_req, res) => res.json({ ok: true, demo: true, stages: fixture.stages }));
  app.post(`/api/public/deal-room/${BIZ_ID}/transaction-record/fields/:fieldId/verify`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${BIZ_ID}/transaction-record/fields/:fieldId`, (_req, res) => res.json({ ok: true, demo: true }));

  app.get(`/api/public/deal-room/${BIZ_ID}/tasks`, (_req, res) => res.json({ tasks: TASKS }));
  app.post(`/api/public/deal-room/${BIZ_ID}/tasks/refresh`, (_req, res) => res.json({ tasks: TASKS }));
  app.get(`/api/public/deal-room/${BIZ_ID}/brain/briefing`, (_req, res) => res.json(BRIEFING));

  app.post(`/api/public/deal-room/${BIZ_ID}/brain/ask`, async (req, res) => {
    const { question } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question required' });
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: buildDemoQaSystemPrompt(DEMO_QA_CONTEXT, fixture, question) },
          { role: 'user', content: question },
        ],
        max_tokens: DEMO_AI_MAX_TOKENS,
        temperature: 0.4,
      });
      res.json({
        answer: formatDemoTokenizationAnswer(completion.choices[0].message.content.trim(), fixture, question),
      });
    } catch (e) {
      const fallback = isTokenizationQuestion(question)
        ? 'AI explanation is temporarily unavailable; use the recorded facts and preparation gaps above.'
        : 'The QoE report is the critical item — the LOI cannot be finalized until Davidson Advisory delivers it.';
      res.json({ answer: formatDemoTokenizationAnswer(fallback, fixture, question) });
    }
  });

  app.post(`/api/public/deal-room/${BIZ_ID}/tasks/biz-task-cpa/approve`, (_req, res) =>
    res.json({ ok: true, demo: true, message: 'Demo mode — email not sent. In a live deal room this would deliver the follow-up to Davidson Advisory.' }));
  app.post(`/api/public/deal-room/${BIZ_ID}/tasks/biz-task-seller/approve`, (_req, res) =>
    res.json({ ok: true, demo: true, message: 'Demo mode — email not sent. In a live deal room this would deliver the follow-up to Tom Briggs.' }));

  app.get(`/api/public/deal-room/${BIZ_ID}/coordination`, (_req, res) =>
    res.json({ stage: 'due-diligence', stageLabel: 'Due Diligence', parties: [
      { role: 'cpa',      label: 'CPA / Accountant', status: 'invited',   name: 'Davidson Advisory' },
      { role: 'attorney', label: 'Attorney',          status: 'submitted', name: 'Vance & Partners' },
      { role: 'broker',   label: 'M&A Broker',        status: 'submitted', name: 'Meridian Advisors' },
    ]}));

  app.get(`/api/public/deal-room/${BIZ_ID}/analyses`, (_req, res) => res.json({ analyses: ANALYSES }));
  app.get(`/api/public/deal-room/${BIZ_ID}/events`, (_req, res) => res.json({ events: [] }));
  app.get(`/api/public/deal-room/${BIZ_ID}/comments`, (_req, res) => res.json({ comments: [] }));
})();

// ── Fundraising demo — kontra-demo-fundraising ────────────────────────────────
;(() => {
  const { PROPERTY, TASKS, BRIEFING, ANALYSES, DEMO_QA_CONTEXT } = require('./lib/demoDataFundraising');
  const { getDemoFixture } = require('./lib/demoRoomFixtures');
  const openai = new OpenAI();
  const FUND_ID = 'kontra-demo-fundraising';
  const fixture = getDemoFixture('fundraising', PROPERTY);

  app.get(`/api/public/deal-room/${FUND_ID}`, (_req, res) => res.json(fixture.property));
  app.get(`/api/public/deal-room/${FUND_ID}/checklist`, (_req, res) => res.json({ items: fixture.checklist }));
  app.get(`/api/public/deal-room/${FUND_ID}/transaction-record`, (_req, res) => res.json(fixture.record));
  app.get(`/api/public/deal-room/${FUND_ID}/readiness`, (_req, res) => res.json(fixture.readiness));
  app.get(`/api/public/deal-room/${FUND_ID}/stages`, (_req, res) => res.json({
    stages: fixture.stages, currentStage: fixture.coordination.stage, packId: fixture.packId,
  }));
  app.get(`/api/public/deal-room/${FUND_ID}/coordination`, (_req, res) => res.json(fixture.coordination));
  app.get(`/api/public/deal-room/${FUND_ID}/events`, (_req, res) => res.json({ events: fixture.events }));
  app.get(`/api/public/deal-room/${FUND_ID}/invites`, (_req, res) => res.json({ invites: fixture.coordination.participantInvites }));
  app.get(`/api/public/deal-room/${FUND_ID}/comments`, (_req, res) => res.json({ comments: [] }));
  app.put(`/api/public/deal-room/${FUND_ID}/checklist`, (_req, res) => res.json({ ok: true, demo: true, items: fixture.checklist }));
  app.post(`/api/public/deal-room/${FUND_ID}/track-document`, (_req, res) => res.json({ ok: true, demo: true }));
  app.post(`/api/public/deal-room/${FUND_ID}/request-document`, (_req, res) => res.json({ ok: true, demo: true, message: 'Demo mode — no request sent.' }));
  app.post(`/api/public/deal-room/${FUND_ID}/submit`, (_req, res) => res.json({ ok: true, demo: true }));
  app.post(`/api/public/deal-room/${FUND_ID}/advance`, (_req, res) => res.json({ ok: true, demo: true, message: 'Demo mode — stage did not change.' }));
  app.post(`/api/public/deal-room/${FUND_ID}/invite`, (_req, res) => res.json({ ok: true, demo: true, message: 'Demo mode — invitation not sent.' }));
  app.post(`/api/public/deal-room/${FUND_ID}/comments`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${FUND_ID}/metadata`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${FUND_ID}/metadata-merge`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${FUND_ID}/stages`, (_req, res) => res.json({ ok: true, demo: true, stages: fixture.stages }));
  app.post(`/api/public/deal-room/${FUND_ID}/transaction-record/fields/:fieldId/verify`, (_req, res) => res.json({ ok: true, demo: true }));
  app.patch(`/api/public/deal-room/${FUND_ID}/transaction-record/fields/:fieldId`, (_req, res) => res.json({ ok: true, demo: true }));

  app.get(`/api/public/deal-room/${FUND_ID}/tasks`, (_req, res) => res.json({ tasks: TASKS }));
  app.post(`/api/public/deal-room/${FUND_ID}/tasks/refresh`, (_req, res) => res.json({ tasks: TASKS }));
  app.get(`/api/public/deal-room/${FUND_ID}/brain/briefing`, (_req, res) => res.json(BRIEFING));

  app.post(`/api/public/deal-room/${FUND_ID}/brain/ask`, async (req, res) => {
    const { question } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question required' });
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: buildDemoQaSystemPrompt(DEMO_QA_CONTEXT, fixture, question) },
          { role: 'user', content: question },
        ],
        max_tokens: DEMO_AI_MAX_TOKENS,
        temperature: 0.4,
      });
      res.json({
        answer: formatDemoTokenizationAnswer(completion.choices[0].message.content.trim(), fixture, question),
      });
    } catch (e) {
      const fallback = isTokenizationQuestion(question)
        ? 'AI explanation is temporarily unavailable; use the recorded facts and preparation gaps above.'
        : 'Two subscription agreements from committed LPs are outstanding — Clearwater\'s $5M agreement is the most urgent before the August 1 close.';
      res.json({ answer: formatDemoTokenizationAnswer(fallback, fixture, question) });
    }
  });

  app.post(`/api/public/deal-room/${FUND_ID}/tasks/fund-task-lp1/approve`, (_req, res) =>
    res.json({ ok: true, demo: true, message: 'Demo mode — email not sent. In a live deal room this would send the follow-up to Clearwater Capital.' }));
  app.post(`/api/public/deal-room/${FUND_ID}/tasks/fund-task-lp2/approve`, (_req, res) =>
    res.json({ ok: true, demo: true, message: 'Demo mode — email not sent. In a live deal room this would send the follow-up to Vantage Family Office.' }));

  app.get(`/api/public/deal-room/${FUND_ID}/coordination`, (_req, res) =>
    res.json({ stage: 'soft-circle', stageLabel: 'Soft Circle', parties: [
      { role: 'investor_relations', label: 'LP — Clearwater Capital',     status: 'invited',   name: 'Jessica Wu' },
      { role: 'investor_relations', label: 'LP — Vantage Family Office',  status: 'invited',   name: 'Mark Chen' },
      { role: 'attorney',           label: 'Legal Counsel',               status: 'submitted', name: 'Thornton LLP' },
      { role: 'advisor',            label: 'Financial Advisor',           status: 'submitted', name: 'Atlas Partners' },
    ]}));

  app.get(`/api/public/deal-room/${FUND_ID}/analyses`, (_req, res) => res.json({ analyses: ANALYSES }));
  app.get(`/api/public/deal-room/${FUND_ID}/events`, (_req, res) => res.json({ events: [] }));
  app.get(`/api/public/deal-room/${FUND_ID}/comments`, (_req, res) => res.json({ comments: [] }));
})();

// ── Public deal room lookup — no auth required ────────────────────────────────
app.get('/api/public/deal-room/:propertyId', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    // A stale participant session may coexist with a valid owner token after
    // the owner returns through My Deal Rooms. getRoomAccessContext gives the
    // owner precedence, so do not reject that resolved owner context here.
    if (req.headers['x-kontra-session'] && !['participant', 'owner'].includes(access.mode)) {
      return accessDenied(res, 'This invitation session is invalid or has expired');
    }
    const { data, error } = await supabase
      .from('deal_rooms')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .single();
    if (error || !data) return res.status(404).json({ error: 'Deal room not found' });
    // Strip sensitive fields before returning — owner_write_token is a write
    // credential delivered only through the checkout redirect; never expose it
    // in a public GET response or any participant could forge checklist edits.
    const { customer_email, first_name, last_name, stripe_session_id, owner_write_token: _owt, ...safe } = data;
    if (safe.workflow_pack_id?.startsWith('ws_')) {
      const { data: customPack } = await supabase
        .from('custom_workflow_packs')
        .select('config')
        .eq('id', safe.workflow_pack_id)
        .maybeSingle();
      if (customPack?.config) {
        safe.workflow_pack_config = normalizeCustomPackConfig(
          customPack.config,
          safe.property_name || 'Custom Workspace',
        );
      }
    }
    // Securities jurisdictions only apply to tokenization rooms. Older rooms
    // could contain a stale Regulation D value from a generic creation default;
    // do not expose that stale value as if it governs a normal acquisition.
    safe.jurisdiction = await jurisdictionForTransaction(
      safe.jurisdiction,
      safe.workflow_pack_id,
      safe.deal_type,
      safe.metadata_values,
    ) || null;
    if (access.mode === 'participant') {
      safe.access = {
        mode: access.mode,
        role: access.role,
        permissions: access.permissions,
      };
    }
    if (access.mode === 'owner') {
      // The room owner always has coordinator authority regardless of the role
      // they selected at checkout. Override the stored role so the browser
      // receives the correct identity for isCoordinator and tab-visibility
      // checks. safe.access.mode lets the UI apply belt-and-suspenders guards.
      safe.role = 'deal_coordinator';
      safe.access = { mode: 'owner' };
    }
    res.json(safe);
  } catch (err) {
    console.error('[deal-room-public]', err.message);
    res.status(404).json({ error: 'Deal room not found' });
  }
});

// ── My deal rooms — OTP auth + dashboard ────────────────────────────────────
// In-memory OTP store: email → { code, expiresAt }
const otpStore = new Map();

function buildOwnerTokenMap(rooms) {
  return (rooms || []).reduce((tokens, room) => {
    if (room?.property_id && room?.owner_write_token) {
      tokens[room.property_id] = room.owner_write_token;
    }
    return tokens;
  }, {});
}

app.post('/api/public/my-rooms/request-otp', async (req, res) => {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' });
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
  try {
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kontra <notifications@kontraplatform.com>',
        to: email,
        subject: `Your Kontra access code: ${code}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
          <div style="margin-bottom:28px">
            <span style="display:inline-block;background:#800020;color:white;font-weight:800;font-size:15px;padding:6px 14px;border-radius:8px">Kontra</span>
          </div>
          <h2 style="color:#111;font-size:22px;font-weight:800;margin:0 0 8px">Your access code</h2>
          <p style="color:#555;font-size:14px;margin:0 0 24px">Enter this code to view your deal rooms. It expires in 10 minutes.</p>
          <div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:16px;padding:28px;text-align:center;margin:0 0 24px">
            <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#111;font-family:monospace">${code}</div>
          </div>
          <p style="color:#999;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
        </div>`,
      }),
    });
    const sendData = await sendRes.json();
    if (!sendRes.ok) {
      console.error('[request-otp] Resend error:', JSON.stringify(sendData));
      return res.status(500).json({ error: `Email delivery failed: ${sendData?.message || sendData?.name || 'unknown error'}` });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[request-otp]', err.message);
    res.status(500).json({ error: 'Failed to send code' });
  }
});

app.post('/api/public/my-rooms/verify-otp', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  const code = (req.body?.code || '').trim();
  if (!email || !code) return res.status(400).json({ error: 'email and code required' });
  const stored = otpStore.get(email);
  if (!stored) return res.status(401).json({ error: 'No code found. Request a new one.' });
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email);
    return res.status(401).json({ error: 'Code expired. Request a new one.' });
  }
  if (stored.code !== code) return res.status(401).json({ error: 'Incorrect code.' });
  otpStore.delete(email);
  try {
    const { data: rooms, error } = await supabase
      .from('deal_rooms')
      .select('property_id, property_name, property_type, deal_amount, deal_type, address, status, deal_stage, workflow_pack_id, created_at, activated_at, owner_write_token')
      .ilike('customer_email', email)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const ownerTokens = buildOwnerTokenMap(rooms);
    if (!rooms || rooms.length === 0) return res.json({ rooms: [], email, owner_tokens: {} });
    const ids = rooms.map(r => r.property_id);
    const [subsRes, invitesRes, analysesRes] = await Promise.all([
      supabase
        .from('party_submissions')
        .select('property_id, role, name, doc_count, submitted_at, notes')
        .in('property_id', ids),
      supabase
        .from('deal_room_invites')
        .select('property_id, role_key, status, last_used_at, expires_at, revoked_at')
        .in('property_id', ids),
      supabase
        .from('deal_analyses')
        .select('property_id, section, analysis')
        .in('property_id', ids),
    ]);
    if (subsRes.error) throw subsRes.error;
    if (invitesRes.error) throw invitesRes.error;
    if (analysesRes.error) throw analysesRes.error;
    const subs = subsRes.data || [];
    const invites = invitesRes.data || [];
    const analyses = analysesRes.data || [];
    const subMap = {};
    subs.forEach(s => {
      if (!subMap[s.property_id]) subMap[s.property_id] = [];
      subMap[s.property_id].push(s);
    });
    const inviteMap = {};
    invites.forEach(invite => {
      if (!inviteMap[invite.property_id]) inviteMap[invite.property_id] = [];
      inviteMap[invite.property_id].push(invite);
    });
    const analysesMap = {};
    analyses.forEach(analysis => {
      if (!analysesMap[analysis.property_id]) analysesMap[analysis.property_id] = [];
      analysesMap[analysis.property_id].push(analysis);
    });
    const enriched = rooms.map(({ owner_write_token: _ownerWriteToken, ...room }) => ({
      ...room,
      owner_name: room.owner_name || null,
      parties: buildRoomParticipants({
        invites: inviteMap[room.property_id] || [],
        submissions: subMap[room.property_id] || [],
      }),
      document_count: (analysesMap[room.property_id] || [])
        .filter(analysis => analysis.section !== 'cross_document_verification')
        .length,
      active_participant_count: buildRoomParticipants({
        invites: inviteMap[room.property_id] || [],
        submissions: subMap[room.property_id] || [],
      }).length,
    }));
    // The email OTP just verified ownership of every returned room. Rehydrate
    // the same owner credential used by direct room links so a stale
    // participant session cannot win when the owner opens a room from this
    // dashboard. Keep the credential out of each persisted room row.
    res.json({ rooms: enriched, email, owner_tokens: ownerTokens });
  } catch (err) {
    console.error('[verify-otp]', err.message);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

// ── Delete deal room — owner only, verified by email match ───────────────────
app.delete('/api/public/my-rooms/:propertyId', async (req, res) => {
  const { propertyId } = req.params;
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email || !propertyId) return res.status(400).json({ error: 'email and propertyId required' });
  try {
    const { data: room, error: findErr } = await supabase
      .from('deal_rooms').select('id, customer_email, property_name').eq('property_id', propertyId).maybeSingle();
    if (findErr || !room) return res.status(404).json({ error: 'Room not found' });
    if (room.customer_email.toLowerCase() !== email)
      return res.status(403).json({ error: 'Not authorized to delete this room' });
    const { error: delErr } = await supabase.from('deal_rooms').delete().eq('property_id', propertyId);
    if (delErr) throw delErr;
    res.json({ ok: true, deleted: room.property_name });
  } catch (err) {
    console.error('[delete-room]', err.message);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ── Stripe billing portal — lets owner manage/cancel subscription ────────────
app.post('/api/public/billing-portal', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.startsWith('placeholder')) {
    return res.status(500).json({ error: 'Billing not configured' });
  }
  try {
    const stripe = require('stripe')(stripeKey);
    // Find the Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 5 });
    if (!customers.data.length) {
      return res.status(404).json({ error: 'No billing account found for this email. Make sure you are using the same email from your Stripe receipt.' });
    }
    // Use the most recent customer (last created)
    const customer = customers.data[0];
    const returnUrl = process.env.SITE_URL
      ? `${process.env.SITE_URL}/my-deal-rooms`
      : `${FRONTEND_URL}/my-deal-rooms`;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl,
    });
    console.log(`[billing-portal] created for customer ${customer.id} (${email})`);
    res.json({ url: portalSession.url });
  } catch (err) {
    console.error('[billing-portal]', err.message);
    // Billing portal not configured in Stripe dashboard
    if (err.message?.includes('configuration') || err.code === 'portal_configuration_not_found') {
      return res.status(503).json({ error: 'billing_portal_not_configured' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Owner analytics dashboard ──────────────────────────────────────────────────
app.get('/api/public/my-rooms/analytics', async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const { data: rooms } = await supabase
      .from('deal_rooms')
      .select('property_id, deal_stage, status, activated_at, workflow_pack_id, deal_type, property_type, checklist_items')
      .ilike('customer_email', email);

    if (!rooms?.length) {
      return res.json({
        totalDeals: 0,
        waitingOnBorrower: 0,
        waitingOnInspector: 0,
        avgDaysActive: null,
        documentsUploaded: 0,
        aiReviewsCompleted: 0,
        activeParticipants: 0,
      });
    }

    const propertyIds = rooms.map(r => r.property_id);

    const [analysesRes, invitesRes, submissionsRes] = await Promise.all([
      supabase.from('deal_analyses').select('property_id, section, analysis').in('property_id', propertyIds),
      supabase.from('deal_room_invites')
        .select('property_id, role_key, status, last_used_at, expires_at, revoked_at')
        .in('property_id', propertyIds),
      supabase.from('party_submissions')
        .select('property_id, role, name, doc_count, submitted_at, notes')
        .in('property_id', propertyIds),
    ]);
    if (analysesRes.error) throw analysesRes.error;
    if (invitesRes.error) throw invitesRes.error;
    if (submissionsRes.error) throw submissionsRes.error;
    const analyses = analysesRes.data || [];

    const activeRooms = rooms.filter(r => r.status === 'active');
    const invitesByProperty = {};
    (invitesRes.data || []).forEach(invite => {
      if (!invitesByProperty[invite.property_id]) invitesByProperty[invite.property_id] = [];
      invitesByProperty[invite.property_id].push(invite);
    });
    const submissionsByProperty = {};
    (submissionsRes.data || []).forEach(submission => {
      if (!submissionsByProperty[submission.property_id]) submissionsByProperty[submission.property_id] = [];
      submissionsByProperty[submission.property_id].push(submission);
    });
    const analysesByProperty = {};
    analyses.forEach(analysis => {
      if (!analysesByProperty[analysis.property_id]) analysesByProperty[analysis.property_id] = [];
      analysesByProperty[analysis.property_id].push(analysis);
    });

    // Prefer each room's persisted checklist. Older rooms can have an empty
    // checklist_items value, so resolve the pack schema in memory instead of
    // seeding or mutating the room during a dashboard read.
    const roomStates = await Promise.all(rooms.map(async room => {
      const packId = room.workflow_pack_id
        || DEAL_TYPE_TO_PACK_INDEX[room.deal_type]
        || DEFAULT_PACK_ID;
      const documents = Array.isArray(room.checklist_items) && room.checklist_items.length > 0
        ? room.checklist_items
        : (await getCanonicalChecklist(packId, room.property_type) || []);
      return computeRoomDashboardState({
        room,
        analyses: analysesByProperty[room.property_id] || [],
        invites: invitesByProperty[room.property_id] || [],
        submissions: submissionsByProperty[room.property_id] || [],
        documents,
      });
    }));
    const activeRoomIds = new Set(activeRooms.map(room => room.property_id));
    const activeRoomStates = roomStates.filter(state => activeRoomIds.has(state.property_id));

    // Average days active (activated → today)
    const activatedRooms = activeRooms.filter(r => r.activated_at);
    const avgDaysActive = activatedRooms.length > 0
      ? Math.round(activatedRooms.reduce((sum, r) =>
          sum + (Date.now() - new Date(r.activated_at).getTime()) / 86400000, 0
        ) / activatedRooms.length)
      : null;

    const aiReviewsCompleted = roomStates.reduce((sum, state) => sum + state.aiReviewsCompleted, 0);

    console.log(`[analytics] ${email} → ${rooms.length} deals, ${analyses.length} docs`);
    res.json({
      totalDeals: rooms.length,
      waitingOnBorrower: activeRoomStates.filter(state => state.waitingOnBorrower).length,
      waitingOnInspector: activeRoomStates.filter(state => state.waitingOnInspector).length,
      avgDaysActive,
      documentsUploaded: roomStates.reduce((sum, state) => sum + state.documentCount, 0),
      aiReviewsCompleted,
      activeParticipants: activeRoomStates.reduce((sum, state) => sum + state.activeParticipants, 0),
    });
  } catch (err) {
    console.error('[analytics]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Legacy GET — backwards compat
app.get('/api/public/my-rooms', async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const { data, error } = await supabase
      .from('deal_rooms')
      .select('property_id, property_name, property_type, deal_amount, deal_type, address, status, deal_stage, created_at, activated_at, workflow_pack_id')
      .ilike('customer_email', email)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ rooms: data || [] });
  } catch (err) {
    console.error('[my-rooms]', err.message);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// ── Document-assignment config — used for role-scoped analyses filtering ──────
const DOC_ASSIGNMENTS = (() => {
  try {
    return require('../shared/document_assignments.json');
  } catch { return {}; }
})();

const TRANSACTION_RECORD_REQUIREMENTS = (() => {
  try {
    const requirements = require('../shared/transaction_record_requirements.json');
    const requiredKeys = ['cre_acquisition', 'business_acquisition', 'fundraising', 'tokenization', 'generic'];
    if (!requirements || requiredKeys.some(key => !Array.isArray(requirements[key]) || requirements[key].length === 0)) {
      throw new Error('required workflow keys are missing');
    }
    return requirements;
  } catch (error) {
    throw new Error(`[config] transaction_record_requirements.json could not load: ${error.message}`);
  }
})();

const TRANSACTION_RECORD_METADATA_FIELDS = {
  target_close_date: {
    fieldKey: 'transaction.closing_date',
    fieldCategory: 'transaction',
    displayLabel: 'Target closing date',
  },
  transaction_type: {
    fieldKey: 'transaction.type',
    fieldCategory: 'transaction',
    displayLabel: 'Transaction type',
  },
  transaction_structure: {
    fieldKey: 'transaction.structure',
    fieldCategory: 'transaction',
    displayLabel: 'Transaction structure',
  },
};

function dateOnly(value) {
  const match = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function buildCreationMetadata({
  propertyName,
  workflowPackId,
  transactionDescription,
  transactionType,
  transactionTypeLabel,
  transactionTypeSource,
  transactionStructure,
  transactionValue,
  transactionValueConfidence,
  customConfigReviewed,
  customConfigApprovalHash,
  customConfigGenerationId,
  customConfigApprovalSource,
  customConfigApprovedAt,
  generatedProposal,
  generatedBasePack,
  generatedSubtype,
  closingDate,
}) {
  const transactionTypeKey = String(transactionType || workflowPackId || '').trim();
  const metadata = {
    workspace_name: String(propertyName || '').slice(0, 500),
    transaction_description: String(transactionDescription || '').slice(0, 2000),
    transaction_type: canonicalTransactionTypeLabel(
      transactionType,
      workflowPackId,
      transactionTypeLabel,
    ),
    transaction_type_key: transactionTypeKey.slice(0, 100),
    transaction_type_source: String(transactionTypeSource || '').slice(0, 30),
    workflow_config_reviewed: customConfigReviewed === true || String(customConfigReviewed || '').toLowerCase() === 'true',
    workflow_config_approval_hash: String(customConfigApprovalHash || '').slice(0, 64),
    workflow_config_generation_id: String(customConfigGenerationId || '').slice(0, 100),
    workflow_config_approval_source: String(customConfigApprovalSource || '').slice(0, 20),
    workflow_config_approved_at: customConfigApprovedAt || null,
    target_close_date: dateOnly(closingDate) || null,
    generated_proposal: generatedProposal || null,
    generated_base_pack: generatedBasePack || null,
    generated_transaction_subtype: generatedSubtype || null,
  };
  if (transactionStructure) metadata.transaction_structure = String(transactionStructure).slice(0, 200);
  const numericValue = Number(transactionValue);
  if (String(transactionValueConfidence || '').toLowerCase() === 'high'
      && Number.isFinite(numericValue) && numericValue > 0) {
    metadata.transaction_value = String(numericValue);
  }
  return metadata;
}

function inferredCreationFieldIds(metadata) {
  const inferred = ['transaction_structure', 'transaction_value'];
  if (String(metadata?.transaction_type_source || '').toLowerCase() !== 'owner') {
    inferred.push('transaction_type');
  }
  return inferred;
}

function metadataTransactionValueField(schemaKey) {
  if (schemaKey === 'cre_acquisition' || schemaKey === 'business_acquisition') {
    return {
      fieldKey: 'transaction.purchase_price',
      fieldCategory: 'transaction',
      displayLabel: 'Transaction value',
    };
  }
  if (schemaKey === 'fundraising') {
    return {
      fieldKey: 'financial.target_raise',
      fieldCategory: 'financial',
      displayLabel: 'Transaction value',
    };
  }
  if (schemaKey === 'tokenization') {
    return {
      fieldKey: 'transaction.target_raise',
      fieldCategory: 'transaction',
      displayLabel: 'Transaction value',
    };
  }
  return {
    fieldKey: 'transaction.value',
    fieldCategory: 'transaction',
    displayLabel: 'Transaction value',
  };
}

async function getTransactionRecordSchemaKey(room) {
  return resolveTransactionSchemaKey(room);
}

async function getApprovedGenerationProposal(sessionId) {
  if (!sessionId) return null;
  const { data, error } = await supabase
    .from('transaction_generation_sessions')
    .select('id, status, approved_snapshot')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) {
    console.warn('[room-generator] approved proposal lookup failed:', error.message);
    return null;
  }
  return ['approved', 'created'].includes(data?.status) && data.approved_snapshot
    ? data.approved_snapshot
    : null;
}

async function syncGeneratedProposalToTransactionRecord(propertyId, proposal, actorEmail = 'Deal Owner') {
  const fields = Array.isArray(proposal?.transaction_record_fields)
    ? proposal.transaction_record_fields
    : [];
  for (const field of fields) {
    if (!field?.key || !field?.label) continue;
    const value = field.value === null || field.value === undefined ? null : String(field.value).slice(0, 2000);
    const hasValue = value !== null && value.trim() !== '';
    const now = new Date().toISOString();
    const { error } = await supabase.from('transaction_record_fields').upsert({
      property_id: propertyId,
      field_key: String(field.key).slice(0, 120),
      field_category: String(field.key).split('.')[0] || 'transaction',
      display_label: String(field.label).slice(0, 160),
      value_text: value,
      status: hasValue ? 'extracted' : 'missing',
      confidence: Number.isFinite(Number(field.confidence)) ? Number(field.confidence) : null,
      source_doc_id: null,
      source_page: null,
      source_excerpt: field.source_excerpt || null,
      extracted_by: hasValue ? 'ai' : null,
      verified_by: null,
      verified_at: null,
      notes: field.rationale || null,
      updated_at: now,
    }, { onConflict: 'property_id,field_key' });
    if (error) throw error;
  }
}

function formatMetadataRecordValue(fieldId, value) {
  if (fieldId !== 'transaction_value') return String(value).slice(0, 2000);
  const numeric = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(numeric) && numeric > 0
    ? `$${numeric.toLocaleString('en-US')}`
    : String(value).slice(0, 2000);
}

async function syncMetadataToTransactionRecord(propertyId, values, room, actorEmail, options = {}) {
  const schemaKey = await getTransactionRecordSchemaKey(room);
  const mappings = {
    transaction_value: metadataTransactionValueField(schemaKey),
    target_close_date: TRANSACTION_RECORD_METADATA_FIELDS.target_close_date,
    transaction_type: TRANSACTION_RECORD_METADATA_FIELDS.transaction_type,
    transaction_structure: TRANSACTION_RECORD_METADATA_FIELDS.transaction_structure,
  };
  const inferredFieldIds = new Set(options.inferredFieldIds || []);
  const normalizedValues = { ...(values || {}) };
  if (Object.prototype.hasOwnProperty.call(normalizedValues, 'transaction_type')) {
    const machineType = normalizedValues.transaction_type_key || room?.deal_type || room?.workflow_pack_id;
    normalizedValues.transaction_type = canonicalTransactionTypeLabel(
      machineType,
      room?.workflow_pack_id,
      normalizedValues.transaction_type,
    );
  }

  for (const [fieldId, mapping] of Object.entries(mappings)) {
    if (!Object.prototype.hasOwnProperty.call(normalizedValues, fieldId)) continue;
    const rawValue = normalizedValues[fieldId];
    const hasValue = rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '';
    const now = new Date().toISOString();
    const { data: existing, error: findError } = await supabase
      .from('transaction_record_fields')
      .select('id, value_text, status')
      .eq('property_id', propertyId)
      .eq('field_key', mapping.fieldKey)
      .maybeSingle();
    if (findError) throw findError;

    const nextValue = hasValue ? formatMetadataRecordValue(fieldId, rawValue) : null;
    const inferred = inferredFieldIds.has(fieldId);
    const nextStatus = hasValue ? (inferred ? 'extracted' : 'verified') : 'missing';
    const update = {
      field_category: mapping.fieldCategory,
      display_label: mapping.displayLabel,
      value_text: nextValue,
      status: nextStatus,
      confidence: null,
      source_doc_id: null,
      source_page: null,
      source_excerpt: null,
      extracted_by: hasValue ? (inferred ? 'ai' : 'deal_owner') : null,
      verified_by: hasValue && !inferred ? (actorEmail || 'Deal Owner') : null,
      verified_at: hasValue && !inferred ? now : null,
      updated_at: now,
    };

    let fieldIdValue = existing?.id;
    if (existing?.id) {
      const { error } = await supabase
        .from('transaction_record_fields')
        .update(update)
        .eq('id', existing.id)
        .eq('property_id', propertyId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase
        .from('transaction_record_fields')
        .insert({
          property_id: propertyId,
          field_key: mapping.fieldKey,
          created_at: now,
          ...update,
        })
        .select('id')
        .single();
      if (error) throw error;
      fieldIdValue = inserted?.id;
    }

    if (!options.skipHistory && fieldIdValue && (existing?.value_text !== nextValue || existing?.status !== nextStatus)) {
      await recordTransactionFieldHistory({
        fieldId: fieldIdValue,
        propertyId,
        eventType: 'manual_edit',
        actorEmail: actorEmail || 'Deal Owner',
        actorRole: 'Deal Owner',
        priorValue: existing?.value_text || null,
        newValue: nextValue,
        priorStatus: existing?.status || null,
        newStatus: nextStatus,
        metadata: { source: inferred ? 'ai_creation_inference' : 'deal_owner_input', metadataField: fieldId },
      });
    }
  }
}

function getSectionAssignments(packId, propertyType) {
  const pack = DOC_ASSIGNMENTS[packId];
  if (!pack) return null;
  if (pack.sections) return pack.sections;
  if (pack.byPropertyType) return pack.byPropertyType[propertyType] || pack.byPropertyType['Multifamily'] || null;
  return null;
}

async function getCustomPackDocumentAssignments(packId) {
  if (!packId?.startsWith('ws_')) return null;
  try {
    const { data, error } = await supabase
      .from('custom_workflow_packs')
      .select('config')
      .eq('id', packId)
      .maybeSingle();
    if (error || !Array.isArray(data?.config?.documents)) return null;
    return data.config.documents.reduce((result, document) => {
      const section = document?.section || document?.id;
      if (!section) return result;
      const assignedTo = Array.isArray(document?.assignedTo)
        ? document.assignedTo
        : document?.assignedRole
          ? [document.assignedRole]
          : [];
      result[section] = assignedTo
        .map(role => String(role || '').trim().replace(/\s+/g, '_'))
        .filter(Boolean);
      return result;
    }, {});
  } catch (error) {
    console.warn('[custom-pack] document assignment lookup failed:', error.message);
    return null;
  }
}

function isCoordinatorRole(packId, role) {
  const pack = DOC_ASSIGNMENTS[packId];
  return pack?.coordinatorRoles
    ? hasDocumentRole(pack.coordinatorRoles, role)
    : true; // unknown pack → allow all
}

function filterChecklistItemsByRole(items, role, assignments = null, assignedSections = null, customAssignments = null) {
  return (items || []).filter(item => {
    const section = item?.section || item?.id;
    const effectiveAssignments = getChecklistItemAssignedRoles(
      item,
      assignments,
      customAssignments,
    );
    return effectiveAssignments.length > 0
      ? hasDocumentRole(effectiveAssignments, role)
      : assignedSections?.has(section) === true;
  });
}

async function scopeChecklistItemsForAccess(items, access, packId, propertyType) {
  if (access.mode !== 'participant') return items;
  const assignments = getSectionAssignments(packId, propertyType);
  const customAssignments = await getCustomPackDocumentAssignments(packId);
  const customAssignedSections = new Set(
    Object.entries(customAssignments || {})
      .filter(([, roles]) => hasDocumentRole(roles, access.role))
      .map(([section]) => section),
  );
  return filterChecklistItemsByRole(
    items,
    access.role,
    assignments,
    customAssignedSections,
    customAssignments,
  ).map(item => {
    // The API response is the participant's authorized checklist. Include the
    // effective assignment when the persisted legacy row omitted assignedTo so
    // the client does not re-filter an already-authorized item out.
    const assignedTo = getChecklistItemAssignedRoles(item, assignments, customAssignments);
    return assignedTo.length > 0 ? { ...item, assignedTo } : item;
  });
}

// ── Public room access context ───────────────────────────────────────────────
// Owners authenticate with the owner write token issued at checkout. Participants
// authenticate with the short-lived session created from their invite PIN/OTP.
// Never trust role values from query strings or request bodies for authorization.
async function getRoomAccessContext(req, propertyId, ownerTokenOverride = '') {
  // A browser can retain a participant session after the room owner returns
  // through My Deal Rooms or refreshes a tab. Owner authorization is stronger
  // and must win whenever both credentials are present and valid.
  const ownerToken = (
    (req.headers['x-owner-write-token'] || '').trim()
    || String(ownerTokenOverride || '').trim()
  );
  if (ownerToken) {
    const { data: owner } = await supabase
      .from('deal_rooms')
      .select('id, owner_write_token, customer_email')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (owner?.owner_write_token && owner.owner_write_token === ownerToken) {
      return {
        mode: 'owner',
        role: 'owner',
        actorId: owner.customer_email || 'owner',
        email: owner.customer_email || null,
        roomId: owner.id || null,
        actorType: 'owner',
        permissions: {
          viewOverview: true,
          viewAssignedDocuments: true,
          uploadAssignedDocuments: true,
          viewAllDocuments: true,
          manageStages: true,
          manageParticipants: true,
          manageSettings: true,
          updateOwnSubmission: true,
        },
      };
    }
  }

  const sessionToken = (req.headers['x-kontra-session'] || '').trim();
  if (sessionToken) {
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const { data: session } = await supabase
      .from('deal_room_access_sessions')
      .select('invite_id, expires_at, revoked_at')
      .eq('session_token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .is('revoked_at', null)
      .maybeSingle();
    if (session?.invite_id) {
      const { data: invite } = await supabase
        .from('deal_room_invites')
        .select('property_id, role_key, invited_email, status')
        .eq('id', session.invite_id)
        .maybeSingle();
      if (invite?.property_id === propertyId && !['revoked', 'expired'].includes(invite.status)) {
        return {
          mode: 'participant',
          role: invite.role_key,
          actorId: session.invite_id,
          email: invite.invited_email || null,
          actorType: 'participant',
          permissions: {
            viewOverview: true,
            viewAssignedDocuments: true,
            uploadAssignedDocuments: true,
            viewAllDocuments: false,
            manageStages: false,
            manageParticipants: false,
            manageSettings: false,
            updateOwnSubmission: true,
          },
        };
      }
    }
  }

  return {
    mode: 'anonymous',
    role: 'guest',
    permissions: {
      viewOverview: true,
      viewAssignedDocuments: false,
      uploadAssignedDocuments: false,
      viewAllDocuments: false,
      manageStages: false,
      manageParticipants: false,
      manageSettings: false,
      updateOwnSubmission: false,
    },
  };
}

function accessDenied(res, message = 'A verified deal-room invitation or owner access token is required') {
  return res.status(403).json({ error: 'Access denied', message });
}

const PREVIEW_TOKEN_TTL_SECONDS = 72 * 60 * 60;
const PREVIEW_TOKEN_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'development-preview-secret';

function createPreviewToken(propertyId) {
  const payload = Buffer.from(JSON.stringify({
    propertyId,
    exp: Math.floor(Date.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', PREVIEW_TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyPreviewToken(token, propertyId) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature) return false;
    const expected = crypto.createHmac('sha256', PREVIEW_TOKEN_SECRET).update(payload).digest('base64url');
    const given = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (given.length !== expectedBuffer.length || !crypto.timingSafeEqual(given, expectedBuffer)) return false;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.propertyId === propertyId && Number(parsed.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

app.post('/api/public/deal-room/:propertyId/preview-link', async (req, res) => {
  const { propertyId } = req.params;
  const ownerWriteToken = String(req.body?.ownerWriteToken || req.headers['x-owner-write-token'] || '').trim();
  try {
    const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
    if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can create a preview link');
    const token = createPreviewToken(propertyId);
    res.json({
      token,
      expiresAt: new Date((Math.floor(Date.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS) * 1000).toISOString(),
    });
  } catch (err) {
    console.error('[preview-link]', err.message);
    res.status(500).json({ error: 'Could not create preview link' });
  }
});

app.get('/api/public/deal-room/:propertyId/preview', async (req, res) => {
  const { propertyId } = req.params;
  if (!verifyPreviewToken(req.query.token, propertyId)) {
    return res.status(401).json({ error: 'This preview link is invalid or has expired' });
  }
  try {
    const [roomRes, analysesRes, partiesRes] = await Promise.all([
      supabase.from('deal_rooms').select('*').eq('property_id', propertyId).eq('status', 'active').maybeSingle(),
      supabase.from('deal_analyses').select('id, section, filename, analysis, uploaded_by_role, created_at').eq('property_id', propertyId).order('created_at', { ascending: true }),
      supabase.from('party_submissions').select('role, name, status, doc_count, submitted_at, notes').eq('property_id', propertyId),
    ]);
    if (roomRes.error) throw roomRes.error;
    if (!roomRes.data) return res.status(404).json({ error: 'Deal room not found' });
    const { customer_email, first_name, last_name, stripe_session_id, owner_write_token: _owt, ...room } = roomRes.data;
    if (room.workflow_pack_id?.startsWith('ws_')) {
      const { data: customPack } = await supabase
        .from('custom_workflow_packs')
        .select('config')
        .eq('id', room.workflow_pack_id)
        .maybeSingle();
      if (customPack?.config) room.workflow_pack_config = customPack.config;
    }
    room.jurisdiction = await jurisdictionForTransaction(
      room.jurisdiction,
      room.workflow_pack_id,
      room.deal_type,
      room.metadata_values,
    ) || null;
    res.set('Cache-Control', 'no-store');
    res.json({
      room,
      analyses: analysesRes.data || [],
      parties: partiesRes.data || [],
      expiresAt: new Date((Math.floor(Date.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS) * 1000).toISOString(),
    });
  } catch (err) {
    console.error('[preview]', err.message);
    res.status(500).json({ error: 'Could not load preview' });
  }
});

async function getAssignedSectionsForAccess(propertyId, packId, propertyType, access) {
  if (access.mode !== 'participant') return null;

  // Prefer the room's persisted checklist because custom packs are not
  // necessarily present in the server's built-in assignment map.
  const { data: room } = await supabase
    .from('deal_rooms')
    .select('checklist_items')
    .eq('property_id', propertyId)
    .maybeSingle();
  const checklistItems = Array.isArray(room?.checklist_items) ? room.checklist_items : [];
  const assignments = getSectionAssignments(packId, propertyType);
  const customAssignments = await getCustomPackDocumentAssignments(packId);
  const assignedSections = getAssignedSectionsFromChecklist(
    checklistItems,
    access.role,
    assignments,
    customAssignments,
  );

  // Rooms created before checklist_items was populated still use the active
  // workflow pack's canonical schema/map as their durable authorization source.
  if (checklistItems.length === 0) {
    for (const [section, roles] of Object.entries(customAssignments || assignments || {})) {
      if (hasDocumentRole(roles, access.role)) assignedSections.add(section);
    }
  }
  return assignedSections;
}

// ── Public analyses fetch — no auth required ──────────────────────────────
app.get('/api/public/deal-room/:propertyId/analyses', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    const role = access.mode === 'participant' ? access.role : access.mode === 'preview' ? null : (req.query.role || 'owner');
    // Resolve pack + property_type if role filtering is needed
    let packId = null;
    let propertyType = null;
    if (role) {
      const { data: room } = await supabase
        .from('deal_rooms')
        .select('workflow_pack_id, property_type')
        .eq('property_id', propertyId)
        .maybeSingle();
      packId = room?.workflow_pack_id || 'cre_acquisition';
      propertyType = room?.property_type || 'Multifamily';
    }

    let { data, error } = await supabase
      .from('deal_analyses')
      .select('id, section, filename, analysis, uploaded_by_role, created_at, storage_path, post_completion, post_completion_added_at, processing_status, source_hash, extraction_version, processing_attempt, correlation_id, failure_reason, processing_started_at, processing_completed_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true }); // oldest first → version = index+1
    if (error && /post_completion|processing_status|source_hash|extraction_version|correlation_id|failure_reason/i.test(error.message || '')) {
      ({ data, error } = await supabase
        .from('deal_analyses')
        // Production may still be on the pre-pipeline schema. Keep this
        // fallback strictly to columns that existed before migration 019;
        // otherwise participant reads silently degrade to an empty list.
        .select('id, section, filename, analysis, uploaded_by_role, created_at, storage_path')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true }));
    }
    if (error) throw error;
    // Assign version by section-scoped sequence (no extra DB column needed)
    const sectionCounters = {};
    const allWithVersion = (data || [])
      .filter(a => a.section !== 'cross_document_verification')
      .map(a => {
      sectionCounters[a.section] = (sectionCounters[a.section] || 0) + 1;
      return { ...a, version: sectionCounters[a.section] };
      });
    // Build history map (all versions per section, newest last)
    const history = {};
    for (const a of allWithVersion) {
      if (!history[a.section]) history[a.section] = [];
      history[a.section].push({ id: a.id, version: a.version, filename: a.filename, uploaded_by_role: a.uploaded_by_role, created_at: a.created_at });
    }
    // Auto-resolve orphaned pending records older than 2 minutes (background AI job never ran)
    const now = Date.now();
    const stuckIds = allWithVersion
      .filter(a => (a.processing_status === 'uploaded' || (!a.processing_status && a.analysis?.pending))
        && (now - new Date(a.created_at).getTime()) > 2 * 60 * 1000)
      .map(a => a.id);
    if (stuckIds.length > 0) {
      // Fix each stuck record individually so we can set the right label
      for (const stuck of allWithVersion.filter(a => stuckIds.includes(a.id))) {
        const label = stuck.filename ? `${stuck.filename} received and logged.` : `Document received and logged.`;
        updateDocumentProcessing(stuck.id, {
          analysis: { summary: label, documentType: stuck.analysis?.documentType || 'Document', confidence: 100, pending: false, processing_status: 'failed' },
          processing_status: 'failed',
          failure_reason: 'Background processing did not start',
          processing_completed_at: new Date().toISOString(),
        }, {
          analysis: { summary: label, documentType: stuck.analysis?.documentType || 'Document', confidence: 100, pending: false },
        }).catch(() => {});
        stuck.analysis = { ...stuck.analysis, pending: false, summary: label, confidence: 100 };
      }
    }

    // De-duplicate: keep only the latest per section (highest version)
    const seen = {};
    const deduped = [...allWithVersion].reverse().filter(a => {
      if (seen[a.section]) return false;
      seen[a.section] = true;
      return true;
    }).map(a => ({ ...a, versionHistory: history[a.section] || [] }));

    // Role-scoped filtering applies to participants only. The owner access
    // context is authenticated by the room's owner_write_token and carries
    // viewAllDocuments=true, so owner visibility must not depend on a
    // participant role name or the pack's assignment map.
    // Custom sections (not in the assignments map) are always visible to all.
    let filtered = deduped;
    const canViewAllDocuments = access.permissions?.viewAllDocuments === true;
    if (
      !canViewAllDocuments
      && access.mode !== 'participant'
      && role
      && packId
      && !isCoordinatorRole(packId, role)
    ) {
      const assignments = getSectionAssignments(packId, propertyType);
      if (assignments) {
        filtered = deduped.filter(a => {
          const assignedTo = assignments[a.section];
          // Section not in the map (e.g. custom upload) → visible to all
          if (!assignedTo) return true;
          return hasDocumentRole(assignedTo, role);
        });
      }
    }
    if (access.mode === 'participant') {
      const assignedSections = await getAssignedSectionsForAccess(propertyId, packId, propertyType, access);
      filtered = filtered.filter(a => assignedSections.has(a.section));
    }

    // Split post-completion records from regular analyses.
    // post_completion=true means the upload happened after sealed_at.
    // transaction_seal records are shown via GET /settlement/seal, not in the main doc list.
    const postCompletionRecords = filtered.filter(a => a.post_completion === true);
    const regularAnalyses       = filtered.filter(a => !a.post_completion);

    res.json({ analyses: regularAnalyses, post_completion_records: postCompletionRecords });
  } catch (err) {
    console.error('[analyses-fetch]', err.message);
    res.json({ analyses: [] });
  }
});

// ── Lightweight document tracking — no AI, just records upload in deal_analyses ─
// ── AI prompts for lightweight sections ──────────────────────────────────────
// ── Transaction Record field extraction ──────────────────────────────────────
// Runs after document analysis. Extracts structured fields from document text
// and merges them into transaction_record_fields. Existing 'verified' fields
// are never overwritten. Conflicting extractions are flagged for coordinator review.
const TRANSACTION_RECORD_DEPENDENCIES = {
  'transaction.financing_contingency': [
    'parties.lender',
    'financial.proposed_financing',
    'financial.required_equity',
    'approval.lender',
  ],
};

async function recordTransactionFieldHistory({
  fieldId, propertyId, eventType, actorEmail = null, actorRole = null,
  priorValue = null, newValue = null, priorStatus = null, newStatus = null,
  sourceDocId = null, sourcePage = null, sourceExcerpt = null, metadata = null,
}) {
  const { error } = await supabase.from('transaction_record_history').insert({
    field_id: fieldId,
    property_id: propertyId,
    event_type: eventType,
    actor_email: actorEmail,
    actor_role: actorRole,
    prior_value: priorValue,
    new_value: newValue,
    prior_status: priorStatus,
    new_status: newStatus,
    source_doc_id: sourceDocId,
    source_page: sourcePage,
    source_excerpt: sourceExcerpt,
    metadata,
  });
  if (error) {
    // The history table is additive and may not be present until migration 015
    // is applied in an environment. Never let audit persistence interrupt the
    // current Transaction Record write or document extraction.
    console.warn('[transaction-record history]', error.message);
    return false;
  }
  return true;
}

async function markDependentTransactionFieldsNotApplicable(propertyId, dependencyKey, actorEmail = 'coordinator', actorRole = 'Deal Coordinator') {
  const dependentKeys = TRANSACTION_RECORD_DEPENDENCIES[dependencyKey] || [];
  if (!dependentKeys.length) return;
  const { data: dependents } = await supabase
    .from('transaction_record_fields')
    .select('id, field_key, value_text, status')
    .eq('property_id', propertyId)
    .in('field_key', dependentKeys);
  for (const field of dependents || []) {
    if (field.status === 'not_applicable') continue;
    await supabase.from('transaction_record_fields').update({
      status: 'not_applicable',
      value_text: null,
      updated_at: new Date().toISOString(),
    }).eq('id', field.id).eq('property_id', propertyId);
    await recordTransactionFieldHistory({
      fieldId: field.id,
      propertyId,
      eventType: 'marked_not_applicable',
      actorEmail,
      actorRole,
      priorValue: field.value_text,
      priorStatus: field.status,
      newStatus: 'not_applicable',
      metadata: { reason: 'dependency_not_applicable', dependencyKey },
    });
  }
}

async function extractTransactionFields(propertyId, docId, text, sectionLabel) {
  if (!text || text.trim().length < 50) {
    return { rawCount: 0, savedCount: 0, rawKeys: [], canonicalKeys: [] };
  }
  try {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('workflow_pack_id, deal_type')
      .eq('property_id', propertyId)
      .maybeSingle();
    const schemaKey = await getTransactionRecordSchemaKey(room);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a transaction data extraction specialist. Given document text, extract key structured fields for a transaction record. Return a JSON array of field objects — only include fields explicitly present in the text. Each object must have: field_key (dotted string like "parties.buyer"), field_category (one of: asset_identity, transaction, parties, beneficial_ownership, financial, legal, approvals), display_label (human-readable label), value_text (the extracted value as a plain string), confidence (0.0 to 1.0), source_page (integer if determinable, else null), source_excerpt (the exact clause the value was extracted from, max 120 chars). Use canonical field keys when a concept has a canonical home: purchase price is "transaction.purchase_price" (never "financial.purchase_price"), and transaction value is "transaction.value" (never "financial.deal_value"). One document may populate multiple distinct fields, but do not emit duplicate keys for the same concept.`,
        },
        {
          role: 'user',
          content: `Extract transaction record fields from this document (section: ${sectionLabel}):\n\n${text.slice(0, 8000)}\n\nReturn JSON: { "fields": [ { "field_key": ..., "field_category": ..., "display_label": ..., "value_text": ..., "confidence": ..., "source_page": ..., "source_excerpt": ... } ] }`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }, { timeout: 20000 });

    const parsed = JSON.parse(completion.choices[0].message.content);
    const extracted = Array.isArray(parsed.fields) ? parsed.fields : [];
    const validExtracted = extracted.filter(f => f?.field_key && f?.field_category && f?.value_text);
    const rawKeys = validExtracted.map(f => String(f.field_key));
    console.log(`[tx-record] raw ${validExtracted.length} fields for ${propertyId} pack=${schemaKey} keys=${rawKeys.join(',') || 'none'}`);
    if (!validExtracted.length) {
      return { rawCount: 0, savedCount: 0, rawKeys, canonicalKeys: [] };
    }

    const canonicalKeys = [];
    for (const f of validExtracted) {
      const canonicalKey = canonicalizeTransactionRecordKey(String(f.field_key), schemaKey);
      canonicalKeys.push(canonicalKey);
      const aliasKeys = aliasKeysForCanonical(canonicalKey, schemaKey);
      const { data: existingRows } = await supabase
        .from('transaction_record_fields')
        .select('id, field_key, status, value_text, source_doc_id, source_page, source_excerpt, verified_by, verified_role')
        .eq('property_id', propertyId)
        .in('field_key', aliasKeys);
      let existing = (existingRows || []).find(row => row.field_key === canonicalKey)
        || (existingRows || [])[0]
        || null;
      const aliasRows = (existingRows || []).filter(row => row.id !== existing?.id);

      // Migrate a legacy alias row in place when no canonical row exists. If
      // both exist, keep one canonical row and remove duplicate alias rows.
      if (existing && existing.field_key !== canonicalKey) {
        const { error: aliasMoveError } = await supabase
          .from('transaction_record_fields')
          .update({ field_key: canonicalKey })
          .eq('id', existing.id)
          .eq('property_id', propertyId);
        if (aliasMoveError) throw aliasMoveError;
        existing = { ...existing, field_key: canonicalKey };
      }
      if (aliasRows.length > 0 && existing) {
        const aliasWithSource = aliasRows.find(row => row.source_doc_id);
        if (!existing.source_doc_id && aliasWithSource?.source_doc_id) {
          await supabase.from('transaction_record_fields').update({
            source_doc_id: aliasWithSource.source_doc_id,
            source_page: aliasWithSource.source_page || null,
            source_excerpt: aliasWithSource.source_excerpt || null,
          }).eq('id', existing.id).eq('property_id', propertyId);
        }
        const { error: duplicateDeleteError } = await supabase
          .from('transaction_record_fields')
          .delete()
          .eq('property_id', propertyId)
          .in('id', aliasRows.map(row => row.id));
        if (duplicateDeleteError) throw duplicateDeleteError;
      }

      const priorValue = existing?.value_text || null;
      const priorStatus = existing?.status || null;
      const differs = existing?.value_text && existing.value_text !== f.value_text;
      const eventType = existing?.status === 'verified' && differs
        ? 'source_changed'
        : differs ? 'conflict' : 'extracted';
      const nextStatus = existing?.status === 'verified'
        ? (eventType === 'source_changed' ? 'source_changed' : 'verified')
        : eventType === 'source_changed'
          ? 'source_changed'
          : eventType === 'conflict' ? 'conflicting' : 'extracted';
      const nextValue = existing?.status === 'verified' || eventType === 'source_changed'
        ? existing.value_text
        : String(f.value_text).slice(0, 2000);

      const { data: savedField, error: saveError } = await supabase.from('transaction_record_fields').upsert({
        property_id:    propertyId,
        field_key:      canonicalKey,
        field_category: f.field_category,
        display_label:  f.display_label || canonicalKey,
        value_text:     nextValue,
        status:         nextStatus,
        confidence:     f.confidence != null ? Math.min(1, Math.max(0, parseFloat(f.confidence))) : null,
        source_doc_id:  docId || null,
        source_page:    f.source_page || null,
        source_excerpt: f.source_excerpt ? String(f.source_excerpt).slice(0, 200) : null,
        extracted_by:   'ai',
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'property_id,field_key', ignoreDuplicates: false }).select('id').single();
      if (saveError) throw saveError;
      console.log(`[tx-record] field ${propertyId} pack=${schemaKey} raw=${String(f.field_key)} canonical=${canonicalKey} status=${nextStatus} source_doc_id=${docId || 'none'}`);
      await recordTransactionFieldHistory({
        fieldId: savedField.id,
        propertyId,
        eventType,
        priorValue,
        newValue: String(f.value_text).slice(0, 2000),
        priorStatus,
        newStatus: nextStatus,
        sourceDocId: docId || null,
        sourcePage: f.source_page || null,
        sourceExcerpt: f.source_excerpt ? String(f.source_excerpt).slice(0, 200) : null,
        metadata: { sectionLabel },
      });
    }
    console.log(`[tx-record] extracted ${canonicalKeys.length} fields for ${propertyId} (${sectionLabel})`);
    return { rawCount: rawKeys.length, savedCount: canonicalKeys.length, rawKeys, canonicalKeys, schemaKey };
  } catch (err) {
    console.warn('[tx-record extraction]', err.message);
    return { rawCount: 0, savedCount: 0, rawKeys: [], canonicalKeys: [], error: err.message };
  }
}

const LIGHTWEIGHT_AI_PROMPTS = {
  purchase_agreement: {
    system: 'You are a CRE transaction analyst. Extract key terms from purchase agreements and PSAs. Return JSON only.',
    user: (text) => `Analyze this commercial real estate purchase agreement and return JSON:
{"documentType":string,"purchasePrice":string|null,"closingDate":string|null,"daysToClose":number|null,"earnestMoney":string|null,"dueDiligencePeriod":string|null,"contingencies":[string],"keyParties":[{"role":string,"name":string}],"redFlags":[{"issue":string,"severity":"Critical"|"Moderate"|"Minor"}],"summary":string,"confidence":number}

confidence is 0-100. Only populate fields explicitly present in the document.

Purchase agreement text:\n${text}`,
  },
  rent_roll: {
    system: 'You are a CRE financial analyst. Extract occupancy and rent data from rent rolls. Return JSON only.',
    user: (text) => `Analyze this commercial real estate rent roll and return JSON:
{"totalUnits":number|null,"occupiedUnits":number|null,"vacantUnits":number|null,"occupancyRate":string|null,"totalMonthlyRent":string|null,"averageRentPerUnit":string|null,"belowMarketUnits":number|null,"expiringLeases":[{"units":number,"expiryPeriod":string}],"anomalies":[{"item":string,"description":string,"severity":"High"|"Medium"|"Low"}],"covenantStatus":"Compliant"|"At Risk"|"Breached"|"Unknown","summary":string,"confidence":number}

confidence is 0-100. Only populate fields explicitly present.

Rent roll:\n${text}`,
  },
  title: {
    system: 'You are a CRE title officer. Review title commitments and identify Schedule B exceptions and issues. Return JSON only.',
    user: (text) => `Analyze this title commitment and return JSON:
{"titleCompany":string|null,"effectiveDate":string|null,"scheduleBExceptions":[{"item":string,"description":string,"severity":"Critical"|"Moderate"|"Minor"}],"encumbrances":[string],"liens":[string],"easements":[string],"redFlags":[{"issue":string,"severity":"Critical"|"Moderate"|"Minor"}],"clearToClose":boolean|null,"summary":string,"confidence":number}

confidence is 0-100. Schedule B exceptions are critical — list each one with its severity.

Title commitment:\n${text}`,
  },
  environmental: {
    system: 'You are a CRE environmental consultant. Review Phase I/II ESA reports and identify RECs and contamination issues. Return JSON only.',
    user: (text) => `Analyze this environmental report and return JSON:
{"reportType":string,"assessmentDate":string|null,"consultant":string|null,"recognizedEnvironmentalConditions":[{"item":string,"severity":"Critical"|"Moderate"|"Minor","description":string}],"historicalUses":[string],"recommendations":[string],"furtherActionRequired":boolean,"summary":string,"confidence":number}

confidence is 0-100. RECs (Recognized Environmental Conditions) are the most important finding.

Environmental report:\n${text}`,
  },
  survey: {
    system: 'You are a CRE surveyor. Review ALTA and boundary surveys for encroachments, easements, and issues. Return JSON only.',
    user: (text) => `Analyze this survey and return JSON:
{"surveyType":string,"surveyDate":string|null,"surveyor":string|null,"lotSize":string|null,"encroachments":[string],"easements":[string],"zoning":string|null,"redFlags":[{"issue":string,"severity":"Critical"|"Moderate"|"Minor"}],"summary":string,"confidence":number}

confidence is 0-100.

Survey text:\n${text}`,
  },
  estoppel: {
    system: 'You are a CRE lease analyst. Review estoppel certificates to verify lease terms and tenant representations. Return JSON only.',
    user: (text) => `Analyze this estoppel certificate and return JSON:
{"tenantName":string|null,"leaseStartDate":string|null,"leaseEndDate":string|null,"monthlyRent":string|null,"securityDeposit":string|null,"renewalOptions":[string],"disputes":boolean|null,"landlordDefaultsClaimed":boolean|null,"redFlags":[{"issue":string,"severity":"Critical"|"Moderate"|"Minor"}],"summary":string,"confidence":number}

confidence is 0-100.

Estoppel certificate:\n${text}`,
  },
};

// ── Canonical server-side document schemas (mirrors frontend workflowPacks) ───
// One source of truth on the server so any first-load seeds the SAME list.
// Keyed by workflow_pack_id → property_type variant → array of items.
// 'default' key is the fallback when property_type doesn't match a named variant.
const PACK_DOCUMENT_SCHEMAS = {
  cre_acquisition: {
    default: [
      { id: 'purchase_agreement', label: 'Purchase Agreement',             section: 'purchase_agreement', required: true,  ai: true,  category: 'Legal',           assignedTo: ['owner'] },
      { id: 'rent_roll',          label: 'Rent Roll',                      section: 'rent_roll',          required: true,  ai: true,  category: 'Financial',       assignedTo: ['owner'] },
      { id: 'financials',         label: 'T-12 Financial Statement',       section: 'financials',         required: true,  ai: true,  category: 'Financial',       assignedTo: ['owner'] },
      { id: 'insurance',          label: 'Insurance Certificate',          section: 'insurance',          required: true,  ai: true,  category: 'Insurance',       assignedTo: ['insurer'] },
      { id: 'inspection',         label: 'Property Inspection Report',     section: 'inspection',         required: true,  ai: true,  category: 'Property / Asset',assignedTo: ['inspector'] },
      { id: 'estoppel',           label: 'Estoppel Certificates',          section: 'estoppel',           required: false, ai: true,  category: 'Legal',           assignedTo: ['owner'] },
      { id: 'environmental',      label: 'Environmental Report (Phase I)', section: 'environmental',      required: true,  ai: true,  category: 'Operational',     assignedTo: ['inspector'] },
      { id: 'survey',             label: 'Survey / ALTA',                  section: 'survey',             required: false, ai: true,  category: 'Property / Asset',assignedTo: ['owner'] },
      { id: 'title',              label: 'Title Commitment',               section: 'title',              required: true,  ai: true,  category: 'Legal',           assignedTo: ['attorney'] },
    ],
    Hotel: [
      { id: 'purchase_agreement', label: 'Purchase Agreement',             section: 'purchase_agreement', required: true,  ai: true,  category: 'Legal',           assignedTo: ['owner'] },
      { id: 'brand_standards',    label: 'PIP / Brand Standards',          section: 'brand-standards',    required: true,  ai: true,  category: 'Closing',         assignedTo: ['owner'] },
      { id: 'legal',              label: 'Franchise Agreement',            section: 'legal',              required: true,  ai: true,  category: 'Legal',           assignedTo: ['attorney'] },
      { id: 'financials',         label: 'STR / P&L Statement',           section: 'financials',         required: true,  ai: true,  category: 'Financial',       assignedTo: ['owner'] },
      { id: 'insurance',          label: 'Insurance Certificate',          section: 'insurance',          required: true,  ai: true,  category: 'Insurance',       assignedTo: ['insurer'] },
      { id: 'inspection',         label: 'Property Inspection Report',     section: 'inspection',         required: true,  ai: true,  category: 'Property / Asset',assignedTo: ['inspector'] },
      { id: 'environmental',      label: 'Environmental Report (Phase I)', section: 'environmental',      required: true,  ai: true,  category: 'Operational',     assignedTo: ['inspector'] },
      { id: 'survey',             label: 'Survey / ALTA',                  section: 'survey',             required: false, ai: true,  category: 'Property / Asset',assignedTo: ['owner'] },
      { id: 'title',              label: 'Title Commitment',               section: 'title',              required: true,  ai: true,  category: 'Legal',           assignedTo: ['attorney'] },
    ],
    Office: [
      { id: 'purchase_agreement', label: 'Purchase Agreement',             section: 'purchase_agreement', required: true,  ai: true,  category: 'Legal',           assignedTo: ['owner'] },
      { id: 'rent_roll',          label: 'Rent Roll',                      section: 'rent_roll',          required: true,  ai: true,  category: 'Financial',       assignedTo: ['owner'] },
      { id: 'financials',         label: 'T-12 Financial Statement',       section: 'financials',         required: true,  ai: true,  category: 'Financial',       assignedTo: ['owner'] },
      { id: 'insurance',          label: 'Insurance Certificate',          section: 'insurance',          required: true,  ai: true,  category: 'Insurance',       assignedTo: ['insurer'] },
      { id: 'inspection',         label: 'Property Inspection Report',     section: 'inspection',         required: true,  ai: true,  category: 'Property / Asset',assignedTo: ['inspector'] },
      { id: 'estoppel',           label: 'Estoppel / Lease Abstracts',     section: 'estoppel',           required: true,  ai: true,  category: 'Legal',           assignedTo: ['owner'] },
      { id: 'environmental',      label: 'Environmental Report (Phase I)', section: 'environmental',      required: true,  ai: true,  category: 'Operational',     assignedTo: ['inspector'] },
      { id: 'survey',             label: 'Survey / ALTA',                  section: 'survey',             required: false, ai: true,  category: 'Property / Asset',assignedTo: ['owner'] },
      { id: 'title',              label: 'Title Commitment',               section: 'title',              required: true,  ai: true,  category: 'Legal',           assignedTo: ['attorney'] },
      { id: 'legal',              label: 'Loan / Legal Documents',         section: 'legal',              required: false, ai: true,  category: 'Legal',           assignedTo: ['attorney'] },
    ],
    Industrial: [
      { id: 'purchase_agreement', label: 'Purchase Agreement',             section: 'purchase_agreement', required: true,  ai: true,  category: 'Legal',           assignedTo: ['owner'] },
      { id: 'financials',         label: 'Financial Statement',            section: 'financials',         required: true,  ai: true,  category: 'Financial',       assignedTo: ['owner'] },
      { id: 'insurance',          label: 'Insurance Certificate',          section: 'insurance',          required: true,  ai: true,  category: 'Insurance',       assignedTo: ['insurer'] },
      { id: 'inspection',         label: 'Property Inspection Report',     section: 'inspection',         required: true,  ai: true,  category: 'Property / Asset',assignedTo: ['inspector'] },
      { id: 'environmental',      label: 'Environmental Report (Phase I)', section: 'environmental',      required: true,  ai: true,  category: 'Operational',     assignedTo: ['inspector'] },
      { id: 'survey',             label: 'Survey / ALTA',                  section: 'survey',             required: false, ai: true,  category: 'Property / Asset',assignedTo: ['owner'] },
      { id: 'title',              label: 'Title Commitment',               section: 'title',              required: true,  ai: true,  category: 'Legal',           assignedTo: ['attorney'] },
      { id: 'legal',              label: 'Lease / Legal Documents',        section: 'legal',              required: false, ai: true,  category: 'Legal',           assignedTo: ['attorney'] },
    ],
    Retail: [
      { id: 'purchase_agreement', label: 'Purchase Agreement',             section: 'purchase_agreement', required: true,  ai: true,  category: 'Legal',           assignedTo: ['owner'] },
      { id: 'rent_roll',          label: 'Rent Roll',                      section: 'rent_roll',          required: true,  ai: true,  category: 'Financial',       assignedTo: ['owner'] },
      { id: 'financials',         label: 'T-12 Financial Statement',       section: 'financials',         required: true,  ai: true,  category: 'Financial',       assignedTo: ['owner'] },
      { id: 'insurance',          label: 'Insurance Certificate',          section: 'insurance',          required: true,  ai: true,  category: 'Insurance',       assignedTo: ['insurer'] },
      { id: 'inspection',         label: 'Property Inspection Report',     section: 'inspection',         required: true,  ai: true,  category: 'Property / Asset',assignedTo: ['inspector'] },
      { id: 'estoppel',           label: 'Estoppel / Lease Abstracts',     section: 'estoppel',           required: true,  ai: true,  category: 'Legal',           assignedTo: ['owner'] },
      { id: 'environmental',      label: 'Environmental Report (Phase I)', section: 'environmental',      required: true,  ai: true,  category: 'Operational',     assignedTo: ['inspector'] },
      { id: 'survey',             label: 'Survey / ALTA',                  section: 'survey',             required: false, ai: true,  category: 'Property / Asset',assignedTo: ['owner'] },
      { id: 'title',              label: 'Title Commitment',               section: 'title',              required: true,  ai: true,  category: 'Legal',           assignedTo: ['attorney'] },
    ],
  },
  business_acquisition: {
    default: [
      { id: 'loi',                 label: 'Letter of Intent',               section: 'loi',                required: true,  ai: false, category: 'Legal',     assignedTo: ['buyer'] },
      { id: 'purchase_agreement',  label: 'Purchase Agreement',             section: 'purchase_agreement', required: true,  ai: false, category: 'Legal',     assignedTo: ['counsel'] },
      { id: 'financials',          label: 'Financial Statements (3-yr)',    section: 'financials',         required: true,  ai: true,  category: 'Financial', assignedTo: ['seller'] },
      { id: 'tax_returns',         label: 'Tax Returns (3-yr)',             section: 'tax_returns',        required: true,  ai: false, category: 'Financial', assignedTo: ['seller'] },
      { id: 'cap_table',           label: 'Cap Table / Ownership',          section: 'cap_table',          required: true,  ai: false, category: 'Financial', assignedTo: ['seller'] },
      { id: 'qoe',                 label: 'Quality of Earnings Report',     section: 'qoe',                required: false, ai: true,  category: 'Financial', assignedTo: ['cpa'] },
      { id: 'contracts',           label: 'Material Contracts',             section: 'contracts',          required: false, ai: false, category: 'Legal',     assignedTo: ['seller'] },
      { id: 'disclosure_schedule', label: 'Disclosure Schedule',            section: 'disclosure_schedule',required: false, ai: false, category: 'Legal',     assignedTo: ['seller'] },
    ],
  },
  fundraising: {
    default: [
      { id: 'term_sheet',          label: 'Term Sheet',                     section: 'term_sheet',         required: true,  ai: false, category: 'Legal',     assignedTo: ['founder'] },
      { id: 'financials',          label: 'Financial Statements',           section: 'financials',         required: true,  ai: true,  category: 'Financial', assignedTo: ['founder'] },
      { id: 'cap_table',           label: 'Cap Table',                      section: 'cap_table',          required: true,  ai: false, category: 'Financial', assignedTo: ['founder'] },
      { id: 'spa',                 label: 'Stock Purchase Agreement / SAFE',section: 'spa',                required: false, ai: false, category: 'Legal',     assignedTo: ['counsel'] },
    ],
  },
};

// New CRE rooms use the canonical participant model. Historical role keys
// remain in document_assignments.json as a compatibility fallback for rooms
// whose persisted checklist still references inspector/insurer/attorney/owner.
const CRE_CANONICAL_DOCUMENT_ASSIGNMENTS = {
  purchase_agreement: ['buyer', 'seller', 'legal_advisor'],
  rent_roll: ['seller', 'financial_advisor'],
  financials: ['seller', 'financial_advisor'],
  insurance: ['seller', 'financial_advisor'],
  inspection: ['buyer', 'financial_advisor'],
  estoppel: ['seller', 'legal_advisor'],
  environmental: ['buyer', 'financial_advisor'],
  survey: ['buyer', 'legal_advisor'],
  title: ['buyer', 'legal_advisor'],
  legal: ['buyer', 'seller', 'legal_advisor'],
  'brand-standards': ['seller', 'legal_advisor'],
};

function normalizeCanonicalPackSchema(packId, schema) {
  if (!Array.isArray(schema) || packId !== 'cre_acquisition') return schema;
  return schema.map(document => ({
    ...document,
    assignedTo: CRE_CANONICAL_DOCUMENT_ASSIGNMENTS[document.section] || document.assignedTo,
  }));
}

// Returns the canonical checklist items for a pack+property_type combination.
// Property type is matched with a fuzzy check to handle slight label variations.
async function getCanonicalChecklist(packId, propertyType) {
  const packSchemas = PACK_DOCUMENT_SCHEMAS[packId];
  if (!packSchemas) {
    if (!packId?.startsWith('ws_')) return null;
    try {
      const { data, error } = await supabase
        .from('custom_workflow_packs')
        .select('config')
        .eq('id', packId)
        .maybeSingle();
      if (error || !Array.isArray(data?.config?.documents)) return null;
      return data.config.documents
        .map((document, index) => {
          const section = document?.section || document?.id || `document_${index + 1}`;
          const assignedTo = Array.isArray(document?.assignedTo)
            ? document.assignedTo
            : document?.assignedRole
              ? [document.assignedRole]
              : [];
          return {
            ...document,
            id: document?.id || section,
            section,
            label: document?.label || document?.name || section.replace(/_/g, ' '),
            assignedTo: assignedTo
              .map(role => String(role || '').trim().replace(/\s+/g, '_'))
              .filter(Boolean),
          };
        })
        .filter(document => document.section);
    } catch (error) {
      console.warn('[checklist] custom pack schema lookup failed:', error.message);
      return null;
    }
  }
  const pt = String(propertyType || '').trim();
  // Exact match first
  if (packSchemas[pt]) return normalizeCanonicalPackSchema(packId, packSchemas[pt]);
  // Fuzzy match for CRE sub-types
  if (/hotel|hospitality|motel/i.test(pt) && packSchemas.Hotel)      return normalizeCanonicalPackSchema(packId, packSchemas.Hotel);
  if (/office/i.test(pt) && packSchemas.Office)                       return normalizeCanonicalPackSchema(packId, packSchemas.Office);
  if (/industrial|warehouse/i.test(pt) && packSchemas.Industrial)     return normalizeCanonicalPackSchema(packId, packSchemas.Industrial);
  if (/retail|strip|shopping/i.test(pt) && packSchemas.Retail)        return normalizeCanonicalPackSchema(packId, packSchemas.Retail);
  return normalizeCanonicalPackSchema(packId, packSchemas.default || null);
}

// ── Checklist CRUD ────────────────────────────────────────────────────────────
// GET  /api/public/deal-room/:propertyId/checklist  → items array
// PUT  /api/public/deal-room/:propertyId/checklist  → replace full array
//
// On first GET older rooms use the canonical pack schema as an in-memory
// fallback. Reads must not mutate a room, because legacy rooms can legitimately
// have no persisted checklist and the Production audit is read-only.

app.get('/api/public/deal-room/:propertyId/checklist', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    const { data, error } = await supabase
      .from('deal_rooms')
      .select('checklist_items, workflow_pack_id, property_type')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Workspace not found' });

    // Already saved — return as-is (deterministic after first seed)
    if (Array.isArray(data.checklist_items) && data.checklist_items.length > 0) {
      const items = await scopeChecklistItemsForAccess(
        data.checklist_items,
        access,
        data.workflow_pack_id,
        data.property_type,
      );
      return res.json({ items });
    }

    // Read-time fallback for rooms created before checklist_items was populated.
    const canonical = await getCanonicalChecklist(data.workflow_pack_id, data.property_type);
    if (canonical) {
      const items = canonical.map((d, i) => ({
        id:         d.id || d.section,
        section:    d.section,
        label:      d.label,
        required:   !!d.required,
        ai:         !!d.ai,
        assignedTo: Array.isArray(d.assignedTo) ? d.assignedTo : [],
        category:   d.category || 'General',
        isCustom:   false,
        sortOrder:  i,
        status:     'missing',
      }));
      const scopedItems = await scopeChecklistItemsForAccess(
        items,
        access,
        data.workflow_pack_id,
        data.property_type,
      );
      return res.json({ items: scopedItems });
    }

    return res.json({ items: null });
  } catch (e) {
    console.error('[checklist GET]', e.message);
    return res.status(500).json({ error: 'Failed to load checklist' });
  }
});

app.put('/api/public/deal-room/:propertyId/checklist', async (req, res) => {
  const { propertyId } = req.params;
  const { items, ownerWriteToken } = req.body || {};

  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') {
    return accessDenied(res, 'Only the deal-room owner can edit the document checklist');
  }

  // Authorization: require the owner_write_token generated at checkout time.
  // This is a 256-bit server-generated credential delivered only through the
  // verified checkout success redirect — never user-controlled, never exposed
  // in any public GET response.  Any missing or mismatched token is a hard deny.
  if (!ownerWriteToken) {
    return res.status(403).json({ error: 'owner_write_token required' });
  }

  try {
    const { data: room, error: roomErr } = await supabase
      .from('deal_rooms')
      .select('owner_write_token')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (roomErr) throw roomErr;
    if (!room) return res.status(404).json({ error: 'Workspace not found' });

    // Constant-time-equivalent string comparison (both sides must be present and equal)
    if (!room.owner_write_token || room.owner_write_token !== ownerWriteToken) {
      return res.status(403).json({ error: 'Invalid owner token — checklist edit not authorized' });
    }

    // Light sanitisation — strip anything that isn't a plain object
    const clean = items.filter(i => i && typeof i === 'object' && !Array.isArray(i));
    const { error } = await supabase
      .from('deal_rooms')
      .update({ checklist_items: clean })
      .eq('property_id', propertyId);
    if (error) throw error;
    recalculateTransactionState(propertyId, {
      source: 'checklist_updated',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] checklist recalculation failed:', e.message));
    return res.json({ ok: true, count: clean.length });
  } catch (e) {
    console.error('[checklist PUT]', e.message);
    return res.status(500).json({ error: 'Failed to save checklist' });
  }
});

// ── Suggestion library ─────────────────────────────────────────────────────────
// Returns the static curated list of commonly-requested due-diligence documents.
// Items are labelled "suggested" or "commonly_requested" — never "required by Kontra".
const SUGGESTIONS = (() => {
  try { return require('./data/suggestions.json'); } catch { return []; }
})();

app.get('/api/suggestions', (_req, res) => {
  res.json({ suggestions: SUGGESTIONS });
});

// migration 015 already defines extraction_version as INTEGER. Keep the
// document-agent version numeric so durable processing writes work on both the
// existing schema and the additive pipeline migration.
const DOCUMENT_EXTRACTION_VERSION = 1;

async function updateDocumentProcessing(recordId, patch, legacyPatch = {}) {
  if (!recordId) return;
  const { error } = await supabase.from('deal_analyses').update(patch).eq('id', recordId);
  if (!error) return;
  // Keep the upload endpoint usable while a deployment is being rolled out
  // before migration 019 has been applied.
  if (Object.keys(legacyPatch).length > 0) {
    const { error: legacyError } = await supabase
      .from('deal_analyses')
      .update(legacyPatch)
      .eq('id', recordId);
    if (legacyError) console.warn('[document-processing] update failed:', legacyError.message);
  } else {
    console.warn('[document-processing] update failed:', error.message);
  }
}

async function documentImpact(propertyId, correlationId, beforeState = null) {
  try {
    const before = beforeState
      ? { state: beforeState, beforeReadiness: beforeState.readiness }
      : await recalculateTransactionState(propertyId, {
          correlationId,
          source: 'document_processing_before',
          evaluateTasks: false,
        });
    const after = await recalculateTransactionState(propertyId, {
      correlationId,
      source: 'document_processing_after',
      before: before.state,
    });
    return {
      before: before.beforeReadiness,
      after: after.readiness,
      overallDelta: after.readiness.overall - before.beforeReadiness.overall,
      confirmedDelta: after.readiness.confirmedCount - before.beforeReadiness.confirmedCount,
      createdTaskCount: after.createdTaskCount,
    };
  } catch (error) {
    console.warn('[document-processing] readiness recalculation failed:', error.message);
    return null;
  }
}

app.post('/api/public/deal-room/:propertyId/track-document', upload.single('file'), async (req, res) => {
  const { propertyId } = req.params;
  const { section, role } = req.body || {};
  if (!propertyId || !section) return res.status(400).json({ error: 'propertyId and section required' });
  if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED', message: 'Please choose a file before uploading.' });

  const access = await getRoomAccessContext(req, propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  // Participant uploads keep their verified invite role. Owner uploads must
  // never inherit the role query/body value: the owner credential identifies
  // the coordinator and should be reflected in document provenance.
  const effectiveRole = access.mode === 'participant'
    ? access.role
    : access.mode === 'owner'
      ? 'deal_coordinator'
      : (role || 'owner');
  if (access.mode === 'participant') {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('workflow_pack_id, property_type')
      .eq('property_id', propertyId)
      .maybeSingle();
    const assignedSections = await getAssignedSectionsForAccess(
      propertyId,
      room?.workflow_pack_id || DEFAULT_PACK_ID,
      room?.property_type || 'Multifamily',
      access,
    );
    if (!assignedSections.has(section)) {
      return accessDenied(res, 'This document section is not assigned to your role');
    }
  }

  const LIGHTWEIGHT_SECTIONS = [
    // CRE Acquisition
    'purchase_agreement', 'rent_roll', 'estoppel', 'environmental', 'survey', 'title',
    // Business Acquisition
    'loi', 'tax_returns', 'cap_table', 'contracts', 'disclosure_schedule',
    // Fundraising
    'term_sheet', 'spa',
  ];
  const SECTION_LABELS = {
    // CRE Acquisition
    purchase_agreement: 'Purchase Agreement',
    rent_roll: 'Rent Roll',
    estoppel: 'Estoppel Certificate',
    environmental: 'Environmental Report',
    survey: 'Survey / ALTA',
    title: 'Title Commitment',
    // Business Acquisition
    loi: 'Letter of Intent',
    tax_returns: 'Tax Returns',
    cap_table: 'Cap Table / Ownership',
    contracts: 'Material Contracts',
    disclosure_schedule: 'Disclosure Schedule',
    // Fundraising
    term_sheet: 'Term Sheet',
    spa: 'Stock Purchase Agreement / SAFE',
  };

  try {
    const buf = req.file?.buffer;
    const mime = req.file?.mimetype;
    const hash = buf ? crypto.createHash('sha256').update(buf).digest('hex') : null;

    // Check seal status first — post-completion uploads bypass section validation.
    // Uploads after sealed_at become post-completion records, shown separately from
    // sealed documents. They do NOT modify or regenerate the Transaction Seal.
    const { data: sealCheckRoom } = await supabase
      .from('deal_rooms').select('sealed_at').eq('property_id', propertyId).maybeSingle();
    const isPostCompletion = !!(sealCheckRoom?.sealed_at);

    // Custom workspace packs may define arbitrary non-AI document sections
    // (for example `loi`, `nda`, or `property_title`). Treat those sections
    // like the built-in lightweight path instead of requiring a nonexistent
    // pack-specific AI endpoint.
    let customDocumentIsLightweight = false;
    if (!isPostCompletion) {
      const { data: roomPack } = await supabase
        .from('deal_rooms')
        .select('workflow_pack_id')
        .eq('property_id', propertyId)
        .maybeSingle();
      if (roomPack?.workflow_pack_id?.startsWith('ws_')) {
        const { data: customPack } = await supabase
          .from('custom_workflow_packs')
          .select('config')
          .eq('id', roomPack.workflow_pack_id)
          .maybeSingle();
        const customDocument = (customPack?.config?.documents || []).find(
          (document) => (document?.section || document?.id) === section,
        );
        customDocumentIsLightweight = customDocument?.ai !== true;
      }
    }

    // Section validation — only enforced for pre-completion uploads.
    // Post-completion uploads accept any section label; they bypass AI analysis.
    if (!isPostCompletion && !LIGHTWEIGHT_SECTIONS.includes(section) && !customDocumentIsLightweight) {
      return res.status(400).json({ error: `Section '${section}' requires AI analysis — use the AI upload endpoint instead` });
    }

    // Label: use the section map if known, otherwise humanize the raw section key.
    const sectionLabel = SECTION_LABELS[section]
      || section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const filename = req.file?.originalname || `${section}.pdf`;
    const correlationId = crypto.randomUUID();

    // Re-uploading a completed or currently-running source is idempotent.
    // A failed source can be retried by uploading it again, preserving the
    // original failure row and its audit trail.
    let isRetry = false;
    if (hash && !isPostCompletion) {
      const { data: duplicate } = await supabase
        .from('deal_analyses')
        .select('id, section, filename, processing_status, analysis')
        .eq('property_id', propertyId)
        .eq('source_hash', hash)
        .in('processing_status', ['uploaded', 'processing', 'retrying', 'extracted'])
        .maybeSingle();
      if (duplicate) {
        return res.json({
          ok: true,
          duplicate: true,
          section: duplicate.section,
          filename: duplicate.filename,
          pending: ['uploaded', 'processing', 'retrying'].includes(duplicate.processing_status),
          processing_status: duplicate.processing_status,
          analysis: duplicate.analysis || null,
        });
      }
      const { data: failedDuplicate } = await supabase
        .from('deal_analyses')
        .select('id')
        .eq('property_id', propertyId)
        .eq('source_hash', hash)
        .eq('processing_status', 'failed')
        .maybeSingle();
      isRetry = !!failedDuplicate;
    }

    // Keep the record pending until any document analysis and transaction-field
    // extraction have both completed.
    const hasAiPrompt = !isPostCompletion && !!(buf && LIGHTWEIGHT_AI_PROMPTS[section]);
    const needsTransactionExtraction = !isPostCompletion && !!buf;
    const initialProcessingStatus = hasAiPrompt || needsTransactionExtraction
      ? (isRetry ? 'retrying' : 'uploaded')
      : 'extracted';
    const initialAnalysis = hasAiPrompt || needsTransactionExtraction
      ? {
          summary: `${sectionLabel} uploaded — AI analysis in progress…`,
          documentType: sectionLabel, confidence: 0, pending: true,
          processing_status: initialProcessingStatus, correlation_id: correlationId,
        }
      : { summary: `${sectionLabel} received and logged.`, documentType: sectionLabel, confidence: 100, pending: false };

    const insertAnalysis = async () => {
      const full = await supabase.from('deal_analyses').insert({
        property_id: propertyId, section, filename,
        analysis: initialAnalysis,
        uploaded_by_role: effectiveRole,
        source_hash: hash,
        extraction_version: hasAiPrompt || needsTransactionExtraction ? DOCUMENT_EXTRACTION_VERSION : null,
        processing_status: initialProcessingStatus,
        processing_attempt: 0,
        correlation_id: correlationId,
        ...(initialProcessingStatus === 'extracted' ? { processing_completed_at: new Date().toISOString() } : {}),
        ...(isPostCompletion ? { post_completion: true, post_completion_added_at: new Date().toISOString() } : {}),
      }).select('id').single();
      if (!full.error) return full;
      const legacy = await supabase.from('deal_analyses').insert({
        property_id: propertyId, section, filename,
        analysis: initialAnalysis,
        uploaded_by_role: effectiveRole,
        ...(isPostCompletion ? { post_completion: true, post_completion_added_at: new Date().toISOString() } : {}),
      }).select('id').single();
      return legacy;
    };

    const [storagePath, insertRes] = await Promise.all([
      buf ? uploadToStorage(buf, mime, propertyId, section, filename).catch(() => null) : Promise.resolve(null),
      insertAnalysis(),
    ]);
    if (insertRes.error) throw insertRes.error;
    const recordId = insertRes.data?.id;

    logEvent(propertyId, 'document_uploaded', effectiveRole, null, `${sectionLabel} uploaded`, { section, filename, post_completion: isPostCompletion || undefined }).catch(() => {});
    res.json({
      ok: true, section, filename,
      pending: hasAiPrompt || needsTransactionExtraction,
      processing_status: initialProcessingStatus,
      correlation_id: correlationId,
    });

    if (recordId && (hasAiPrompt || needsTransactionExtraction)) {
      updateDocumentProcessing(recordId, {
        processing_status: 'processing',
        processing_attempt: 1,
        processing_started_at: new Date().toISOString(),
        correlation_id: correlationId,
      }, { analysis: initialAnalysis, storage_path: storagePath }).catch(() => {});
      emitInternalEvent('document.processing', {
        propertyId, documentId: recordId, section, filename,
        processingStatus: initialProcessingStatus, correlationId,
      }, { correlationId, source: 'document-agent', actorId: access.actorId, actorType: access.actorType });
    }

    // ── Background field extraction for non-AI-prompt sections ──────────────
    // LOI, Tax Returns, Cap Table, Contracts, Disclosure Schedule, Term Sheet,
    // and Stock Purchase Agreement do not have section-specific AI analysis
    // prompts, so they would never populate transaction_record_fields without
    // this secondary extraction pass. This is what makes the Overview, Snapshot,
    // and Digital Asset Readiness update after a coordinator uploads an LOI.
    if (buf && !LIGHTWEIGHT_AI_PROMPTS[section] && recordId) {
      (async () => {
        let extractionResult = { savedCount: 0 };
        let beforeState = null;
        try {
          beforeState = (await recalculateTransactionState(propertyId, {
            correlationId,
            source: 'document_processing_before',
            evaluateTasks: false,
          })).state;
          let text = '';
          const ext = (filename || '').split('.').pop().toLowerCase();
          const isPdf = mime === 'application/pdf' || ext === 'pdf' || (buf.length > 4 && buf.slice(0, 4).toString() === '%PDF');
          if (isPdf) {
            try {
              const { PDFParse } = require('pdf-parse');
              const parser = new PDFParse({ data: buf });
              const parsed = await parser.getText();
              text = (parsed?.text || '').slice(0, 12000);
            } catch {}
          } else if (mime === 'text/csv' || ext === 'csv') {
            text = buf.toString('utf8').slice(0, 12000);
          } else if (['xlsx','xls'].includes(ext) || (mime || '').includes('spreadsheet') || (mime || '').includes('excel')) {
            try {
              const XLSX = require('xlsx');
              const wb = XLSX.read(buf, { type: 'buffer' });
              const rows = [];
              for (const name of wb.SheetNames.slice(0, 6)) {
                const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
                if (csv.replace(/,/g,'').replace(/\n/g,'').trim().length > 10) rows.push(`[${name}]\n${csv}`);
              }
              text = rows.join('\n\n').slice(0, 12000);
            } catch {}
          } else {
            text = buf.toString('utf8', 0, Math.min(buf.length, 10000)).replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim();
          }
          if (text && text.trim().length > 50) {
            extractionResult = await extractTransactionFields(propertyId, recordId, text, SECTION_LABELS[section] || section);
            console.log(`[track-document] ✓ transaction fields extracted from ${section} (non-AI-prompt path)`);
          }
        } catch (extractErr) {
          console.warn(`[track-document] field extraction failed for ${section}:`, extractErr.message);
        }
        const impact = await documentImpact(propertyId, correlationId, beforeState);
        const completedAnalysis = extractionResult.savedCount > 0
          ? { summary: `${sectionLabel} received and transaction facts extracted.`, documentType: sectionLabel, confidence: 100, pending: false }
          : { summary: `${sectionLabel} received and logged.`, documentType: sectionLabel, confidence: 100, pending: false };
        await updateDocumentProcessing(recordId, {
          analysis: { ...completedAnalysis, processing_status: 'extracted', processing_impact: impact },
          storage_path: storagePath,
          processing_status: 'extracted',
          extraction_version: DOCUMENT_EXTRACTION_VERSION,
          correlation_id: correlationId,
          failure_reason: null,
          processing_completed_at: new Date().toISOString(),
        }, { analysis: { ...completedAnalysis, processing_impact: impact }, storage_path: storagePath });
        emitInternalEvent('document.extracted', {
          propertyId, documentId: recordId, section, filename,
          extractedFieldCount: extractionResult.savedCount || 0,
          impact, correlationId,
        }, { correlationId, source: 'document-agent', actorId: access.actorId, actorType: access.actorType });
      })().catch(() => {});
    }

    // Background AI analysis — uses fast text-only extraction (no vision pipeline to avoid hangs)
    if (buf && LIGHTWEIGHT_AI_PROMPTS[section]) {
      const bgJob = (async () => {
        const clearPending = async (analysis) => {
          if (!recordId) return;
          const impact = await documentImpact(propertyId, correlationId, beforeState);
          await updateDocumentProcessing(recordId, {
            analysis: { ...analysis, pending: false, processing_status: 'extracted', processing_impact: impact },
            storage_path: storagePath,
            processing_status: 'extracted',
            extraction_version: DOCUMENT_EXTRACTION_VERSION,
            correlation_id: correlationId,
            failure_reason: null,
            processing_completed_at: new Date().toISOString(),
          }, { analysis: { ...analysis, pending: false, processing_impact: impact }, storage_path: storagePath });
          emitInternalEvent('document.extracted', {
            propertyId, documentId: recordId, section, filename, impact, correlationId,
          }, { correlationId, source: 'document-agent', actorId: access.actorId, actorType: access.actorType });
        };
        let beforeState = null;
        try {
          beforeState = (await recalculateTransactionState(propertyId, {
            correlationId,
            source: 'document_processing_before',
            evaluateTasks: false,
          })).state;
          // Fast text extraction — skips vision pipeline to avoid hangs
          let text = '';
          let isPdf = false;
          try {
            const ext = (filename || '').split('.').pop().toLowerCase();
            isPdf = mime === 'application/pdf' || ext === 'pdf' || buf.slice(0,4).toString() === '%PDF';
            if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('ms-excel') || ['xlsx','xls','xlsm','xlsb'].includes(ext)) {
              const XLSX = require('xlsx');
              const wb = XLSX.read(buf, { type: 'buffer' });
              const rows = [];
              for (const name of wb.SheetNames.slice(0, 8)) {
                const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
                if (csv.replace(/,/g,'').replace(/\n/g,'').trim().length > 20) rows.push(`[Sheet: ${name}]\n${csv}`);
              }
              text = rows.join('\n\n').slice(0, 15000);
            } else if (mime === 'text/csv' || ext === 'csv') {
              text = buf.toString('utf8').slice(0, 15000);
            } else if (isPdf) {
              // Fast path: pure-JS pdf-parse v2 (PDFParse class API — no system binary, works on Render)
              try {
                const { PDFParse } = require('pdf-parse');
                const parser = new PDFParse({ data: buf });
                const parsed = await parser.getText();
                text = (parsed?.text || '').slice(0, 15000);
              } catch (pdfErr) {
                console.warn('[track-document] pdf-parse failed:', pdfErr.message);
                text = '';
              }
            }
            // Raw-buffer fallback only makes sense for genuinely text-based files
            // (unknown/plain-text formats). Decoding raw PDF/binary bytes produces
            // structural garbage (e.g. "obj", "stream", "endobj") that can look like
            // real text but isn't — sending it to the AI causes confusing false
            // "no content" responses instead of an honest "can't extract text" error.
            if ((!text || text.trim().length < 30) && !isPdf) {
              text = buf.toString('utf8', 0, Math.min(buf.length, 12000)).replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim();
            }
          } catch (extractErr) {
            console.warn('[track-document] text extraction error:', extractErr.message);
          }

          const prompt = LIGHTWEIGHT_AI_PROMPTS[section];
          // Some scanned PDFs still produce "text" from pdf-parse — but it's just
          // page-separator noise (e.g. "-- 1 of 62 --") with no real body content.
          // Strip that noise before judging whether we actually got usable text.
          const meaningfulText = (text || '').replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
          // No usable text layer (scanned/image-only PDF) — fall back to sending the
          // PDF directly to a vision-capable model so it can read the page images.
          // Only viable for PDFs within a sane size (larger files risk request-size
          // limits and slow/expensive vision calls).
          const needsVision = isPdf && meaningfulText.length < 30;
          if (needsVision && buf.length > 15 * 1024 * 1024) {
            throw new Error('no extractable text — this PDF appears to be scanned (image-only) or encrypted, and is too large for image analysis');
          }

          let completion;
          if (needsVision) {
            console.log(`[track-document] no text layer for ${filename} — falling back to vision analysis`);
            completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: prompt.system },
                {
                  role: 'user',
                  content: [
                    { type: 'file', file: { filename, file_data: `data:application/pdf;base64,${buf.toString('base64')}` } },
                    { type: 'text', text: prompt.user('(This PDF has no selectable text layer — it is a scanned document. Read the page images directly.)') },
                  ],
                },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.3,
            }, { timeout: 45000 });
          } else {
            if (!text || text.trim().length < 30) {
              throw new Error('insufficient text — document may be scanned or encrypted');
            }
            completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: prompt.system },
                { role: 'user', content: prompt.user(text) },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.3,
            }, { timeout: 30000 });
          }
          const result = JSON.parse(completion.choices[0].message.content);
          await extractTransactionFields(propertyId, recordId, text, SECTION_LABELS[section] || section);
          await clearPending(result);
          notifyOwner(propertyId, section, result.summary).catch(() => {});
          // Extract structured transaction record fields from the same document text
          logEvent(propertyId, 'document_analyzed', effectiveRole, null, `${SECTION_LABELS[section]} analyzed by AI`, { section, filename }).catch(() => {});
          getRoomPackId(propertyId).then(packId => runVerification(propertyId, packId)).catch(e => console.warn('[verification] trigger failed:', e.message));
          console.log(`[track-document] ✓ ${section} analyzed${needsVision ? ' (vision)' : ''} — confidence ${result.confidence}`);
        } catch (aiErr) {
          console.warn(`[track-document] AI failed for ${section}:`, aiErr.message);
          const scanned = /scanned|encrypted/i.test(aiErr.message);
          const summary = scanned
            ? `${SECTION_LABELS[section]} uploaded. This file appears to be a scanned image or password-protected PDF, so the AI couldn't read its text. Try uploading a version with selectable text (e.g. the original digital file before signing/scanning).`
            : `${SECTION_LABELS[section]} uploaded. AI could not analyze this file — it may be scanned or password-protected.`;
           await updateDocumentProcessing(recordId, {
             analysis: {
               summary, documentType: SECTION_LABELS[section], confidence: 0,
               pending: false, processing_status: 'failed',
             },
             storage_path: storagePath,
             processing_status: 'failed',
             extraction_version: DOCUMENT_EXTRACTION_VERSION,
             correlation_id: correlationId,
             failure_reason: aiErr.message,
             processing_completed_at: new Date().toISOString(),
           }, { analysis: { summary, documentType: SECTION_LABELS[section], confidence: 0, pending: false }, storage_path: storagePath });
           emitInternalEvent('document.failed', {
             propertyId, documentId: recordId, section, filename,
             failureReason: aiErr.message, correlationId,
           }, { correlationId, source: 'document-agent', actorId: access.actorId, actorType: access.actorType });
            getRoomPackId(propertyId).then(packId => runVerification(propertyId, packId)).catch(e => console.warn('[verification] trigger failed:', e.message));
        }
      });
      // Hard 50-second timeout so the record never stays "pending" forever
      Promise.race([bgJob(), new Promise((_,rej) => setTimeout(() => rej(new Error('timeout')), 50000))])
        .catch(async (err) => {
          console.warn(`[track-document] bg job timed out or failed for ${section}:`, err.message);
          if (recordId) {
            await updateDocumentProcessing(recordId, {
              analysis: {
                summary: `${SECTION_LABELS[section]} uploaded. Analysis timed out — try re-uploading.`,
                documentType: SECTION_LABELS[section], confidence: 0, pending: false,
                processing_status: 'failed',
              },
              storage_path: storagePath,
              processing_status: 'failed',
              extraction_version: DOCUMENT_EXTRACTION_VERSION,
              correlation_id: correlationId,
              failure_reason: err.message,
              processing_completed_at: new Date().toISOString(),
            }, { analysis: { summary: `${SECTION_LABELS[section]} uploaded. Analysis timed out — try re-uploading.`, documentType: SECTION_LABELS[section], confidence: 0, pending: false }, storage_path: storagePath }).catch(() => {});
            emitInternalEvent('document.failed', {
              propertyId, documentId: recordId, section, filename,
              failureReason: err.message, correlationId,
            }, { correlationId, source: 'document-agent', actorId: access.actorId, actorType: access.actorType });
            getRoomPackId(propertyId).then(packId => runVerification(propertyId, packId)).catch(e => console.warn('[verification] trigger failed:', e.message));
          }
        });
    }
  } catch (err) {
    console.error('[track-document]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Signed download URL for a stored document ─────────────────────────────────
// ── Authenticated document download ──────────────────────────────────────────
// Requires owner auth (Authorization: Bearer <supabase-jwt>) OR a valid
// participant session (x-kontra-session: <token>).  Derives propertyId from
// the storage path (first segment: {propertyId}/{filename}) and validates
// access before issuing a short-lived signed URL.
app.get('/api/public/document-url', async (req, res) => {
  const storagePath = (req.query.path || '').trim();
  if (!storagePath) return res.status(400).json({ error: 'path required' });

  // Extract propertyId from path — must be first segment
  const propertyId = storagePath.split('/')[0];
  if (!propertyId) return res.status(400).json({ error: 'invalid storage path' });

  const bearerJwt    = (req.headers.authorization || '').replace(/^Bearer /i, '').trim() || null;
  const sessionToken = (req.headers['x-kontra-session'] || '').trim() || null;

  if (!bearerJwt && !sessionToken) {
    return res.status(401).json({ error: 'Authentication required to download documents' });
  }

  try {
    let authorized = false;

    if (bearerJwt) {
      // Owner path: verify JWT → check customer_email matches the deal room
      const { data: { user }, error: authErr } = await supabase.auth.getUser(bearerJwt);
      if (!authErr && user?.email) {
        const { data: room } = await supabase
          .from('deal_rooms')
          .select('customer_email')
          .eq('property_id', propertyId)
          .single();
        if (room && room.customer_email?.toLowerCase() === user.email.toLowerCase()) {
          authorized = true;
        }
      }
    }

    if (!authorized && sessionToken) {
      // The legacy session table is keyed by invite_id, not property_id.
      // Resolve the invite after the token lookup so document downloads work
      // against the Production schema from migration 011.
      const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      const { data: sess } = await supabase
        .from('deal_room_access_sessions')
        .select('id, invite_id')
        .eq('session_token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .is('revoked_at', null)
        .maybeSingle();
      if (sess?.invite_id) {
        const { data: invite } = await supabase
          .from('deal_room_invites')
          .select('property_id, status')
          .eq('id', sess.invite_id)
          .maybeSingle();
        authorized = invite?.property_id === propertyId
          && !['revoked', 'expired'].includes(String(invite.status || '').toLowerCase());
      }
    }

    if (!authorized) return res.status(403).json({ error: 'Access denied' });

    const { data, error } = await supabase.storage
      .from('deal-documents')
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) return res.status(404).json({ error: 'Document not found or expired' });
    res.json({ url: data.signedUrl });
  } catch (err) {
    console.error('[document-url]', err.message);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
});

// ── Deal Coordination — party submissions & lifecycle stage ───────────────

app.get('/api/public/deal-room/:propertyId/coordination', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    const [roomRes, submissionsRes, analysesRes, invitesRes] = await Promise.all([
      supabase.from('deal_rooms').select('deal_stage, property_name').eq('property_id', propertyId).maybeSingle(),
      supabase.from('party_submissions').select('*').eq('property_id', propertyId),
      supabase.from('deal_analyses').select('uploaded_by_role').eq('property_id', propertyId),
      supabase.from('deal_room_invites')
        .select('role_key, status, last_used_at, expires_at, revoked_at')
        .eq('property_id', propertyId),
    ]);
    const stage = roomRes.data?.deal_stage || 'uploading';
    const allSubmissions = submissionsRes.data || [];
    const submissions = access.mode === 'participant'
      ? allSubmissions.filter(s => s.role === access.role)
      : allSubmissions;
    const safeSubmissions = submissions.map(({ email, ...submission }) => submission);
    const docsByRole = {};
    (analysesRes.data || []).forEach(a => {
      if (a.uploaded_by_role && (access.mode !== 'participant' || a.uploaded_by_role === access.role)) {
        docsByRole[a.uploaded_by_role] = (docsByRole[a.uploaded_by_role] || 0) + 1;
      }
    });
    const participantInvites = (invitesRes.data || []).filter(invite =>
      access.mode !== 'participant' || invite.role_key === access.role
    );
    res.set('Cache-Control', 'no-store');
    res.json({
      stage,
      submissions: safeSubmissions,
      parties: safeSubmissions,
      docsByRole,
      participantInvites,
    });
  } catch (err) {
    console.error('[coordination]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/public/deal-room/:propertyId/submit', async (req, res) => {
  const { propertyId } = req.params;
  const { role, name, email, notes } = req.body || {};
  if (!role) return res.status(400).json({ error: 'role required' });
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    const effectiveRole = access.mode === 'participant' ? access.role : role;
    const { count } = await supabase
      .from('deal_analyses')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('uploaded_by_role', effectiveRole);
    const { error } = await supabase.from('party_submissions').upsert({
      property_id: propertyId,
      role: effectiveRole,
      name: name || effectiveRole,
      email: email || null,
      doc_count: count || 0,
      submitted_at: new Date().toISOString(),
      notes: notes || null,
    }, { onConflict: 'property_id,role' });
    if (error) throw error;
    const packId = await getRoomPackId(propertyId);
    const roleLabel = getPackRoleLabel(packId, effectiveRole);
    logEvent(propertyId, 'party_submitted', effectiveRole, name || effectiveRole, `${name || roleLabel} signaled ready`, { role: effectiveRole });
    notifyPartySubmitted(propertyId, effectiveRole, name).catch(() => {});
    recalculateTransactionState(propertyId, {
      source: 'participant_submitted',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] submission recalculation failed:', e.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('[submit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Send role-scoped invite email ────────────────────────────────────────────
app.post('/api/public/deal-room/:propertyId/invite', async (req, res) => {
  const { propertyId } = req.params;
  const { role, email, senderName } = req.body || {};
  if (!role || !email) return res.status(400).json({ error: 'role and email required' });
  if (!email.includes('@')) return res.status(400).json({ error: 'invalid email' });
  const access = await getRoomAccessContext(req, propertyId);
  if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can invite participants');
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' });
  try {
    const { data: room } = await supabase.from('deal_rooms')
      .select('property_name, first_name, customer_email, workflow_pack_id')
      .eq('property_id', propertyId).single();
    const propName = room?.property_name || propertyId;
    const fromName = senderName || room?.first_name || 'The deal coordinator';
    const packId = room?.workflow_pack_id || DEFAULT_PACK_ID;
    const roleConfig = getPackRoleConfig(packId).roles.find(r => r.key === role);
    const roleLabel = roleConfig?.label || role;
    const roleAction = roleConfig?.inviteAction || 'access the deal room';
    const inviteUrl = `${FRONTEND_URL}/deal-room/${propertyId}?role=${role}`;
    await sendResendEmail(RESEND_KEY, {
      from: 'Kontra <notifications@kontraplatform.com>',
      to: email,
      reply_to: 'support@kontraplatform.com',
      subject: `You've been invited to a deal room — ${propName}`,
      text: `You've been invited to a deal room on Kontra\n\n${fromName} has added you as ${roleLabel} to their deal room for ${propName}.\n\nYour role: ${roleAction}. No account required.\n\nOpen your deal room:\n${inviteUrl}\n\n---\nKontra is a transaction workspace platform. All parties upload documents, AI analyzes them instantly, and the deal coordinator sees everything in one place.\n\nYou received this because ${fromName} added your email to this workspace. If this is a mistake, you can safely ignore it.`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px 24px">
        <div style="margin-bottom:24px">
          <span style="display:inline-block;background:#800020;color:white;font-weight:800;font-size:15px;padding:6px 14px;border-radius:8px;letter-spacing:0.5px">Kontra</span>
        </div>
        <h2 style="color:#111;font-size:22px;font-weight:800;margin:0 0 8px">You've been invited</h2>
        <p style="color:#555;font-size:15px;margin:0 0 6px"><strong>${fromName}</strong> has added you as <strong>${roleLabel}</strong> to their deal room for <strong>${propName}</strong>.</p>
        <p style="color:#555;font-size:14px;margin:0 0 24px">Your role: ${roleAction}. No account required — click below to access your role-scoped view.</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;background:#800020;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Open Deal Room →</a>
        <div style="margin-top:28px;padding:16px;background:#f9fafb;border-radius:10px;border:1px solid #eee">
          <p style="color:#888;font-size:12px;margin:0 0 4px">What is Kontra?</p>
          <p style="color:#555;font-size:13px;margin:0">Kontra is a transaction workspace platform. All parties upload their documents, AI analyzes them instantly, and the deal coordinator sees everything in one place. No email chains required.</p>
        </div>
        <p style="color:#bbb;font-size:11px;margin-top:24px">You received this because ${fromName} added your email to this deal room. If this is a mistake, you can safely ignore it.</p>
      </div>`,
    });
    logEvent(propertyId, 'invite_sent', 'owner', senderName || null, `${roleLabel} invited: ${email}`, { role, email });
    res.json({ ok: true });
  } catch (err) {
    console.error('[invite]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Create a v1 invite record server-side (bypasses RLS) ─────────────────────
// The Supabase RPC create_deal_room_invite requires auth.email() from a
// Supabase session, which owners don't always have. This endpoint uses the
// service-role client to insert directly and then sends the invite email.
app.post('/api/public/deal-room/:propertyId/create-invite', async (req, res) => {
  const { propertyId } = req.params;
  const { roleKey, invitedEmail, inviteToken, pin, verificationMethod = 'link' } = req.body || {};
  if (!roleKey || !inviteToken) return res.status(400).json({ error: 'roleKey and inviteToken required' });
  const access = await getRoomAccessContext(req, propertyId);
  if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can create invitations');

  const tokenHash = crypto.createHash('sha256').update(inviteToken.trim()).digest('hex');
  const pinHash   = pin ? crypto.createHash('sha256').update(pin.trim()).digest('hex') : null;

  try {
    const { error: insertErr } = await supabase.from('deal_room_invites').insert({
      property_id:         propertyId,
      role_key:            roleKey,
      invited_email:       invitedEmail || null,
      invite_token_hash:   tokenHash,
      verification_method: verificationMethod,
      pin_hash:            pinHash,
      status:              'pending',
    });
    if (insertErr) {
      if (insertErr.code === '23505') return res.status(409).json({ error: 'token_conflict' });
      return res.status(500).json({ error: insertErr.message });
    }

    // Auto-send email if recipient provided and Resend is configured
    let emailSent = false;
    if (invitedEmail && process.env.RESEND_API_KEY) {
      try {
        const { data: room } = await supabase.from('deal_rooms')
          .select('property_name, first_name, workflow_pack_id').eq('property_id', propertyId).single();
        const propName  = room?.property_name || propertyId;
        const fromName  = room?.first_name || 'The deal coordinator';
        const packId    = room?.workflow_pack_id || DEFAULT_PACK_ID;
        const roleConf  = getPackRoleConfig(packId).roles.find(r => r.key === roleKey);
        const roleLabel = roleConf?.label || roleKey;
        const inviteUrl = `${FRONTEND_URL}/deal-room/${propertyId}?invite=${inviteToken}&role=${roleKey}`;
        await sendResendEmail(process.env.RESEND_API_KEY, {
          from: 'Kontra <notifications@kontraplatform.com>',
          to: invitedEmail,
          reply_to: 'support@kontraplatform.com',
          subject: `You've been invited to a deal room — ${propName}`,
          text: `${fromName} has added you as ${roleLabel} to their deal room for ${propName}.\n\nOpen your deal room:\n${inviteUrl}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px 24px">
            <div style="margin-bottom:20px"><span style="background:#800020;color:#fff;font-weight:800;font-size:15px;padding:6px 14px;border-radius:8px;display:inline-block">Kontra</span></div>
            <h2 style="color:#111;font-size:22px;font-weight:800;margin:0 0 8px">You've been invited</h2>
            <p style="color:#555;font-size:15px;margin:0 0 6px"><strong>${fromName}</strong> has added you as <strong>${roleLabel}</strong> to their deal room for <strong>${propName}</strong>.</p>
            <p style="color:#555;font-size:14px;margin:0 0 24px">Click below to access your role-scoped view. No account required.</p>
            <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;background:#800020;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Open Deal Room →</a>
            <p style="color:#bbb;font-size:11px;margin-top:24px">You received this because ${fromName} added your email. If this is a mistake, ignore it.</p>
          </div>`,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error('[create-invite] email send failed:', emailErr.message);
      }
    }

    logEvent(propertyId, 'invite_created', 'owner', null, `${roleKey} invited: ${invitedEmail || 'PIN-only'}`, { roleKey, invitedEmail });
    res.json({ success: true, emailSent });
  } catch (err) {
    console.error('[create-invite]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── List invites for a room (owner auth via ownerWriteToken) ─────────────────
app.get('/api/public/deal-room/:propertyId/invites', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can list invitations');
    const { data, error } = await supabase
      .from('deal_room_invites')
      .select('id, role_key, invited_email, status, verification_method, created_at, last_used_at, expires_at, revoked_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ invites: data || [] });
  } catch (e) {
    console.error('[invites GET]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ── Token-only invite verification (link-auth flow) ───────────────────────────
// For invites created with verification_method='link', the raw invite token in
// the URL IS the credential. No PIN needed. This endpoint validates the token,
// checks invite status, creates a short-lived access session, and returns the
// session token. The session is then stored client-side and sent as
// x-kontra-session on all subsequent requests.
app.post('/api/public/deal-room/:propertyId/invite/verify-link', async (req, res) => {
  const { propertyId } = req.params;
  const { inviteToken } = req.body || {};
  if (!inviteToken) return res.status(400).json({ error: 'inviteToken required' });

  const tokenHash = crypto.createHash('sha256').update(inviteToken.trim()).digest('hex');
  try {
    const { data: invite, error: findErr } = await supabase
      .from('deal_room_invites')
      .select('id, property_id, role_key, status, verification_method, expires_at, locked_until')
      .eq('invite_token_hash', tokenHash)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!invite)                                              return res.status(404).json({ error: 'not_found' });
    if (invite.property_id !== propertyId)                   return res.status(403).json({ error: 'wrong_room' });
    if (invite.status === 'revoked')                         return res.status(403).json({ error: 'revoked' });
    if (invite.status === 'expired')                         return res.status(403).json({ error: 'expired' });
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return res.status(403).json({ error: 'expired' });
    if (invite.locked_until && new Date(invite.locked_until) > new Date()) return res.status(403).json({ error: 'locked', locked_until: invite.locked_until });

    // Only allow token-only verification for link-auth invites.
    // PIN-based invites must use the Supabase RPC verify_invite_credential.
    if (invite.verification_method !== 'link') {
      return res.status(400).json({ error: 'requires_pin', message: 'This invitation requires a PIN. Use the PIN verification flow.' });
    }

    // Create a 7-day access session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionHash  = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: sessionErr } = await supabase.from('deal_room_access_sessions').insert({
      invite_id:          invite.id,
      session_token_hash: sessionHash,
      expires_at:         expiresAt,
    });
    if (sessionErr) throw sessionErr;

    // Mark invite as accepted so the People tab shows the right status
    await supabase.from('deal_room_invites').update({ status: 'accepted', last_used_at: new Date().toISOString() }).eq('id', invite.id);

    logEvent(propertyId, 'participant_authenticated', invite.role_key, null, `${invite.role_key} accessed via invite link`).catch(() => {});
    return res.json({ success: true, session_token: sessionToken, expires_at: expiresAt, role_key: invite.role_key });
  } catch (e) {
    console.error('[verify-link]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ── Send an invite-link email (used by the per-invitation invite panel) ───────
// This endpoint does NOT create the invite record — the client does that via
// Supabase RPC. It only sends the email after the record is created.
// ── Send invite-link email — owner-authenticated, content derived server-side ─
// The client sends ONLY the raw invite token + its own Supabase Auth JWT.
// This endpoint hashes the token to look up the invite, verifies the caller
// owns the deal room, then derives all email content (recipient, role, property)
// from the database.  The client is never trusted for to/url/labels.
app.post('/api/public/deal-room/send-invite-email', async (req, res) => {
  // 1. Accept either a Supabase Bearer JWT or a room-scoped owner_write_token.
  //    This allows owners who are not signed in to Supabase to still trigger emails.
  const authHeader = req.headers.authorization || '';
  const bearerJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  // 2. Accept only the raw invite token from the client — nothing else is trusted
  const { inviteToken, ownerWriteToken } = req.body || {};
  if (!inviteToken || typeof inviteToken !== 'string' || inviteToken.length < 32) {
    return res.status(400).json({ error: 'inviteToken required' });
  }

  if (!bearerJwt && !ownerWriteToken) {
    return res.status(401).json({ error: 'Owner authentication required' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' });

  try {
    // 3. Look up invite by hashed token — never trust the token at face value
    const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');
    const { data: invite, error: inviteErr } = await supabase
      .from('deal_room_invites')
      .select('id, property_id, invited_email, role_key, status')
      .eq('token_hash', tokenHash)
      .single();
    if (inviteErr || !invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.status === 'revoked') return res.status(400).json({ error: 'Invite is revoked' });
    if (!invite.invited_email) return res.status(400).json({ error: 'This invite has no email recipient (PIN-only)' });

    // 4. Verify caller is the deal room owner.
    //    Path A — Supabase JWT: caller email must match deal_rooms.customer_email.
    //    Path B — owner_write_token: token must match deal_rooms.owner_write_token
    //             (generated at checkout, never exposed in public GET responses).
    const { data: room, error: roomErr } = await supabase
      .from('deal_rooms')
      .select('property_name, first_name, workflow_pack_id, customer_email, owner_write_token')
      .eq('property_id', invite.property_id)
      .single();
    if (roomErr || !room) return res.status(404).json({ error: 'Deal room not found' });

    let authorized = false;

    if (bearerJwt) {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(bearerJwt);
      if (!authErr && user?.email) {
        authorized = (room.customer_email || '').toLowerCase() === user.email.toLowerCase();
      }
    }

    if (!authorized && ownerWriteToken) {
      // Constant-time-equivalent comparison — both sides must be present and match
      authorized = !!(room.owner_write_token && room.owner_write_token === ownerWriteToken);
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Not authorized for this deal room' });
    }

    // 5. Derive all email content from verified DB data — nothing from client
    const packId     = room.workflow_pack_id || DEFAULT_PACK_ID;
    const roleConfig = getPackRoleConfig(packId).roles.find(r => r.key === invite.role_key);
    const roleLabel  = roleConfig?.label || invite.role_key;
    const propName   = room.property_name || invite.property_id;
    const senderName = room.first_name || 'The deal coordinator';
    const inviteUrl  = `${FRONTEND_URL}/deal-room/${invite.property_id}?invite=${inviteToken}&role=${invite.role_key}`;
    const to         = invite.invited_email;

    await sendResendEmail(RESEND_KEY, {
      from: 'Kontra <notifications@kontraplatform.com>',
      to,
      reply_to: 'support@kontraplatform.com',
      subject: `You've been invited to ${propName} — Kontra Deal Room`,
      text: `${senderName} has invited you as ${roleLabel} to a deal room for ${propName} on Kontra.\n\nClick your personal invite link below:\n${inviteUrl}\n\nThis link is unique to you — do not forward it.\n\n---\nKontra is a transaction workspace platform. You received this because ${senderName} added your email. If this is a mistake, ignore this email.`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px 24px">
        <div style="margin-bottom:24px">
          <span style="display:inline-block;background:#800020;color:white;font-weight:800;font-size:15px;padding:6px 14px;border-radius:8px;letter-spacing:0.5px">Kontra</span>
        </div>
        <h2 style="color:#111;font-size:22px;font-weight:800;margin:0 0 8px">You've been invited</h2>
        <p style="color:#555;font-size:15px;margin:0 0 6px"><strong>${senderName}</strong> has invited you as <strong>${roleLabel}</strong> to the deal room for <strong>${propName}</strong>.</p>
        <p style="color:#555;font-size:14px;margin:0 0 24px">Click your personal invite link below. You will be asked for a 6-digit PIN — the deal coordinator will share it with you separately (by phone, text, or in person).</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;background:#800020;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Open my invite →</a>
        <div style="margin-top:20px;padding:12px 16px;background:#fef9f0;border-radius:10px;border:1px solid #fde68a">
          <p style="color:#92400e;font-size:12px;margin:0">🔒 This link is unique to you — do not forward it. Your PIN is delivered separately. Both are required to enter the deal room.</p>
        </div>
        <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:10px;border:1px solid #eee">
          <p style="color:#888;font-size:12px;margin:0 0 4px">What is Kontra?</p>
          <p style="color:#555;font-size:13px;margin:0">CRE deal room infrastructure. All parties upload documents, AI analyzes them instantly, and the deal coordinator sees everything in one place.</p>
        </div>
        <p style="color:#bbb;font-size:11px;margin-top:24px">You received this because ${senderName} added your email. If this is a mistake, ignore this email.</p>
      </div>`,
    });

    logEvent(invite.property_id, 'invite_email_sent', 'owner', senderName, `Invite email sent to ${to} for role ${roleLabel}`, { role: invite.role_key });
    res.json({ ok: true });
  } catch (err) {
    console.error('[send-invite-email]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/public/deal-room/:propertyId/advance', async (req, res) => {
  const { propertyId } = req.params;
  const { stage, ownerWriteToken } = req.body || {};
  try {
    const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
    if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can advance stages');
    const { data: room, error: fetchError } = await supabase
      .from('deal_rooms')
      .select('workflow_pack_id, deal_stage, stages_config, metadata_values, settlement_mode')
      .eq('property_id', propertyId)
      .single();
    if (fetchError) throw fetchError;
    const packId = room?.workflow_pack_id || DEFAULT_PACK_ID;

    // Derive the effective ordered stage list from custom config or pack defaults.
    // This is the single source of truth for both validation and milestone detection.
    const effectiveStages = Array.isArray(room?.stages_config) && room.stages_config.length >= 2
      ? room.stages_config
      : getPackStageConfig(packId).stages;

    // Extend valid stages with settlement/complete when settlement capability is on.
    const settlementCapableAdv = roomHasSettlementCapability(room);
    const alreadyHasSettlement = effectiveStages.some(s => s.key === 'settlement' || s.key === 'complete');

    // When settlement is enabled, 'funded' is a backward-compat milestone, not a
    // lifecycle stage. Remove it from the stage list so new rooms advance:
    //   closing → settlement → complete   (not closing → funded → settlement → complete).
    // A legacy room already at deal_stage='funded' can still advance to 'settlement'
    // because that key is included in VALID below.
    const stagesForValidation = (settlementCapableAdv && !alreadyHasSettlement)
      ? effectiveStages.filter(s => s.key !== 'funded')
      : effectiveStages;

    const VALID = [
      ...stagesForValidation.map(s => s.key),
      ...(settlementCapableAdv && !alreadyHasSettlement ? ['settlement', 'complete'] : []),
    ];

    // Block direct advancement to 'complete' — must use POST /settlement/complete.
    // That endpoint validates all conditions, creates the Transaction Seal, and
    // advances the stage atomically via a PostgreSQL RPC transaction.
    if (stage === 'complete') {
      return res.status(400).json({
        error: 'COMPLETE_GATE',
        message: 'Cannot advance directly to "complete". Use POST /settlement/complete after all settlement conditions are verified. That endpoint creates the Transaction Seal and advances the stage atomically.',
        advancementEndpoint: `/api/public/deal-room/${propertyId}/settlement/complete`,
      });
    }

    if (!VALID.includes(stage)) return res.status(400).json({ error: 'invalid stage' });

    // Resolve the display label for the incoming stage key.
    // Custom stages may have owner-supplied labels; pack stages use the JSON label.
    const allKnownStages = [...stagesForValidation, ...(settlementCapableAdv && !alreadyHasSettlement ? [{ key: 'settlement', label: 'Settlement' }, { key: 'complete', label: 'Complete' }] : [])];
    const incomingStageObj = allKnownStages.find(s => s.key === stage);
    const stageLabel = incomingStageObj?.label || stage;

    // Position-based milestone detection — independent of fixed key names.
    // Uses the full effective sequence (with settlement/complete when capable).
    // last stage = "funded equivalent" → seal + VAP + close record
    // second-to-last stage = "closing equivalent" → preview VAP, no seal
    // Note: 'complete' is always blocked by COMPLETE_GATE above, so the
    // lastStageKey milestone logic is effectively dead for settlement rooms,
    // but milestone detection uses secondToLastStageKey (→ 'settlement') for
    // the preview-VAP trigger.
    const fullEffectiveStages = allKnownStages;
    const lastStageKey        = fullEffectiveStages[fullEffectiveStages.length - 1].key;
    const secondToLastStageKey = fullEffectiveStages.length >= 2
      ? fullEffectiveStages[fullEffectiveStages.length - 2].key
      : null;

    const currentStage = room?.deal_stage;
    const stageChanging = currentStage !== stage;

    const { error } = await supabase.from('deal_rooms').update({ deal_stage: stage }).eq('property_id', propertyId);
    if (error) throw error;
    logEvent(propertyId, 'stage_advanced', 'owner', null, `Deal advanced to ${stageLabel}`, { stage, stageLabel });
    recalculateTransactionState(propertyId, {
      source: 'stage_advanced',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] stage recalculation failed:', e.message));
    res.json({ ok: true, stage, unchanged: !stageChanging });

    // Only fire notifications when the stage actually changes — prevents duplicate
    // emails if the advance endpoint is called twice with the same stage.
    if (!stageChanging) return;

    notifyStageAdvance(propertyId, stage, stageLabel).catch(() => {});

    // Position-based VAP triggers — fire on the last two stages regardless of key name.
    // generateAndStoreVAP returns null on failure (swallows errors internally), so we
    // gate all downstream actions on a truthy return value to avoid sending a "ready" email
    // when the package actually failed to build.
    if (stage === secondToLastStageKey) {
      generateAndStoreVAP(propertyId, { seal: false })
        .then(pkg => { if (pkg) return notifyVAPReady(propertyId, stage, stageLabel); })
        .catch(() => {});
    }
    if (stage === lastStageKey) {
      generateAndStoreVAP(propertyId, { seal: true })
        .then(pkg => {
          if (!pkg) return;
          return Promise.all([
            sealClosingRecord(propertyId),
            notifyVAPReady(propertyId, stage, stageLabel),
          ]);
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error('[advance]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Custom stage configuration ───────────────────────────────────────────────
// GET  /api/public/deal-room/:propertyId/stages
//   Returns the room's custom stages_config (or null if using pack defaults).
// PATCH /api/public/deal-room/:propertyId/stages
//   Updates the ordered stage list.  Requires owner_write_token in body.
//   Validates: ≥2 stages, each has a non-empty key and label, keys are unique.
// ----------------------------------------------------------------------------

app.get('/api/public/deal-room/:propertyId/stages', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    let { data, error } = await supabase
      .from('deal_rooms')
      .select('stages_config, workflow_pack_id, deal_stage')
      .eq('property_id', propertyId)
      .maybeSingle();
    // Older Supabase schemas may not have stages_config yet. The room can
    // still resolve its custom workflow pack, so return null stages and let the
    // client use that pack's stages instead of failing the whole room.
    if (error && /stages_config.*(does not exist|schema cache)|column .*stages_config/i.test(error.message || '')) {
      ({ data, error } = await supabase
        .from('deal_rooms')
        .select('workflow_pack_id, deal_stage')
        .eq('property_id', propertyId)
        .maybeSingle());
      if (!error && data) data.stages_config = null;
    }
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'room not found' });
    res.json({
      stages: data.stages_config || null,
      currentStage: data.deal_stage || 'uploading',
      packId: data.workflow_pack_id || DEFAULT_PACK_ID,
    });
  } catch (err) {
    console.error('[stages GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/public/deal-room/:propertyId/stages', async (req, res) => {
  const { propertyId } = req.params;
  const { stages, ownerWriteToken } = req.body || {};

  // Auth: require owner_write_token
  if (!ownerWriteToken) return res.status(403).json({ error: 'owner_write_token required' });
  const { data: room, error: authErr } = await supabase
    .from('deal_rooms')
    .select('owner_write_token, deal_stage')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (authErr) return res.status(500).json({ error: authErr.message });
  if (!room) return res.status(404).json({ error: 'room not found' });
  if (!room.owner_write_token || room.owner_write_token !== ownerWriteToken) {
    return res.status(403).json({ error: 'invalid owner_write_token' });
  }

  // Validate stages array
  if (!Array.isArray(stages) || stages.length < 2) {
    return res.status(400).json({ error: 'stages must be an array with at least 2 items' });
  }
  for (const s of stages) {
    if (!s.key || typeof s.key !== 'string' || !s.key.trim()) {
      return res.status(400).json({ error: 'each stage must have a non-empty key' });
    }
    if (!s.label || typeof s.label !== 'string' || !s.label.trim()) {
      return res.status(400).json({ error: 'each stage must have a non-empty label' });
    }
  }
  const keys = stages.map(s => s.key);
  if (new Set(keys).size !== keys.length) {
    return res.status(400).json({ error: 'stage keys must be unique' });
  }

  // Sanitize: only persist key, label, icon, desc — no extra fields
  const sanitized = stages.map(s => ({
    key: s.key.trim(),
    label: s.label.trim(),
    ...(s.icon ? { icon: s.icon } : {}),
    ...(s.desc ? { desc: s.desc.trim() } : {}),
  }));

  try {
    const { error: updateErr } = await supabase
      .from('deal_rooms')
      .update({ stages_config: sanitized })
      .eq('property_id', propertyId);
    if (updateErr) throw updateErr;

    logEvent(propertyId, 'stages_updated', 'owner', null, `Stage list updated (${sanitized.length} stages)`, {
      stageKeys: sanitized.map(s => s.key),
    });
    recalculateTransactionState(propertyId, {
      source: 'stages_updated',
      actorId: 'owner',
      actorType: 'owner',
    }).catch(e => console.warn('[transaction-state] stages recalculation failed:', e.message));

    res.json({ ok: true, stages: sanitized });
  } catch (err) {
    console.error('[stages PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Transaction metadata (pack-driven Transaction Details panel) ─────────────
// PATCH saves the key/value form from the TransactionDetailsPanel to the
// `metadata_values` JSONB column. Auth: owner_write_token (same pattern as
// the stages PATCH above).
app.patch('/api/public/deal-room/:propertyId/metadata', async (req, res) => {
  const { propertyId } = req.params;
  const { values, ownerWriteToken } = req.body || {};

  if (!ownerWriteToken) return res.status(403).json({ error: 'owner_write_token required' });

  const { data: room, error: authErr } = await supabase
    .from('deal_rooms')
    .select('owner_write_token, workflow_pack_id, deal_type')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (authErr) return res.status(500).json({ error: authErr.message });
  if (!room) return res.status(404).json({ error: 'room not found' });
  if (!room.owner_write_token || room.owner_write_token !== ownerWriteToken) {
    return res.status(403).json({ error: 'invalid owner_write_token' });
  }

  // Sanitize values: only allow string/number/null, max 64 keys, max 500 chars per value
  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    return res.status(400).json({ error: 'values must be an object' });
  }
  const sanitized = {};
  for (const [k, v] of Object.entries(values)) {
    if (Object.keys(sanitized).length >= 64) break;
    if (typeof k !== 'string' || k.length > 80) continue;
    if ((v === null || v === undefined || v === '') &&
        !['transaction_value', 'target_close_date'].includes(k)) continue;
    sanitized[k] = (v === null || v === undefined || v === '')
      ? null
      : String(v).slice(0, 500);
  }

  try {
    const { error: updateErr } = await supabase
      .from('deal_rooms')
      .update({ metadata_values: sanitized })
      .eq('property_id', propertyId);
    if (updateErr) throw updateErr;
    await syncMetadataToTransactionRecord(
      propertyId,
      sanitized,
      room,
      'Deal Owner',
    );

    logEvent(propertyId, 'metadata_updated', 'owner', null, 'Transaction details updated', {
      fieldCount: Object.keys(sanitized).length,
    });
    recalculateTransactionState(propertyId, {
      source: 'metadata_updated',
      actorId: 'owner',
      actorType: 'owner',
    }).catch(e => console.warn('[transaction-state] metadata recalculation failed:', e.message));

    res.json({ ok: true, metadata_values: sanitized });
  } catch (err) {
    console.error('[metadata PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Metadata merge (non-destructive PATCH) ───────────────────────────────────
// Merges individual key/value pairs into metadata_values without overwriting
// unrelated keys. Used by DigitalAssetTogglePanel (#181) and
// OwnershipStructurePanel (#182). Auth: owner_write_token.
app.patch('/api/public/deal-room/:propertyId/metadata-merge', async (req, res) => {
  const { propertyId } = req.params;
  const { values, ownerWriteToken } = req.body || {};

  if (!ownerWriteToken) return res.status(403).json({ error: 'owner_write_token required' });
  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    return res.status(400).json({ error: 'values must be an object' });
  }

  const { data: room, error: authErr } = await supabase
    .from('deal_rooms')
    .select('owner_write_token, metadata_values, jurisdiction, workflow_pack_id, deal_type')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (authErr) return res.status(500).json({ error: authErr.message });
  if (!room) return res.status(404).json({ error: 'room not found' });
  if (!room.owner_write_token || room.owner_write_token !== ownerWriteToken) {
    return res.status(403).json({ error: 'invalid owner_write_token' });
  }

  // Merge: start from existing values, apply incoming keys (empty string = delete)
  const merged = { ...(room.metadata_values || {}) };
  for (const [k, v] of Object.entries(values)) {
    if (typeof k !== 'string' || k.length > 80) continue;
    if (v === null || v === undefined || v === '') {
      delete merged[k];
    } else {
      merged[k] = String(v).slice(0, 500);
    }
    if (Object.keys(merged).length > 64) break;
  }

  try {
    const layerWasDisabled = room.metadata_values?.digital_asset_enabled === true
      || room.metadata_values?.digital_asset_enabled === 'true';
    const layerIsDisabled = !('digital_asset_enabled' in merged)
      || (merged.digital_asset_enabled !== true && merged.digital_asset_enabled !== 'true');
    const update = { metadata_values: merged };
    if (layerWasDisabled && layerIsDisabled) update.jurisdiction = null;
    const { error: updateErr } = await supabase
      .from('deal_rooms')
      .update(update)
      .eq('property_id', propertyId);
    if (updateErr) throw updateErr;
    await syncMetadataToTransactionRecord(
      propertyId,
      values,
      room,
      'Deal Owner',
    );

    logEvent(propertyId, 'metadata_updated', 'owner', null, 'Workspace settings updated', {
      keys: Object.keys(values).join(','),
    });
    recalculateTransactionState(propertyId, {
      source: 'metadata_merge',
      actorId: 'owner',
      actorType: 'owner',
    }).catch(e => console.warn('[transaction-state] metadata merge recalculation failed:', e.message));

    res.json({ ok: true, metadata_values: merged });
  } catch (err) {
    console.error('[metadata-merge PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Ownership data — PATCH ────────────────────────────────────────────────────
// Stores structured token economics + cap-table rows into metadata_values.
// Cap table is persisted as a JSON blob so row arrays are not truncated by the
// 500-char scalar limit applied by /metadata-merge.
// Auth: owner_write_token in request body.
app.patch('/api/public/deal-room/:propertyId/ownership', async (req, res) => {
  const { propertyId } = req.params;
  const {
    ownerWriteToken,
    token_name, token_symbol, total_supply, token_price,
    raise_target, asset_valuation, pct_tokenized,
    cap_table_rows,
  } = req.body || {};

  if (!ownerWriteToken) return res.status(403).json({ error: 'owner_write_token required' });

  const { data: room, error: authErr } = await supabase
    .from('deal_rooms')
    .select('owner_write_token, metadata_values')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (authErr) return res.status(500).json({ error: authErr.message });
  if (!room) return res.status(404).json({ error: 'room not found' });
  if (!room.owner_write_token || room.owner_write_token !== ownerWriteToken) {
    return res.status(403).json({ error: 'invalid owner_write_token' });
  }

  const merged = { ...(room.metadata_values || {}) };
  const scalars = { token_name, token_symbol, total_supply, token_price, raise_target, asset_valuation, pct_tokenized };
  for (const [k, v] of Object.entries(scalars)) {
    if (v === null || v === undefined || v === '') delete merged[k];
    else merged[k] = String(v).slice(0, 200);
  }
  // Cap table stored as JSON — max 20 rows, each field capped
  if (Array.isArray(cap_table_rows)) {
    const safe = cap_table_rows
      .slice(0, 20)
      .map(r => ({
        name: String(r.name || '').slice(0, 100),
        role: String(r.role || '').slice(0, 80),
        pct:  String(r.pct  || '').slice(0, 20),
      }))
      .filter(r => r.name);
    if (safe.length > 0) merged.cap_table_rows = JSON.stringify(safe);
    else delete merged.cap_table_rows;
  }

  try {
    const { error: updateErr } = await supabase
      .from('deal_rooms')
      .update({ metadata_values: merged })
      .eq('property_id', propertyId);
    if (updateErr) throw updateErr;

    logEvent(propertyId, 'metadata_updated', 'owner', null, 'Ownership structure updated', {
      keys: 'ownership_data',
    });
    recalculateTransactionState(propertyId, {
      source: 'ownership_updated',
      actorId: 'owner',
      actorType: 'owner',
    }).catch(e => console.warn('[transaction-state] ownership recalculation failed:', e.message));

    res.json({ ok: true, metadata_values: merged });
  } catch (err) {
    console.error('[ownership PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SETTLEMENT CAPABILITY — Phase 1: Provider-Neutral Settlement Readiness
// ══════════════════════════════════════════════════════════════════════════════
//
// Routes:
//   GET   /api/public/deal-room/:transactionId/settlement/readiness
//   PATCH /api/public/deal-room/:transactionId/settlement/mode
//   PATCH /api/public/deal-room/:transactionId/settlement/mode/lock
//   POST  /api/public/deal-room/:transactionId/settlement/complete
//   GET   /api/public/deal-room/:transactionId/settlement/seal
//
// KEY INVARIANT: settlement_readiness_pct reaching 1.0 NEVER grants completion.
// Completion is always a fresh deterministic server-side check — every
// mandatory settlement.* field must have status='verified' AND every required
// settlement approval must have action='approved'. This is evaluated in full
// each time POST /settlement/complete is called.
//
// Terminology: params use "transactionId" per architecture; internally we map
// `const propertyId = req.params.transactionId` for backward compat.
//
// Immutability scope: only transaction_record_fields, transaction_record_approvals,
// and the seal record (deal_analyses doc_type='transaction_seal') become immutable
// after sealing. The workspace itself (participants, documents) remains usable.
// Post-sealing documents are flagged post_completion=true in deal_analyses.

// ── Server-side settlement conditions ────────────────────────────────────────
// Server-side equivalent of SETTLEMENT_RECORD_SCHEMA in transactionRecordSchema.js.
// These MUST stay in sync with the frontend schema definition.

function getSettlementConditionsServer(mode) {
  if (!mode) return [];

  const COMMON = [
    { key: 'settlement.provider',             label: 'Settlement Provider',         type: 'field' },
    { key: 'settlement.rail',                 label: 'Settlement Rail',             type: 'field' },
    { key: 'settlement.asset_currency',       label: 'Settlement Asset / Currency', type: 'field' },
    { key: 'settlement.destination_reference',label: 'Destination Reference',       type: 'field' },
  ];

  const MODE_FIELDS = {
    traditional: [
      { key: 'settlement.funding_confirmed', label: 'Funding Confirmed',      type: 'field' },
      { key: 'settlement.settlement_date',   label: 'Settlement Date',        type: 'field' },
      { key: 'settlement.evidence_doc_ref',  label: 'Settlement Evidence',    type: 'field' },
    ],
    digital: [
      { key: 'settlement.expected_amount',   label: 'Expected Settlement Amount', type: 'field' },
    ],
    tokenized: [
      { key: 'settlement.token_type',           label: 'Token Type',                     type: 'field' },
      { key: 'settlement.issuance_provider',    label: 'Issuance Provider',              type: 'field' },
      { key: 'settlement.whitelist_confirmed',  label: 'KYC / Whitelist Confirmed',      type: 'field' },
      { key: 'settlement.legal_opinion_present',label: 'Legal Opinion Uploaded',         type: 'field' },
    ],
  };

  const APPROVALS = {
    traditional: [
      { key: 'settlement.coordinator_approval', label: 'Coordinator Approval',    type: 'approval', role: 'Deal Coordinator' },
      { key: 'settlement.legal_approval',       label: 'Legal Counsel Approval',  type: 'approval', role: 'Legal Counsel'    },
    ],
    digital: [
      { key: 'settlement.coordinator_approval', label: 'Coordinator Approval', type: 'approval', role: 'Deal Coordinator'   },
      { key: 'settlement.compliance_approval',  label: 'Compliance Approval',  type: 'approval', role: 'Compliance Officer' },
    ],
    tokenized: [
      { key: 'settlement.coordinator_approval', label: 'Coordinator Approval',    type: 'approval', role: 'Deal Coordinator'   },
      { key: 'settlement.legal_approval',       label: 'Legal Counsel Approval',  type: 'approval', role: 'Legal Counsel'      },
      { key: 'settlement.compliance_approval',  label: 'Compliance Approval',     type: 'approval', role: 'Compliance Officer' },
    ],
  };

  return [
    ...COMMON,
    ...(MODE_FIELDS[mode] || []),
    ...(APPROVALS[mode]   || []),
  ];
}

// Compute settlement readiness for a workspace.
// Returns: { score, conditions, all_conditions_met, unmet, mode }
// Scoring: verified=1.0, needs_review=0.5, missing/pending=0.
// all_conditions_met: true only if EVERY condition (field + approval) is met.
async function computeSettlementReadiness(propertyId, mode) {
  if (!mode) {
    return { score: 0, conditions: [], all_conditions_met: false, unmet: [], mode: null };
  }
  const conditions = getSettlementConditionsServer(mode);
  const approvalKeys = conditions.filter(c => c.type === 'approval').map(c => c.key);

  // All record fields come from the same canonical resolver used by the
  // Transaction Record, Key Facts, and Operations Manager. This prevents
  // settlement from interpreting aliases or legacy statuses independently.
  const transactionState = await readTransactionState(propertyId);
  const fieldsByKey = new Map(
    (transactionState.recordState.fields || []).map(field => [field.key, field]),
  );
  const approvalFieldRows = approvalKeys
    .map(key => {
      const field = fieldsByKey.get(key);
      return field?.fieldId ? { id: field.fieldId, field_key: key } : null;
    })
    .filter(Boolean);
  const approvalFieldIds = approvalFieldRows.map(f => f.id);
  const { data: approvals } = approvalFieldIds.length
    ? await supabase.from('transaction_record_approvals').select('field_id, action').eq('property_id', propertyId).in('field_id', approvalFieldIds)
    : { data: [] };

  const approvalFieldByKey = new Map((approvalFieldRows || []).map(f => [f.field_key, f]));
  const approvedFieldIds  = new Set((approvals || []).filter(a => a.action === 'approved').map(a => a.field_id));

  let total = 0;
  let earned = 0;
  const conditionResults = [];
  const unmet = [];

  for (const cond of conditions) {
    total += 1;
    let score = 0;
    let met = false;
    let status = 'missing';

    if (cond.type === 'field') {
      const field = fieldsByKey.get(cond.key);
      // source_changed is represented as confirmed + attention by the
      // canonical state engine, but it still requires review before settlement.
      status = field?.attention === 'source_changed' ? 'source_changed' : (field?.status || 'missing');
      if (status === 'confirmed') { score = 1.0; met = true; }
      else if (status === 'awaiting' || status === 'captured') { score = 0.5; }
    } else {
      const af = approvalFieldByKey.get(cond.key);
      met = af ? approvedFieldIds.has(af.id) : false;
      status = met ? 'approved' : 'pending';
      score = met ? 1.0 : 0;
    }

    earned += score;
    conditionResults.push({ ...cond, status, score, met });
    if (!met) unmet.push({ key: cond.key, label: cond.label });
  }

  const readinessScore = total > 0 ? earned / total : 0;
  return {
    score: Math.round(readinessScore * 10000) / 10000,
    conditions: conditionResults,
    all_conditions_met: unmet.length === 0 && total > 0,
    unmet,
    mode,
  };
}

// Helper: check if a room has settlement capability active.
// A room is settlement-capable when any of the following is true:
//   1. The coordinator explicitly enabled it via metadata_values.settlement_capability_enabled
//   2. The coordinator set a settlement mode (implies capability was activated)
//   3. The room uses the tokenization workflow pack
function roomHasSettlementCapability(room) {
  const meta = room?.metadata_values || {};
  return !!(
    !!room?.settlement_mode                             // mode set → capability active
    || room?.workflow_pack_id === 'tokenization'
    || meta.settlement_capability_enabled === true
    || meta.settlement_capability_enabled === 'true'
  );
}

// ── GET /settlement/readiness ─────────────────────────────────────────────────

app.get('/api/public/deal-room/:transactionId/settlement/readiness', async (req, res) => {
  const propertyId = req.params.transactionId;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);

    const { data: room, error } = await supabase
      .from('deal_rooms')
      .select('property_id, workflow_pack_id, deal_stage, metadata_values, settlement_mode, settlement_mode_locked_at, settlement_readiness_pct, sealed_at, completed_at')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (error) throw error;
    if (!room) return res.status(404).json({ error: 'room not found' });

    if (!roomHasSettlementCapability(room)) {
      return res.json({
        capability_enabled: false,
        message: 'Settlement capability is not active. Enable it from workspace settings.',
      });
    }

    const mode = room.settlement_mode || null;
    const readiness = await computeSettlementReadiness(propertyId, mode);

    // Cache the score if it changed by more than 0.1%
    if (mode && Math.abs((readiness.score || 0) - (room.settlement_readiness_pct || 0)) > 0.001) {
      supabase.from('deal_rooms').update({ settlement_readiness_pct: readiness.score }).eq('property_id', propertyId).then(() => {});
    }

    res.json({
      capability_enabled: true,
      mode,
      mode_locked:    !!room.settlement_mode_locked_at,
      mode_locked_at: room.settlement_mode_locked_at || null,
      sealed_at:      room.sealed_at || null,
      completed_at:   room.completed_at || null,
      is_complete:    !!room.sealed_at,
      readiness_pct:  Math.round((readiness.score || 0) * 100),
      all_conditions_met: readiness.all_conditions_met,
      conditions:     readiness.conditions,
      unmet:          readiness.unmet,
      deal_stage:     room.deal_stage,
    });
  } catch (err) {
    console.error('[settlement/readiness GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /settlement/mode ────────────────────────────────────────────────────

app.patch('/api/public/deal-room/:transactionId/settlement/mode', async (req, res) => {
  const propertyId = req.params.transactionId;
  const { mode, ownerWriteToken } = req.body || {};
  const VALID_MODES = ['traditional', 'digital', 'tokenized'];
  try {
    const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
    if (access.mode !== 'owner') return accessDenied(res, 'Coordinator access required');
    if (!VALID_MODES.includes(mode)) {
      return res.status(400).json({ error: 'INVALID_MODE', message: `settlement.mode must be one of: ${VALID_MODES.join(', ')}` });
    }
    const { data: room } = await supabase.from('deal_rooms').select('settlement_mode, settlement_mode_locked_at, sealed_at').eq('property_id', propertyId).maybeSingle();
    if (room?.sealed_at) return res.status(400).json({ error: 'WORKSPACE_SEALED', message: 'Settlement mode cannot be changed after sealing.' });
    if (room?.settlement_mode_locked_at && room.settlement_mode !== mode) {
      return res.status(400).json({ error: 'MODE_LOCKED', message: 'Settlement mode is locked. Contact support to unlock.', locked_at: room.settlement_mode_locked_at });
    }
    const { error } = await supabase.from('deal_rooms').update({ settlement_mode: mode }).eq('property_id', propertyId);
    if (error) throw error;
    logEvent(propertyId, 'settlement_mode_set', 'owner', null, `Settlement mode set to ${mode}`, { mode }).catch(() => {});
    recalculateTransactionState(propertyId, {
      source: 'settlement_mode_set',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] settlement mode recalculation failed:', e.message));
    res.json({ ok: true, mode });
  } catch (err) {
    console.error('[settlement/mode PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /settlement/mode/lock ───────────────────────────────────────────────

app.patch('/api/public/deal-room/:transactionId/settlement/mode/lock', async (req, res) => {
  const propertyId = req.params.transactionId;
  const { ownerWriteToken } = req.body || {};
  try {
    const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
    if (access.mode !== 'owner') return accessDenied(res, 'Coordinator access required');
    const { data: room } = await supabase.from('deal_rooms').select('settlement_mode, settlement_mode_locked_at, sealed_at').eq('property_id', propertyId).maybeSingle();
    if (!room?.settlement_mode) return res.status(400).json({ error: 'NO_MODE', message: 'Set a settlement mode before locking.' });
    if (room?.sealed_at) return res.status(400).json({ error: 'WORKSPACE_SEALED', message: 'Workspace is already sealed.' });
    const now = new Date().toISOString();
    const { error } = await supabase.from('deal_rooms').update({ settlement_mode_locked_at: now }).eq('property_id', propertyId);
    if (error) throw error;
    logEvent(propertyId, 'settlement_mode_locked', 'owner', null, `Settlement mode locked: ${room.settlement_mode}`, { mode: room.settlement_mode }).catch(() => {});
    recalculateTransactionState(propertyId, {
      source: 'settlement_mode_locked',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] settlement lock recalculation failed:', e.message));
    res.json({ ok: true, locked_at: now, mode: room.settlement_mode });
  } catch (err) {
    console.error('[settlement/mode/lock PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /settlement/complete ─────────────────────────────────────────────────
// Deterministic completion gate: all mandatory conditions must be met.
// Creates the Transaction Seal, marks workspace sealed, advances to 'complete'.

app.post('/api/public/deal-room/:transactionId/settlement/complete', async (req, res) => {
  const propertyId = req.params.transactionId;
  const { ownerWriteToken, sealDisplayName } = req.body || {};
  try {
    const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
    if (access.mode !== 'owner') return accessDenied(res, 'Coordinator access required');

    const { data: room, error: fetchError } = await supabase
      .from('deal_rooms')
      .select('property_id, property_name, workflow_pack_id, deal_stage, metadata_values, settlement_mode, sealed_at')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!room) return res.status(404).json({ error: 'room not found' });

    if (room.sealed_at) {
      return res.status(400).json({ error: 'ALREADY_SEALED', message: 'This workspace is already sealed.', sealed_at: room.sealed_at });
    }
    if (!roomHasSettlementCapability(room)) {
      return res.status(400).json({ error: 'CAPABILITY_NOT_ENABLED', message: 'Settlement capability is not active for this workspace.' });
    }
    if (!room.settlement_mode) {
      return res.status(400).json({ error: 'NO_SETTLEMENT_MODE', message: 'Set a settlement mode first — use PATCH /settlement/mode.' });
    }

    // ── Deterministic gate: all required conditions must be met ───────────────
    const readiness = await computeSettlementReadiness(propertyId, room.settlement_mode);
    if (!readiness.all_conditions_met) {
      return res.status(400).json({
        error: 'CONDITIONS_NOT_MET',
        message: 'Not all settlement conditions are verified. Every required field must be status=verified and every required approval must be action=approved.',
        unmet: readiness.unmet,
        readiness_pct: Math.round((readiness.score || 0) * 100),
      });
    }

    // ── Build the Transaction Seal payload ───────────────────────────────────
    const now = new Date().toISOString();
    const displayName = sealDisplayName || 'Transaction Seal';
    const verifiedConditions = readiness.conditions.filter(c => c.met).map(c => ({ key: c.key, label: c.label, type: c.type }));
    const sealContent = {
      seal_type:           'transaction_seal',
      display_name:        displayName,
      property_id:         propertyId,
      workspace_name:      room.property_name || propertyId,
      settlement_mode:     room.settlement_mode,
      created_at:          now,
      conditions_verified: verifiedConditions,
      conditions_count:    readiness.conditions.length,
      verified_count:      verifiedConditions.length,
      note: 'This seal is a digital record of verified settlement conditions at the time of completion. It is not a legal instrument. Kontra is a coordination platform — it does not settle transactions or provide legal or financial advice.',
    };
    const sealText = [
      `Transaction Seal — ${displayName}`,
      `Workspace: ${room.property_name || propertyId}`,
      `Settlement Mode: ${room.settlement_mode}`,
      `Sealed At: ${now}`,
      `Conditions Verified: ${sealContent.verified_count} / ${sealContent.conditions_count}`,
      '',
      'Verified Conditions:',
      ...verifiedConditions.map(c => `  ✓ ${c.label} (${c.type})`),
      '',
      sealContent.note,
    ].join('\n');

    // ── Atomic seal via PostgreSQL RPC ────────────────────────────────────────
    // The RPC runs inside a single DB transaction with a FOR UPDATE row lock.
    // Unique index idx_deal_analyses_one_seal_per_room prevents duplicate seals
    // even if a concurrent call races past the lock. If any step fails, the
    // entire transaction rolls back — no partial state can persist.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'complete_settlement_transaction',
      {
        p_property_id:  propertyId,
        p_seal_content: sealContent,  // JSONB — stored in deal_analyses.analysis
        p_score:        readiness.score,
        p_now:          now,
      }
    );
    if (rpcError) throw rpcError;

    // The RPC returns JSONB; Supabase unwraps it as a plain object.
    const rpc = rpcResult || {};
    if (rpc.error === 'ALREADY_SEALED') {
      return res.status(400).json({
        error:     'ALREADY_SEALED',
        message:   'This workspace is already sealed.',
        sealed_at: rpc.sealed_at,
      });
    }
    if (rpc.error === 'ROOM_NOT_FOUND') {
      return res.status(404).json({ error: 'room not found' });
    }
    if (!rpc.ok) {
      throw new Error(`RPC complete_settlement_transaction failed: ${JSON.stringify(rpc)}`);
    }

    logEvent(
      propertyId, 'transaction_sealed', 'owner', null,
      `Transaction sealed — ${displayName}. Settlement mode: ${room.settlement_mode}.`,
      { seal_id: rpc.seal_id, mode: room.settlement_mode, conditions_count: sealContent.conditions_count }
    ).catch(() => {});
    recalculateTransactionState(propertyId, {
      source: 'settlement_completed',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] settlement completion recalculation failed:', e.message));

    res.json({
      ok:                  true,
      seal_id:             rpc.seal_id,
      seal_display_name:   displayName,
      sealed_at:           rpc.sealed_at || now,
      completed_at:        rpc.sealed_at || now,
      deal_stage:          'complete',
      mode:                room.settlement_mode,
      conditions_verified: sealContent.verified_count,
    });
  } catch (err) {
    console.error('[settlement/complete POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /settlement/seal ──────────────────────────────────────────────────────

app.get('/api/public/deal-room/:transactionId/settlement/seal', async (req, res) => {
  const propertyId = req.params.transactionId;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);

    const { data: room } = await supabase
      .from('deal_rooms')
      .select('property_name, sealed_at, completed_at, settlement_mode, settlement_readiness_pct')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (!room?.sealed_at) {
      return res.status(404).json({ error: 'WORKSPACE_NOT_SEALED', message: 'This workspace has not been sealed.' });
    }

    // deal_analyses uses `section` as the type discriminator and `analysis` (JSONB)
    // as the content store — there is no doc_type, summary, or extracted_text column.
    const { data: sealRecord } = await supabase
      .from('deal_analyses')
      .select('id, section, analysis, created_at')
      .eq('property_id', propertyId)
      .eq('section', 'transaction_seal')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sealRecord) {
      return res.status(404).json({ error: 'SEAL_NOT_FOUND', message: 'Seal record not found for sealed workspace.' });
    }

    const sealContent = sealRecord.analysis || {};

    res.json({
      seal_id:         sealRecord.id,
      workspace_name:  room.property_name,
      sealed_at:       room.sealed_at,
      completed_at:    room.completed_at,
      settlement_mode: room.settlement_mode,
      readiness_pct:   Math.round((room.settlement_readiness_pct || 0) * 100),
      summary:         sealContent,  // key kept for SealedView frontend compatibility
    });
  } catch (err) {
    console.error('[settlement/seal GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Verified Transaction Record — GET ────────────────────────────────────────
// Returns the structured, auditable identity of a transaction, auto-generated
// from workspace data. The endpoint name remains stable for existing clients.
app.get('/api/public/deal-room/:propertyId/asset-passport', async (req, res) => {
  const { propertyId } = req.params;
  const access = await getRoomAccessContext(req, propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  const { data: room, error } = await supabase
    .from('deal_rooms')
    .select('property_id, property_name, workflow_pack_id, deal_type, jurisdiction, metadata_values, created_at, first_name, last_name')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!room) return res.status(404).json({ error: 'room not found' });

  const [{ count: docCount }, { count: eventCount }] = await Promise.all([
    supabase.from('deal_analyses').select('id', { count: 'exact', head: true }).eq('property_id', propertyId),
    supabase.from('deal_events').select('id', { count: 'exact', head: true }).eq('property_id', propertyId),
  ]);

  const meta = room.metadata_values || {};
  const normalizedJurisdiction = await jurisdictionForTransaction(
    room.jurisdiction,
    room.workflow_pack_id,
    room.deal_type,
    meta,
  );
  const entityName = meta.entity_name || null;
  const ownerName = [room.first_name, room.last_name].filter(Boolean).join(' ') || entityName || meta.issuer_name || null;

  res.json({
    record_type:          'verified_transaction',
    asset_id:             propertyId,
    asset_name:           room.property_name,
    asset_type:           meta.asset_type || room.workflow_pack_id || 'transaction',
    jurisdiction:         normalizedJurisdiction || null,
    pack:                 room.workflow_pack_id,
    owner:                ownerName,
    entity:               entityName,
    closing_date:         meta.target_close_date || null,
    document_count:       docCount || 0,
    event_count:          eventCount || 0,
    verification_status:  docCount > 3 && eventCount > 5 ? 'Pending' : 'Incomplete',
    closing_ready:        docCount > 3 && eventCount > 5,
    created_at:           room.created_at,
    kontra_version:       '2.0',
    schema_version:       '1.0',
    generated_at:         new Date().toISOString(),
  });
});

// ── Transaction Metadata — GET ───────────────────────────────────────────────
// Portable structured data for closing, audit, and downstream integrations.
app.get('/api/public/deal-room/:propertyId/asset-metadata', async (req, res) => {
  const { propertyId } = req.params;
  const { data: room, error } = await supabase
    .from('deal_rooms')
    .select('property_id, property_name, workflow_pack_id, deal_type, jurisdiction, metadata_values, created_at, first_name, last_name')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!room) return res.status(404).json({ error: 'room not found' });

  const { data: docs } = await supabase
    .from('deal_analyses')
    .select('id, section, created_at')
    .eq('property_id', propertyId)
    .limit(100);

  const meta = room.metadata_values || {};
  const normalizedJurisdiction = await jurisdictionForTransaction(
    room.jurisdiction,
    room.workflow_pack_id,
    room.deal_type,
    meta,
  );
  const ownerName = [room.first_name, room.last_name].filter(Boolean).join(' ') || meta.entity_name || meta.issuer_name || null;

  res.json({
    record_type:     'verified_transaction',
    asset_id:       propertyId,
    asset_name:     room.property_name,
    asset_type:     meta.asset_type || room.workflow_pack_id || 'transaction',
    jurisdiction:   normalizedJurisdiction || null,
    entity:         meta.entity_name || null,
    closing_date:   meta.target_close_date || null,
    currency:       'USD',
    ownership_structure: {
      owner:              ownerName,
      lead_investor:      meta.lead_investor      || null,
      total_token_supply: meta.total_token_supply || null,
      investor_pct:       meta.investor_token_pct || null,
      team_pct:           meta.team_token_pct     || null,
      reserve_pct:        meta.reserve_token_pct  || null,
      vesting_schedule:   meta.vesting_schedule   || null,
      governance_rights:  meta.governance_rights  || null,
    },
    valuation: {
      raise_amount:   meta.raise_amount   || null,
      token_price:    meta.token_price    || null,
      min_investment: meta.min_investment || null,
      total_tokens:   meta.total_tokens   || null,
    },
    supporting_documents: {
      total_uploaded: docs?.length || 0,
      types: [...new Set((docs || []).map(d => d.section).filter(Boolean))],
    },
    compatible_networks: ['XRPL', 'Ethereum', 'Polygon', 'Canton', 'Stellar'],
    schema_version: '1.0',
    generated_at:   new Date().toISOString(),
  });
});

// ── Transaction Readiness — GET ──────────────────────────────────────────────
// Core closing/readiness score computed from workspace data. Digital-asset
// compatibility remains an optional downstream flag in the response.
app.get('/api/public/deal-room/:propertyId/readiness', async (req, res) => {
  const { propertyId } = req.params;
  const access = await getRoomAccessContext(req, propertyId);
  if (access.mode === 'anonymous') return accessDenied(res);
  const transactionState = await readTransactionState(propertyId);
  const room = transactionState.room;
  if (!room) return res.status(404).json({ error: 'room not found' });

  const meta = room.metadata_values || {};
  const readiness = transactionState.readiness;
  const overall = readiness.overall;
  const overallLabel = readiness.overallLabel;
  const confirmedRequiredCount = readiness.confirmedCount;
  const requiredFieldCount = readiness.requiredCount;
  const categories = readiness.categories;
  const populatedRecordFields = (readiness.recordState?.fields || []).filter(field =>
    field.status === 'confirmed' && String(field.value || '').trim()
  );
  const digitalAssetReadinessPercent = readiness.digitalAssetPercent;
  const digitalAssetReadinessSufficient = readiness.digitalAssetSufficient;
  const digitalAssetReadinessStatus = digitalAssetReadinessSufficient
    ? 'Preparation inputs captured'
    : populatedRecordFields.length > 0
      ? 'Preparation inputs incomplete'
      : 'No preparation inputs recorded';

  res.json({
    record_type:        'transaction_readiness',
    asset_id:            propertyId,
    overall_score:       overall,
    status:              overallLabel,
    closing_ready:       overall >= 80,
    transaction_ready:   overall >= 80,
    tokenization_ready: digitalAssetReadinessSufficient
      && (meta.digital_asset_enabled === true || meta.digital_asset_enabled === 'true'
        || room.workflow_pack_id === 'tokenization' || room.deal_type === 'tokenization'),
    transaction_readiness: {
      overall_pct: overall,
      status: overallLabel,
      categories,
      confirmed_fields: confirmedRequiredCount,
      required_fields: requiredFieldCount,
      awaiting_fields: readiness.recordState.awaitingCount,
      awaiting_required_fields: readiness.recordState.awaitingRequiredCount,
      awaiting_optional_fields: readiness.recordState.awaitingOptionalCount,
      conflicts: readiness.recordState.conflictCount,
    },
    transaction_record: readiness.recordState,
    digital_asset_readiness: {
      status: digitalAssetReadinessStatus,
      percent: digitalAssetReadinessPercent,
      sufficient: digitalAssetReadinessSufficient,
      captured_facts: populatedRecordFields.length,
      required_inputs: readiness.digitalAssetRequiredInputCount,
      confirmed_inputs: readiness.digitalAssetConfirmedInputCount,
      missing_inputs: readiness.digitalAssetGapCount,
      note: 'AI-prepared coordination data only. Kontra does not determine legal or regulatory outcomes.',
    },
    ...((room.workflow_pack_id === 'tokenization'
      || room.deal_type === 'tokenization'
      || meta.digital_asset_enabled === true
      || meta.digital_asset_enabled === 'true')
      ? {
          digital_asset_layer: {
            enabled: true,
            compatible_networks: ['XRPL', 'Ethereum', 'Polygon', 'Canton', 'Stellar'],
          },
        }
      : {}),
    note:                'Transaction Record completeness and confirmation only — not a legal, regulatory, or settlement determination.',
    schema_version:      '1.0',
    generated_at:        new Date().toISOString(),
  });
});

// ── Jurisdiction update (task #167) ─────────────────────────────────────────
// Coordinators can change the jurisdiction of an existing workspace without
// recreating it. Triggers readiness task evaluation so any new regulatory
// document tasks are seeded immediately.
const VALID_JURISDICTIONS = ['uae_adgm', 'eu_mica', 'us_reg_d', 'sg_mas', 'uk_fca'];
app.patch('/api/public/deal-room/:propertyId/jurisdiction', async (req, res) => {
  const { propertyId } = req.params;
  const { jurisdiction, ownerWriteToken } = req.body || {};

  if (!ownerWriteToken) return res.status(403).json({ error: 'owner_write_token required' });
  if (jurisdiction && !VALID_JURISDICTIONS.includes(jurisdiction)) {
    return res.status(400).json({ error: `Invalid jurisdiction. Must be one of: ${VALID_JURISDICTIONS.join(', ')}` });
  }

  const { data: room, error: authErr } = await supabase
    .from('deal_rooms')
    .select('owner_write_token, jurisdiction, workflow_pack_id, deal_type, metadata_values')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (authErr) return res.status(500).json({ error: authErr.message });
  if (!room) return res.status(404).json({ error: 'room not found' });
  if (!room.owner_write_token || room.owner_write_token !== ownerWriteToken) {
    return res.status(403).json({ error: 'invalid owner_write_token' });
  }
  const normalizedJurisdiction = await jurisdictionForTransaction(
    jurisdiction || room.jurisdiction || '',
    room.workflow_pack_id,
    room.deal_type,
    room.metadata_values,
  );
  if (jurisdiction && !normalizedJurisdiction) {
    return res.status(409).json({
      error: 'Digital Asset Preparation must be enabled before setting a securities jurisdiction',
    });
  }

  try {
    const { error: updateErr } = await supabase
      .from('deal_rooms')
      .update({ jurisdiction: jurisdiction || null })
      .eq('property_id', propertyId);
    if (updateErr) throw updateErr;

    const prev = room.jurisdiction;
    const label = {
      uae_adgm: 'UAE — ADGM / DFSA', eu_mica: 'EU — MiCA', us_reg_d: 'US — Reg D',
      sg_mas: 'Singapore — MAS', uk_fca: 'UK — FCA',
    }[jurisdiction] || jurisdiction || '(cleared)';
    logEvent(propertyId, 'jurisdiction_changed', 'owner', null,
      jurisdiction ? `Jurisdiction ${prev ? 'updated' : 'selected'}: ${label}` : 'Jurisdiction cleared',
      { from: prev || null, to: jurisdiction || null }
    ).catch(() => {});

    // Re-evaluate readiness tasks — jurisdiction change affects regulatory doc requirements
    evaluateReadinessTasks(propertyId, []).catch(e =>
      console.warn('[tasks] readiness evaluate on jurisdiction change failed:', e.message));

    res.json({ ok: true, jurisdiction: jurisdiction || null });
  } catch (err) {
    console.error('[jurisdiction PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Notification log — owner can see what emails were sent ──────────────────
app.get('/api/public/deal-room/:propertyId/notifications', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const { data, error } = await supabase
      .from('deal_notifications')
      .select('id, type, to_email, subject, sent_at')
      .eq('property_id', propertyId)
      .order('sent_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ notifications: data || [] });
  } catch (err) {
    // Graceful fallback — table may not exist yet (migration pending)
    res.json({ notifications: [] });
  }
});

// ── Resend a notification email (task #88) ──────────────────────────────────
// Owner-gated. Looks up the original notification by ID, sends a forwarding
// email with "Resent from log" header to the same recipient, and logs an event.
app.post('/api/public/deal-room/:propertyId/notifications/:notificationId/resend', async (req, res) => {
  const { propertyId, notificationId } = req.params;
  const { ownerWriteToken } = req.body || {};
  if (!ownerWriteToken) return res.status(403).json({ error: 'owner_write_token required' });
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(503).json({ error: 'Email not configured (RESEND_API_KEY not set)' });

  try {
    const [roomRes, notifRes] = await Promise.all([
      supabase.from('deal_rooms').select('owner_write_token, property_name')
        .eq('property_id', propertyId).maybeSingle(),
      supabase.from('deal_notifications').select('id, type, to_email, subject, sent_at')
        .eq('id', notificationId).eq('property_id', propertyId).maybeSingle(),
    ]);
    if (roomRes.error) throw roomRes.error;
    if (!roomRes.data) return res.status(404).json({ error: 'room not found' });
    if (!roomRes.data.owner_write_token || roomRes.data.owner_write_token !== ownerWriteToken) {
      return res.status(403).json({ error: 'invalid owner_write_token' });
    }
    if (notifRes.error) throw notifRes.error;
    if (!notifRes.data) return res.status(404).json({ error: 'notification not found' });

    const notif = notifRes.data;
    const room  = roomRes.data;
    const workspaceUrl = `${req.headers.origin || 'https://kontraplatform.com'}/deal-room/${propertyId}`;

    await sendResendEmail(RESEND_KEY, {
      from: 'Kontra <notifications@kontraplatform.com>',
      to: notif.to_email,
      subject: `[Resent] ${notif.subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <p style="color:#888;font-size:12px;margin:0 0 16px;padding:8px 12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
            📬 Resent from the notification log — original sent ${new Date(notif.sent_at).toLocaleString()}
          </p>
          <h2 style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">${notif.subject}</h2>
          <p style="color:#555;font-size:14px;margin:0 0 24px">
            This email was resent at the request of the workspace coordinator. 
            Click below to access the workspace.
          </p>
          <a href="${workspaceUrl}"
            style="display:inline-block;padding:12px 24px;background:#800020;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
            Open workspace →
          </a>
          <p style="color:#bbb;font-size:11px;margin-top:24px">Kontra deal room · ${room.property_name || propertyId}</p>
        </div>`,
    });

    logEvent(propertyId, 'notification_resent', 'owner', null,
      `Notification resent to ${notif.to_email}: ${notif.subject}`,
      { notificationId, type: notif.type }
    ).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    console.error('[notification/resend]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Task #143: Request a specific document from an invited participant ────────
// Coordinator-only (ownerWriteToken required). Looks up deal_room_invites for
// any of the assignedTo roles, sends an email asking them to upload the named
// document, and logs the event.
app.post('/api/public/deal-room/:propertyId/request-document', async (req, res) => {
  const { propertyId } = req.params;
  const { ownerWriteToken, roles: assignedRoles = [], docLabel, docSection } = req.body || {};
  if (!ownerWriteToken) return res.status(403).json({ error: 'owner_write_token required' });
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can request documents');
  if (!docLabel) return res.status(400).json({ error: 'docLabel required' });
  const RESEND_KEY = process.env.RESEND_API_KEY;

  try {
    const { data: room, error: roomErr } = await supabase
      .from('deal_rooms')
      .select('property_name, first_name')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (roomErr) throw roomErr;
    if (!room) return res.status(404).json({ error: 'room not found' });

    const propName   = room.property_name || propertyId;
    const senderName = room.first_name || 'The workspace coordinator';
    const roomUrl    = `${FRONTEND_URL}/deal-room/${propertyId}`;

    // Find all invited participants for the assignedTo roles
    let recipients = [];
    if (assignedRoles.length > 0) {
      const { data: invites } = await supabase
        .from('deal_room_invites')
        .select('invited_email, role_key')
        .eq('property_id', propertyId)
        .in('role_key', assignedRoles)
        .not('invited_email', 'is', null);
      if (invites?.length) {
        recipients = invites.map(i => ({ email: i.invited_email, roleKey: i.role_key }));
      }
    }

    if (!RESEND_KEY || recipients.length === 0) {
      // Log the request even if no email can be sent
      logEvent(propertyId, 'document_requested', 'owner', senderName,
        `Document requested: ${docLabel} from ${assignedRoles.join(', ') || 'assigned participant'}`,
        { docSection, docLabel, emailSent: false, reason: recipients.length === 0 ? 'no_participant_found' : 'no_resend_key' }
      ).catch(() => {});
      return res.json({ ok: true, emailSent: false, reason: recipients.length === 0 ? 'no_participant_found' : 'email_not_configured' });
    }

    // Send an email to each found participant
    await Promise.all(recipients.map(({ email, roleKey }) =>
      sendResendEmail(RESEND_KEY, {
        from: 'Kontra <notifications@kontraplatform.com>',
        to: email,
        subject: `Action needed: please upload "${docLabel}" — ${propName}`,
        text: `${senderName} is requesting that you upload "${docLabel}" to the deal room for ${propName} on Kontra.\n\nOpen your workspace to upload the document:\n${roomUrl}\n\n---\nKontra transaction workspace. If you believe this was sent in error, ignore this message.`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
            <h2 style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Document requested</h2>
            <p style="color:#555;font-size:15px;margin:0 0 8px">
              <strong>${senderName}</strong> is requesting that you upload a document to the deal room for <strong>${propName}</strong>.
            </p>
            <div style="margin:16px 0;padding:12px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px">
              <p style="margin:0;font-size:14px;font-weight:700;color:#9a3412">📄 ${docLabel}</p>
            </div>
            <p style="color:#555;font-size:14px;margin:0 0 24px">
              Please log into your workspace and upload this document at your earliest convenience.
            </p>
            <a href="${roomUrl}"
              style="display:inline-block;padding:12px 24px;background:#800020;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
              Open workspace →
            </a>
            <p style="color:#bbb;font-size:11px;margin-top:24px">Kontra deal room · ${propName}</p>
          </div>`,
      })
    ));

    logEvent(propertyId, 'document_requested', 'owner', senderName,
      `Document requested: ${docLabel} from ${recipients.map(r => r.email).join(', ')}`,
      { docSection, docLabel, recipients: recipients.map(r => r.email) }
    ).catch(() => {});

    res.json({ ok: true, emailSent: true, recipients: recipients.map(r => r.email) });
  } catch (err) {
    console.error('[request-document]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Activity timeline ───────────────────────────────────────────────────────
app.get('/api/public/deal-room/:propertyId/events', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    const { data, error } = await supabase.from('deal_events').select('*')
      .eq('property_id', propertyId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.set('Cache-Control', 'no-store');
    const events = access.mode === 'participant'
      ? (data || []).filter(e => e.actor_role === access.role || e.event_type === 'stage_advanced')
      : (data || []);
    res.json({ events });
  } catch (err) { console.error('[events]', err.message); res.json({ events: [] }); }
});

// ── Comments ────────────────────────────────────────────────────────────────
app.get('/api/public/deal-room/:propertyId/comments', async (req, res) => {
  const { propertyId } = req.params;
  const { section } = req.query;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    let q = supabase.from('deal_comments').select('*').eq('property_id', propertyId);
    if (section) q = q.eq('section', section);
    const { data, error } = await q.order('created_at', { ascending: true });
    if (error) throw error;
    let comments = data || [];
    if (access.mode === 'participant') {
      const { data: room } = await supabase
        .from('deal_rooms')
        .select('workflow_pack_id, property_type')
        .eq('property_id', propertyId)
        .maybeSingle();
      const assignedSections = await getAssignedSectionsForAccess(
        propertyId,
        room?.workflow_pack_id || DEFAULT_PACK_ID,
        room?.property_type || 'Multifamily',
        access,
      );
      comments = comments.filter(comment => assignedSections.has(comment.section));
    }
    res.json({ comments, role: access.role });
  } catch (err) { console.error('[comments-get]', err.message); res.json({ comments: [] }); }
});

app.post('/api/public/deal-room/:propertyId/comments', async (req, res) => {
  const { propertyId } = req.params;
  const { section, role, author_name, content } = req.body || {};
  if (!section || !role || !content) return res.status(400).json({ error: 'section, role, content required' });
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    if (access.mode === 'participant') {
      const { data: room } = await supabase
        .from('deal_rooms')
        .select('workflow_pack_id, property_type')
        .eq('property_id', propertyId)
        .maybeSingle();
      const assignedSections = await getAssignedSectionsForAccess(
        propertyId,
        room?.workflow_pack_id || DEFAULT_PACK_ID,
        room?.property_type || 'Multifamily',
        access,
      );
      if (!assignedSections.has(section)) {
        return accessDenied(res, 'Comments are limited to document sections assigned to your role');
      }
    }
    const effectiveRole = access.mode === 'participant' ? access.role : role;
    const { data, error } = await supabase.from('deal_comments').insert({
      property_id: propertyId, section, role: effectiveRole, author_name: author_name || effectiveRole, content,
    }).select().single();
    if (error) throw error;
    logEvent(propertyId, 'comment_added', effectiveRole, author_name, `Comment on ${section}`, { section });
    res.json({ comment: data });
  } catch (err) { console.error('[comments-post]', err.message); res.status(500).json({ error: err.message }); }
});

app.patch('/api/public/deal-room/:propertyId/comments/:commentId/resolve', async (req, res) => {
  const { propertyId, commentId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId, req.body?.ownerWriteToken);
    if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can resolve comments');
    const { error } = await supabase.from('deal_comments').update({ resolved: true })
      .eq('id', commentId).eq('property_id', propertyId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { console.error('[comment-resolve]', err.message); res.status(500).json({ error: err.message }); }
});

// ── Submission approval status ──────────────────────────────────────────────
app.patch('/api/public/deal-room/:propertyId/submissions/:subRole/status', async (req, res) => {
  const { propertyId, subRole } = req.params;
  const { status, status_note, updater_role } = req.body || {};
  const VALID_STATUS = ['submitted', 'needs_revision', 'approved', 'rejected'];
  if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'invalid status' });
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can change participant status');
    const { error } = await supabase.from('party_submissions').update({
      status, status_note: status_note || null, status_updated_at: new Date().toISOString(),
    }).eq('property_id', propertyId).eq('role', subRole);
    if (error) throw error;
    const STATUS_LABELS = { submitted: 'Submitted', needs_revision: 'Needs Revision', approved: 'Approved', rejected: 'Rejected' };
    logEvent(propertyId, 'status_changed', access.role, null,
      `${subRole} submission marked ${STATUS_LABELS[status] || status}`, { role: subRole, status });
    res.json({ ok: true });
    notifyStatusChange(propertyId, subRole, status, status_note, access.role).catch(() => {});
  } catch (err) { console.error('[submission-status]', err.message); res.status(500).json({ error: err.message }); }
});

// ── Public AI Tools — extracted to routers/aiDealReview.js ──────────────────
app.use('/api/ai', aiDealReviewRouter);

// ── Task Engine + AI Ownership Layer — PUBLIC, must stay BEFORE
// requireOrgContext (same property-scoped access model as the other public
// deal-room routes above). See lib/taskEngine.js for the Observe Mode rules.
app.use('/api/public', tasksRouter);
app.use('/api/public', verificationRouter);

// AI Operations Manager — PUBLIC, must stay BEFORE requireOrgContext. Answer
// engine grounded in the Task Engine above; read-only, no task mutation.
// See lib/operationsManager.js and .agents/memory/kontra-task-architecture.md.
// Live-room Copilot requests must use the same verified owner/participant
// boundary as the rest of the deal-room APIs. Demo brain routes are registered
// above this middleware and keep their existing demo behavior.
app.use('/api/public/deal-room/:propertyId/brain', async (req, res, next) => {
  try {
    const access = await getRoomAccessContext(req, req.params.propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    req.roomAccess = access;
    return next();
  } catch (err) {
    console.error('[operationsManager access]', err.message);
    return accessDenied(res);
  }
});
app.use('/api/public', operationsManagerRouter);

// Workflow Packs — PUBLIC, must stay BEFORE requireOrgContext. These power
// public, unauthenticated deal rooms (built via the Workflow Pack Builder),
// same as the public deal-room routes above.
app.use('/api', workflowPacksRouter);

// Participant security v2 — PUBLIC (has its own JWT auth inside each handler).
// Must stay BEFORE requireOrgContext — these endpoints are called by
// unauthenticated participants and owners who do not have an org JWT.
app.use('/api/v2/deal-room', dealRoomSecurityV2Router);

// Tokenization execution boundary — keep synthetic/ledger-only mutation paths
// clearly disabled before authentication can turn them into an ambiguous 401.
// Readiness and preparation endpoints (/tokenization/assess, /contract/*)
// intentionally remain available.
const PRODUCTION_TOKENIZATION_EXECUTION_PATHS = [
  '/tokenization/packages',
  '/tokenization/whitelist',
  '/tokenization/transfers',
  '/tokenization/payments',
  '/tokenization/secondary-market',
  '/tokenization/governance',
  '/tokenization/pools',
  '/capital-markets/tokens',
  '/pools',
  '/investments',
  '/investors/subscribe',
  '/tokenize-loan',
];
const PRODUCTION_TOKENIZATION_MUTATION_PREFIXES = [
  '/marketplace',
  '/trades',
  '/exchange-programs',
  '/markets',
];
const PRODUCTION_MARKET_EXECUTION_PREFIXES = [
  '/market/tokenize',
  '/market/offerings',
  '/market/approvals',
  '/market/rfq',
  '/market/trades',
];
const MARKET_PREPARATION_SUFFIXES = [
  '/disclosures/generate',
  '/ai/summary',
];
app.use('/api', (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  const isKnownExecutionPath = PRODUCTION_TOKENIZATION_EXECUTION_PATHS.some(path =>
    req.path === path || req.path.startsWith(`${path}/`)
  );
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const isMutationPrefix = isMutation && PRODUCTION_TOKENIZATION_MUTATION_PREFIXES.some(path =>
    req.path === path || req.path.startsWith(`${path}/`)
  );
  const isMarketExecution = isMutation
    && PRODUCTION_MARKET_EXECUTION_PREFIXES.some(path =>
      req.path === path || req.path.startsWith(`${path}/`)
    )
    && !MARKET_PREPARATION_SUFFIXES.some(suffix => req.path.endsWith(suffix));
  const isDrawTokenization = req.method === 'POST'
    && /^\/draw-requests\/[^/]+\/(?:tokenize|tokenizations\/mint)$/.test(req.path);
  const isBlockchainLedgerWrite = req.method === 'POST'
    && ['/blockchain/transactions', '/blockchain/cashflows'].includes(req.path);
  const isLoanGovernanceExecution = req.method === 'POST'
    && /^\/loan-governance\/proposals\/[^/]+\/execute$/.test(req.path);
  const isInvestorWhitelistWrite = isMutation
    && (req.path === '/investors/whitelist' || req.path.startsWith('/investors/whitelist/'));
  const isStablecoinPaymentCreation = req.method === 'POST'
    && req.path === '/payments/stablecoin';
  const isExchangeExecution = isMutation && [
    '/exchange/tokenize',
    '/exchange/listings',
    '/exchange/offers',
    '/exchange/trades',
  ].some(path => req.path === path || req.path.startsWith(`${path}/`));

  if (!isKnownExecutionPath && !isMutationPrefix && !isMarketExecution && !isDrawTokenization
    && !isBlockchainLedgerWrite && !isLoanGovernanceExecution
    && !isInvestorWhitelistWrite && !isStablecoinPaymentCreation
    && !isExchangeExecution) {
    return next();
  }
  return res.status(503).json({
    error: 'TOKENIZATION_EXECUTION_DISABLED',
    message: 'This tokenization execution surface is preparation-only until a live authorized chain adapter and durable evidence path are enabled.',
    alternative: '/api/tokenization/assess',
  });
});

app.use('/api', requireOrgContext);
app.use('/api/dashboard-layout', authenticate, dashboard);
app.use('/api/portfolio', portfolioSliceRouter);
app.use('/api/servicing', servicingSliceRouter);
app.use('/api/governance', governanceSliceRouter);
app.use('/api/markets', marketsSliceRouter);
app.use('/api/reports', reportsSliceRouter);
app.use('/api/orgs', orgsSliceRouter);
app.use('/api/ai', aiSliceRouter);
app.use('/api', workflowsSliceRouter);
app.use('/api/agent-console',  agentConsoleRouter);
app.use('/api/integration',   integrationHubRouter);
app.use('/api/v1',            headlessApiRouter);
app.use('/api/tokenization',  phase6TokenizationRouter);
app.use('/api/cost',          phase7CostGovernanceRouter);
app.use('/api/cc',            phase8CommandCentersRouter);
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devSliceRouter);
}
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
app.use('/api/billing', billingRouter);
app.use('/api/loan-governance', loanGovernanceRouter);
app.use('/api/onboarding', authenticate, onboardingRouter);
app.use('/api/rules', authenticate, rulesRouter);
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
app.use('/api', paymentsStablecoinRouter);
app.use('/api', paymentsStablecoinWebhookRouter);
app.use('/api', paymentsStripeRouter);
app.use('/api', aiReviewsRouter);
app.use('/api', payoffsRouter);
app.use('/api', escrowDisbursementsRouter);
app.use('/api', poolInvestmentsRouter);
app.use('/api', assetDigitizationRouter);
app.use('/api', tokenizationRouter);
app.use('/api', blockchainRouter);
app.use('/api', marketDistributionRouter);
app.use('/api', delinquencyAlertsRouter);
app.use('/api', communicationsLogRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/exchange', exchangeRouter);
app.use('/api/exchange-programs', exchangeProgramsRouter);
app.use('/api/investors', investorsRouter);
app.use('/api/investor', investorRouter);
app.use('/api/servicer', servicerRouter);
app.use('/api/ai',       aiDocsRouter);
app.use('/api/borrower', borrowerRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/capital-markets/tokens', capitalMarketsTokensRouter);
app.use('/api/legal', legalRouter);
app.use('/api', subscriptionsRouter);
app.use('/api/searches', savedSearchesRouter);
app.use('/api/site-analysis', siteAnalysisRouter);
app.use('/api', analyticsRouter);
app.use('/api', visitorsRouter);
app.use('/api', waitlistRouter);
app.use('/api', covenantAgentRouter);
app.use('/api', underwritingRouter);
app.use('/api', eventsRouter);
app.use('/api', mobileRouter);
app.use('/api', restaurantRouter);
app.use('/api', restaurantsRouter);

// ── Health Checks ──────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('Sentry test running!'));
app.get('/api/test', (req, res) => res.send('✅ API is alive'));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/api/whoami', authenticate, (req, res) => {
  res.json({
    ok: true,
    user: req.user ?? null,
    tenant_id: req.tenant_id ?? req.orgId ?? null,
    roles: req.role ?? "member",
  });
});
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
  app.use('/api/policy', authenticate, policyRouter);
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

// 404 and error handlers moved to end of file (after all route registrations).

// ── Start Server ──────────────────────────────────────────────────────────

async function logBaselineSchemaHealth() {
  const checks = [
    ['assets', 'id,org_id'],
    ['loans', 'id,org_id'],
    ['inspections', 'id,org_id'],
    ['exchange_listings', 'id,org_id'],
    ['payments', 'id,org_id,currency'],
    ['escrows', 'id,org_id'],
    ['draws', 'id,org_id'],
    ['borrower_financials', 'id,org_id'],
    ['management_items', 'id,org_id'],
    ['pools', 'id,org_id'],
    ['tokens', 'id,org_id'],
    ['compliance_items', 'id,org_id'],
    ['legal_items', 'id,org_id'],
    ['regulatory_scans', 'id,org_id'],
    ['risk_items', 'id,org_id'],
    ['document_reviews', 'id,org_id'],
    ['reports', 'id,org_id'],
    ['org_memberships', 'id,org_id,user_id,role'],
  ];

  const missing = [];

  for (const [table, columns] of checks) {
    const { error } = await supabase.from(table).select(columns).limit(1);
    if (error) {
      missing.push({ table, code: error.code, message: error.message });
    }
  }

  if (missing.length > 0) {
    console.warn('[schema] Baseline migration appears missing or incomplete.');
    console.warn('[schema] Run: supabase db push (or supabase migration up) before using dev API.');
    console.warn('[schema] Failing checks:', missing);
    return;
  }

  console.log('[schema] Baseline migration check passed.');
}

// ── User Properties CRUD ──────────────────────────────────────────────────

function mapDbToProperty(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type || null,
    address: row.address || null,
    city: row.city || null,
    state: row.state || null,
    units: row.units || null,
    sqft: row.sqft || null,
    yearBuilt: row.year_built || null,
    occupancy: row.occupancy || null,
    noi: row.noi || null,
    status: row.status || 'Active',
    risk: 'Unknown',
    riskColor: '#6b7280',
    createdAt: row.created_at,
  };
}

app.get('/api/user-properties', authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { data, error } = await supabase
      .from('user_properties')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ properties: (data || []).map(mapDbToProperty) });
  } catch (err) {
    console.error('[user-properties GET]', err.message);
    res.json({ properties: [] }); // Fail gracefully — client falls back to localStorage
  }
});

app.post('/api/user-properties', authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, type, address, city, state, units, sqft, yearBuilt, occupancy, noi } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Property name required' });
  try {
    const { data, error } = await supabase
      .from('user_properties')
      .insert([{
        user_id: userId,
        name,
        type: type || null,
        address: address || null,
        city: city || null,
        state: state || null,
        units: units ? Number(units) : null,
        sqft: sqft ? Number(sqft) : null,
        year_built: yearBuilt ? Number(yearBuilt) : null,
        occupancy: occupancy ? Number(occupancy) : null,
        noi: noi ? Number(noi) : null,
      }])
      .select()
      .single();
    if (error) throw error;
    res.json({ property: mapDbToProperty(data) });
  } catch (err) {
    console.error('[user-properties POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user-properties/:id', authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, type, address, city, state, units, sqft, yearBuilt, occupancy, noi } = req.body || {};
  try {
    const updates = {};
    if (name) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (units !== undefined) updates.units = units ? Number(units) : null;
    if (sqft !== undefined) updates.sqft = sqft ? Number(sqft) : null;
    if (yearBuilt !== undefined) updates.year_built = yearBuilt ? Number(yearBuilt) : null;
    if (occupancy !== undefined) updates.occupancy = occupancy ? Number(occupancy) : null;
    if (noi !== undefined) updates.noi = noi ? Number(noi) : null;
    const { data, error } = await supabase
      .from('user_properties')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ property: mapDbToProperty(data) });
  } catch (err) {
    console.error('[user-properties PUT]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user-properties/:id', authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { error } = await supabase
      .from('user_properties')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[user-properties DELETE]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Stripe Checkout ────────────────────────────────────────────────────────
app.post('/api/checkout', authenticate, async (req, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey.startsWith('placeholder') || stripeKey.length < 20) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Payments are not yet enabled. Contact hello@kontraplatform.com to upgrade.',
      });
    }
    const stripe = require('stripe')(stripeKey);
    const { propertyId, propertyName, plan = 'deal' } = req.body;
    const origin = req.headers.origin || 'https://kontraplatform.com';
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    // Plan config — inline pricing, no pre-created Stripe price IDs required
    const PLANS = {
      deal: {
        name: 'Kontra Deal Room',
        description: propertyName ? `Deal room for ${propertyName}` : 'Per-deal access for all parties',
        amount: 49900, // $499.00
        mode: 'payment',
      },
      pro_monthly: {
        name: 'Kontra Pro — Monthly',
        description: 'Unlimited deal rooms, full AI suite',
        amount: 29900, // $299/mo
        mode: 'subscription',
      },
      pro_annual: {
        name: 'Kontra Pro — Annual',
        description: 'Unlimited deal rooms, full AI suite (billed annually)',
        amount: 249900, // $2,499/yr
        mode: 'subscription',
      },
    };

    const cfg = PLANS[plan] || PLANS.deal;

    const lineItem = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        product_data: { name: cfg.name, description: cfg.description },
        unit_amount: cfg.amount,
        ...(cfg.mode === 'subscription' ? { recurring: { interval: plan === 'pro_annual' ? 'year' : 'month' } } : {}),
      },
    };

    const sessionParams = {
      mode: cfg.mode,
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: `${origin}/dashboard?checkout=success&plan=${plan}${propertyId ? `&property=${propertyId}` : ''}`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
      metadata: { userId: userId || '', plan, propertyId: propertyId || '' },
    };
    if (userEmail) sessionParams.customer_email = userEmail;

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[checkout]', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ── Link Revocation — owner regenerates invite links ──────────────────────────
app.post('/api/public/deal-room/:propertyId/regenerate-links', async (req, res) => {
  const { propertyId } = req.params;
  const access = await getRoomAccessContext(req, propertyId, req.body?.ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Only the deal-room owner can regenerate links');
  try {
    const newToken = crypto.randomBytes(16).toString('hex');
    const { error } = await supabase.from('deal_rooms')
      .update({ link_token: newToken })
      .eq('property_id', propertyId);
    if (error) throw error;
    res.json({ ok: true, link_token: newToken });
  } catch (err) {
    console.error('[regenerate-links]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Upload / Multer error handler ─────────────────────────────────────────────
// ── Transaction Record ────────────────────────────────────────────────────────
// Architecture: Transaction → Verification → Verified Record → DA Readiness
// These routes power the Asset Record tab — field-level structured data,
// source-linked from uploaded documents.

app.get('/api/public/deal-room/:propertyId/transaction-record', async (req, res) => {
  const { propertyId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    const [{ data: fields, error: fieldsError }, { data: room, error: roomError }] = await Promise.all([
      supabase
        .from('transaction_record_fields')
        .select('*')
        .eq('property_id', propertyId)
        .order('field_category', { ascending: true })
        .order('display_label', { ascending: true }),
      supabase
        .from('deal_rooms')
        .select('workflow_pack_id, deal_type')
        .eq('property_id', propertyId)
        .maybeSingle(),
    ]);
    if (fieldsError) throw fieldsError;
    if (roomError) throw roomError;
    const schemaKey = await resolveTransactionSchemaKey(room);
    res.json({
      fields: fields || [],
      record_state: computeTransactionRecordState(fields || [], schemaKey),
    });
  } catch (err) {
    console.error('[transaction-record GET]', err.message);
    res.json({ fields: [] });
  }
});

app.get('/api/public/deal-room/:propertyId/transaction-record/fields/:fieldId/history', async (req, res) => {
  const { propertyId, fieldId } = req.params;
  try {
    const access = await getRoomAccessContext(req, propertyId);
    if (access.mode === 'anonymous') return accessDenied(res);
    const { data, error } = await supabase
      .from('transaction_record_history')
      .select('*')
      .eq('property_id', propertyId)
      .eq('field_id', fieldId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ history: data || [] });
  } catch (err) {
    console.error('[transaction-record history GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/public/deal-room/:propertyId/transaction-record/fields/:fieldId', async (req, res) => {
  const { propertyId, fieldId } = req.params;
  const { value_text, notes, status, ownerWriteToken } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  // Sealed workspaces: transaction_record_fields are immutable after the Transaction Seal is created.
  // Post-completion documents can still be uploaded (they are flagged post_completion=true).
  const { data: sealedRoom } = await supabase.from('deal_rooms').select('sealed_at').eq('property_id', propertyId).maybeSingle();
  if (sealedRoom?.sealed_at) {
    return res.status(400).json({
      error: 'WORKSPACE_SEALED',
      message: 'Transaction record fields are immutable after the workspace is sealed. The Transaction Seal was created at ' + sealedRoom.sealed_at + '. New documents can still be added as post-completion records.',
      sealed_at: sealedRoom.sealed_at,
    });
  }

  const ALLOWED_STATUSES = ['missing','extracted','needs_review','verified','conflicting','not_applicable'];
  const update = { updated_at: new Date().toISOString() };
  if (value_text !== undefined) { update.value_text = String(value_text).slice(0, 2000); update.extracted_by = 'coordinator'; }
  if (notes !== undefined)      update.notes = String(notes).slice(0, 500);
  if (status && ALLOWED_STATUSES.includes(status)) update.status = status;
  try {
    const { data: existing } = await supabase
      .from('transaction_record_fields')
      .select('id, field_key, value_text, status')
      .eq('id', fieldId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Transaction Record field not found' });
    const { error } = await supabase
      .from('transaction_record_fields')
      .update(update)
      .eq('id', fieldId)
      .eq('property_id', propertyId);
    if (error) throw error;
    const nextStatus = update.status || existing.status;
    const nextValue = update.value_text !== undefined ? update.value_text : existing.value_text;
    const eventType = nextStatus === 'not_applicable'
      ? 'marked_not_applicable'
      : nextStatus === 'conflicting'
        ? 'conflict'
        : nextValue !== existing.value_text ? 'manual_edit' : null;
    if (eventType) {
      await recordTransactionFieldHistory({
        fieldId,
        propertyId,
        eventType,
        actorEmail: access.email || 'coordinator',
        actorRole: 'Deal Coordinator',
        priorValue: existing.value_text,
        newValue: nextValue,
        priorStatus: existing.status,
        newStatus: nextStatus,
      });
    }
    if (nextStatus === 'not_applicable') {
      await markDependentTransactionFieldsNotApplicable(propertyId, existing.field_key, access.email || 'coordinator');
    }
    recalculateTransactionState(propertyId, {
      source: 'transaction_record_field_updated',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] field update recalculation failed:', e.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('[transaction-record PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/public/deal-room/:propertyId/transaction-record/fields/:fieldId/verify', async (req, res) => {
  const { propertyId, fieldId } = req.params;
  const { ownerWriteToken, actorRole } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  // Sealed workspaces: transaction_record_fields and their approvals are immutable.
  const { data: sealedRoom } = await supabase.from('deal_rooms').select('sealed_at, customer_email').eq('property_id', propertyId).maybeSingle();
  if (sealedRoom?.sealed_at) {
    return res.status(400).json({
      error: 'WORKSPACE_SEALED',
      message: 'Transaction record fields are immutable after the workspace is sealed. The Transaction Seal was created at ' + sealedRoom.sealed_at + '.',
      sealed_at: sealedRoom.sealed_at,
    });
  }

  try {
    const room = sealedRoom; // already fetched above
    const email = room?.customer_email || 'coordinator';
    const { error: fErr } = await supabase
      .from('transaction_record_fields')
      .select('id').eq('id', fieldId).eq('property_id', propertyId).maybeSingle();
    if (fErr) throw fErr;
    const { data: existing } = await supabase.from('transaction_record_fields')
      .select('id, value_text, status')
      .eq('id', fieldId).eq('property_id', propertyId).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Transaction Record field not found' });
    const nextValue = existing.value_text;
    await supabase.from('transaction_record_fields').update({
      status: 'verified', verified_by: email,
      verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', fieldId).eq('property_id', propertyId);
    await recordTransactionFieldHistory({
      fieldId, propertyId, eventType: 'confirmed',
      actorEmail: email, actorRole: actorRole || 'coordinator',
      priorValue: existing.value_text, newValue: nextValue,
      priorStatus: existing.status, newStatus: 'verified',
    });
    await supabase.from('transaction_record_approvals').insert({
      field_id: fieldId, property_id: propertyId,
      action: 'approved', actor_email: email, actor_role: actorRole || 'coordinator',
    });
    recalculateTransactionState(propertyId, {
      source: 'transaction_record_field_confirmed',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] field confirmation recalculation failed:', e.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('[transaction-record verify]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create or upsert a field manually (coordinator enters value before extraction)
app.post('/api/public/deal-room/:propertyId/transaction-record/fields', async (req, res) => {
  const { propertyId } = req.params;
  const { field_key, display_label, field_category, value_text, notes, status, ownerWriteToken } = req.body || {};
  if (!field_key || !field_category) return res.status(400).json({ error: 'field_key and field_category required' });
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  // Sealed workspaces: transaction_record_fields are immutable after the Transaction Seal is created.
  const { data: sealedRoom } = await supabase.from('deal_rooms').select('sealed_at').eq('property_id', propertyId).maybeSingle();
  if (sealedRoom?.sealed_at) {
    return res.status(400).json({
      error: 'WORKSPACE_SEALED',
      message: 'Transaction record fields are immutable after the workspace is sealed. The Transaction Seal was created at ' + sealedRoom.sealed_at + '. New documents can still be added as post-completion records.',
      sealed_at: sealedRoom.sealed_at,
    });
  }

  const ALLOWED_STATUSES = ['missing','extracted','needs_review','verified','not_applicable'];
  const now = new Date().toISOString();
  try {
    // Try update first (in case a record already exists for this key)
      const { data: existing } = await supabase
      .from('transaction_record_fields')
        .select('id, field_key, value_text, status')
      .eq('property_id', propertyId)
      .eq('field_key', field_key)
      .maybeSingle();
    if (existing?.id) {
      const update = { updated_at: now };
      if (value_text !== undefined) { update.value_text = String(value_text).slice(0, 2000); update.extracted_by = 'coordinator'; }
      if (notes !== undefined)      update.notes = String(notes).slice(0, 500);
      if (status && ALLOWED_STATUSES.includes(status)) update.status = status;
      else if (value_text) update.status = 'needs_review';
      const { error } = await supabase.from('transaction_record_fields').update(update).eq('id', existing.id);
      if (error) throw error;
        const nextStatus = update.status || (value_text ? 'needs_review' : existing.status);
        const nextValue = value_text !== undefined ? String(value_text).slice(0, 2000) : existing.value_text;
        const eventType = nextStatus === 'not_applicable'
          ? 'marked_not_applicable'
          : nextValue !== existing.value_text ? 'manual_edit' : null;
        if (eventType) {
          await recordTransactionFieldHistory({
            fieldId: existing.id,
            propertyId,
            eventType,
            actorEmail: access.email || 'coordinator',
            actorRole: 'Deal Coordinator',
            priorValue: existing.value_text,
            newValue: nextValue,
            priorStatus: existing.status,
            newStatus: nextStatus,
          });
        }
        if (nextStatus === 'not_applicable') {
          await markDependentTransactionFieldsNotApplicable(propertyId, field_key, access.email || 'coordinator');
        }
        recalculateTransactionState(propertyId, {
          source: 'transaction_record_field_updated',
          actorId: access.actorId,
          actorType: access.actorType,
        }).catch(e => console.warn('[transaction-state] field update recalculation failed:', e.message));
      return res.json({ ok: true, action: 'updated', id: existing.id });
    }
    // Insert new
    const insert = {
      property_id:    propertyId,
      field_key:      String(field_key).slice(0, 100),
      display_label:  display_label ? String(display_label).slice(0, 200) : field_key,
      field_category: String(field_category).slice(0, 100),
      value_text:     value_text ? String(value_text).slice(0, 2000) : null,
      notes:          notes ? String(notes).slice(0, 500) : null,
      status:         (status && ALLOWED_STATUSES.includes(status)) ? status : (value_text ? 'needs_review' : 'missing'),
      extracted_by:   'coordinator',
      created_at:     now,
      updated_at:     now,
    };
    const { data, error } = await supabase.from('transaction_record_fields').insert(insert).select('id').single();
    if (error) throw error;
    const eventType = insert.status === 'not_applicable' ? 'marked_not_applicable' : 'manual_edit';
    await recordTransactionFieldHistory({
      fieldId: data.id,
      propertyId,
      eventType,
      actorEmail: access.email || 'coordinator',
      actorRole: 'Deal Coordinator',
      newValue: insert.value_text,
      newStatus: insert.status,
    });
    if (insert.status === 'not_applicable') {
      await markDependentTransactionFieldsNotApplicable(propertyId, field_key, access.email || 'coordinator');
    }
    recalculateTransactionState(propertyId, {
      source: 'transaction_record_field_created',
      actorId: access.actorId,
      actorType: access.actorType,
    }).catch(e => console.warn('[transaction-state] field create recalculation failed:', e.message));
    res.json({ ok: true, action: 'created', id: data?.id });
  } catch (err) {
    console.error('[transaction-record POST field]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/public/deal-room/:propertyId/transaction-record/extract', async (req, res) => {
  const { propertyId } = req.params;
  const { ownerWriteToken } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');
  res.json({ ok: true, message: 'Re-extraction queued' });
  // Background: re-extract from all stored documents
  (async () => {
    try {
      // Fetch ALL analyses — documents with storage_path use the file,
      // documents without (e.g. LOI uploaded before storage was configured)
      // fall back to their AI-analysis summary text so we still extract what we can.
      const { data: analyses } = await supabase
        .from('deal_analyses')
        .select('id, section, filename, storage_path, analysis')
        .eq('property_id', propertyId);
      if (!analyses?.length) return;
      for (const doc of analyses) {
        try {
          let text = '';

          if (doc.storage_path) {
            // Primary path: re-download the stored file and extract text from it
            const { data: urlData } = await supabase.storage
              .from('deal-documents')
              .createSignedUrl(doc.storage_path, 60);
            if (urlData?.signedUrl) {
              const buf = Buffer.from(await (await fetch(urlData.signedUrl)).arrayBuffer());
              try {
                if (doc.filename?.match(/\.(pdf)$/i)) {
                  const { PDFParse } = require('pdf-parse');
                  const parser = new PDFParse({ data: buf });
                  const parsed = await parser.getText();
                  text = (parsed?.text || '').slice(0, 8000);
                } else {
                  text = buf.toString('utf8', 0, 6000);
                }
              } catch { text = buf.toString('utf8', 0, 4000); }
            }
          }

          // Fallback: if the file isn't in storage, use the AI analysis summary.
          // It's shorter than the full document but better than nothing — it often
          // contains the key extracted facts (buyer, price, asset) in sentence form.
          if (!text || text.trim().length < 50) {
            const summary = doc.analysis?.summary || '';
            if (summary.length > 50) {
              text = `Section: ${doc.section}\nFilename: ${doc.filename}\n\n${summary}`;
              console.log(`[tx-record re-extract] using summary fallback for ${doc.section} (no storage path)`);
            }
          }

          if (text.trim().length > 50) {
            await extractTransactionFields(propertyId, doc.id, text, doc.section);
          }
        } catch (docErr) {
          console.warn('[tx-record re-extract]', doc.id, docErr.message);
        }
      }
    } catch (err) {
      console.warn('[tx-record re-extract outer]', err.message);
    }
  })();
});

// ── Optional digital-asset preparation request ────────────────────────────────
// Uses the background transaction record without exposing token economics or a
// tokenization workflow in the deal-room UI. The response intentionally reports
// only missing facts that the owner can supply before an external handoff.
app.post('/api/public/deal-room/:propertyId/digital-asset-prep', async (req, res) => {
  const { propertyId } = req.params;
  const { ownerWriteToken } = req.body || {};
  const access = await getRoomAccessContext(req, propertyId, ownerWriteToken);
  if (access.mode !== 'owner') return accessDenied(res, 'Owner access required');

  try {
    const [{ data: room, error: roomErr }, { data: fields, error: fieldsErr }] = await Promise.all([
      supabase.from('deal_rooms').select('metadata_values').eq('property_id', propertyId).maybeSingle(),
      supabase.from('transaction_record_fields')
        .select('field_key, display_label, value_text, status')
        .eq('property_id', propertyId)
        .order('display_label', { ascending: true }),
    ]);
    if (roomErr) throw roomErr;
    if (fieldsErr) throw fieldsErr;
    if (!room) return res.status(404).json({ error: 'room not found' });

    const recordFields = fields || [];
    const tokenizationGuidance = buildTokenizationGuidance({
      recordFields,
      enabled: true,
    });
    const missing = tokenizationGuidance.gaps
      .slice(0, 12)
      .map(field => ({
        field_key: field.key,
        label: field.label,
        reason: field.reason,
        status: field.status,
      }));
    const now = new Date().toISOString();
    const preparedPackage = {
      package_type: 'digital_asset_preparation',
      preparation_status: missing.length > 0 ? 'needs_information' : 'inputs_captured',
      prepared_at: now,
      facts: tokenizationGuidance.known,
      missing,
      optional: true,
      disclaimer: 'AI-prepared coordination data only. Kontra does not determine legal or regulatory outcomes and does not issue, sell, recommend, custody, or settle digital assets.',
    };
    const metadata = {
      ...(room.metadata_values || {}),
      digital_asset_prep_requested: true,
      digital_asset_prep_opted_in: true,
      digital_asset_prep_requested_at: now,
      digital_asset_prep_package: preparedPackage,
    };
    const { error: updateErr } = await supabase
      .from('deal_rooms')
      .update({ metadata_values: metadata })
      .eq('property_id', propertyId);
    if (updateErr) throw updateErr;

    logEvent(propertyId, 'digital_asset_prep_requested', 'owner', null, 'Digital asset preparation requested', {
      missing_count: missing.length,
    });

    res.json({
      ok: true,
      status: missing.length > 0 ? 'needs_information' : 'inputs_captured',
      missing,
      prepared_field_count: tokenizationGuidance.known.length,
      package: preparedPackage,
      requested_at: now,
    });
  } catch (err) {
    console.error('[digital-asset-prep]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large — maximum size is 20MB. Please compress the file and try again.' });
  }
  if (err.message?.includes('File type not allowed')) {
    return res.status(415).json({ error: 'Unsupported file type. Accepted formats: PDF, Word, Excel, CSV, JPEG, PNG.' });
  }
  console.error('[unhandled error]', err.message);
  res.status(500).json({ error: err.message || 'Server error' });
});

// ── Startup migration: ensure workflow_pack_id column exists ─────────────────
// Migration 005 is manual-only; run it automatically here so Render/production
// gets the column on first boot without a manual Supabase SQL editor step.
async function ensureWorkflowPackIdColumn() {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS workflow_pack_id text DEFAULT 'cre_acquisition'`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stated_revenue NUMERIC`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stated_ebitda NUMERIC`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS checklist_items JSONB`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS owner_write_token TEXT`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS stages_config JSONB`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS metadata_values JSONB`
    );
    await pool.query(
      `ALTER TABLE deal_rooms ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(64)`
    );
    // transaction_record_fields and transaction_record_approvals are NOT created
    // here. They must be applied via the committed Supabase migration:
    //   kontra-ui-clone/api/migrations/015_transaction_record.sql
    // Startup checks are kept read-only beyond the deal_rooms column additions above.
    // analytics_events — created here so it's always present when first event arrives
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id           BIGSERIAL PRIMARY KEY,
        session_id   TEXT NOT NULL,
        event_name   TEXT NOT NULL,
        workspace_id TEXT,
        properties   JSONB DEFAULT '{}',
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS analytics_events_event_name_idx ON analytics_events (event_name)`);
    await pool.end();
    console.log('[startup] deal_rooms schema columns ready (workflow_pack_id, stated_revenue, stated_ebitda, checklist_items, owner_write_token, stages_config, metadata_values, jurisdiction)');
  } catch (err) {
    // Non-fatal: Supabase service role may not allow DDL via pooler — fall back gracefully
    console.warn('[startup] workflow_pack_id column ensure skipped:', err.message);
  }
}

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    startJobSchedulers();
  }
  const server = http.createServer(app);
  attachChatServer(server);
  attachCollabServer(server);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kontra API listening on port ${PORT}`);
    void ensureWorkflowPackIdColumn();
    if (process.env.NODE_ENV !== 'production') {
      void logBaselineSchemaHealth();
    }
  });
}

// ── Generic Deal Room — AI Assistant (/brain/ask) ────────────────────────────
// Context-aware assistant that reasons from the actual room state.
// Registered BEFORE the static demo overrides so dynamic rooms hit this route.
app.post('/api/public/deal-room/:propertyId/brain/ask', async (req, res) => {
  const { propertyId } = req.params;
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: 'question required' });

  try {
    const access = await getRoomAccessContext(req, propertyId, req.body?.ownerWriteToken);
    if (access.mode === 'anonymous') return accessDenied(res);

    const [
      transactionState,
      { count: docCount },
      { data: invites },
    ] = await Promise.all([
      readTransactionState(propertyId),
      supabase.from('deal_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId),
      supabase.from('deal_room_invites')
        .select('role_key, status')
        .eq('property_id', propertyId),
    ]);
    const room = transactionState.room;
    const fields = transactionState.recordState.fields || [];

    const populated = fields.filter(f => f.value !== null && f.value !== undefined
      && String(f.value).trim() && f.status !== 'not_applicable');
    const conflicts = fields.filter(f => f.status === 'conflict' || f.attention === 'source_changed');
    const needsReview = fields.filter(f => f.status === 'awaiting' && f.value !== null && f.value !== undefined);
    const inviteCount = (invites || []).length;

    const CAT_PREFIXES = {
      'Identity & Parties': ['parties.', 'ownership.owner_name'],
      'Asset / Company': ['asset.'],
      'Transaction Terms': ['transaction.'],
      'Financial Information': ['financial.'],
      'Legal & Diligence': ['legal.', 'ownership.cap_table', 'ownership.beneficial_owners', 'ownership.liens'],
    };
    const catStatus = Object.entries(CAT_PREFIXES).map(([label, prefixes]) => {
      const count = populated.filter(f => prefixes.some(p => f.field_key?.startsWith(p) || f.field_key === p)).length;
      return `${label}: ${count === 0 ? 'Not started' : count >= 2 ? 'Building' : 'Needs information'}`;
    }).join('\n');

    const systemPrompt = `You are Kontra AI, a transaction-aware assistant embedded in a deal room called Kontra. You reason specifically from the current room state below. Never give generic advice — always tie your answer to the specific room context.

ROOM NAME: ${room?.property_name || 'Unnamed transaction'}
TYPE: ${transactionState.packId || transactionState.schemaKey || room?.deal_type || 'General transaction'}
DOCUMENTS UPLOADED: ${docCount || 0}
PARTICIPANTS INVITED: ${inviteCount}
EXTRACTED FACTS: ${populated.length}
CONFLICTING / CHANGED FIELDS: ${conflicts.length}
NEEDS REVIEW: ${needsReview.length}

DIGITAL ASSET READINESS BY CATEGORY:
${catStatus}

${populated.length > 0 ? `KNOWN FACTS (up to 20):\n${populated.slice(0, 20).map(f => `• ${f.label || f.key}: ${f.value}`).join('\n')}` : '(No facts have been extracted yet — no documents have been uploaded or analyzed.)'}

${conflicts.length > 0 ? `CONFLICTS TO RESOLVE:\n${conflicts.map(f => `• ${f.label || f.key}: conflicting sources — needs coordinator review`).join('\n')}` : ''}

RULES:
- If the room is empty (0 documents, 0 facts): clearly state this room has not started, recommend uploading the most relevant first document (e.g. Letter of Intent or Purchase Agreement), and explain what Kontra will extract from it.
- If asked about digital-asset readiness or tokenization: describe which categories have facts vs. which are still empty. Never quote a percentage. Never say "eligible for tokenization", "approved", or "issuance ready".
- If there are conflicts or needs-review fields: name them specifically.
- Keep answers concise (3–6 sentences), factual, and actionable.
- Do not provide legal, regulatory, or financial advice.
- Kontra organizes and prepares transaction information — it does not issue, sell, recommend, custody, or settle digital assets.`;

    const aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      max_tokens: 450,
      temperature: 0.3,
    });

    res.json({ answer: completion.choices[0]?.message?.content || 'I could not answer from the current transaction record.' });
  } catch (err) {
    console.error('[brain/ask]', err.message);
    res.status(500).json({ error: 'AI assistant error', answer: 'Kontra could not reach the transaction workspace. Try again in a moment.' });
  }
});

// ── Generic Deal Room — Transaction-Record Fact Summary (/brain/facts) ───────
// Distinct from /brain/briefing (which is served by the operationsManager
// router for deal health / chain status). This endpoint returns a machine-
// readable summary of extracted transaction facts plus a document count so the
// CoordinatorOverview can show "N documents uploaded" and known transaction
// values without a separate /transaction-record fetch.
// Returns a lightweight computed briefing from live room data.
// Static demo rooms register their own routes above and override this.
app.get('/api/public/deal-room/:propertyId/brain/facts', async (req, res) => {
  const { propertyId } = req.params;
  const access = await getRoomAccessContext(req, propertyId, req.body?.ownerWriteToken);
  if (access.mode === 'anonymous') return accessDenied(res, 'A verified deal-room invitation or owner access token is required');
  try {
    const [transactionState, { count: docCount }] = await Promise.all([
      readTransactionState(propertyId),
      supabase.from('deal_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', propertyId),
    ]);
    const fields = transactionState.recordState.fields || [];

    const conflicts   = fields.filter(f => f.status === 'conflict' || f.attention === 'source_changed');
    const needsReview = fields.filter(f => f.status === 'awaiting' && f.value !== null && f.value !== undefined);

    // Return null only when truly nothing has been uploaded or extracted yet
    if ((docCount || 0) === 0 && (fields || []).length === 0) {
      return res.json(null);
    }

    const risks = conflicts.map(f => ({
      text: `${f.label || f.key} has conflicting values from different sources`,
      field_key: f.key,
    }));
    const actions = needsReview.slice(0, 4).map(f => ({
      text: `Confirm "${f.label || f.key}" extracted as "${f.value}"`,
      field_key: f.key,
    }));

    res.json({
      actions,
      risks,
      open_items: [],
      snapshot: { document_count: docCount || 0, fact_count: (fields || []).length },
      record_state: transactionState.recordState,
      // Surface the most important known values for the Overview snapshot row
      known_values: Object.fromEntries(
        (fields || [])
          .filter(f => f.value !== null && f.value !== undefined && f.status !== 'not_applicable')
          .map(f => [f.key, f.value])
      ),
    });
  } catch (err) {
    console.error('[brain/facts]', err.message);
    res.json(null);
  }
});

// ── 404 catch-all — MUST remain after all route registrations ─────────────────
// Placed here so that routes registered later in this file (transaction-record,
// brain/facts, extract, etc.) are not swallowed by the catch-all before they
// can be matched. Express evaluates handlers in registration order.
app.use('/api', (req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `${req.method} ${req.originalUrl} not found`
  });
});
if (Sentry.Handlers?.errorHandler) {
  app.use(Sentry.Handlers.errorHandler());
} else if (Sentry.errorHandler) {
  app.use(Sentry.errorHandler());
}
app.use(errorHandler);

// Kept on the Express app for focused authorization/checklist regression tests;
// these helpers do not change the public HTTP surface.
app.getRoomAccessContext = getRoomAccessContext;
app.filterChecklistItemsByRole = filterChecklistItemsByRole;
app.getChecklistItemAssignedRoles = getChecklistItemAssignedRoles;
app.getAssignedSectionsForAccess = getAssignedSectionsForAccess;
if (process.env.NODE_ENV === 'test') {
  app.setMyRoomsOtpForTest = (email, code) => {
    otpStore.set(email, { code, expiresAt: Date.now() + 60_000 });
  };
}

module.exports = app;
