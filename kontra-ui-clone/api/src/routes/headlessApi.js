/**
 * Kontra Headless Enterprise API — Phase 5
 * Mounted at: /api/v1
 *
 * Routes:
 *   POST   /api/v1/complete              — model router inference (any provider)
 *   GET    /api/v1/models                — list available providers + models
 *   PUT    /api/v1/models/config         — set org-level model routing config
 *
 *   GET    /api/v1/webhooks              — list registered webhooks
 *   POST   /api/v1/webhooks              — register a webhook
 *   PATCH  /api/v1/webhooks/:id          — update a webhook
 *   DELETE /api/v1/webhooks/:id          — remove a webhook
 *   POST   /api/v1/webhooks/:id/ping     — send a test ping event
 *   GET    /api/v1/webhooks/:id/deliveries — delivery history
 *
 *   GET    /api/v1/events                — event log
 *   POST   /api/v1/events/emit           — manually emit an event
 *   GET    /api/v1/events/stream         — SSE stream (live events)
 *
 *   GET    /api/v1/plugins               — list all available connectors
 *   GET    /api/v1/plugins/installed     — list installed connectors for org
 *   POST   /api/v1/plugins/install       — install a connector
 *   DELETE /api/v1/plugins/install/:id   — uninstall a connector
 *   POST   /api/v1/plugins/install/:id/execute — execute a connector action
 *
 *   GET    /api/v1/api-keys              — list API keys for org
 *   POST   /api/v1/api-keys              — create API key
 *   DELETE /api/v1/api-keys/:id          — revoke API key
 *
 *   GET    /api/v1/health                — health + version
 *   GET    /api/v1/stats                 — combined router + event + delivery stats
 *   GET    /api/v1/openapi               — OpenAPI 3.1 spec (JSON)
 */

'use strict';

const express   = require('express');
const { v4: uuidv4 } = require('uuid');
const modelRouter    = require('../../lib/modelRouter');
const eventBus       = require('../../lib/eventBus');
const pluginConn     = require('../../lib/pluginConnector');

const router = express.Router();

// ── Middleware: org context from header or JWT ─────────────────────────────────

router.use((req, res, next) => {
  req.orgId = req.headers['x-org-id'] || req.user?.orgId || 'demo-org';
  next();
});

// ── In-memory API key store ───────────────────────────────────────────────────

const API_KEYS = new Map();

function seedApiKeys() {
  if (API_KEYS.size) return;
  const demoKey = { id: uuidv4(), key: `kontra_live_${uuidv4().replace(/-/g,'')}`, name: 'Production Integration Key', orgId: 'demo-org', scopes: ['*'], createdAt: new Date().toISOString(), lastUsedAt: null, active: true };
  const testKey = { id: uuidv4(), key: `kontra_test_${uuidv4().replace(/-/g,'')}`, name: 'Test / Sandbox Key',         orgId: 'demo-org', scopes: ['read:loans','read:events','write:webhooks'], createdAt: new Date().toISOString(), lastUsedAt: null, active: true };
  API_KEYS.set(demoKey.id, demoKey);
  API_KEYS.set(testKey.id, testKey);
}
seedApiKeys();

// ── SSE stream subscribers ────────────────────────────────────────────────────

const SSE_CLIENTS = new Set();

