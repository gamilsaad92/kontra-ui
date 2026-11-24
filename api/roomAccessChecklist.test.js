const mockOwnerToken = 'owner-token';
const mockOwnerSessionToken = 'owner-session-token';
const mockParticipantToken = 'participant-session';
const mockInsertedRows = [];
const mockChecklistDefaults = [
  { section: 'seller_financials', assignedTo: ['seller'] },
  { section: 'legal_review', assignedTo: ['counsel'] },
];
const mockChecklistItems = mockChecklistDefaults.map(item => ({ ...item }));
const mockDocumentAnalyses = [];
const mockRecoveryConflicts = [];
let mockTransactionRecordFields = null;
let mockExtractionSchemaKey = null;
const mockChecklistSelections = [];
const mockCanonicalRpc = jest.fn(async () => ({ data: { status: 'committed' }, error: null }));
const mockOpenAIChatCreate = jest.fn();
let mockFieldSourceDocId = null;
let mockParticipantSessionAvailable = true;
let mockOwnerSessionAvailable = true;
let mockOwnerSessionExpired = false;
let mockBrainAuthorizationTestsEnabled = false;
const mockBrainReadTransactionState = jest.fn();
const mockBrainGetBriefing = jest.fn();
const mockBrainAskQuestion = jest.fn();
const mockBrainBuildGroundedContext = jest.fn();

jest.mock('./db', () => {
  const owner = {
    id: 'room-1',
    property_id: 'room-1',
    property_name: 'Owner Room',
    owner_write_token: mockOwnerToken,
    customer_email: 'owner@example.com',
    checklist_items: mockChecklistItems,
    workflow_pack_id: 'business_acquisition',
    property_type: 'Business',
    status: 'active',
    deal_stage: 'uploading',
  };
  const invite = {
    id: 'invite-1',
    property_id: 'room-1',
    role_key: 'seller',
    invited_email: 'seller@example.com',
    status: 'accepted',
    expires_at: '2999-01-01T00:00:00.000Z',
    revoked_at: null,
  };
  const ownerInvite = {
    id: 'owner-invite-1',
    property_id: 'room-1',
    role_key: '__room_owner__',
    invited_email: 'owner@example.com',
    status: 'accepted',
    expires_at: '2999-01-01T00:00:00.000Z',
    revoked_at: null,
  };
  const session = {
    invite_id: 'invite-1',
    expires_at: '2999-01-01T00:00:00.000Z',
    revoked_at: null,
  };
  const sessionHash = require('crypto').createHash('sha256').update(mockParticipantToken).digest('hex');
  const ownerSessionHash = require('crypto').createHash('sha256').update(mockOwnerSessionToken).digest('hex');
  const transactionField = () => ({
    id: 'field-1',
    field_key: 'financial.borrower_funds',
    value_text: '90000',
    value_json: null,
    status: 'verified',
    updated_at: '2026-08-26T12:00:00.000Z',
    source_doc_id: mockFieldSourceDocId,
    source_file_hash: null,
  });

  function builder(table) {
    const state = { filters: {} };
    const chain = {
      select: (columns) => {
        state.selectedColumns = columns;
        if (table === 'deal_analyses') mockChecklistSelections.push(columns);
        return chain;
      },
      insert: (values) => {
        mockInsertedRows.push({ table, values });
        return chain;
      },
      update: () => chain,
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
      limit: () => chain,
      gt: () => chain,
      is: () => chain,
      maybeSingle: async () => {
        if (table === 'deal_rooms') {
          if (state.filters.property_id === 'room-1') {
            return {
              data: mockExtractionSchemaKey
                ? { ...owner, workflow_pack_id: mockExtractionSchemaKey }
                : owner,
              error: null,
            };
          }
          if (state.filters.property_id === 'room-2') {
            return {
              data: {
                ...owner,
                id: 'room-2',
                property_id: 'room-2',
                property_name: 'Other Room',
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }
        if (table === 'transaction_record_fields') {
          const rows = mockTransactionRecordFields === null
            ? [transactionField()]
            : mockTransactionRecordFields;
          return {
            data: rows.find(row => Object.entries(state.filters)
              .every(([key, value]) => row[key] === undefined || row[key] === value)) || null,
            error: null,
          };
        }
        if (table === 'transaction_record_conflicts') {
          return {
            data: mockRecoveryConflicts.find(row => Object.entries(state.filters)
              .every(([key, value]) => row[key] === value)) || null,
            error: null,
          };
        }
        if (table === 'deal_analyses') {
          return {
            data: mockDocumentAnalyses.find(row => Object.entries(state.filters)
              .every(([key, value]) => row[key] === undefined || row[key] === value)) || null,
            error: null,
          };
        }
        if (table === 'deal_room_access_sessions') {
          if (state.filters.session_token_hash === sessionHash && mockParticipantSessionAvailable) {
            return { data: session, error: null };
          }
          if (state.filters.session_token_hash === ownerSessionHash && mockOwnerSessionAvailable) {
            return {
              data: {
                ...session,
                invite_id: 'owner-invite-1',
                expires_at: mockOwnerSessionExpired ? '2000-01-01T00:00:00.000Z' : session.expires_at,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }
        if (table === 'deal_room_invites') {
          return {
            data: state.filters.id === 'owner-invite-1' ? ownerInvite : invite,
            error: null,
          };
        }
        return { data: null, error: null };
      },
      single: async () => ({ data: owner, error: null }),
      then: (resolve) => {
        let data = [];
        if (table === 'deal_rooms' && state.filters.customer_email) {
          data = [(({ owner_write_token, ...room }) => room)(owner)];
        } else if (table === 'transaction_record_fields') {
          const rows = mockTransactionRecordFields === null
            ? [transactionField()]
            : mockTransactionRecordFields;
          data = rows.filter(row => Object.entries(state.filters)
            .every(([key, value]) => row[key] === undefined || row[key] === value));
        } else if (table === 'transaction_record_conflicts') {
          data = mockRecoveryConflicts.filter(row => Object.entries(state.filters)
            .every(([key, value]) => row[key] === value));
        } else if (table === 'deal_analyses') {
          const filteredAnalyses = mockDocumentAnalyses.filter(analysis => Object.entries(state.filters)
            .every(([key, value]) => analysis[key] === undefined || analysis[key] === value));
          const selectedColumns = state.selectedColumns === '*'
            ? null
            : String(state.selectedColumns || '').split(',').map(column => column.trim()).filter(Boolean);
          data = filteredAnalyses.map(analysis => selectedColumns
            ? Object.fromEntries(selectedColumns
              .filter(column => Object.prototype.hasOwnProperty.call(analysis, column))
              .map(column => [column, analysis[column]]))
            : { ...analysis });
        }
        return resolve({ data, error: null });
      },
    };
    return chain;
  }

  return {
    supabase: {
      from: builder,
      rpc: (...args) => mockCanonicalRpc(...args),
    },
  };
});

jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: (...args) => mockOpenAIChatCreate(...args),
    },
  },
})));

