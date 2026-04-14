/**
 * Kontra Event Bus — Phase 5
 *
 * In-process event emitter + outbound webhook dispatcher.
 *
 * Events flow: emit(event) → local listeners → registered webhooks (HTTP POST)
 *
 * Canonical event types:
 *   loan.created          loan.updated          loan.matured
 *   draw.requested        draw.approved         draw.rejected
 *   inspection.scheduled  inspection.completed  inspection.hold_placed
 *   insurance.expiring    insurance.updated
 *   document.uploaded     document.extracted    document.failed
 *   agent.action          agent.escalation
 *   policy.evaluated      policy.violation      policy.override
 *   token.issued          token.transferred     token.burned
 *   webhook.registered    webhook.delivered     webhook.failed
 *
 * Retry strategy: 3 attempts with exponential backoff (1s → 2s → 4s)
 */

'use strict';

const { EventEmitter } = require('events');
const { v4: uuidv4 }  = require('uuid');

const bus = new EventEmitter();
bus.setMaxListeners(100);

// ── In-memory stores ──────────────────────────────────────────────────────────

const WEBHOOKS      = new Map();   // id → WebhookConfig
const EVENT_LOG     = [];          // ring buffer, last 1000 events
const DELIVERY_LOG  = [];          // ring buffer, last 500 delivery attempts
const MAX_EVENTS    = 1000;
const MAX_DELIVERY  = 500;

// ── Helper: truncate rings ────────────────────────────────────────────────────

function pushEvent(entry) {
  EVENT_LOG.push(entry);
  if (EVENT_LOG.length > MAX_EVENTS) EVENT_LOG.shift();
}

function pushDelivery(entry) {
  DELIVERY_LOG.push(entry);
  if (DELIVERY_LOG.length > MAX_DELIVERY) DELIVERY_LOG.shift();
}

// ── Webhook registration ──────────────────────────────────────────────────────

function registerWebhook({ url, events = ['*'], secret, orgId, description = '', headers = {} } = {}) {
  if (!url) throw new Error('Webhook url is required');
  const id = uuidv4();
  const hook = {
    id, url, events, secret: secret || null, orgId: orgId || null,
    description, headers, active: true,
    createdAt: new Date().toISOString(),
    deliveries: 0, failures: 0, lastDeliveredAt: null,
  };
  WEBHOOKS.set(id, hook);
  emit('webhook.registered', { webhookId: id, url, events }, { orgId });
  return hook;
}

function updateWebhook(id, patch) {
  const hook = WEBHOOKS.get(id);
  if (!hook) throw new Error(`Webhook ${id} not found`);
  Object.assign(hook, patch);
  return hook;
}

function deleteWebhook(id) {
  return WEBHOOKS.delete(id);
}

function listWebhooks({ orgId } = {}) {
  let hooks = Array.from(WEBHOOKS.values());
  if (orgId) hooks = hooks.filter(h => !h.orgId || h.orgId === orgId);
  return hooks;
}

function getWebhook(id) {
  return WEBHOOKS.get(id) || null;
}

// ── Webhook delivery ──────────────────────────────────────────────────────────

