#!/usr/bin/env node

/**
 * Read-only production smoke check for the authenticated Operations Manager
 * route. The stage-decision question is intentional: it exercises the
 * deterministic route that emits the redacted server trace used to verify the
 * deployed source and mounted handler.
 *
 * Required:
 *   BRAIN_SMOKE_PROPERTY_ID
 *   BRAIN_SMOKE_OWNER_WRITE_TOKEN or BRAIN_SMOKE_SESSION_TOKEN
 *
 * Optional full deployment verification:
 *   BRAIN_SMOKE_EXPECTED_COMMIT
 *   RENDER_API_KEY
 *   RENDER_OWNER_ID
 *   RENDER_SERVICE_ID
 *
 * The token and response body are never printed.
 */

const DEFAULT_BASE_URL = 'https://kontra-api.onrender.com';
const DEFAULT_TIMEOUT_MS = 30_000;
const QUESTION = "What's blocking the transaction?";

function fail(message) {
  throw new Error(message);
}

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) fail(`${name} is required`);
  return value;
}

function usage() {
  console.log([
    'Read-only production brain smoke check',
    '',
    'Required environment:',
    '  BRAIN_SMOKE_PROPERTY_ID',
    '  BRAIN_SMOKE_OWNER_WRITE_TOKEN or BRAIN_SMOKE_SESSION_TOKEN',
    '',
    'Optional full deployment verification:',
    '  BRAIN_SMOKE_EXPECTED_COMMIT',
    '  RENDER_API_KEY, RENDER_OWNER_ID, RENDER_SERVICE_ID',
    '',
    'Optional:',
    '  BRAIN_SMOKE_BASE_URL (default: https://kontra-api.onrender.com)',
  ].join('\n'));
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(
    process.env.BRAIN_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
  ));
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let body = null;
    try {
      body = await response.json();
    } catch {
      // Keep the status as the useful failure signal without echoing a body.
    }
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

function assertHealth(response, body) {
  if (response.status !== 200 || body?.ok !== true || body?.status !== 'ok') {
    const missing = Array.isArray(body?.missing_configuration)
      ? body.missing_configuration.join(', ')
      : 'unknown';
    fail(`health check failed (HTTP ${response.status}; missing configuration: ${missing})`);
  }
}

function assertBrainResponse(response, body) {
  if (!response.ok) fail(`brain/ask failed (HTTP ${response.status})`);
  if (typeof body?.answer !== 'string' || !body.answer.trim()) {
    fail('brain/ask returned no answer');
  }

  // Trace data belongs in server logs only. This also catches an accidental
  // switch to a diagnostic/debug response shape.
  for (const key of ['trace', 'projection', 'deployedCommit', 'authHeaderPresence']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      fail(`brain/ask exposed server diagnostics in the response (${key})`);
    }
  }
}

function renderLogVerificationConfigured() {
  return ['RENDER_API_KEY', 'RENDER_OWNER_ID', 'RENDER_SERVICE_ID']
    .every(name => String(process.env[name] || '').trim());
}

async function verifyRenderTrace({ requestId, propertyId, expectedCommit, baseUrl }) {
  if (!expectedCommit) {
    console.log('PASS: live revision check skipped (BRAIN_SMOKE_EXPECTED_COMMIT not set)');
    return;
  }
  if (!renderLogVerificationConfigured()) {
    fail('BRAIN_SMOKE_EXPECTED_COMMIT requires RENDER_API_KEY, RENDER_OWNER_ID, and RENDER_SERVICE_ID');
  }

  let traceLine = null;
  for (let attempt = 0; attempt < 5 && !traceLine; attempt += 1) {
    const now = Date.now();
    const query = new URLSearchParams({
      ownerId: process.env.RENDER_OWNER_ID.trim(),
      resource: process.env.RENDER_SERVICE_ID.trim(),
      type: 'app',
      direction: 'forward',
      startTime: new Date(now - 120_000).toISOString(),
      endTime: new Date(now + 30_000).toISOString(),
      limit: '200',
    });
    const { response, body } = await fetchJson(
      `https://api.render.com/v1/logs?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.RENDER_API_KEY.trim()}`,
          Accept: 'application/json',
        },
      },
    );
    if (!response.ok) fail(`Render log lookup failed (HTTP ${response.status})`);

    const messages = Array.isArray(body?.logs) ? body.logs.map(entry => entry?.message || '') : [];
    traceLine = messages.find(message => message.includes(`[brain/ask-trace]`)
      && message.includes(requestId));
    if (!traceLine && attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 2_000));
    }
  }
  if (!traceLine) {
    fail(`no server trace found for ${requestId} at ${new URL(baseUrl).host}`);
  }

  const jsonText = traceLine.slice(traceLine.indexOf('{'));
  let trace;
  try {
    trace = JSON.parse(jsonText);
  } catch {
    fail('server trace was not valid JSON');
  }
  if (trace.deployedCommit !== expectedCommit) {
    fail(`live commit mismatch (expected ${expectedCommit}, received ${trace.deployedCommit || 'unknown'})`);
  }
  if (trace.accessMode !== 'operations_manager_router') {
    fail(`unexpected brain/ask handler (${trace.accessMode || 'unknown'})`);
  }
  if (trace.propertyId !== propertyId || trace.requestId !== requestId) {
    fail('server trace identity did not match the smoke request');
  }
  console.log(`PASS: Render trace matches commit ${expectedCommit} and operations-manager handler`);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  const baseUrl = (process.env.BRAIN_SMOKE_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  const propertyId = required('BRAIN_SMOKE_PROPERTY_ID');
  const ownerToken = String(process.env.BRAIN_SMOKE_OWNER_WRITE_TOKEN || '').trim();
  const sessionToken = String(process.env.BRAIN_SMOKE_SESSION_TOKEN || '').trim();
  if (!ownerToken && !sessionToken) {
    fail('BRAIN_SMOKE_OWNER_WRITE_TOKEN or BRAIN_SMOKE_SESSION_TOKEN is required');
  }

  const requestId = `brain-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { Accept: 'application/json' };
  if (ownerToken) headers['x-owner-write-token'] = ownerToken;
  else headers['x-kontra-session'] = sessionToken;

  const health = await fetchJson(`${baseUrl}/health`, { headers: { Accept: 'application/json' } });
  assertHealth(health.response, health.body);
  console.log(`PASS: /health is healthy at ${new URL(baseUrl).host}`);

  const brain = await fetchJson(
    `${baseUrl}/api/public/deal-room/${encodeURIComponent(propertyId)}/brain/ask`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'x-kontra-request-id': requestId,
      },
      body: JSON.stringify({ question: QUESTION }),
    },
  );
  assertBrainResponse(brain.response, brain.body);
  console.log(`PASS: authenticated brain/ask returned an answer (request ${requestId})`);

  await verifyRenderTrace({
    requestId,
    propertyId,
    expectedCommit: String(process.env.BRAIN_SMOKE_EXPECTED_COMMIT || '').trim(),
    baseUrl,
  });

  console.log('Smoke check passed; authentication material was not logged');
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});