'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertStagingEnvironment } = require('./stagingEnvironment');
const {
  STAGING_SCORING_POST_PATHS,
  createStagingScoringGuard,
  createStagingScoringScheduler,
} = require('./stagingScoringGuard');

const schedules = [
  { type: 'score-assets', intervalMs: 6 * 60 * 60 * 1000 },
  { type: 'score-loans', intervalMs: 6 * 60 * 60 * 1000 },
  { type: 'score-troubled', intervalMs: 12 * 60 * 60 * 1000 },
];

function validStagingEnvironment(overrides = {}) {
  const env = {
    NODE_ENV: 'production',
    KONTRA_STAGING_ISOLATION: 'true',
    STAGING_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-staging-role-key-for-tests-only',
    STAGING_OPENAI_API_KEY: 'synthetic-staging-openai-key-for-tests-only',
    STAGING_SESSION_SECRET: 'synthetic-staging-session-secret-for-tests-only-123456',
    ...overrides,
  };
  return assertStagingEnvironment(env);
}

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('validated staging identity suppresses all automatic score jobs and timers', () => {
  const stagingEnvironment = validStagingEnvironment();
  const enqueued = [];
  const timers = [];
  const start = createStagingScoringScheduler({
    nodeEnv: 'production',
    stagingEnvironment,
    schedules,
    addJob: type => enqueued.push(type),
    setIntervalFn: (callback, intervalMs) => timers.push({ callback, intervalMs }),
  });

  assert.equal(stagingEnvironment.enabled, true);
  assert.equal(start(), false);
  assert.deepEqual(enqueued, []);
  assert.deepEqual(timers, []);
});

test('non-staging production preserves immediate jobs and scoring intervals', () => {
  const stagingEnvironment = assertStagingEnvironment({ NODE_ENV: 'production' });
  const enqueued = [];
  const timers = [];
  const start = createStagingScoringScheduler({
    nodeEnv: 'production',
    stagingEnvironment,
    schedules,
    addJob: type => enqueued.push(type),
    setIntervalFn: (callback, intervalMs) => timers.push({ callback, intervalMs }),
  });

  assert.equal(stagingEnvironment.enabled, false);
  assert.equal(start(), true);
  assert.deepEqual(enqueued, ['score-assets', 'score-loans', 'score-troubled']);
  assert.deepEqual(timers.map(timer => timer.intervalMs), schedules.map(item => item.intervalMs));
  assert.equal(timers.length, 3);
  timers.forEach(timer => timer.callback());
  assert.deepEqual(enqueued.slice(3), ['score-assets', 'score-loans', 'score-troubled']);
});

test('non-production never schedules score jobs', () => {
  const stagingEnvironment = assertStagingEnvironment({ NODE_ENV: 'development' });
  const enqueued = [];
  const timers = [];
  const start = createStagingScoringScheduler({
    nodeEnv: 'development',
    stagingEnvironment,
    schedules,
    addJob: type => enqueued.push(type),
    setIntervalFn: (callback, intervalMs) => timers.push({ callback, intervalMs }),
  });

  assert.equal(start(), false);
  assert.deepEqual(enqueued, []);
  assert.deepEqual(timers, []);
});

test('staging returns 403 before downstream middleware for every scoring route variant', () => {
  const guard = createStagingScoringGuard(validStagingEnvironment());
  for (const route of STAGING_SCORING_POST_PATHS) {
    for (const requestPath of [route, `${route}/`, route.toUpperCase()]) {
      for (const headers of [
        {},
        { 'x-organization-id': 'synthetic-org' },
        { authorization: 'Bearer ordinary-deal-room-user' },
      ]) {
        let nextCalled = false;
        let enqueueCount = 0;
        const res = responseRecorder();
        guard(
          { method: 'POST', path: requestPath, headers },
          res,
          () => {
            nextCalled = true;
            enqueueCount += 1;
          },
        );

        assert.equal(res.statusCode, 403, requestPath);
        assert.equal(res.body.error, 'SCORING_DISABLED_IN_STAGING');
        assert.equal(nextCalled, false);
        assert.equal(enqueueCount, 0);
      }
    }
  }
});

test('non-staging scoring requests pass through without changing other methods', () => {
  const guard = createStagingScoringGuard(assertStagingEnvironment({ NODE_ENV: 'production' }));
  for (const req of [
    { method: 'POST', path: '/api/jobs/score-assets' },
    { method: 'POST', path: '/api/risk/run' },
    { method: 'GET', path: '/api/jobs/score-assets' },
  ]) {
    const res = responseRecorder();
    let nextCalled = false;
    guard(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
  }
});

test('missing or malformed validated isolation policy fails closed', () => {
  for (const policy of [undefined, null, {}, { enabled: 'true' }, { enabled: 1 }]) {
    assert.throws(
      () => createStagingScoringGuard(policy),
      /validated staging environment policy is required/,
    );
    assert.throws(
      () => createStagingScoringScheduler({
        nodeEnv: 'production',
        stagingEnvironment: policy,
        schedules,
        addJob() {},
      }),
      /validated staging environment policy is required/,
    );
  }

  for (const value of ['', 'false', 'TRUE', '1']) {
    assert.throws(
      () => validStagingEnvironment({ KONTRA_STAGING_ISOLATION: value }),
      /KONTRA_STAGING_ISOLATION must be exactly true/,
    );
  }
});

test('API guard is registered before organization context and all scoring handlers', () => {
  const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
  const guardIndex = source.indexOf('app.use(createStagingScoringGuard(stagingEnvironment))');
  const orgContextIndex = source.indexOf("app.use('/api', requireOrgContext)");
  const riskRouterMountIndex = source.indexOf("app.use('/api/risk', riskRouter)");
  const scoreRouteIndex = source.indexOf("app.post('/api/jobs/score-loans'");
  assert.ok(guardIndex >= 0);
  assert.ok(orgContextIndex > guardIndex);
  assert.ok(riskRouterMountIndex > guardIndex);
  assert.ok(scoreRouteIndex > orgContextIndex);
  assert.match(source, /startJobSchedulers\s*=\s*createStagingScoringScheduler/);
  assert.match(source, /if \(process\.env\.NODE_ENV === 'production'\)\s*\{\s*startJobSchedulers\(\)/);
});
