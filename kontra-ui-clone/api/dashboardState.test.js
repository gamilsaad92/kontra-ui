const {
  buildRoomParticipants,
  computeRoomDashboardState,
} = require('./lib/dashboardState');

describe('durable dashboard room state', () => {
  it('uses accepted invite state when legacy party submissions are absent', () => {
    const participants = buildRoomParticipants({
      invites: [
        { role_key: 'buyer', status: 'accepted', last_used_at: '2026-08-15T00:00:00Z' },
        { role_key: 'seller', status: 'pending' },
      ],
      submissions: [],
    });

    expect(participants.map(p => p.role)).toEqual(['buyer']);
    expect(participants[0].status).toBe('accepted');
  });

  it('does not count an expired or revoked invite as an active participant', () => {
    const participants = buildRoomParticipants({
      now: Date.parse('2026-08-15T00:00:00Z'),
      invites: [
        { role_key: 'seller', status: 'accepted', expires_at: '2026-08-14T00:00:00Z' },
        { role_key: 'cpa', status: 'accepted', revoked_at: '2026-08-14T00:00:00Z' },
      ],
      submissions: [],
    });

    expect(participants).toEqual([]);
  });

  it('derives waiting metrics from required document assignments, not section names', () => {
    const state = computeRoomDashboardState({
      room: { property_id: 'room-1' },
      analyses: [{ section: 'loi', analysis: {} }],
      documents: [
        { section: 'loi', required: true, ai: false, assignedTo: ['buyer'] },
        { section: 'inspection', required: true, ai: true, assignedTo: ['inspector'] },
      ],
      invites: [{ role_key: 'buyer', status: 'accepted' }],
    });

    expect(state.waitingOnBorrower).toBe(false);
    expect(state.waitingOnInspector).toBe(true);
    expect(state.aiReviewsCompleted).toBe(0);
    expect(state.activeParticipants).toBe(1);
  });
});