jest.mock('./lib/transactionState', () => {
  const actual = jest.requireActual('./lib/transactionState');
  return {
    ...actual,
    readTransactionState: (...args) => mockBrainAuthorizationTestsEnabled
      ? mockBrainReadTransactionState(...args)
      : actual.readTransactionState(...args),
    recalculateTransactionState: jest.fn().mockResolvedValue({
      state: { recordState: { fields: [] } },
    }),
  };
});

jest.mock('./lib/operationsManager', () => {
  const actual = jest.requireActual('./lib/operationsManager');
  return {
    ...actual,
    getBriefing: (...args) => mockBrainAuthorizationTestsEnabled
      ? mockBrainGetBriefing(...args)
      : actual.getBriefing(...args),
    askQuestion: (...args) => mockBrainAuthorizationTestsEnabled
      ? mockBrainAskQuestion(...args)
      : actual.askQuestion(...args),
    buildGroundedContext: (...args) => mockBrainAuthorizationTestsEnabled
      ? mockBrainBuildGroundedContext(...args)
      : actual.buildGroundedContext(...args),
  };
});

process.env.SESSION_SECRET = 'test-session-secret';
process.env.RESEND_API_KEY = '';
const { createParticipantAccessToken } = require('./lib/participantAccessTokens');
const app = require('./index');
const request = require('supertest');

