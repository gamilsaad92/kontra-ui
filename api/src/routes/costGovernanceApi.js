/**
 * Kontra AI Cost Governance API — Phase 7
 * Mounted at: /api/cost
 *
 * Routes:
 *   GET  /api/cost/dashboard           — admin dashboard stats (spend, ROI, budgets)
 *   GET  /api/cost/tiers               — list all usage tiers
 *   POST /api/cost/tiers/:id/simulate  — simulate cost for N runs under a tier
 *   GET  /api/cost/workflows           — list workflow catalog
 *   POST /api/cost/track               — record a usage event (called post-inference)
 *   GET  /api/cost/usage               — query usage events
 *   GET  /api/cost/roi                 — ROI per workflow
 *   GET  /api/cost/budgets             — list budgets for org
 *   POST /api/cost/budgets             — create a budget
 *   PATCH /api/cost/budgets/:id        — update a budget
 *   POST /api/cost/budgets/check       — pre-flight budget check (will this call be allowed?)
 *   GET  /api/cost/leaderboard         — top cost-consuming workflows
 *   GET  /api/cost/model-registry      — provider models + pricing
 */

'use strict';

const express  = require('express');
const gov      = require('../../lib/costGovernance');
const { supabase } = require('../../db');

const router = express.Router();

// ── Org middleware (inherits from tokenizationApi pattern) ────────────────────
router.use((req, res, next) => {
  const orgId = req.headers['x-org-id'] || req.query.orgId || null;
  if (!orgId) return res.status(400).json({ code: 'ORG_CONTEXT_MISSING', message: 'Missing X-Org-Id header' });
  req.orgId = orgId;
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/cost/dashboard
 * Returns the full admin cost governance dashboard:
 * MTD spend, budget utilization, ROI summary, daily trend, by-workflow breakdown.
 */
router.get('/dashboard', (req, res) => {
  try {
    const stats = gov.getDashboardStats(req.orgId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USAGE TIERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/cost/tiers
 * Returns all 4 usage tiers with token envelopes, cost ranges, and ROI metadata.
 */
router.get('/tiers', (req, res) => {
  res.json({
    tiers: Object.values(gov.USAGE_TIERS),
    note: 'Set tier per workflow to control AI spend. Quick Review uses gpt-4o-mini; Deep Analysis uses gpt-4o.',
  });
});

/**
 * POST /api/cost/tiers/:tierId/simulate
 * Simulate cost + ROI for a given tier × workflow × run count.
 * Body: { workflowType, runCount }
 */
router.post('/tiers/:tierId/simulate', (req, res) => {
  const { tierId }  = req.params;
  const { workflowType = 'loan_review', runCount = 1 } = req.body;
  try {
    const sim = gov.simulateTierCost(tierId, workflowType, parseInt(runCount));
    res.json(sim);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW CATALOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/cost/workflows
 * Returns the full workflow catalog with default tiers, time-saved benchmarks,
 * manual cost baselines, and ROI metadata.
 */
router.get('/workflows', (req, res) => {
  const catalog = Object.values(gov.WORKFLOW_CATALOG).map(wf => ({
    ...wf,
    defaultTierConfig: gov.USAGE_TIERS[wf.defaultTier] || null,
  }));
  res.json({ workflows: catalog });
});

// ─────────────────────────────────────────────────────────────────────────────
// USAGE TRACKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/cost/track
 * Record an AI usage event after inference completes.
 * Called by modelRouter or agent orchestration layer post-inference.
 *
 * Body: {
 *   workflowType, tierId, model, provider,
 *   inputTokens, outputTokens, costUsd, latencyMs,
 *   loanId, requestId, outcome, metadata
 * }
 */
router.post('/track', async (req, res) => {
  const {
    workflowType, tierId, model, provider,
    inputTokens, outputTokens, costUsd, latencyMs,
    loanId, requestId, outcome, metadata,
  } = req.body;

  if (!workflowType) return res.status(400).json({ error: 'workflowType is required' });

  try {
    const event = gov.recordUsageEvent({
      orgId: req.orgId,
      workflowType, tierId, model, provider,
      inputTokens:  parseInt(inputTokens  || 0),
      outputTokens: parseInt(outputTokens || 0),
      costUsd:      parseFloat(costUsd || 0),
      latencyMs:    parseInt(latencyMs || 0),
      loanId, requestId,
      outcome: outcome || 'success',
      metadata,
    });

    // Persist to Supabase (non-fatal)
    try {
      await supabase.from('kontra_ai_usage_events').insert({
        event_id:      event.eventId,
        org_id:        event.orgId,
        workflow_type: event.workflowType,
        tier_id:       event.tierId,
        model:         event.model,
        provider:      event.provider,
        input_tokens:  event.inputTokens,
        output_tokens: event.outputTokens,
        total_tokens:  event.totalTokens,
        cost_usd:      event.costUsd,
        latency_ms:    event.latencyMs,
        loan_id:       event.loanId,
        request_id:    event.requestId,
        outcome:       event.outcome,
        metadata:      event.metadata,
        recorded_at:   event.recordedAt,
      });
    } catch (dbErr) {
      console.error('[cost/track] Supabase persist failed:', dbErr.message);
    }

    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/cost/usage
 * Query usage events with optional filters.
 * Query params: workflowType, loanId, tierId, startDate, endDate, limit
 */
router.get('/usage', (req, res) => {
  const { workflowType, loanId, tierId, startDate, endDate, limit } = req.query;
  const events = gov.listUsageEvents({
    orgId: req.orgId,
    workflowType, loanId, tierId, startDate, endDate,
    limit: parseInt(limit || 200),
  });
  res.json({
    count:       events.length,
    totalCostUsd:+events.reduce((s, e) => s + e.costUsd, 0).toFixed(4),
    totalTokens:  events.reduce((s, e) => s + e.totalTokens, 0),
    events,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/cost/roi
 * ROI analysis per workflow type.
 * Query params: workflowType (filter), startDate, endDate
 */
router.get('/roi', (req, res) => {
  const { workflowType, startDate, endDate } = req.query;
  try {
    const result = gov.computeROI({ orgId: req.orgId, workflowType, startDate, endDate });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BUDGETS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/cost/budgets
 * List all active (and optionally inactive) budgets for the org.
 */
router.get('/budgets', (req, res) => {
  const { status } = req.query;
  const budgets = gov.listBudgets({ orgId: req.orgId, status });
  res.json({ count: budgets.length, budgets });
});

/**
 * POST /api/cost/budgets
 * Create a new budget.
 * Body: { name, scope, limitUsd, alertAt, hardStop, tierOverride, workflowScopes }
 */
router.post('/budgets', async (req, res) => {
  const { name, scope, limitUsd, alertAt, hardStop, tierOverride, workflowScopes } = req.body;
  if (!name || !limitUsd) return res.status(400).json({ error: 'name and limitUsd are required' });

  try {
    const budget = gov.createBudget({
      orgId: req.orgId,
      name, scope, limitUsd, alertAt, hardStop, tierOverride, workflowScopes,
    });

    // Persist to Supabase (non-fatal)
    try {
      await supabase.from('kontra_ai_budgets').insert({
        budget_id:       budget.budgetId,
        org_id:          budget.orgId,
        name:            budget.name,
        scope:           budget.scope,
        limit_usd:       budget.limitUsd,
        alert_at:        budget.alertAt,
        hard_stop:       budget.hardStop,
        tier_override:   budget.tierOverride,
        workflow_scopes: budget.workflowScopes,
        status:          budget.status,
        created_at:      budget.createdAt,
      });
    } catch (dbErr) {
      console.error('[cost/budgets] Supabase persist failed:', dbErr.message);
    }

    res.status(201).json(budget);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/cost/budgets/:id
 * Update a budget (name, limit, alertAt, hardStop, status).
 */
router.patch('/budgets/:id', (req, res) => {
  try {
    const budget = gov.updateBudget(req.params.id, req.body);
    res.json(budget);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * POST /api/cost/budgets/check
 * Pre-flight: will this estimated spend be allowed?
 * Body: { workflowType, estimatedCostUsd }
 */
router.post('/budgets/check', (req, res) => {
  const { workflowType, estimatedCostUsd } = req.body;
  if (!workflowType) return res.status(400).json({ error: 'workflowType is required' });

  const result = gov.checkBudget(req.orgId, workflowType, parseFloat(estimatedCostUsd || 0));
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/cost/leaderboard
 * Top cost-consuming workflows and loans for the org.
 */
router.get('/leaderboard', (req, res) => {
  const { limit = 10 } = req.query;

  const events = gov.listUsageEvents({ orgId: req.orgId, limit: 5000 });

  // By workflow
  const byWf = {};
  for (const e of events) {
    if (!byWf[e.workflowType]) byWf[e.workflowType] = { workflowType: e.workflowType, label: gov.WORKFLOW_CATALOG[e.workflowType]?.label || e.workflowType, totalCostUsd: 0, runs: 0 };
    byWf[e.workflowType].totalCostUsd += e.costUsd;
    byWf[e.workflowType].runs         += 1;
  }
  const topWorkflows = Object.values(byWf)
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    .slice(0, parseInt(limit))
    .map(w => ({ ...w, totalCostUsd: +w.totalCostUsd.toFixed(4) }));

  // By loan
  const byLoan = {};
  for (const e of events.filter(e => e.loanId)) {
    if (!byLoan[e.loanId]) byLoan[e.loanId] = { loanId: e.loanId, totalCostUsd: 0, runs: 0 };
    byLoan[e.loanId].totalCostUsd += e.costUsd;
    byLoan[e.loanId].runs         += 1;
  }
  const topLoans = Object.values(byLoan)
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    .slice(0, parseInt(limit))
    .map(l => ({ ...l, totalCostUsd: +l.totalCostUsd.toFixed(4) }));

  // By model
  const byModel = {};
  for (const e of events) {
    if (!byModel[e.model]) byModel[e.model] = { model: e.model, totalCostUsd: 0, runs: 0 };
    byModel[e.model].totalCostUsd += e.costUsd;
    byModel[e.model].runs         += 1;
  }
  const topModels = Object.values(byModel)
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    .map(m => ({ ...m, totalCostUsd: +m.totalCostUsd.toFixed(4) }));

  res.json({ topWorkflows, topLoans, topModels });
});

// ─────────────────────────────────────────────────────────────────────────────
// MODEL REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/cost/model-registry
 * Returns pricing for all known models used in the platform.
 */
router.get('/model-registry', (req, res) => {
  const registry = [
    { provider: 'openai',     model: 'gpt-4o',                 inputPer1M: 2.50,  outputPer1M: 10.00, tier: 'deep_analysis',   contextK: 128 },
    { provider: 'openai',     model: 'gpt-4o-mini',            inputPer1M: 0.15,  outputPer1M: 0.60,  tier: 'quick_review',    contextK: 128 },
    { provider: 'openai',     model: 'o1-preview',             inputPer1M: 15.00, outputPer1M: 60.00, tier: 'deep_analysis',   contextK: 128 },
    { provider: 'openai',     model: 'o1-mini',                inputPer1M: 3.00,  outputPer1M: 12.00, tier: 'deep_analysis',   contextK: 128 },
    { provider: 'anthropic',  model: 'claude-3-5-sonnet',      inputPer1M: 3.00,  outputPer1M: 15.00, tier: 'deep_analysis',   contextK: 200 },
    { provider: 'anthropic',  model: 'claude-3-haiku-20240307',inputPer1M: 0.25,  outputPer1M: 1.25,  tier: 'quick_review',    contextK: 200 },
    { provider: 'anthropic',  model: 'claude-3-opus-20240229', inputPer1M: 15.00, outputPer1M: 75.00, tier: 'executive_memo',  contextK: 200 },
    { provider: 'bedrock',    model: 'anthropic.claude-3-haiku-20240307-v1:0', inputPer1M: 0.25, outputPer1M: 1.25, tier: 'quick_review', contextK: 200 },
    { provider: 'ollama',     model: 'llama3.2:3b',            inputPer1M: 0,     outputPer1M: 0,     tier: 'quick_review',    contextK: 128, note: 'Self-hosted — compute cost only' },
  ];
  res.json({ models: registry, note: 'Prices in USD per 1M tokens. Check provider pricing pages for latest rates.' });
});

module.exports = router;
