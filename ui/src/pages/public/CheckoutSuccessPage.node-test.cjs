'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'CheckoutSuccessPage.jsx'), 'utf8');
const createSource = fs.readFileSync(path.join(__dirname, 'CreateDealRoomPage.jsx'), 'utf8');

test('staging checkout handoff exchanges the one-use capability through the owner session endpoint', () => {
  const read = source.indexOf('sessionStorage.getItem(key)');
  const clear = source.indexOf('sessionStorage.removeItem(key)', read);
  const send = source.indexOf('body: JSON.stringify({ exchangeToken })', clear);
  assert.ok(read >= 0 && clear > read && send > clear);
  assert.match(source, /credentials:\s*"include"/);
  assert.match(source, /owner-session\/exchange/);
  const stagingBranch = source.slice(source.indexOf('if (isStagingTrial && property)'), source.indexOf('const planLabel'));
  assert.match(stagingBranch, /setOwnerSessionHint\(property\)/);
  assert.doesNotMatch(stagingBranch, /ownerToken/);
});

test('trial creation stores the response capability only in tab storage before redirect', () => {
  const store = createSource.indexOf('data.ownerExchange.token');
  const redirect = createSource.indexOf('window.location.href = data.url', store);
  assert.ok(store >= 0 && redirect > store);
  assert.match(createSource, /sessionStorage\.setItem\(\s*`kontra_trial_owner_exchange_\$\{data\.ownerExchange\.propertyId\}`,\s*data\.ownerExchange\.token/s);
  assert.doesNotMatch(createSource, /ownerExchange\.token.*localStorage/s);
});

test('checkout success removes legacy owner credentials from browser history', () => {
  assert.match(source, /safe\.searchParams\.delete\("owner_token"\)/);
  assert.match(source, /window\.history\.replaceState/);
});