eventBus.on('*', (event) => {
  for (const res of SSE_CLIENTS) {
    try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch (_) { SSE_CLIENTS.delete(res); }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.0.0',
    phase: 'Phase 5 — Headless Enterprise Interoperability',
    timestamp: new Date().toISOString(),
    capabilities: ['model-routing', 'webhooks', 'event-bus', 'plugins', 'api-keys', 'sse-stream'],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MODEL ROUTER
// ─────────────────────────────────────────────────────────────────────────────

router.get('/models', (req, res) => {
  const providers = Object.entries(modelRouter.PROVIDER_CONFIG).map(([id, cfg]) => ({
    id, defaultModel: cfg.defaultModel, supportsJsonMode: cfg.supportsJsonMode,
    supportsFunctions: cfg.supportsFunctions, costPerInputToken: cfg.costPerInputToken,
    costPerOutputToken: cfg.costPerOutputToken,
    available: Boolean(
      process.env[`${id.toUpperCase()}_API_KEY`] ||
      (id === 'openai' && process.env.OPENAI_API_KEY) ||
      id === 'ollama'
    ),
  }));
  const tasks = Object.entries(modelRouter.TASK_ROUTING).map(([task, chain]) => ({ task, chain }));
  const orgCfg = modelRouter.getOrgConfig(req.orgId);
  res.json({ providers, tasks, orgConfig: orgCfg });
});

router.put('/models/config', async (req, res) => {
  try {
    const { providerChain, model, ...keys } = req.body;
    modelRouter.setOrgConfig(req.orgId, { providerChain, model, ...keys });
    res.json({ ok: true, orgId: req.orgId, config: modelRouter.getOrgConfig(req.orgId) });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/complete', async (req, res) => {
  const { task = 'default', messages, prompt, provider, model, options = {} } = req.body;

  if (!messages && !prompt) return res.status(400).json({ error: 'messages or prompt required' });

  try {
    const result = await modelRouter.route({
      task, messages, prompt, orgId: req.orgId,
      options: { ...options, model },
      forceProvider: provider,
    });
    eventBus.emit('agent.action', { action: 'llm_completion', task, provider: result.provider, model: result.model, costUsd: result.costUsd }, { orgId: req.orgId });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'All model providers failed', detail: err.message });
  }
});

router.get('/models/stats', (req, res) => {
  res.json(modelRouter.getStats({ orgId: req.orgId }));
});

router.get('/models/audit', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(modelRouter.getAuditLog({ orgId: req.orgId, limit }));
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOKS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/webhooks', (req, res) => {
  res.json(eventBus.listWebhooks({ orgId: req.orgId }));
});

router.post('/webhooks', (req, res) => {
  try {
    const { url, events, secret, description, headers } = req.body;
    const hook = eventBus.registerWebhook({ url, events, secret, description, headers, orgId: req.orgId });
    res.status(201).json(hook);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/webhooks/:id', (req, res) => {
  try {
    const hook = eventBus.updateWebhook(req.params.id, req.body);
    res.json(hook);
  } catch (err) { res.status(404).json({ error: err.message }); }
});

router.delete('/webhooks/:id', (req, res) => {
  const ok = eventBus.deleteWebhook(req.params.id);
  if (ok) res.json({ ok: true }); else res.status(404).json({ error: 'Webhook not found' });
});

router.post('/webhooks/:id/ping', (req, res) => {
  const hook = eventBus.getWebhook(req.params.id);
  if (!hook) return res.status(404).json({ error: 'Webhook not found' });
  const event = eventBus.emit('webhook.ping', { webhookId: hook.id, url: hook.url, message: 'Kontra webhook ping' }, { orgId: req.orgId });
  res.json({ ok: true, eventId: event.id });
});

router.get('/webhooks/:id/deliveries', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(eventBus.getDeliveries({ hookId: req.params.id, limit }));
});

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/events', (req, res) => {
  const { type, limit, since } = req.query;
  res.json(eventBus.getEvents({ type, orgId: req.orgId, limit: parseInt(limit) || 100, since }));
});

router.post('/events/emit', (req, res) => {
  const { type, data = {}, source } = req.body;
  if (!type) return res.status(400).json({ error: 'type is required' });
  const event = eventBus.emit(type, data, { orgId: req.orgId, source });
  res.status(201).json(event);
});

router.get('/events/stream', (req, res) => {
  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  SSE_CLIENTS.add(res);
  const heartbeat = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch (_) {} }, 20000);

  req.on('close', () => { SSE_CLIENTS.delete(res); clearInterval(heartbeat); });
});

// ─────────────────────────────────────────────────────────────────────────────
// PLUGINS / CONNECTORS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/plugins', (req, res) => {
  const plugins = pluginConn.BUILT_IN_CONNECTORS.map(({ execute: _ex, ...rest }) => rest);
  res.json(plugins);
});

