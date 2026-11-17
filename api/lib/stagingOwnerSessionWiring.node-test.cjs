'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');

test('staging owner mutations use the centralized room-scoped authorization resolver', () => {
  const routes = [
    ["put", "/api/public/deal-room/:propertyId/checklist"],
    ["patch", "/api/public/deal-room/:propertyId/stages"],
    ["patch", "/api/public/deal-room/:propertyId/metadata"],
    ["patch", "/api/public/deal-room/:propertyId/metadata-merge"],
    ["patch", "/api/public/deal-room/:propertyId/ownership"],
    ["patch", "/api/public/deal-room/:propertyId/jurisdiction"],
    ["post", "/api/public/deal-room/:propertyId/notifications/:notificationId/resend"],
    ["post", "/api/public/deal-room/:propertyId/request-document"],
  ];
  for (const [method, route] of routes) {
    const start = source.indexOf(`app.${method}('${route}'`);
    assert.notEqual(start, -1, `missing route ${route}`);
    const nextRoute = source.indexOf("\napp.", start + route.length);
    const block = source.slice(start, nextRoute < 0 ? undefined : nextRoute);
    assert.match(block, /requireRoomOwnerAccess\(/, `route does not use owner resolver: ${route}`);
  }
  assert.match(source, /presentedOwnerToken === 'room-owner-session'\s*\?\s*''/);
  assert.match(source, /if \(!stagingEnvironment\.enabled\)[\s\S]*?owner\.owner_write_token !== token/);
});

test('staging trial inserts rooms without conflict overwrite or failure cleanup', () => {
  assert.match(source, /stagingTrial\s*\?\s*supabase\.from\('deal_rooms'\)\.insert\(record\)/);
  const stagingBranch = source.slice(
    source.indexOf('if (stagingTrial) {\n      let ownerExchangeToken;'),
    source.indexOf('// Generate owner write token and persist it', source.indexOf('if (stagingTrial) {\n      let ownerExchangeToken;')),
  );
  assert.ok(stagingBranch.length > 0);
  assert.doesNotMatch(stagingBranch, /deleteDealRoomData/);
  assert.match(stagingBranch, /partialRoom: true/);
});

test('owner exchange requires exact trusted Origin and sets a scoped secure HttpOnly cookie', () => {
  const start = source.indexOf("'/api/public/deal-room/:propertyId/owner-session/exchange'");
  const end = source.indexOf("app.post('/api/public/deal-room/:propertyId/owner-session/logout'", start);
  const block = source.slice(start, end);
  assert.match(block, /requireOrigin:\s*true/);
  assert.match(block, /'HttpOnly'/);
  assert.match(block, /'Secure'/);
  assert.match(block, /'SameSite=Lax'/);
  assert.match(block, /ownerSessionCookiePath\(propertyId\)/);
  assert.match(block, /'Cache-Control', 'no-store'/);
});
