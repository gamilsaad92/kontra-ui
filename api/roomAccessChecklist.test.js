const mockOwnerToken = 'owner-token';
const mockParticipantToken = 'participant-session';

jest.mock('./db', () => {
  const owner = {
    id: 'room-1',
    property_id: 'room-1',
    property_name: 'Owner Room',
    owner_write_token: mockOwnerToken,
    customer_email: 'owner@example.com',
    checklist_items: [
      { section: 'seller_financials', assignedTo: ['seller'] },
      { section: 'legal_review', assignedTo: ['counsel'] },
    ],
    workflow_pack_id: 'business_acquisition',
    property_type: 'Business',
    status: 'active',
    deal_stage: 'uploading',
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
      ilike: (key, value) => {
        state.filters[key] = value;
        return chain;
      },
      order: () => chain,
      in: () => chain,
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
      then: (resolve) => resolve({
        data: table === 'deal_rooms' && state.filters.customer_email ? [owner] : [],
        error: null,
      }),
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

  it('resolves an owner-only direct room URL to coordinator access', async () => {
    const response = await request(app)
      .get('/api/public/deal-room/room-1?role=seller')
      .set('x-owner-write-token', mockOwnerToken);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('deal_coordinator');
    expect(response.body.access).toEqual({ mode: 'owner' });
  });

  it('keeps owner coordinator access across repeated room loads', async () => {
    for (let i = 0; i < 2; i += 1) {
      const response = await request(app)
        .get('/api/public/deal-room/room-1?role=seller')
        .set('x-owner-write-token', mockOwnerToken)
        .set('x-kontra-session', mockParticipantToken);

      expect(response.status).toBe(200);
      expect(response.body.role).toBe('deal_coordinator');
      expect(response.body.access).toEqual({ mode: 'owner' });
    }
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

  it('does not show a participant a persisted row just because the pack fallback mentions that role', () => {
    const creAssignments = {
      purchase_agreement: ['buyer', 'seller', 'legal_advisor', 'owner', 'attorney'],
      inspection: ['buyer', 'financial_advisor', 'inspector'],
      title: ['buyer', 'legal_advisor', 'attorney'],
      financing: ['lender'],
    };
    const items = [
      { section: 'purchase_agreement', assignedTo: ['owner'] },
      { section: 'inspection', assignedTo: ['inspector'] },
      { section: 'title', assignedTo: ['attorney'] },
      { section: 'financing', assignedTo: ['lender'] },
    ];

    expect(app.filterChecklistItemsByRole(items, 'buyer', creAssignments).map(item => item.section))
      .toEqual([]);
    expect(app.filterChecklistItemsByRole(items, 'inspector', creAssignments).map(item => item.section))
      .toEqual(['inspection']);
    expect(app.filterChecklistItemsByRole(items, 'attorney', creAssignments).map(item => item.section))
      .toEqual(['title']);
    expect(app.filterChecklistItemsByRole(items, 'lender', creAssignments).map(item => item.section))
      .toEqual(['financing']);
  });

  it('uses normalized role keys for canonical and legacy assignments', () => {
    const items = [
      { section: 'title', assignedTo: ['Legal Advisor'] },
      { section: 'inspection', assignedTo: ['inspector'] },
      { section: 'financials', assignedTo: ['financial_advisor'] },
    ];

    expect(app.filterChecklistItemsByRole(items, 'legal_advisor').map(item => item.section))
      .toEqual(['title']);
    expect(app.filterChecklistItemsByRole(items, 'INSPECTOR').map(item => item.section))
      .toEqual(['inspection']);
    expect(app.filterChecklistItemsByRole(items, 'Financial Advisor').map(item => item.section))
      .toEqual(['financials']);
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

  it('keeps checklist visibility and upload authorization aligned', async () => {
    const access = await app.getRoomAccessContext({
      headers: { 'x-kontra-session': mockParticipantToken },
    }, 'room-1');
    const assignedSections = await app.getAssignedSectionsForAccess(
      'room-1',
      'business_acquisition',
      'Business',
      access,
    );

    expect([...assignedSections]).toEqual(['seller_financials']);

    const uploadResponse = await request(app)
      .post('/api/public/deal-room/room-1/track-document')
      .set('x-kontra-session', mockParticipantToken)
      .field('section', 'legal_review')
      .field('role', 'counsel')
      .attach('file', Buffer.from('not a real document'), 'document.pdf');

    expect(uploadResponse.status).toBe(403);
    expect(uploadResponse.body.message).toMatch(/not assigned to your role/i);
  });

  it('ignores URL and body role overrides for a verified participant session', async () => {
    const response = await request(app)
      .get('/api/public/deal-room/room-1/checklist?role=counsel')
      .set('x-kontra-session', mockParticipantToken);

    expect(response.status).toBe(200);
    expect(response.body.items.map(item => item.section)).toEqual(['seller_financials']);
  });

  it('rehydrates owner credentials for My Deal Rooms re-entry without exposing them in room rows', async () => {
    app.setMyRoomsOtpForTest('owner@example.com', '123456');

    const response = await request(app)
      .post('/api/public/my-rooms/verify-otp')
      .send({ email: 'owner@example.com', code: '123456' });

    expect(response.status).toBe(200);
    expect(response.body.owner_tokens).toEqual({ 'room-1': mockOwnerToken });
    expect(response.body.rooms[0]).not.toHaveProperty('owner_write_token');
  });
});