async function deliverWebhook(hook, event) {
  const fetch   = (await import('node-fetch')).default;
  const crypto  = await import('crypto');

  const deliveryId = uuidv4();
  const payload    = JSON.stringify(event);
  const timestamp  = Math.floor(Date.now() / 1000);

  const headers = {
    'Content-Type': 'application/json',
    'X-Kontra-Event':      event.type,
    'X-Kontra-Delivery':   deliveryId,
    'X-Kontra-Timestamp':  String(timestamp),
    ...hook.headers,
  };

  // HMAC signature (similar to GitHub/Stripe webhook signatures)
  if (hook.secret) {
    const sig = crypto
      .createHmac('sha256', hook.secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    headers['X-Kontra-Signature'] = `sha256=${sig}`;
  }

  const MAX_ATTEMPTS = 3;
  let attempt = 0;
  let lastErr;

  while (attempt < MAX_ATTEMPTS) {
    const t0 = Date.now();
    try {
      const res = await fetch(hook.url, {
        method: 'POST', headers, body: payload,
        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
      });
      const latencyMs = Date.now() - t0;
      const success   = res.ok;

      const log = { deliveryId, hookId: hook.id, eventId: event.id, eventType: event.type, attempt: attempt + 1, statusCode: res.status, latencyMs, success, timestamp: new Date().toISOString() };
      pushDelivery(log);

      hook.deliveries++;
      if (!success) hook.failures++;
      else hook.lastDeliveredAt = new Date().toISOString();

      if (success) return log;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      const latencyMs = Date.now() - t0;
      const log = { deliveryId, hookId: hook.id, eventId: event.id, eventType: event.type, attempt: attempt + 1, latencyMs, success: false, error: err.message, timestamp: new Date().toISOString() };
      pushDelivery(log);
      hook.failures++;
    }

    attempt++;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  pushDelivery({ deliveryId, hookId: hook.id, eventId: event.id, eventType: event.type, attempt: MAX_ATTEMPTS, success: false, error: `Max retries exceeded. Last: ${lastErr?.message}`, timestamp: new Date().toISOString() });
}

// ── Core emit ─────────────────────────────────────────────────────────────────

function emit(type, data = {}, meta = {}) {
  const event = {
    id:        uuidv4(),
    type,
    data,
    orgId:     meta.orgId     || null,
    source:    meta.source    || 'kontra-api',
    version:   meta.version   || '1.0',
    timestamp: new Date().toISOString(),
  };

  pushEvent(event);
  bus.emit(type, event);
  bus.emit('*', event);

  // Dispatch to registered webhooks (fire-and-forget)
  setImmediate(async () => {
    for (const hook of WEBHOOKS.values()) {
      if (!hook.active) continue;
      if (hook.orgId && meta.orgId && hook.orgId !== meta.orgId) continue;
      const matches = hook.events.includes('*') || hook.events.includes(type) || hook.events.some(e => {
        const [ns] = e.split('.');
        return type.startsWith(ns + '.');
      });
      if (matches) {
        try { await deliverWebhook(hook, event); } catch (_) {}
      }
    }
  });

  return event;
}

// ── Subscribe (local listener) ────────────────────────────────────────────────

function on(type, handler) {
  bus.on(type, handler);
  return () => bus.off(type, handler);
}

function once(type, handler) {
  bus.once(type, handler);
}

// ── Log accessors ─────────────────────────────────────────────────────────────

function getEvents({ type, orgId, limit = 50, since } = {}) {
  let logs = EVENT_LOG.slice().reverse();
  if (type)   logs = logs.filter(e => e.type === type || e.type.startsWith(type));
  if (orgId)  logs = logs.filter(e => !e.orgId || e.orgId === orgId);
  if (since)  logs = logs.filter(e => new Date(e.timestamp) >= new Date(since));
  return logs.slice(0, limit);
}

function getDeliveries({ hookId, limit = 50 } = {}) {
  let logs = DELIVERY_LOG.slice().reverse();
  if (hookId) logs = logs.filter(d => d.hookId === hookId);
  return logs.slice(0, limit);
}

function getStats({ orgId } = {}) {
  const events    = orgId ? EVENT_LOG.filter(e => !e.orgId || e.orgId === orgId) : EVENT_LOG;
  const deliveries = orgId
    ? DELIVERY_LOG.filter(d => { const h = WEBHOOKS.get(d.hookId); return h && (!h.orgId || h.orgId === orgId); })
    : DELIVERY_LOG;

  const byType = {};
  events.forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });

  return {
    totalEvents:        events.length,
    totalWebhooks:      WEBHOOKS.size,
    totalDeliveries:    deliveries.length,
    successDeliveries:  deliveries.filter(d => d.success).length,
    failedDeliveries:   deliveries.filter(d => !d.success).length,
    byType,
  };
}

// ── Seed: demo webhooks ───────────────────────────────────────────────────────

function seedDemoWebhooks() {
  if (WEBHOOKS.size > 0) return;
  registerWebhook({ url: 'https://hooks.slack.com/services/demo/kontra-alerts', events: ['agent.escalation', 'policy.violation', 'draw.rejected'], description: 'Slack — Critical Alerts Channel', orgId: null });
  registerWebhook({ url: 'https://api.example-lender.com/kontra/events',        events: ['loan.*', 'draw.*', 'token.*'],                              description: 'First National Bank — Loan Events Feed',  orgId: null });
  registerWebhook({ url: 'https://servicer-platform.io/webhook/kontra',         events: ['*'],                                                          description: 'Situs AMC — Full Event Stream',           orgId: null });
}

seedDemoWebhooks();

module.exports = {
  emit,
  on,
  once,
  registerWebhook,
  updateWebhook,
  deleteWebhook,
  listWebhooks,
  getWebhook,
  getEvents,
  getDeliveries,
  getStats,
};
