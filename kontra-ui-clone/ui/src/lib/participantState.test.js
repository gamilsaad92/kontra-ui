import {
  participantStateToInviteStatus,
  resolveParticipantState,
  resolveParticipantStates,
} from './participantState';

const role = { key: 'buyer', label: 'Buyer', required: true };

describe('participant state resolver', () => {
  test('accepted invite is joined and complete without a submission row', () => {
    const state = resolveParticipantState(role, {
      invites: [{ role_key: 'buyer', status: 'accepted' }],
    });

    expect(state.state).toBe('joined');
    expect(state.stateLabel).toBe('Joined/Active');
    expect(state.complete).toBe(true);
    expect(state.invited).toBe(true);
    expect(participantStateToInviteStatus(state)).toBe('accepted');
  });

  test('valid pending invite is invited, not active', () => {
    const state = resolveParticipantState(role, {
      invites: [{
        role_key: 'buyer',
        status: 'pending',
        expires_at: '2099-01-01T00:00:00.000Z',
      }],
    });

    expect(state.state).toBe('invited');
    expect(state.stateLabel).toBe('Invited');
    expect(state.complete).toBe(false);
    expect(participantStateToInviteStatus(state)).toBe('pending');
  });

  test('expired or revoked invites do not make a participant invited', () => {
    expect(resolveParticipantState(role, {
      invites: [{
        role_key: 'buyer',
        status: 'pending',
        expires_at: '2000-01-01T00:00:00.000Z',
      }],
    }).state).toBe('not_invited');

    expect(resolveParticipantState(role, {
      invites: [{ role_key: 'buyer', status: 'revoked' }],
    }).state).toBe('not_invited');
  });

  test('joined invite wins over a pending invite and submissions do not authorize access', () => {
    const states = resolveParticipantStates([role], {
      invites: [
        { role_key: 'buyer', status: 'pending' },
        { role_key: 'buyer', status: 'accepted' },
      ],
      submissions: [{ role: 'buyer', status: 'approved' }],
    });

    expect(states[0].state).toBe('joined');
    expect(states[0].complete).toBe(true);
    expect(states[0].submission.status).toBe('approved');
  });
});