/**
 * Kontra Model Router — Phase 5
 *
 * Routes LLM inference to any configured provider with:
 *   - Priority-ordered fallback chains
 *   - Per-provider token + cost accounting
 *   - Latency tracking per call
 *   - Structured output enforcement (JSON mode / function-calling)
 *   - Audit logging to in-memory ring buffer (last 500 calls)
 *
 * Supported providers: openai | azure_openai | anthropic | bedrock | ollama
 *
 * Usage:
 *   const router = require('./modelRouter');
 *   const result = await router.route({ task: 'classify', prompt, orgId });
 *   // → { provider, model, content, usage, latencyMs, costUsd, requestId }
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

// ── Provider defaults ──────────────────────────────────────────────────────────

const PROVIDER_CONFIG = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    costPerInputToken:  0.00000015,   // $0.15 / 1M
    costPerOutputToken: 0.00000060,   // $0.60 / 1M
    supportsJsonMode: true,
    supportsFunctions: true,
    maxRetries: 2,
  },
  azure_openai: {
    baseUrl: process.env.AZURE_OPENAI_ENDPOINT || '',
    defaultModel: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
    apiVersion: '2024-08-01-preview',
    costPerInputToken:  0.00000015,
    costPerOutputToken: 0.00000060,
    supportsJsonMode: true,
    supportsFunctions: true,
    maxRetries: 2,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-haiku-20240307',
    costPerInputToken:  0.00000025,   // $0.25 / 1M
    costPerOutputToken: 0.00000125,   // $1.25 / 1M
    supportsJsonMode: false,
    supportsFunctions: true,
    maxRetries: 2,
  },
  bedrock: {
    baseUrl: `https://bedrock-runtime.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
    defaultModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    costPerInputToken:  0.00000025,
    costPerOutputToken: 0.00000125,
    supportsJsonMode: false,
    supportsFunctions: false,
    maxRetries: 1,
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    defaultModel: 'llama3.2:3b',
    costPerInputToken:  0,
    costPerOutputToken: 0,
    supportsJsonMode: false,
    supportsFunctions: false,
    maxRetries: 1,
  },
};

// ── Task → provider priority maps ─────────────────────────────────────────────

const TASK_ROUTING = {
  classify:          ['openai', 'anthropic', 'ollama'],
  extract:           ['openai', 'anthropic', 'ollama'],
  summarize:         ['openai', 'anthropic', 'ollama'],
  policy_eval:       ['openai', 'azure_openai', 'anthropic'],
  agent_decision:    ['openai', 'azure_openai', 'anthropic'],
  email_parse:       ['openai', 'anthropic', 'ollama'],
  document_ocr:      ['openai'],
  risk_score:        ['openai', 'azure_openai'],
  code_generation:   ['openai'],
  default:           ['openai', 'anthropic', 'ollama'],
};

// ── Audit ring buffer ──────────────────────────────────────────────────────────

const AUDIT_RING = [];
const AUDIT_MAX  = 500;

function auditLog(entry) {
  AUDIT_RING.push(entry);
  if (AUDIT_RING.length > AUDIT_MAX) AUDIT_RING.shift();
}

// ── Cost estimate ─────────────────────────────────────────────────────────────

function estimateCost(provider, inputTokens, outputTokens) {
  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) return 0;
  return (inputTokens * cfg.costPerInputToken) + (outputTokens * cfg.costPerOutputToken);
}

// ── Provider call implementations ─────────────────────────────────────────────

async function callOpenAI(messages, options, apiKey, baseUrl, model) {
  const fetch = (await import('node-fetch')).default;
  const body = {
    model: model || 'gpt-4o-mini',
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens:  options.maxTokens  ?? 1024,
  };

  if (options.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
    if (!messages.some(m => m.content.includes('JSON'))) {
      body.messages = [{ role: 'system', content: 'Respond with valid JSON only.' }, ...messages];
    }
  }
  if (options.tools) body.tools = options.tools;
  if (options.toolChoice) body.tool_choice = options.toolChoice;

  const url = `${baseUrl}/chat/completions`;
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const choice = data.choices[0];
  const content = choice.message.tool_calls
    ? JSON.stringify(choice.message.tool_calls[0].function.arguments)
    : (choice.message.content || '');

  return { content, usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 }, finishReason: choice.finish_reason };
}

async function callAzureOpenAI(messages, options, apiKey, endpoint, deployment, apiVersion) {
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const fetch = (await import('node-fetch')).default;
  const body = {
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens:  options.maxTokens  ?? 1024,
  };
  if (options.responseFormat === 'json') body.response_format = { type: 'json_object' };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Azure OpenAI ${res.status}: ${await res.text().then(t => t.slice(0,200))}`);
  const data = await res.json();
  const choice = data.choices[0];
  return { content: choice.message.content || '', usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 }, finishReason: choice.finish_reason };
}

async function callAnthropic(messages, options, apiKey, model) {
  const fetch = (await import('node-fetch')).default;
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsgs  = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const body = {
    model: model || 'claude-3-haiku-20240307',
    max_tokens: options.maxTokens ?? 1024,
    messages: userMsgs,
  };
  if (systemMsg) body.system = systemMsg;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text().then(t => t.slice(0,200))}`);
  const data = await res.json();
  const content = data.content?.[0]?.text || '';
  return { content, usage: { prompt_tokens: data.usage?.input_tokens || 0, completion_tokens: data.usage?.output_tokens || 0 }, finishReason: data.stop_reason };
}

async function callOllama(messages, options, baseUrl, model) {
  const fetch = (await import('node-fetch')).default;
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || 'llama3.2:3b', prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text().then(t => t.slice(0,200))}`);
  const data = await res.json();
  return {
    content: data.response || '',
    usage: { prompt_tokens: Math.ceil((data.prompt_eval_count || 0)), completion_tokens: Math.ceil((data.eval_count || 0)) },
    finishReason: data.done ? 'stop' : 'length',
  };
}

// ── Per-org model config (in-memory, can be backed by DB) ─────────────────────

const ORG_CONFIGS = new Map();

function setOrgConfig(orgId, config) {
  ORG_CONFIGS.set(orgId, { ...config, updatedAt: new Date().toISOString() });
}

function getOrgConfig(orgId) {
  return ORG_CONFIGS.get(orgId) || null;
}

function listOrgConfigs() {
  return Array.from(ORG_CONFIGS.entries()).map(([orgId, cfg]) => ({ orgId, ...cfg }));
}

// ── Core route function ───────────────────────────────────────────────────────

async function route({ task = 'default', messages, prompt, orgId, options = {}, forceProvider } = {}) {
  const requestId = uuidv4();
  const t0 = Date.now();

  // Normalize messages
  const msgs = messages || [{ role: 'user', content: prompt || '' }];

  // Determine provider priority
  const orgCfg = getOrgConfig(orgId);
  const customChain = orgCfg?.providerChain;
  const taskChain   = TASK_ROUTING[task] || TASK_ROUTING.default;
  const chain       = forceProvider ? [forceProvider] : (customChain || taskChain);

  let lastError;

  for (const provider of chain) {
    const cfg    = PROVIDER_CONFIG[provider];
    if (!cfg) continue;

    // Resolve API key
    const apiKey = orgCfg?.[`${provider}_api_key`]
      || process.env[`${provider.toUpperCase()}_API_KEY`]
      || (provider === 'openai' ? process.env.OPENAI_API_KEY : null);

    // Ollama doesn't need a key
    if (!apiKey && provider !== 'ollama') {
      lastError = new Error(`No API key for provider: ${provider}`);
      continue;
    }

    const model = orgCfg?.model || options.model || cfg.defaultModel;

    try {
      const callStart = Date.now();
      let result;

      if (provider === 'openai') {
        result = await callOpenAI(msgs, options, apiKey, cfg.baseUrl, model);
      } else if (provider === 'azure_openai') {
        if (!cfg.baseUrl) { lastError = new Error('Azure endpoint not configured'); continue; }
        result = await callAzureOpenAI(msgs, options, apiKey, cfg.baseUrl, cfg.defaultModel, cfg.apiVersion);
      } else if (provider === 'anthropic') {
        result = await callAnthropic(msgs, options, apiKey, model);
      } else if (provider === 'ollama') {
        result = await callOllama(msgs, options, cfg.baseUrl, model);
      } else if (provider === 'bedrock') {
        // Bedrock requires AWS SDK — fall through for now
        throw new Error('Bedrock requires AWS SDK v3 — configure Lambda adapter');
      }

      const latencyMs = Date.now() - callStart;
      const totalMs   = Date.now() - t0;
      const costUsd   = estimateCost(provider, result.usage.prompt_tokens, result.usage.completion_tokens);

      const entry = {
        requestId, orgId, task, provider, model,
        latencyMs, totalMs, costUsd,
        inputTokens:  result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
        finishReason: result.finishReason,
        timestamp: new Date().toISOString(),
        success: true,
      };
      auditLog(entry);

      return {
        requestId, provider, model, task,
        content: result.content,
        usage:   result.usage,
        latencyMs, totalMs, costUsd,
        finishReason: result.finishReason,
      };

    } catch (err) {
      lastError = err;
      auditLog({
        requestId, orgId, task, provider, model,
        latencyMs: Date.now() - t0,
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
      // Try next provider in chain
    }
  }

  throw new Error(`All providers failed for task "${task}". Last error: ${lastError?.message}`);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function getStats({ orgId, since } = {}) {
  let logs = AUDIT_RING.slice();
  if (orgId) logs = logs.filter(l => l.orgId === orgId);
  if (since) logs = logs.filter(l => new Date(l.timestamp) >= new Date(since));

  const successful  = logs.filter(l => l.success);
  const failed      = logs.filter(l => !l.success);
  const totalCost   = successful.reduce((s, l) => s + (l.costUsd || 0), 0);
  const avgLatency  = successful.length ? successful.reduce((s, l) => s + l.latencyMs, 0) / successful.length : 0;

  const byProvider = {};
  for (const l of successful) {
    byProvider[l.provider] = byProvider[l.provider] || { calls: 0, cost: 0, totalLatency: 0 };
    byProvider[l.provider].calls++;
    byProvider[l.provider].cost     += l.costUsd || 0;
    byProvider[l.provider].totalLatency += l.latencyMs;
  }
  Object.values(byProvider).forEach(p => { p.avgLatency = p.calls ? p.totalLatency / p.calls : 0; });

  return {
    totalCalls: logs.length,
    successCalls: successful.length,
    failedCalls:  failed.length,
    totalCostUsd: totalCost,
    avgLatencyMs: avgLatency,
    byProvider,
    recentErrors: failed.slice(-5).map(l => ({ provider: l.provider, error: l.error, timestamp: l.timestamp })),
  };
}

function getAuditLog({ limit = 50, orgId } = {}) {
  let logs = AUDIT_RING.slice().reverse();
  if (orgId) logs = logs.filter(l => l.orgId === orgId);
  return logs.slice(0, limit);
}

module.exports = {
  route,
  setOrgConfig,
  getOrgConfig,
  listOrgConfigs,
  getStats,
  getAuditLog,
  PROVIDER_CONFIG,
  TASK_ROUTING,
};
