const ACTIVE_INVITE_STATUSES = new Set(['pending', 'invited', 'sent', 'accepted', 'joined', 'active']);
const JOINED_INVITE_STATUSES = new Set(['accepted', 'joined', 'active']);
const INVALID_INVITE_STATUSES = new Set(['revoked', 'expired', 'superseded', 'cancelled']);

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidInvite(invite) {
  const status = normalizeStatus(invite?.status);
  if (!ACTIVE_INVITE_STATUSES.has(status) || INVALID_INVITE_STATUSES.has(status)) return false;
  if (status === 'pending' || status === 'invited' || status === 'sent') {
    if (invite?.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) return false;
  }
  return true;
}

function inviteRank(invite) {
  return JOINED_INVITE_STATUSES.has(normalizeStatus(invite?.status)) ? 2 : 1;
}

/**
 * Resolve participant state from durable invitation records first.
 *
 * Submission/activity rows are retained as supporting metadata only. They
 * cannot turn a role into an active participant without a valid invite.
 */
export function resolveParticipantState(role, {
  invites = [],
  submissions = [],
} = {}) {
  const roleKey = role?.key || role?.role_key;
  const roleInvites = invites
    .filter(invite => invite?.role_key === roleKey && isValidInvite(invite))
    .sort((a, b) => inviteRank(b) - inviteRank(a));
  const invite = roleInvites[0] || null;
  const submission = submissions.find(item => item?.role === roleKey) || null;

  if (invite && inviteRank(invite) === 2) {
    return {
      ...role,
      role_key: roleKey,
      state: 'joined',
      stateLabel: 'Joined/Active',
      invited: true,
      joined: true,
      complete: true,
      invite,
      submission,
    };
  }

  if (invite) {
    return {
      ...role,
      role_key: roleKey,
      state: 'invited',
      stateLabel: 'Invited',
      invited: true,
      joined: false,
      complete: false,
      invite,
      submission,
    };
  }

  return {
    ...role,
    role_key: roleKey,
    state: 'not_invited',
    stateLabel: 'Not invited',
    invited: false,
    joined: false,
    complete: false,
    invite: null,
    submission,
  };
}

export function resolveParticipantStates(roles = [], data = {}) {
  return roles.map(role => resolveParticipantState(role, data));
}

export function participantStateToInviteStatus(state) {
  if (state?.state === 'joined') return 'accepted';
  if (state?.state === 'invited') return 'pending';
  return 'not_invited';
}