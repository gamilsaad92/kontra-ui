const mockEventHandlers = {};
const mockInsertedNotifications = [];
const mockSentEmails = [];

function mockQueryResult(table) {
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    insert(payload) {
      if (table === 'deal_notifications') mockInsertedNotifications.push(payload);
      return query;
    },
    update(patch) {
      if (table === 'deal_notifications' && patch?.link && mockInsertedNotifications.length > 0) {
        Object.assign(mockInsertedNotifications[mockInsertedNotifications.length - 1], { link: patch.link });
      }
      return query;
    },
    then(resolve, reject) {
      let result = { data: null, error: null };
      if (table === 'deal_rooms') {
        result = {
          data: {
            property_id: 'room-1',
            customer_email: 'owner@example.com',
            property_name: 'Acquisition Room',
            first_name: 'Owner',
            workflow_pack_id: 'business_acquisition',
            deal_type: 'business_acquisition',
          },
          error: null,
        };
      } else if (table === 'party_submissions') {
        result = { data: [], error: null };
      } else if (table === 'deal_room_invites') {
        result = {
          data: [
            {
              id: 'invite-seller',
              role_key: 'seller',
              invited_email: 'seller@example.com',
              status: 'accepted',
              expires_at: '2099-01-01T00:00:00.000Z',
              revoked_at: null,
            },
            {
              id: 'invite-buyer',
              role_key: 'buyer',
              invited_email: 'buyer@example.com',
              status: 'accepted',
              expires_at: '2099-01-01T00:00:00.000Z',
              revoked_at: null,
            },
          ],
          error: null,
        };
      }
      return Promise.resolve(result).then(resolve, reject);
    },
    maybeSingle() {
      return query;
    },
    single() {
      return Promise.resolve({ data: { id: 'delivery-1' }, error: null });
    },
  };
  return query;
}

jest.mock('./db', () => ({
  supabase: {
    from: jest.fn(table => mockQueryResult(table)),
  },
}));

jest.mock('./lib/eventBus', () => ({
  on: jest.fn((type, handler) => {
    mockEventHandlers[type] = handler;
  }),
}));

jest.mock('./lib/dealRoomHelpers', () => ({
  sendResendEmail: jest.fn(async (_key, payload) => {
    mockSentEmails.push(payload);
  }),
  getPackRoleLabel: jest.fn((_packId, role) => role),
  resolvePackIdFromRoom: jest.fn(room => room.workflow_pack_id),
}));

process.env.RESEND_API_KEY = 'test-resend-key';
process.env.SESSION_SECRET = 'test-session-secret';

const { startDealNotificationDispatcher } = require('./lib/dealNotificationDispatcher');
const { sendResendEmail } = require('./lib/dealRoomHelpers');
const { verifyParticipantAccessToken } = require('./lib/participantAccessTokens');

describe('event-driven participant assignment delivery', () => {
  function assignmentEvent(id, role, section = 'custom_questionnaire') {
    return {
      id,
      type: 'transaction.event',
      data: {
        propertyId: 'room-1',
        eventType: 'participant_assignment_changed',
        metadata: {
          newlyAssignedRoles: [role],
          assignments: [{
            section,
            label: 'Buyer Due Diligence Questionnaire',
            required: false,
            newlyAssignedRoles: [role],
          }],
        },
      },
    };
  }

  async function flushDispatch() {
    await new Promise(resolve => setImmediate(resolve));
  }

  beforeEach(() => {
    mockInsertedNotifications.length = 0;
    mockSentEmails.length = 0;
    jest.clearAllMocks();
    Object.keys(mockEventHandlers).forEach(key => delete mockEventHandlers[key]);
    startDealNotificationDispatcher.started = false;
    startDealNotificationDispatcher();
  });

  it('delivers a reassignment to an accepted invite before submission exists', async () => {
    const handler = mockEventHandlers['transaction.event'];
    expect(handler).toBeDefined();

    handler({
      id: 'event-1',
      type: 'transaction.event',
      data: {
        propertyId: 'room-1',
        eventType: 'participant_assignment_changed',
        metadata: {
          newlyAssignedRoles: ['seller'],
          assignments: [{
            section: 'custom_questionnaire',
            label: 'Buyer Due Diligence Questionnaire',
            required: false,
            newlyAssignedRoles: ['seller'],
          }],
        },
      },
    });

    await new Promise(resolve => setImmediate(resolve));

    expect(mockInsertedNotifications).toEqual([expect.objectContaining({
      property_id: 'room-1',
      type: 'participant_assignment',
      event_id: 'event-1',
      to_email: 'seller@example.com',
      delivery_status: 'pending',
      metadata: {
        assignments: [{
          section: 'custom_questionnaire',
          required: false,
        }],
      },
    })]);
    expect(sendResendEmail).toHaveBeenCalledTimes(1);
    expect(mockSentEmails[0].to).toBe('seller@example.com');
    expect(mockSentEmails[0].html).toContain('Buyer Due Diligence Questionnaire');
    expect(mockSentEmails[0].html).not.toContain('buyer@example.com');
    const notificationUrl = new URL(mockInsertedNotifications[0].link);
    expect(notificationUrl.searchParams.get('tab')).toBe('documents');
    expect(notificationUrl.searchParams.get('role')).toBe('seller');
    expect(
      verifyParticipantAccessToken(notificationUrl.searchParams.get('participant_access'), {
        propertyId: 'room-1',
      }),
    ).toEqual(expect.objectContaining({
      propertyId: 'room-1',
      inviteId: 'invite-seller',
      role: 'seller',
    }));
  });

  it('delivers Buyer → Seller → Buyer as three distinct assignment events', async () => {
    const handler = mockEventHandlers['transaction.event'];

    handler(assignmentEvent('event-buyer-1', 'buyer'));
    await flushDispatch();
    handler(assignmentEvent('event-seller-1', 'seller'));
    await flushDispatch();
    handler(assignmentEvent('event-buyer-2', 'buyer'));
    await flushDispatch();

    expect(sendResendEmail).toHaveBeenCalledTimes(3);
    expect(mockSentEmails.map(email => email.to)).toEqual([
      'buyer@example.com',
      'seller@example.com',
      'buyer@example.com',
    ]);
    expect(mockInsertedNotifications).toHaveLength(3);
    expect(new Set(mockInsertedNotifications.map(notification => notification.idempotency_key)).size)
      .toBe(3);

    const ctas = mockInsertedNotifications.map(notification => new URL(notification.link));
    expect(ctas.map(url => url.searchParams.get('role'))).toEqual(['buyer', 'seller', 'buyer']);
    expect(ctas.every(url => url.searchParams.get('tab') === 'documents')).toBe(true);
    expect(ctas.map(url => verifyParticipantAccessToken(
      url.searchParams.get('participant_access'),
      { propertyId: 'room-1' },
    )?.inviteId)).toEqual([
      'invite-buyer',
      'invite-seller',
      'invite-buyer',
    ]);
  });

  it('does not send when the saved assignment is unchanged', async () => {
    const handler = mockEventHandlers['transaction.event'];

    handler({
      id: 'event-unchanged',
      type: 'transaction.event',
      data: {
        propertyId: 'room-1',
        eventType: 'participant_assignment_changed',
        metadata: {
          newlyAssignedRoles: [],
          assignments: [],
        },
      },
    });
    await flushDispatch();

    expect(sendResendEmail).not.toHaveBeenCalled();
    expect(mockInsertedNotifications).toHaveLength(0);
  });
});