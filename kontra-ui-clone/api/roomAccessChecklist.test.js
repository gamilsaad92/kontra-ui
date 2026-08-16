const mockOwnerToken = 'owner-token';
const mockParticipantToken = 'participant-session';

jest.mock('./db', () => {
  const owner = {
    id: 'room-1',
    owner_write_token: mockOwnerToken,
    customer_email: 'owner@example.com',
    checklist_items: [
      { section: 'seller_financials', assignedTo: ['seller'] },
      { section: 'legal_review', assignedTo: ['counsel'] },
    ],
    workflow_pack_id: 'business_acquisition',
    property_type: 'Business',
  };
  const invite = {
    property_id: 'room-1',
    role_key: 'seller',
    invited_email: 'seller@example.com',
    status: 'accepted',
  };
  const session = {
    invite_id: 'invite-1',
    expires_at: '2999-01-01T00:00:00.000Z',
    revoked_at: null,
  };
  const sessionHash = require('crypto').createHash('sha256').update(mockParticipantToken).digest('hex');

  function builder(table) {
    const state = { filters: {} };
    const chain = {
      select: () => chain,
      eq: (key, value) => {
        state.filters[key] = value;
        return chain;
      },
      gt: () => chain,
      is: () => chain,
      maybeSingle: async () => {
        if (table === 'deal_rooms') return { data: owner, error: null };
        if (table === 'deal_room_access_sessions') {
          return state.filters.session_token_hash === sessionHash
            ? { data: session, error: null }
            : { data: null, error: null };
        }
        if (table === 'deal_room_invites') return { data: invite, error: null };
        return { data: null, error: null };
      },
      single: async () => ({ data: owner, error: null }),
      then: (resolve) => resolve({ data: [], error: null }),
    };
    return chain;
  }

  return { supabase: { from: builder } };
});

const app = require('./index');
const request = require('supertest');

describe('room access and checklist scoping', () => {
  it('gives a valid owner token precedence over a valid participant session', async () => {
    const access = await app.getRoomAccessContext({
      headers: {
        'x-owner-write-token': mockOwnerToken,
        'x-kontra-session': mockParticipantToken,
      },
    }, 'room-1');

    expect(access.mode).toBe('owner');
    expect(access.permissions.viewAllDocuments).toBe(true);
  });

  it('does not reject the owner room lookup when a stale participant session is also present', async () => {
    const response = await request(app)
      .get('/api/public/deal-room/room-1')
      .set('x-owner-write-token', mockOwnerToken)
      .set('x-kontra-session', mockParticipantToken);

    expect(response.status).not.toBe(403);
  });

  it('keeps a participant session role-scoped when no owner token is present', async () => {
    const access = await app.getRoomAccessContext({
      headers: { 'x-kontra-session': mockParticipantToken },
    }, 'room-1');

    expect(access.mode).toBe('participant');
    expect(access.role).toBe('seller');
  });

  it('filters participant checklist items while leaving coordinator items complete', () => {
    const items = [
      { section: 'seller_financials', assignedTo: ['seller'] },
      { section: 'legal_review', assignedTo: ['counsel'] },
      { section: 'legacy_seller_item' },
    ];
    const scoped = app.filterChecklistItemsByRole(
      items,
      'seller',
      { legacy_seller_item: ['seller'] },
    );

    expect(scoped.map(item => item.section)).toEqual([
      'seller_financials',
      'legacy_seller_item',
    ]);
    expect(items).toHaveLength(3);
  });

  it('returns only assigned checklist items to participants and the full checklist to owners', async () => {
    const participantResponse = await request(app)
      .get('/api/public/deal-room/room-1/checklist')
      .set('x-kontra-session', mockParticipantToken);
    const ownerResponse = await request(app)
      .get('/api/public/deal-room/room-1/checklist')
      .set('x-owner-write-token', mockOwnerToken);

    expect(participantResponse.status).toBe(200);
    expect(participantResponse.body.items.map(item => item.section)).toEqual(['seller_financials']);
    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.items.map(item => item.section)).toEqual([
      'seller_financials',
      'legal_review',
    ]);
  });
});