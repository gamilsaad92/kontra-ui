'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveExplicitParticipantAccess } = require('./explicitParticipantAccess');

const now = new Date('2026-11-06T12:00:00Z');
const validSession = { invite_id: 'invite-1', expires_at: '2026-11-07T12:00:00Z', revoked_at: null };

test('explicit participant roles remain isolated from an available owner credential', async t => {
  for (const role of ['buyer', 'seller', 'legal_advisor', 'financial_advisor', 'custom_reviewer']) {
    await t.test(role, () => {
      const access = resolveExplicitParticipantAccess({
        sessionToken: 'participant',
        session: validSession,
        invite: { property_id: 'room-1', role_key: role, status: 'accepted' },
        propertyId: 'room-1',
        now,
      });
      assert.equal(access.mode, 'participant');
      assert.equal(access.role, role);
      assert.equal(access.permissions.manageStages, false);
      assert.equal(access.permissions.viewAllDocuments, false);
    });
  }
});

test('invalid, expired, revoked, and wrong-room participant sessions fail closed', () => {
  for (const [session, invite] of [
    [null, null],
    [{ ...validSession, expires_at: '2026-11-06T11:59:59Z' }, null],
    [{ ...validSession, revoked_at: now.toISOString() }, null],
    [validSession, { property_id: 'other-room', role_key: 'buyer', status: 'accepted' }],
    [validSession, { property_id: 'room-1', role_key: 'buyer', status: 'revoked' }],
  ]) {
    const access = resolveExplicitParticipantAccess({
      sessionToken: 'explicit-participant',
      session,
      invite,
      propertyId: 'room-1',
      now,
    });
    assert.equal(access.mode, 'anonymous');
    assert.equal(access.permissions.manageStages, false);
    assert.equal(access.permissions.viewAllDocuments, false);
  }
});
