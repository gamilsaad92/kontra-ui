const {
  buildRoomLink,
  buildPackageLink,
  buildIdempotencyKey,
  isActiveParticipant,
  isMaterialReadinessRegression,
  participantRecipientsForRoles,
} = require('./lib/dealNotificationDispatcher');

describe('deal notification dispatcher policy', () => {
  it('keeps role-scoped links inside the authorized deal-room route', () => {
    expect(buildRoomLink('room/with spaces', 'participant', { task: 'task-1' }))
      .toBe('https://kontraplatform.com/deal-room/room%2Fwith%20spaces?role=participant&task=task-1');
    expect(buildRoomLink('room-1', 'buyer', { tab: 'documents' }))
      .toBe('https://kontraplatform.com/deal-room/room-1?role=buyer&tab=documents');
    expect(buildPackageLink('room-1', 'owner', 'package-1'))
      .toBe('https://kontraplatform.com/deal-room/room-1?role=owner&package=package-1');
  });

  it('normalizes recipient addresses for deterministic idempotency keys', () => {
    expect(buildIdempotencyKey('event-1', ' Participant@Example.com '))
      .toBe('event-1:participant@example.com');
  });

  it('excludes revoked or address-less participants', () => {
    expect(isActiveParticipant({ email: 'active@example.com', status: 'submitted' })).toBe(true);
    expect(isActiveParticipant({ email: 'revoked@example.com', status: 'revoked' })).toBe(false);
    expect(isActiveParticipant({ status: 'submitted' })).toBe(false);
  });

  it('targets only active participants in newly assigned roles', () => {
    expect(participantRecipientsForRoles([
      { email: 'buyer@example.com', name: 'Buyer', role: 'buyer' },
      { email: 'seller@example.com', name: 'Seller', role: 'seller' },
      { email: 'counsel@example.com', name: 'Counsel', role: 'counsel' },
    ], ['Seller'])).toEqual([
      { email: 'seller@example.com', name: 'Seller', role: 'seller' },
    ]);
  });

  it('only treats material readiness transitions as regressions', () => {
    expect(isMaterialReadinessRegression(
      { overall: 90, approvalReady: true, digitalAssetSufficient: true },
      { overall: 80, approvalReady: true, digitalAssetSufficient: true },
    )).toEqual([]);

    expect(isMaterialReadinessRegression(
      { approvalReady: true, fundReleaseReady: true, digitalAssetSufficient: true },
      { approvalReady: false, fundReleaseReady: true, digitalAssetSufficient: false },
    )).toEqual([
      { key: 'approvalReady', label: 'Transaction approval readiness' },
      { key: 'digitalAssetSufficient', label: 'Digital Asset readiness' },
    ]);
  });
});