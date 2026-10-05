'use strict';

jest.mock('../db', () => ({
  supabase: { rpc: jest.fn() },
}));

const { supabase: rpcClient } = require('../db');
const { invalidateSupersededFields } = require('./currentSourceIntegrity');

describe('superseded source invalidation persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('commits the field invalidation and audit history in one canonical change set', async () => {
    const field = {
      id: 'field-1',
      property_id: 'room-1',
      field_key: 'transaction.purchase_price',
      updated_at: '2026-10-04T10:00:00.000Z',
      value_text: '$10,000',
      status: 'verified',
      source_type: 'document',
      source_doc_id: 'document-a',
      source_doc_version: 'document-a',
      source_file_hash: 'hash-a',
      source_page: 4,
      source_excerpt: 'Purchase price: $10,000',
      verified_by: 'owner@example.com',
      verified_role: 'Workspace Owner',
      verified_at: '2026-10-03T10:00:00.000Z',
      conflict_candidates: [],
    };
    const query = {
      select() { return this; },
      eq() { return this; },
      then(resolve, reject) {
        return Promise.resolve({ data: [field], error: null }).then(resolve, reject);
      },
    };
    const sourceDb = {
      from: jest.fn(() => query),
    };
    rpcClient.rpc.mockResolvedValue({ data: { status: 'committed' }, error: null });

    const changed = await invalidateSupersededFields({
      supabase: sourceDb,
      propertyId: 'room-1',
      priorDocuments: [{ id: 'document-a', source_hash: 'hash-a' }],
      replacementDocument: {
        id: 'document-b',
        source_hash: 'hash-b',
        created_at: '2026-10-04T10:01:00.000Z',
      },
      correlationId: 'correlation-1',
      now: '2026-10-04T10:01:00.000Z',
    });

    expect(changed).toEqual(['field-1']);
    expect(sourceDb.from).toHaveBeenCalledTimes(1);
    expect(sourceDb.from).toHaveBeenCalledWith('transaction_record_fields');
    expect(rpcClient.rpc).toHaveBeenCalledTimes(1);
    expect(rpcClient.rpc).toHaveBeenCalledWith(
      'kontra_commit_canonical_change_set',
      expect.objectContaining({
        p_change_set: expect.objectContaining({
          property_id: 'room-1',
          expected_fields: [expect.objectContaining({ id: 'field-1' })],
          field_changes: [expect.objectContaining({
            op: 'update',
            id: 'field-1',
            patch: expect.objectContaining({
              status: 'needs_review',
              verified_by: null,
            }),
          })],
          history_rows: [expect.objectContaining({
            field_id: 'field-1',
            event_type: 'source_changed',
            metadata: expect.objectContaining({ correlation_id: 'correlation-1' }),
          })],
        }),
      }),
    );
  });
});