router.get('/plugins/installed', (req, res) => {
  res.json(pluginConn.listInstalled({ orgId: req.orgId }));
});

router.post('/plugins/install', (req, res) => {
  try {
    const { connectorId, credentials, config, label } = req.body;
    const result = pluginConn.install({ connectorId, orgId: req.orgId, credentials: credentials || {}, config: config || {}, label });
    eventBus.emit('agent.action', { action: 'plugin_installed', connectorId, label }, { orgId: req.orgId });
    res.status(201).json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/plugins/install/:id', (req, res) => {
  const ok = pluginConn.uninstall(req.params.id);
  if (ok) res.json({ ok: true }); else res.status(404).json({ error: 'Install not found' });
});

router.post('/plugins/install/:id/execute', async (req, res) => {
  const { actionId, payload = {} } = req.body;
  if (!actionId) return res.status(400).json({ error: 'actionId required' });
  try {
    const result = await pluginConn.execute(req.params.id, actionId, payload);
    eventBus.emit('agent.action', { action: 'plugin_executed', installId: req.params.id, actionId }, { orgId: req.orgId });
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// API KEYS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/api-keys', (req, res) => {
  const keys = Array.from(API_KEYS.values())
    .filter(k => k.orgId === req.orgId)
    .map(({ key, ...rest }) => ({ ...rest, key: `${key.slice(0, 14)}${'•'.repeat(20)}` }));
  res.json(keys);
});

router.post('/api-keys', (req, res) => {
  const { name = 'New Key', scopes = ['*'] } = req.body;
  const prefix = 'kontra_live_';
  const rawKey = `${prefix}${uuidv4().replace(/-/g, '')}`;
  const record = { id: uuidv4(), key: rawKey, name, orgId: req.orgId, scopes, createdAt: new Date().toISOString(), lastUsedAt: null, active: true };
  API_KEYS.set(record.id, record);
  res.status(201).json({ ...record }); // Return full key once on creation
});

router.delete('/api-keys/:id', (req, res) => {
  const key = API_KEYS.get(req.params.id);
  if (!key || key.orgId !== req.orgId) return res.status(404).json({ error: 'Key not found' });
  key.active = false;
  res.json({ ok: true, revoked: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS (combined)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  res.json({
    model:    modelRouter.getStats({ orgId: req.orgId }),
    events:   eventBus.getStats({ orgId: req.orgId }),
    plugins:  { installed: pluginConn.listInstalled({ orgId: req.orgId }).length, available: pluginConn.BUILT_IN_CONNECTORS.length },
    apiKeys:  { total: Array.from(API_KEYS.values()).filter(k => k.orgId === req.orgId).length, active: Array.from(API_KEYS.values()).filter(k => k.orgId === req.orgId && k.active).length },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OPENAPI 3.1 SPEC
// ─────────────────────────────────────────────────────────────────────────────

router.get('/openapi', (req, res) => {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Kontra Enterprise API',
      version: '5.0.0',
      description: 'Headless enterprise infrastructure API for CRE loan servicing. Provides model routing, webhooks, event bus, plugin connectors, and API key management.',
      contact: { name: 'Kontra Platform', email: 'api@kontraplatform.com', url: 'https://kontraplatform.com' },
      license: { name: 'Enterprise License' },
    },
    servers: [{ url: '/api/v1', description: 'Kontra API v1' }],
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    tags: [
      { name: 'Model Routing', description: 'Route inference to OpenAI, Azure, Anthropic, Bedrock, or Ollama' },
      { name: 'Webhooks', description: 'Register and manage outbound webhooks for Kontra events' },
      { name: 'Events', description: 'Event bus — browse history, emit events, subscribe via SSE' },
      { name: 'Plugins', description: 'Install and execute connectors (Slack, Salesforce, Jira, etc.)' },
      { name: 'API Keys', description: 'Manage API keys for external access' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        ApiKeyAuth:  { type: 'apiKey', in: 'header', name: 'X-Kontra-Api-Key' },
      },
      schemas: {
        CompletionRequest: {
          type: 'object', required: ['prompt'],
          properties: {
            task:     { type: 'string', enum: Object.keys(modelRouter.TASK_ROUTING), default: 'default' },
            prompt:   { type: 'string' },
            messages: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, content: { type: 'string' } } } },
            provider: { type: 'string', enum: Object.keys(modelRouter.PROVIDER_CONFIG) },
            options:  { type: 'object', properties: { temperature: { type: 'number' }, maxTokens: { type: 'integer' }, responseFormat: { type: 'string', enum: ['json', 'text'] } } },
          },
        },
        WebhookRegistration: {
          type: 'object', required: ['url'],
          properties: {
            url:         { type: 'string', format: 'uri' },
            events:      { type: 'array', items: { type: 'string' }, default: ['*'] },
            secret:      { type: 'string', description: 'HMAC-SHA256 signing secret' },
            description: { type: 'string' },
            headers:     { type: 'object' },
          },
        },
        EventEmit: {
          type: 'object', required: ['type'],
          properties: {
            type:   { type: 'string', example: 'loan.updated' },
            data:   { type: 'object' },
            source: { type: 'string' },
          },
        },
      },
    },
    paths: {
      '/complete':     { post: { tags: ['Model Routing'], summary: 'Run inference via model router', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CompletionRequest' } } } }, responses: { 200: { description: 'Completion result with provider, model, content, usage, latency, cost' } } } },
      '/models':       { get:  { tags: ['Model Routing'], summary: 'List providers, models, and org config', responses: { 200: { description: 'Provider list and org routing config' } } } },
      '/models/config':{ put:  { tags: ['Model Routing'], summary: 'Set org-level model routing config', responses: { 200: { description: 'Updated config' } } } },
      '/models/stats': { get:  { tags: ['Model Routing'], summary: 'Inference usage + cost stats', responses: { 200: { description: 'Stats by provider' } } } },
      '/webhooks':     { get:  { tags: ['Webhooks'], summary: 'List webhooks', responses: { 200: { description: 'Webhook list' } } }, post: { tags: ['Webhooks'], summary: 'Register webhook', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookRegistration' } } } }, responses: { 201: { description: 'Registered webhook' } } } },
      '/webhooks/{id}/ping': { post: { tags: ['Webhooks'], summary: 'Send a test ping to a webhook', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Ping dispatched' } } } },
      '/events':       { get:  { tags: ['Events'], summary: 'List event log', parameters: [{ in: 'query', name: 'type', schema: { type: 'string' } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 100 } }], responses: { 200: { description: 'Events array' } } } },
      '/events/emit':  { post: { tags: ['Events'], summary: 'Emit a custom event', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/EventEmit' } } } }, responses: { 201: { description: 'Emitted event' } } } },
      '/events/stream':{ get:  { tags: ['Events'], summary: 'SSE live event stream', responses: { 200: { description: 'text/event-stream — perpetual live event stream' } } } },
      '/plugins':      { get:  { tags: ['Plugins'], summary: 'List all available connectors', responses: { 200: { description: 'Connector catalog' } } } },
      '/plugins/installed': { get: { tags: ['Plugins'], summary: 'List installed connectors for org', responses: { 200: { description: 'Installed connector instances' } } }, post: { tags: ['Plugins'], summary: 'Install a connector', responses: { 201: { description: 'Install record' } } } },
      '/plugins/install/{id}/execute': { post: { tags: ['Plugins'], summary: 'Execute a connector action', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Execution result' } } } },
      '/api-keys':     { get: { tags: ['API Keys'], summary: 'List API keys', responses: { 200: { description: 'Masked key list' } } }, post: { tags: ['API Keys'], summary: 'Create API key', responses: { 201: { description: 'New key (full value shown once)' } } } },
      '/api-keys/{id}':{ delete: { tags: ['API Keys'], summary: 'Revoke API key', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Revoked' } } } },
    },
  };
  res.json(spec);
});

module.exports = router;
