'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');

test('owner mutations in every environment use the centralized room-scoped authorization resolver', () => {
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
  assert.match(source, /async function getRoomAccessContext\(req, propertyId\)\s*\{\s*return resolveRoomSessionAccess/);
  assert.match(source, /async function requireRoomOwnerAccess\(req, propertyId\)\s*\{\s*const access = await getRoomAccessContext\(req, propertyId\)/);
  assert.doesNotMatch(source, /presentedOwnerToken|owner\.owner_write_token !== token/);
});

test('staging trial inserts rooms without conflict overwrite or failure cleanup', () => {
  assert.match(source, /stagingTrial\s*\?\s*supabase\.from\('deal_rooms'\)\.insert\(record\)/);
  const stagingBranch = source.slice(
    source.indexOf('if (stagingTrial) {\n      let ownerExchangeToken;'),
    source.indexOf('const successUrl =', source.indexOf('if (stagingTrial) {\n      let ownerExchangeToken;')),
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

test('owner AI and task actions remain under the room-scoped cookie path', () => {
  assert.match(source, /function ownerSessionCookiePath\(propertyId\)\s*\{\s*return `\/api\/public\/deal-room\/\$\{encodeURIComponent\(propertyId\)\}`;/);
  assert.match(source, /app\.use\('\/api\/public\/deal-room\/:propertyId\/ai', aiDealReviewRouter\)/);
});

test('staging deferrals are enabled only by validated staging isolation', () => {
  assert.match(source, /createDeferredTask531Modules\(\{\s*enabled:\s*stagingEnvironment\.enabled\s*\}\)/);
});

test('legacy owner credential spellings are scrubbed and the unused email route is absent', () => {
  for (const field of ['ownerWriteToken', 'ownerToken', 'owner_token', 'owner_write_token']) {
    assert.match(source, new RegExp(`delete req\\.body\\.${field}`));
  }
  assert.match(source, /delete req\.headers\['x-owner-write-token'\]/);
  assert.match(source, /delete req\.headers\['x-owner-token'\]/);
  assert.doesNotMatch(source, /send-invite-email/);
  assert.match(source, /app\.post\('\/api\/public\/deal-room\/:propertyId\/create-invite'/);
});