describe('room access and checklist scoping', () => {
  beforeEach(() => {
    mockInsertedRows.length = 0;
    mockChecklistItems.splice(
      0,
      mockChecklistItems.length,
      ...mockChecklistDefaults.map(item => ({ ...item })),
    );
    mockDocumentAnalyses.length = 0;
    mockRecoveryConflicts.length = 0;
    mockTransactionRecordFields = null;
    mockExtractionSchemaKey = null;
    mockChecklistSelections.length = 0;
    mockCanonicalRpc.mockReset().mockResolvedValue({ data: { status: 'committed' }, error: null });
    mockOpenAIChatCreate.mockReset();
    mockFieldSourceDocId = null;
    mockParticipantSessionAvailable = true;
    mockOwnerSessionAvailable = true;
    mockOwnerSessionExpired = false;
    mockBrainAuthorizationTestsEnabled = false;
    mockBrainReadTransactionState.mockReset();
    mockBrainGetBriefing.mockReset();
    mockBrainAskQuestion.mockReset();
    mockBrainBuildGroundedContext.mockReset();
  });

  it('keeps a valid participant session role-scoped even when a raw owner token is presented', async () => {
    const access = await app.getRoomAccessContext({
      headers: {
        'x-owner-write-token': mockOwnerToken,
        'x-kontra-session': mockParticipantToken,
      },
    }, 'room-1');

    expect(access.mode).toBe('participant');
    expect(access.role).toBe('seller');
    expect(access.permissions.viewAllDocuments).toBe(false);
  });

  it('exchanges a signed notification CTA for the invite role session', async () => {
    const accessToken = createParticipantAccessToken({
      propertyId: 'room-1',
      inviteId: 'invite-1',
      role: 'seller',
    });

    const response = await request(app)
      .post('/api/public/deal-room/room-1/participant-access/verify')
      .send({ accessToken });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      success: true,
      role_key: 'seller',
    }));
    expect(mockInsertedRows).toContainEqual(expect.objectContaining({
      table: 'deal_room_access_sessions',
      values: expect.objectContaining({ invite_id: 'invite-1' }),
    }));
  });

  it('returns not found for the unused global invite-email route', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/send-invite-email')
      .send({ inviteToken: 'unused-invite-token-that-is-long-enough' });

    expect(response.status).toBe(404);
  });

  it('disables the legacy tokenless invite route after verifying owner access', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-1/invite')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
      .set('Origin', 'http://localhost:3000')
      .send({ role: 'seller', email: 'seller@example.com' });

    expect(response.status).toBe(410);
    expect(response.body.error).toBe('legacy_invite_disabled');
  });

  it('rejects a configured owner role when creating a V1 participant invitation', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-1/create-invite')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
      .set('Origin', 'http://localhost:3000')
      .send({
        roleKey: 'buyer',
        invitedEmail: 'seller@example.com',
        inviteToken: 'a'.repeat(48),
        verificationMethod: 'link',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('reserved_role');
    expect(mockInsertedRows.some(row => row.table === 'deal_room_invites')).toBe(false);
  });

  it('does not accept a raw owner token for V1 invitation creation', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-1/create-invite')
      .set('x-owner-write-token', mockOwnerToken)
      .send({
        roleKey: 'seller',
        invitedEmail: 'seller@example.com',
        inviteToken: 'c'.repeat(48),
        verificationMethod: 'link',
      });

    expect(response.status).toBe(403);
    expect(mockInsertedRows.some(row => row.table === 'deal_room_invites')).toBe(false);
  });

  it('creates a V1 participant invite with accurate email status and no token in the response', async () => {
    const rawToken = 'b'.repeat(48);
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const response = await request(app)
      .post('/api/public/deal-room/room-1/create-invite')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
      .set('Origin', 'http://localhost:3000')
      .send({
        roleKey: 'seller',
        invitedEmail: 'Seller@Example.com',
        inviteToken: rawToken,
        verificationMethod: 'link',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      emailSent: false,
      deliveryReason: 'email_not_configured',
    });
    expect(JSON.stringify(response.body)).not.toContain(rawToken);
    const inserted = mockInsertedRows.find(row => row.table === 'deal_room_invites');
    expect(inserted.values.invite_token_hash).not.toBe(rawToken);
    expect(inserted.values.invited_email).toBe('seller@example.com');
    expect(infoSpy).toHaveBeenCalledWith('[create-invite] email delivery skipped', {
      reason: 'email_not_configured',
    });
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('seller@example.com');
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(rawToken);
    const inviteEvent = mockInsertedRows.find(row =>
      row.table === 'deal_events' && row.values.event_type === 'invite_created',
    );
    expect(inviteEvent.values.description).toBe('seller invitation created');
    expect(inviteEvent.values.metadata).toEqual({
      roleKey: 'seller',
      emailSent: false,
      deliveryReason: 'email_not_configured',
    });
    expect(JSON.stringify(inviteEvent.values)).not.toContain('seller@example.com');
    infoSpy.mockRestore();
  });

  it('resolves an owner-only direct room URL from the room-scoped owner session cookie', async () => {
    const response = await request(app)
      .get('/api/public/deal-room/room-1?role=seller')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('deal_coordinator');
    expect(response.body.access).toEqual({ mode: 'owner' });
  });

  it('keeps participant access across repeated room loads when both credentials are present', async () => {
    for (let i = 0; i < 2; i += 1) {
      const response = await request(app)
        .get('/api/public/deal-room/room-1?role=seller')
        .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
        .set('x-kontra-session', mockParticipantToken);

      expect(response.status).toBe(200);
      expect(response.body.access.role).toBe('seller');
      expect(response.body.access).toEqual(expect.objectContaining({
        mode: 'participant',
        role: 'seller',
      }));
    }
  });

  it('fails closed when an explicit participant session is expired or revoked', async () => {
    mockParticipantSessionAvailable = false;
    const response = await request(app)
      .get('/api/public/deal-room/room-1')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
      .set('x-kontra-session', mockParticipantToken);

    expect(response.status).toBe(403);
  });

  it('does not accept an owner session from a different room', async () => {
    const access = await app.getRoomAccessContext({
      headers: { cookie: `kontra_owner_session=${mockOwnerSessionToken}` },
    }, 'room-2');

    expect(access.mode).toBe('anonymous');
  });

  it.each([
    ['missing', () => { mockOwnerSessionAvailable = false; }],
    ['expired', () => { mockOwnerSessionExpired = true; }],
  ])('rejects a %s owner session', async (_label, configure) => {
    configure();
    const response = await request(app)
      .post('/api/public/deal-room/room-1/transaction-record/fields/field-1/verify')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
      .set('Origin', 'https://staging.kontraplatform.com')
      .send({ approveProvenance: true });
    expect(response.status).toBe(403);
  });

  it('does not allow a raw owner token in a request header or body to authorize a mutation', async () => {
    const headerResponse = await request(app)
      .post('/api/public/deal-room/room-1/transaction-record/fields/field-1/verify')
      .set('x-owner-write-token', mockOwnerToken)
      .send({ approveProvenance: true });
    const bodyResponse = await request(app)
      .post('/api/public/deal-room/room-1/transaction-record/fields/field-1/verify')
      .send({ ownerWriteToken: mockOwnerToken, approveProvenance: true });

    expect(headerResponse.status).toBe(403);
    expect(bodyResponse.status).toBe(403);
  });

  it('blocks anonymous access to transaction metadata', async () => {
    const response = await request(app)
      .get('/api/public/deal-room/room-1/asset-metadata');

    expect(response.status).toBe(403);
  });

  it.each([
    '/api/public/deal-room/room-1/transaction-record',
    '/api/public/deal-room/room-1/transaction-record/fields/field-1/history',
    '/api/public/deal-room/room-1/asset-passport',
    '/api/public/deal-room/room-1/asset-metadata',
    '/api/public/deal-room/room-1/readiness',
    '/api/public/deal-room/room-1/verified-asset/snapshots',
    '/api/public/deal-room/room-1/verified-asset/snapshots/1',
    '/api/public/deal-room/room-1/verified-asset/readiness',
    '/api/public/deal-room/room-1/verified-asset/readiness/export',
    '/api/public/deal-room/room-1/digital-asset-packages',
    '/api/public/deal-room/room-1/digital-asset-packages/by-snapshot/snapshot-1',
    '/api/public/deal-room/room-1/digital-asset-packages/package-1',
    '/api/public/deal-room/room-1/digital-asset-packages/package-1/revisions',
    '/api/public/deal-room/room-1/digital-asset-packages/package-1/artifacts',
    '/api/public/deal-room/room-1/digital-asset-packages/package-1/artifacts/artifact-1',
    '/api/public/deal-room/room-1/verification',
  ])('blocks participant access to owner-only sensitive read %s', async path => {
    const response = await request(app)
      .get(path)
      .set('x-kontra-session', mockParticipantToken);

    expect(response.status).toBe(403);
  });

  it('blocks anonymous access to the verification run endpoint', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-1/verification/run')
      .send({});

    expect(response.status).toBe(403);
  });

  it.each([
    '/api/public/deal-room/room-1/verified-asset/snapshots',
    '/api/public/deal-room/room-1/verification',
  ])('blocks anonymous access to %s', async path => {
    const response = await request(app).get(path);

    expect(response.status).toBe(403);
  });

  it('blocks anonymous access to the owner-only provenance approval endpoint', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-1/transaction-record/fields/field-1/verify')
      .send({ approveProvenance: true });

    expect(response.status).toBe(403);
  });

  it('records owner provenance approval without changing the confirmed value or status', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-1/transaction-record/fields/field-1/verify')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
      .set('Origin', 'https://staging.kontraplatform.com')
      .send({ approveProvenance: true });

    expect(response.status).toBe(200);
    expect(response.body.provenanceApproved).toBe(true);
    const rpcCall = mockCanonicalRpc.mock.calls.find(([name]) => name === 'kontra_commit_canonical_change_set');
    expect(rpcCall).toBeDefined();
    const changeSet = rpcCall[1].p_change_set;
    expect(changeSet.approval_rows).toEqual([expect.objectContaining({
      field_id: 'field-1',
      action: 'approved',
      is_manual: true,
      prior_value: '90000',
      new_value: '90000',
    })]);
    expect(changeSet.history_rows).toEqual([expect.objectContaining({
      event_type: 'provenance_approved',
      prior_value: '90000',
      new_value: '90000',
      prior_status: 'verified',
      new_status: 'verified',
    })]);
  });

  it('rejects manual provenance approval when document provenance already exists', async () => {
    mockFieldSourceDocId = 'source-document-1';
    const response = await request(app)
      .post('/api/public/deal-room/room-1/transaction-record/fields/field-1/verify')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
      .set('Origin', 'https://staging.kontraplatform.com')
      .send({ approveProvenance: true });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('FIELD_NOT_MISSING_PROVENANCE');
    expect(mockInsertedRows).toHaveLength(0);
  });

  it('blocks anonymous access to the notification log', async () => {
    const response = await request(app)
      .get('/api/public/deal-room/room-1/notifications');

    expect(response.status).toBe(403);
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
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`);

    expect(participantResponse.status).toBe(200);
    expect(participantResponse.body.items.map(item => item.section)).toEqual(['seller_financials']);
    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.items.map(item => item.section)).toEqual([
      'seller_financials',
      'legal_review',
    ]);
  });

  it('rehydrates receipt-only checklist completion after refresh using stored-path evidence', async () => {
    mockChecklistItems.splice(0, mockChecklistItems.length, {
      id: 'letter_of_intent',
      section: 'letter_of_intent',
      label: 'Letter of Intent',
      required: true,
      ai: false,
      assignedTo: [],
    });
    mockDocumentAnalyses.push({
      id: 'loi-upload',
      section: 'letter_of_intent',
      filename: 'Letter of Intent.pdf',
      analysis: { pending: false, summary: 'Document received.' },
      created_at: '2026-11-21T12:00:00.000Z',
      processing_status: 'extracted',
      storage_path: 'deal-rooms/room-1/letter-of-intent.pdf',
      is_active: true,
    });

    const fetchChecklist = () => request(app)
      .get('/api/public/deal-room/room-1/checklist')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`);
    const [firstRefresh, secondRefresh] = await Promise.all([
      fetchChecklist(),
      fetchChecklist(),
    ]);

    expect(firstRefresh.status).toBe(200);
    expect(secondRefresh.status).toBe(200);
    expect(mockChecklistSelections).toHaveLength(2);
    expect(mockChecklistSelections.every(columns => columns.includes('storage_path'))).toBe(true);
    for (const response of [firstRefresh, secondRefresh]) {
      expect(response.body.items).toEqual([expect.objectContaining({
        section: 'letter_of_intent',
        documentState: 'received',
        documentReceived: true,
        documentEvidenceType: 'upload_receipt',
        documentValidationStatus: 'not_required',
        documentAiClassificationValidated: false,
      })]);
    }
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

  it('rejects a valid participant session from room one when uploading to another room', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-2/track-document')
      .set('x-kontra-session', mockParticipantToken)
      .field('section', 'seller_financials')
      .field('role', 'seller')
      .attach('file', Buffer.from('synthetic isolated test document'), 'cross-room.pdf');

    expect([401, 403]).toContain(response.status);
    expect(mockInsertedRows.some(row => row.table === 'deal_analyses')).toBe(false);
    expect(mockInsertedRows.some(row => row.table === 'deal_room_tasks')).toBe(false);
  });

  it('ignores URL and body role overrides for a verified participant session', async () => {
    const response = await request(app)
      .get('/api/public/deal-room/room-1/checklist?role=counsel')
      .set('x-kontra-session', mockParticipantToken);

    expect(response.status).toBe(200);
    expect(response.body.items.map(item => item.section)).toEqual(['seller_financials']);
  });

  it('returns one-use owner exchange capabilities without exposing owner-write tokens', async () => {
    app.setMyRoomsOtpForTest('owner@example.com', '123456');

    const response = await request(app)
      .post('/api/public/my-rooms/verify-otp')
      .send({ email: 'owner@example.com', code: '123456' });

    expect(response.status).toBe(200);
    expect(response.body.owner_exchange_tokens).toEqual({
      'room-1': expect.any(String),
    });
    expect(response.body.owner_exchange_tokens['room-1']).not.toBe(mockOwnerToken);
    expect(response.body).not.toHaveProperty('owner_tokens');
    expect(response.body.rooms[0]).not.toHaveProperty('owner_write_token');
  });

  it('does not expose owner room lists or dashboard data based on an email address alone', async () => {
    const roomsResponse = await request(app)
      .get('/api/public/my-rooms?email=owner%40example.com');
    const analyticsResponse = await request(app)
      .get('/api/public/my-rooms/analytics?email=owner%40example.com');

    expect(roomsResponse.status).toBe(401);
    expect(analyticsResponse.status).toBe(403);
  });

  it('does not allow email-only room deletion or billing access', async () => {
    const deleteResponse = await request(app)
      .delete('/api/public/my-rooms/room-1')
      .send({ email: 'owner@example.com' });
    const billingResponse = await request(app)
      .post('/api/public/billing-portal')
      .send({ email: 'owner@example.com' });

    expect(deleteResponse.status).toBe(403);
    expect(billingResponse.status).toBe(403);
  });

  describe('dynamic brain route authorization', () => {
    const routes = [
      {
        name: '/brain/facts',
        method: 'get',
        path: '/api/public/deal-room/room-1/brain/facts',
        downstream: mockBrainReadTransactionState,
      },
      {
        name: '/brain/ask',
        method: 'post',
        path: '/api/public/deal-room/room-1/brain/ask',
        body: { question: 'What is the current status?' },
        downstream: mockBrainAskQuestion,
      },
      {
        name: '/brain/briefing',
        method: 'get',
        path: '/api/public/deal-room/room-1/brain/briefing',
        downstream: mockBrainGetBriefing,
      },
    ];

    const sendRouteRequest = route => {
      const pending = request(app)[route.method](route.path);
      pending.set('Origin', 'https://staging.kontraplatform.com');
      return route.body ? pending.send(route.body) : pending;
    };

    const expectNoBrainWork = () => {
      expect(mockBrainReadTransactionState).not.toHaveBeenCalled();
      expect(mockBrainGetBriefing).not.toHaveBeenCalled();
      expect(mockBrainAskQuestion).not.toHaveBeenCalled();
      expect(mockBrainBuildGroundedContext).not.toHaveBeenCalled();
      expect(mockInsertedRows).toHaveLength(0);
    };

    beforeEach(() => {
      mockBrainAuthorizationTestsEnabled = true;
      mockBrainReadTransactionState.mockResolvedValue({
        room: { property_name: 'Test room' },
        recordState: { fields: [] },
        packId: 'business_acquisition',
      });
      mockBrainGetBriefing.mockResolvedValue({ status: 'ready' });
      mockBrainAskQuestion.mockResolvedValue({ answer: 'Owner-only answer' });
      mockBrainBuildGroundedContext.mockResolvedValue({});
    });

    afterEach(() => {
      mockBrainAuthorizationTestsEnabled = false;
    });

    it.each(routes)('allows the owner to use $name', async route => {
      const response = await sendRouteRequest(route)
        .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`);

      expect(response.status).toBe(200);
      expect(route.downstream).toHaveBeenCalledTimes(1);
    });

    it.each(routes)('denies a verified participant before downstream work on $name', async route => {
      const response = await sendRouteRequest(route)
        .set('x-kontra-session', mockParticipantToken)
        .set('x-owner-write-token', mockOwnerToken);

      expect(response.status).toBe(403);
      expectNoBrainWork();
    });

    it.each(routes)('continues to deny anonymous access to $name', async route => {
      const response = await sendRouteRequest(route);

      expect(response.status).toBe(403);
      expectNoBrainWork();
    });

    it.each([
      'kontra-demo',
      'kontra-demo-biz',
      'kontra-demo-fundraising',
    ])('leaves public demo AI routes unaffected for %s', async propertyId => {
      const briefing = await request(app)
        .get(`/api/public/deal-room/${propertyId}/brain/briefing`);
      const askWithoutQuestion = await request(app)
        .post(`/api/public/deal-room/${propertyId}/brain/ask`)
        .send({});

      expect(briefing.status).toBe(200);
      expect(askWithoutQuestion.status).toBe(400);
      expect(askWithoutQuestion.body.error).toBe('question required');
      expectNoBrainWork();
    });

    it('keeps participant document checklist and assigned-section comments available', async () => {
      const checklist = await request(app)
        .get('/api/public/deal-room/room-1/checklist')
        .set('x-kontra-session', mockParticipantToken);
      const comments = await request(app)
        .get('/api/public/deal-room/room-1/comments')
        .set('x-kontra-session', mockParticipantToken);
      const addedComment = await request(app)
        .post('/api/public/deal-room/room-1/comments')
        .set('x-kontra-session', mockParticipantToken)
        .send({
          section: 'seller_financials',
          role: 'owner',
          content: 'Participant comment',
        });

      expect(checklist.status).toBe(200);
      expect(checklist.body.items.map(item => item.section)).toEqual(['seller_financials']);
      expect(comments.status).toBe(200);
      expect(comments.body.role).toBe('seller');
      expect(addedComment.status).toBe(200);
      expect(mockInsertedRows.find(row => row.table === 'deal_comments').values.role)
        .toBe('seller');
    });

    it('keeps recovered Buyer Funds Due evidence owner-only and room-scoped', async () => {
      mockRecoveryConflicts.push({
        id: 'resolved-buyer-funds',
        property_id: 'room-1',
        field_key: 'parties.buyer',
        display_label: 'Estimated Buyer Funds Due',
        conflicting_value: '$1,450,000',
        conflicting_source_doc_id: 'loi-1',
        conflicting_source_page: 1,
        conflicting_source_excerpt: 'Estimated Buyer Funds Due: $1,450,000.',
        status: 'resolved',
      });
      mockDocumentAnalyses.push({
        id: 'loi-1',
        property_id: 'room-1',
        section: 'letter_of_intent',
        filename: 'Letter of Intent.pdf',
        created_at: '2026-11-01T00:00:00.000Z',
        source_hash: 'sha256:loi',
        is_active: true,
        superseded_at: null,
      });
      mockTransactionRecordFields = [];

      const anonymous = await request(app)
        .get('/api/public/deal-room/room-1/transaction-record/recoverable-evidence');
      const rawOwnerToken = await request(app)
        .get('/api/public/deal-room/room-1/transaction-record/recoverable-evidence')
        .set('x-owner-write-token', mockOwnerToken);
      const participant = await request(app)
        .get('/api/public/deal-room/room-1/transaction-record/recoverable-evidence')
        .set('x-kontra-session', mockParticipantToken);
      const otherRoom = await request(app)
        .get('/api/public/deal-room/room-2/transaction-record/recoverable-evidence')
        .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`);
      const candidates = await request(app)
        .get('/api/public/deal-room/room-1/transaction-record/recoverable-evidence')
        .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`);

      expect(anonymous.status).toBe(403);
      expect(rawOwnerToken.status).toBe(403);
      expect(participant.status).toBe(403);
      expect(otherRoom.status).toBe(403);
      expect(candidates.status).toBe(200);
      expect(candidates.body.candidates).toEqual([
        expect.objectContaining({
          conflict_id: 'resolved-buyer-funds',
          field_key: 'financial.buyer_funds_due',
          value_text: '$1,450,000',
          source_doc_id: 'loi-1',
          source_page: 1,
          source_excerpt: 'Estimated Buyer Funds Due: $1,450,000.',
        }),
      ]);
      expect(candidates.body.candidates[0]).not.toHaveProperty('source_file_hash');
    });

    it('recovers an existing-room amount without confirming it or rewriting conflict history', async () => {
      const conflict = {
        id: 'resolved-buyer-funds',
        property_id: 'room-1',
        field_key: 'parties.buyer',
        display_label: 'Estimated Buyer Funds Due',
        conflicting_value: '$1,450,000',
        conflicting_source_doc_id: 'loi-1',
        conflicting_source_page: 1,
        conflicting_source_excerpt: 'Estimated Buyer Funds Due: $1,450,000.',
        status: 'resolved',
        resolution_note: 'Original discrepancy resolved.',
      };
      mockRecoveryConflicts.push(conflict);
      mockDocumentAnalyses.push({
        id: 'loi-1',
        property_id: 'room-1',
        section: 'letter_of_intent',
        created_at: '2026-11-01T00:00:00.000Z',
        source_hash: 'sha256:loi',
        is_active: true,
        superseded_at: null,
      });
      mockTransactionRecordFields = [];

      const response = await request(app)
        .post('/api/public/deal-room/room-1/transaction-record/recoverable-evidence/resolved-buyer-funds')
        .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        ok: true,
        field_key: 'financial.buyer_funds_due',
        status: 'needs_review',
        is_required: false,
        source_doc_id: 'loi-1',
      }));
      const changeSet = mockCanonicalRpc.mock.calls[0][1].p_change_set;
      expect(changeSet.field_changes).toEqual([
        expect.objectContaining({
          op: 'insert',
          field_key: 'financial.buyer_funds_due',
          patch: expect.objectContaining({
            value_text: '$1,450,000',
            status: 'needs_review',
            is_required: false,
            source_doc_id: 'loi-1',
            source_doc_version: 'loi-1',
            source_file_hash: 'sha256:loi',
            source_page: 1,
            source_excerpt: 'Estimated Buyer Funds Due: $1,450,000.',
            verified_by: null,
            verified_at: null,
          }),
        }),
      ]);
      expect(changeSet.history_rows[0]).toEqual(expect.objectContaining({
        event_type: 'extracted',
        new_status: 'needs_review',
        source_doc_id: 'loi-1',
        source_page: 1,
        source_excerpt: 'Estimated Buyer Funds Due: $1,450,000.',
        metadata: expect.objectContaining({
          recovery: true,
          conflict_id: 'resolved-buyer-funds',
          original_field_key: 'parties.buyer',
          source_doc_version: 'loi-1',
          source_file_hash: 'sha256:loi',
        }),
      }));
      expect(changeSet.conflict_changes).toEqual([]);
      expect(changeSet.expected_conflicts).toEqual([
        expect.objectContaining({ id: 'resolved-buyer-funds', status: 'resolved' }),
      ]);
      expect(conflict).toMatchObject({
        field_key: 'parties.buyer',
        conflicting_value: '$1,450,000',
        status: 'resolved',
        resolution_note: 'Original discrepancy resolved.',
      });
      expect(require('./lib/transactionState').recalculateTransactionState)
        .toHaveBeenCalledWith('room-1', expect.objectContaining({ evaluateTasks: false }));
    });

    it('does not insert a duplicate Buyer Funds Due field when the same canonical value exists', async () => {
      mockRecoveryConflicts.push({
        id: 'resolved-buyer-funds',
        property_id: 'room-1',
        field_key: 'parties.buyer',
        display_label: 'Estimated Buyer Funds Due',
        conflicting_value: '$1,450,000',
        conflicting_source_doc_id: 'loi-1',
        status: 'resolved',
      });
      mockDocumentAnalyses.push({
        id: 'loi-1',
        property_id: 'room-1',
        section: 'letter_of_intent',
        created_at: '2026-11-01T00:00:00.000Z',
        source_hash: 'sha256:loi',
        is_active: true,
        superseded_at: null,
      });
      mockTransactionRecordFields = [{
        id: 'buyer-funds-row',
        property_id: 'room-1',
        field_key: 'financial.buyer_funds_due',
        value_text: '$1,450,000',
        status: 'needs_review',
        is_required: false,
      }];

      const response = await request(app)
        .post('/api/public/deal-room/room-1/transaction-record/recoverable-evidence/resolved-buyer-funds')
        .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.already_exists).toBe(true);
      expect(mockCanonicalRpc).not.toHaveBeenCalled();
    });

    it('extracts Buyer Funds Due into an optional canonical field for a new generated room without a schema definition', async () => {
      mockExtractionSchemaKey = 'generated_ai';
      mockDocumentAnalyses.push({
        id: 'new-room-loi',
        property_id: 'room-1',
        section: 'letter_of_intent',
        created_at: '2026-11-01T00:00:00.000Z',
        source_hash: 'sha256:new-room-loi',
        is_active: true,
        superseded_at: null,
      });
      mockTransactionRecordFields = [];
      mockOpenAIChatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              fields: [{
                field_key: 'parties.buyer',
                field_category: 'parties',
                display_label: 'Estimated Buyer Funds Due',
                value_text: '$1,450,000',
                confidence: 0.98,
                source_page: 1,
                source_excerpt: 'Estimated Buyer Funds Due: $1,450,000.',
              }],
            }),
          },
        }],
      });

      const result = await app.extractTransactionFieldsForTest(
        'room-1',
        'new-room-loi',
        'x'.repeat(100),
        'Letter of Intent',
      );

      expect(result).toEqual(expect.objectContaining({
        status: 'committed',
        canonicalKeys: ['financial.buyer_funds_due'],
        schemaKey: 'generated_ai',
      }));
      const changeSet = mockCanonicalRpc.mock.calls[0][1].p_change_set;
      expect(changeSet.field_changes).toEqual([
        expect.objectContaining({
          op: 'insert',
          field_key: 'financial.buyer_funds_due',
          patch: expect.objectContaining({
            value_text: '$1,450,000',
            status: 'extracted',
            is_required: false,
            source_doc_id: 'new-room-loi',
            source_doc_version: 'new-room-loi',
            source_file_hash: 'sha256:new-room-loi',
            source_page: 1,
            source_excerpt: 'Estimated Buyer Funds Due: $1,450,000.',
            verified_by: null,
            verified_at: null,
          }),
        }),
      ]);
    });
  });
});