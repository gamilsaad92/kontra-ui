'use strict';

jest.mock('../db', () => ({
  supabase: { rpc: jest.fn() },
}));

const { supabase } = require('../db');
const {
  activateDocumentVersion,
  afterCanonicalCommit,
  canonicalExtractionOutcome,
  commitCanonicalChangeSet,
  expectedFieldSnapshot,
} = require('./canonicalPersistence');

describe('canonical persistence RPC boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rebuilds a change set from the latest field after a concurrent snapshot conflict', async () => {
    let currentField = {
      id: 'field-1',
      field_key: 'transaction.purchase_price',
      updated_at: '2026-10-04T10:00:00.000Z',
      status: 'extracted',
      value_text: '$10,000',
      source_doc_id: 'document-a',
      source_doc_version: 'document-a',
      source_file_hash: 'hash-a',
      verified_by: null,
      verified_role: null,
      verified_at: null,
      conflict_candidates: [],
    };
    let rpcCalls = 0;
    let buildCalls = 0;

    supabase.rpc.mockImplementation(async (functionName, args) => {
      expect(functionName).toBe('kontra_commit_canonical_change_set');
      rpcCalls += 1;
      if (rpcCalls === 1) {
        // Simulate another coordinator committing between the read and write.
        currentField = {
          ...currentField,
          value_text: '$12,000',
          status: 'needs_review',
          updated_at: '2026-10-04T10:00:01.000Z',
        };
        return { data: { status: 'retry_snapshot', field_id: currentField.id }, error: null };
      }

      expect(args.p_change_set.expected_fields).toEqual([expectedFieldSnapshot(currentField)]);
      expect(args.p_change_set.field_changes[0].patch.value_text).toBe('$12,000');
      return { data: { status: 'committed', field_ids: [currentField.id] }, error: null };
    });

    const result = await commitCanonicalChangeSet(async () => {
      buildCalls += 1;
      return {
        p_change_set: {
          property_id: 'room-1',
          expected_fields: [expectedFieldSnapshot(currentField)],
          field_changes: [{
            op: 'update',
            id: currentField.id,
            patch: { value_text: currentField.value_text },
          }],
        },
      };
    });

    expect(result.status).toBe('committed');
    expect(rpcCalls).toBe(2);
    expect(buildCalls).toBe(2);
  });

  test('activates document versions through the separate activation RPC', async () => {
    const request = {
      propertyId: 'room-1',
      section: 'purchase_agreement',
      document: { filename: 'agreement.pdf', source_hash: 'hash-a' },
      existingDocumentId: null,
    };
    supabase.rpc.mockResolvedValue({
      data: { status: 'committed', document_id: 'document-a' },
      error: null,
    });

    const result = await activateDocumentVersion(request);

    expect(result.status).toBe('committed');
    expect(supabase.rpc).toHaveBeenCalledWith('kontra_activate_document_version', {
      p_property_id: 'room-1',
      p_section: 'purchase_agreement',
      p_document: request.document,
      p_existing_document_id: null,
    });
  });

  test('runs verification and readiness callbacks only after a committed canonical extraction', async () => {
    const downstream = jest.fn();

    expect(canonicalExtractionOutcome({ status: 'stale_source' })).toBe('stale_source');
    expect(canonicalExtractionOutcome({ status: 'error', error: new Error('lock timeout') })).toBe('failed');
    expect(canonicalExtractionOutcome({ skipped: 'superseded' })).toBe('stale_source');

    expect(await afterCanonicalCommit({ status: 'stale_source' }, downstream)).toBe('stale_source');
    expect(await afterCanonicalCommit({ status: 'error' }, downstream)).toBe('failed');
    expect(downstream).not.toHaveBeenCalled();

    const order = [];
    expect(await afterCanonicalCommit({ status: 'committed' }, async () => {
      order.push('persisted');
      order.push('verification');
      order.push('readiness');
    })).toBe('committed');
    expect(order).toEqual(['persisted', 'verification', 'readiness']);
  });

  test('field snapshots include mutable provenance and metadata used by concurrent writers', () => {
    const snapshot = expectedFieldSnapshot({
      id: 'field-2',
      field_key: 'transaction.purchase_price',
      field_category: 'transaction',
      display_label: 'Purchase price',
      notes: 'owner note',
      confidence: 0.9,
      source_page: 3,
      source_excerpt: 'page excerpt',
      extracted_by: 'ai',
      definition_key: 'purchase_price',
      is_required: true,
      source_type: 'document',
      extraction_timestamp: '2026-10-04T10:00:00.000Z',
    });

    expect(snapshot).toEqual(expect.objectContaining({
      field_category: 'transaction',
      display_label: 'Purchase price',
      notes: 'owner note',
      confidence: 0.9,
      source_page: 3,
      source_excerpt: 'page excerpt',
      extracted_by: 'ai',
      definition_key: 'purchase_price',
      is_required: true,
      source_type: 'document',
      extraction_timestamp: '2026-10-04T10:00:00.000Z',
    }));
  });
});