const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

const mockCompletionCreate = jest.fn();
const mockRows = [];

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
          workflow_pack_id: 'custom_hazard_loss',
          property_type: 'Hazard Loss',
          checklist_items: [],
        },
        error: null,
      };
    }
    if (table === 'deal_analyses') {
      return { data: mockRows.filter(matches), error: null };
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

  return { supabase: { from } };
});

const router = require('./routers/aiDealReview');
const app = express();
app.use('/api/ai', router);

const DOCX_FIXTURE = Buffer.from(
  'UEsDBBQAAAAIAIUMI13TPDzjAAEAALEBAAARAAAAd29yZC9kb2N1bWVudC54bWyNkMFOwzAMhu97iihCO40mTDCNru1OcAWh8QBeErpITRzZYaVvTwpCSAgJLn8UJ/7+3272b2EQZ0fsMbbyqtJSuGjQ+ti38vlwf7mVgjNECwNG18rJsdx3i2asLZrX4GIWhRC5Hlt5yjnVSrE5uQBcYXKxvL0gBcjlSr0akWwiNI65GIRBrbXeqAA+yq4gj2in+Uyz0Cy5e3IJPIk7zr5gXKPm4qz0oenn/wNmGAR9dhnkXIuL283qeqsrrf/sfqSSmvIkLATonUg4eDOJwQc/g9arG61XWv+L9TBGR0tIyDsWkMrc55JsCSHtSrCYCUxGEmyK5S8w9bUP9b3rbvEOUEsBAh4DFAAAAAgAhQwjXdM8POMAAQAAsQEAABEAAAAAAAAAAQAAAKSBAAAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAABAAEAPwAAAC8BAAAAAA==',
  'base64',
);

describe('Deal Room generic AI DOCX upload route', () => {
  beforeEach(() => {
    mockRows.length = 0;
    mockCompletionCreate.mockReset();
    mockCompletionCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            doc_type: 'Repair Estimate',
            summary: 'The repair estimate records a total repair cost of $96,480.00 and references a $2,500,000.00 property damage policy limit.',
            metrics: { total_repair_cost: 96480, policy_limit: 2500000 },
            risk_flags: [],
            recommendations: ['Confirm the estimate against the insurance claim file.'],
          }),
        },
      }],
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
      .post('/api/ai/analyze-document')
      .set('x-owner-write-token', 'hazard-owner-token')
      .field('property_id', 'hazard-room')
      .field('section', section)
      .attach('file', DOCX_FIXTURE, {
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(response.status).toBe(200);
    expect(response.body.analysis.summary).toContain('$96,480.00');
    expect(response.body.analysis.summary).toContain('$2,500,000.00');
    expect(mockCompletionCreate).toHaveBeenCalledTimes(1);

    const completionRequest = mockCompletionCreate.mock.calls[0][0];
    const userMessage = completionRequest.messages.find(message => message.role === 'user');
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
      }),
    }));
  });
});