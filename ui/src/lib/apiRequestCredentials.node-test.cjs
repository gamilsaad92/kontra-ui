'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const helperUrl = pathToFileURL(path.join(__dirname, 'apiRequestCredentials.mjs'));

test('room API requests include cookies for a configured cross-origin API', async () => {
  const { resolveApiRequestCredentials } = await import(helperUrl);
  assert.equal(
    resolveApiRequestCredentials(
      'https://api-staging.kontraplatform.com/api/public/deal-room/room-1',
      'https://api-staging.kontraplatform.com',
      'https://staging.kontraplatform.com',
    ),
    'include',
  );
});

test('same-origin rewrites include cookies but unrelated external requests do not', async () => {
  const { resolveApiRequestCredentials } = await import(helperUrl);
  assert.equal(resolveApiRequestCredentials('/api/room', '', 'https://kontraplatform.com'), 'include');
  assert.equal(
    resolveApiRequestCredentials('https://cdn.example.test/image.png', 'https://api.example.test', 'https://app.example.test'),
    undefined,
  );
});
