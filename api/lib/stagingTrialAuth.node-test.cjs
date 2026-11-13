'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseAllowedTesterEmails,
  stagingDemoRouteGuard,
  stagingTrialAuth,
} = require('./stagingTrialAuth');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('hosted staging blocks the demo write route before its handler', () => {
  const res = responseRecorder();
  let nextCalled = false;

  stagingDemoRouteGuard(true)({}, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'not_found' });
  assert.equal(nextCalled, false);
});

test('non-staging demo route behavior is unchanged', () => {
  let nextCalled = false;
  stagingDemoRouteGuard(false)({}, responseRecorder(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('hosted staging rejects trial creation without a bearer token before its handler', async () => {
  let getUserCalls = 0;
  let nextCalled = false;
  const res = responseRecorder();
  const middleware = stagingTrialAuth(true, {
    auth: { getUser: async () => { getUserCalls += 1; } },
  }, 'qa@example.test');

  await middleware({ headers: {} }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(getUserCalls, 0);
});

test('hosted staging rejects an invalid Supabase token before its handler', async () => {
  let nextCalled = false;
  const res = responseRecorder();
  const middleware = stagingTrialAuth(true, {
    auth: { getUser: async () => ({ data: { user: null }, error: new Error('invalid token') }) },
  }, 'qa@example.test');

  await middleware({ headers: { authorization: 'Bearer invalid' } }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('hosted staging rejects valid but unapproved tester identity before its handler', async () => {
  let nextCalled = false;
  const res = responseRecorder();
  const middleware = stagingTrialAuth(true, {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'stage-user-2', email: 'other@example.test' } },
        error: null,
      }),
    },
  }, 'qa@example.test');

  await middleware({ headers: { authorization: 'Bearer valid-unapproved-token' } }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'staging_tester_not_approved');
  assert.equal(nextCalled, false);
});

test('hosted staging denies all trial creation when no testers are configured', async () => {
  let getUserCalls = 0;
  let nextCalled = false;
  const res = responseRecorder();
  const middleware = stagingTrialAuth(true, {
    auth: { getUser: async () => { getUserCalls += 1; } },
  }, '');

  await middleware({ headers: { authorization: 'Bearer valid-token' } }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'staging_testers_not_configured');
  assert.equal(nextCalled, false);
  assert.equal(getUserCalls, 0);
});

test('hosted staging passes verified approved tester identity to the trial handler', async () => {
  let receivedToken = null;
  let nextCalled = false;
  const req = { headers: { authorization: 'Bearer verified-token' } };
  const middleware = stagingTrialAuth(true, {
    auth: {
      getUser: async (token) => {
        receivedToken = token;
        return { data: { user: { id: 'stage-user-1', email: 'QA@Example.Test ' } }, error: null };
      },
    },
  }, 'qa@example.test');

  await middleware(req, responseRecorder(), () => { nextCalled = true; });

  assert.equal(receivedToken, 'verified-token');
  assert.equal(req.stagingTrialUser.email, 'qa@example.test');
  assert.equal(nextCalled, true);
});

test('non-staging trial route behavior is unchanged', async () => {
  let nextCalled = false;
  const middleware = stagingTrialAuth(false, null);
  await middleware({ headers: {} }, responseRecorder(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('approved tester emails are normalized and empty entries are ignored', () => {
  assert.deepEqual(
    [...parseAllowedTesterEmails(' QA@example.test, ,owner@example.test ')],
    ['qa@example.test', 'owner@example.test'],
  );
});
