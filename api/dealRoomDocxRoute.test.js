const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

const mockCompletionCreate = jest.fn();
const mockRows = [];
const mockOwnerSessionToken = 'docx-owner-session';
const mockOwnerSessionHash = crypto.createHash('sha256').update(mockOwnerSessionToken).digest('hex');
const EXPECTED_TYPES = {
  insurance_claim_documentation: 'Insurance Claim Documentation',
  insurance_coverage: 'Insurance Coverage',
  repair_estimate: 'Repair Estimate',
};

jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: { completions: { create: mockCompletionCreate } },
})));

jest.mock('./middlewares/aiRateLimit', () => (_req, _res, next) => next());
jest.mock('./lib/dealRoomHelpers', () => ({
  uploadToStorage: jest.fn().mockResolvedValue('hazard-room/insurance_claim_documentation/replacement.docx'),
  logEvent: jest.fn().mockResolvedValue(undefined),
  notifyOwner: jest.fn().mockResolvedValue(undefined),
  notifyLender: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./lib/operationsManager', () => ({
  clearBriefingCache: jest.fn(),
}));
jest.mock('./lib/verificationEngine', () => ({
  runVerification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./lib/transactionState', () => ({
  recalculateTransactionState: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./lib/taskEngine', () => ({
  evaluateDealRoomForTasks: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./db', () => {
  const execute = (table, state) => {
    const matches = row => Object.entries(state.filters).every(([key, value]) => {
      if (key === '__neq') return row[value[0]] !== value[1];
      if (key === '__in') return value[1].includes(row[value[0]]);
      return row[key] === value;
    });

    if (state.operation === 'insert') {
      const value = Array.isArray(state.values) ? state.values[0] : state.values;
      const row = { ...value, id: value.id || `doc-${mockRows.length + 1}` };
      mockRows.push(row);
      return { data: row, error: null };
    }
    if (state.operation === 'update') {
      mockRows.filter(matches).forEach(row => Object.assign(row, state.values));
      return { data: null, error: null };
    }
    if (table === 'deal_rooms') {
      return {
        data: {
          property_id: 'hazard-room',
          owner_write_token: 'hazard-owner-token',
          workflow_pack_id: 'ws_custom_hazard_loss',
          property_type: 'Hazard Loss',
          checklist_items: [],
        },
        error: null,
      };
    }
    if (table === 'custom_workflow_packs') {
      return {
        data: {
          config: {
            documents: Object.entries(EXPECTED_TYPES).map(([section, label]) => ({
              id: section,
              section,
              label,
              required: true,
              ai: true,
              aiExtraction: { docTypes: [label] },
            })),
          },
        },
        error: null,
      };
    }
    if (table === 'deal_analyses') {
      return { data: mockRows.filter(matches), error: null };
    }
    if (table === 'deal_room_access_sessions') {
      return state.filters.session_token_hash === mockOwnerSessionHash
        ? { data: { invite_id: 'owner-invite', expires_at: '2999-01-01T00:00:00.000Z', revoked_at: null }, error: null }
        : { data: null, error: null };
    }
    if (table === 'deal_room_invites') {
      return {
        data: {
          property_id: 'hazard-room',
          role_key: '__room_owner__',
          invited_email: 'owner@example.test',
          status: 'accepted',
          expires_at: '2999-01-01T00:00:00.000Z',
          revoked_at: null,
        },
        error: null,
      };
    }
    return { data: [], error: null };
  };

  const from = table => {
    const state = { filters: {}, operation: 'select', values: null };
    const chain = {
      select: () => chain,
      insert: values => {
        state.operation = 'insert';
        state.values = values;
        return chain;
      },
      update: values => {
        state.operation = 'update';
        state.values = values;
        return chain;
      },
      eq: (key, value) => {
        state.filters[key] = value;
        return chain;
      },
      gt: () => chain,
      is: () => chain,
      neq: (key, value) => {
        state.filters.__neq = [key, value];
        return chain;
      },
      in: (key, values) => {
        state.filters.__in = [key, values];
        return chain;
      },
      maybeSingle: async () => {
        const result = execute(table, state);
        return { data: Array.isArray(result.data) ? result.data[0] || null : result.data, error: result.error };
      },
      single: async () => {
        const result = execute(table, state);
        return { data: Array.isArray(result.data) ? result.data[0] || null : result.data, error: result.error };
      },
      then: (resolve, reject) => Promise.resolve(execute(table, state)).then(resolve, reject),
    };
    return chain;
  };

  return {
    supabase: {
      from,
      rpc: async (_name, args) => ({
        data: { status: 'committed', document_id: args?.p_document?.id || mockRows.at(-1)?.id || 'doc-1' },
        error: null,
      }),
    },
  };
});

const router = require('./routers/aiDealReview');
router.setTransactionFieldExtractor(async () => ({ status: 'committed' }));
const app = express();
app.use('/api/ai', router);
app.use('/api/public/deal-room/:propertyId/ai', router);

const DOCX_FIXTURE = Buffer.from(
  'UEsDBBQAAAAIAIUMI13TPDzjAAEAALEBAAARAAAAd29yZC9kb2N1bWVudC54bWyNkMFOwzAMhu97iihCO40mTDCNru1OcAWh8QBeErpITRzZYaVvTwpCSAgJLn8UJ/7+3272b2EQZ0fsMbbyqtJSuGjQ+ti38vlwf7mVgjNECwNG18rJsdx3i2asLZrX4GIWhRC5Hlt5yjnVSrE5uQBcYXKxvL0gBcjlSr0akWwiNI65GIRBrbXeqAA+yq4gj2in+Uyz0Cy5e3IJPIk7zr5gXKPm4qz0oenn/wNmGAR9dhnkXIuL283qeqsrrf/sfqSSmvIkLATonUg4eDOJwQc/g9arG61XWv+L9TBGR0tIyDsWkMrc55JsCSHtSrCYCUxGEmyK5S8w9bUP9b3rbvEOUEsBAh4DFAAAAAgAhQwjXdM8POMAAQAAsQEAABEAAAAAAAAAAQAAAKSBAAAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAABAAEAPwAAAC8BAAAAAA==',
  'base64',
);

describe('Deal Room generic AI DOCX upload route', () => {
  beforeEach(() => {
    mockRows.length = 0;
    mockCompletionCreate.mockReset();
    mockCompletionCreate.mockImplementation(async completionRequest => {
      const systemPrompt = completionRequest.messages.find(message => message.role === 'system')?.content || '';
      const typeList = systemPrompt.match(/"doc_type": string \(one of: ([^)]+)\)/)?.[1] || '';
      const docType = typeList.match(/"([^"]+)"/)?.[1] || 'Other';
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              doc_type: docType,
              summary: 'The repair estimate records a total repair cost of $96,480.00 and references a $2,500,000.00 property damage policy limit.',
              metrics: { total_repair_cost: 96480, policy_limit: 2500000 },
              risk_flags: [],
              recommendations: ['Confirm the estimate against the insurance claim file.'],
            }),
          },
        }],
      };
    });
  });

  test.each([
    ['insurance_claim_documentation', 'loss-documentation.docx'],
    ['insurance_coverage', 'insurance-coverage.docx'],
    ['repair_estimate', 'repair-estimate.docx'],
  ])('extracts %s DOCX content through the mounted Deal Room AI route and refreshes a stale same-file analysis', async (section, filename) => {
    const sourceHash = crypto.createHash('sha256').update(DOCX_FIXTURE).digest('hex');
    mockRows.push({
      id: `old-unreadable-${section}`,
      property_id: 'hazard-room',
      section,
      filename,
      source_hash: sourceHash,
      processing_status: 'extracted',
      is_active: true,
      analysis: {
        summary: 'The document appears to be corrupt or contains unreadable content.',
        pending: false,
      },
    });

    const response = await request(app)
      .post('/api/public/deal-room/hazard-room/ai/analyze-document')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
      .field('property_id', 'hazard-room')
      .field('section', section)
      .field('docTypes', '["Caller Chosen Type"]')
      .attach('file', DOCX_FIXTURE, {
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(response.status).toBe(200);
    expect(response.body.analysis.summary).toContain('$96,480.00');
    expect(response.body.analysis.summary).toContain('$2,500,000.00');
    expect(mockCompletionCreate).toHaveBeenCalledTimes(1);

    const completionRequest = mockCompletionCreate.mock.calls[0][0];
    const systemMessage = completionRequest.messages.find(message => message.role === 'system');
    const userMessage = completionRequest.messages.find(message => message.role === 'user');
    expect(systemMessage.content).toContain(EXPECTED_TYPES[section]);
    expect(systemMessage.content).not.toContain('Caller Chosen Type');
    expect(userMessage.content).toContain('Repair Estimate');
    expect(userMessage.content).toContain('Total repair cost: $96,480.00');
    expect(userMessage.content).not.toContain('PK');

    expect(mockRows).toHaveLength(1);
    expect(mockRows[0]).toEqual(expect.objectContaining({
      id: `old-unreadable-${section}`,
      processing_status: 'extracted',
      is_active: true,
      analysis: expect.objectContaining({
        summary: expect.stringContaining('$96,480.00'),
        document_classification: expect.objectContaining({
          source: 'ai',
          label: EXPECTED_TYPES[section],
          validation_status: 'validated',
        }),
      }),
    }));
  });

  test('rejects a document upload whose body room conflicts with the room-scoped URL', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/other-room/ai/analyze-document')
      .set('Cookie', `kontra_owner_session=${mockOwnerSessionToken}`)
      .field('property_id', 'hazard-room')
      .field('section', 'insurance_claim_documentation')
      .attach('file', DOCX_FIXTURE, {
        filename: 'loss-documentation.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/room does not match/i);
    expect(mockCompletionCreate).not.toHaveBeenCalled();
  });

  test('raw owner token fields cannot replace the owner session on the room-scoped route', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/hazard-room/ai/analyze-document')
      .set('x-owner-write-token', 'hazard-owner-token')
      .field('property_id', 'hazard-room')
      .field('owner_write_token', 'hazard-owner-token')
      .field('section', 'insurance_claim_documentation')
      .attach('file', DOCX_FIXTURE, {
        filename: 'loss-documentation.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(response.status).toBe(403);
    expect(mockCompletionCreate).not.toHaveBeenCalled();
  });

  test('keeps non-owner AI scoring available on the existing /api/ai path', async () => {
    const response = await request(app)
      .post('/api/ai/score-property')
      .send({ propertyType: 'Multifamily', occupancy: 95, noi: 120000 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});