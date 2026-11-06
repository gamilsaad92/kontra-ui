'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const helperUrl = pathToFileURL(path.join(__dirname, 'myDealRoomsOwnerSessions.mjs'));

test('owner exchange requests use the one-use capability and HttpOnly cookie session', async () => {
  const { exchangeMyDealRoomsOwnerSessions } = await import(helperUrl);
  let request;
  await exchangeMyDealRoomsOwnerSessions({
    rooms: [{ property_id: 'room/1' }],
    exchangeTokens: { 'room/1': 'one-time-capability' },
    apiBase: 'https://api.example/',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
  });
  assert.equal(request.url, 'https://api.example/api/public/deal-room/room%2F1/owner-session/exchange');
  assert.equal(request.options.credentials, 'include');
  assert.deepEqual(JSON.parse(request.options.body), { exchangeToken: 'one-time-capability' });
});

test('owner logout uses credentials and missing exchanges fail closed', async () => {
  const { exchangeMyDealRoomsOwnerSessions, logoutMyDealRoomsOwnerSessions } = await import(helperUrl);
  let request;
  await logoutMyDealRoomsOwnerSessions({
    rooms: [{ property_id: 'room-1' }],
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
  });
  assert.equal(request.options.credentials, 'include');
  await assert.rejects(exchangeMyDealRoomsOwnerSessions({
    rooms: [{ property_id: 'room-1' }],
    exchangeTokens: {},
    fetchImpl: async () => ({ ok: true }),
  }), /secure room access/i);
});
