'use strict';

jest.mock('./db', () => ({ supabase: {} }));
jest.mock('./lib/eventBus', () => ({ emit: jest.fn() }));

const {
  currentSourceDocuments,
  conflictValueMatches,
  hasDocumentProvenance,
  isConfirmationFromCurrentSource,
  invalidationForSupersededField,
  isCurrentVerification,
  isFieldSourceCurrent,
  projectCurrentSourceField,
  resolveCurrentSourceDocument,
} = require('./lib/currentSourceIntegrity');
const { computeTransactionRecordState } = require('./lib/transactionState');
const { buildVerificationResult } = require('./lib/verificationEngine');
const { buildVerifiedAssetSnapshot } = require('./lib/verifiedAssetSnapshot');
const { buildVerifiedAssetHandoff } = require('./lib/verifiedAssetHandoff');

describe('current Transaction Record source integrity', () => {
  const sourceA = {
    id: 'doc-a',
    property_id: 'room-1',
    section: 'purchase_agreement',
    source_hash: 'hash-a',
    is_active: false,
    superseded_at: '2026-10-01T00:00:00.000Z',
  };
  const sourceB = {
    id: 'doc-b',
    property_id: 'room-1',
    section: 'purchase_agreement',
    source_hash: 'hash-b',
    is_active: true,
  };

  test('keeps only explicitly active documents as current sources', () => {
    expect(currentSourceDocuments([sourceA, sourceB]).map(document => document.id)).toEqual(['doc-b']);
    expect(isFieldSourceCurrent({ source_doc_id: 'doc-a' }, [sourceA, sourceB])).toBe(false);
    expect(isFieldSourceCurrent({ source_doc_id: 'doc-b' }, [sourceA, sourceB])).toBe(true);
    expect(isFieldSourceCurrent({ source_file_hash: 'hash-b' }, [sourceA, sourceB])).toBe(true);
    expect(isFieldSourceCurrent({
      source_doc_id: 'doc-b',
      source_file_hash: 'hash-a',
    }, [sourceA, sourceB])).toBe(false);
  });

  test.each([
    ['same comparable value', '42', '42'],
    ['different comparable value', '42', '43'],
    ['non-comparable value', 'Forty two', '$42'],
  ])('A verified → B %s never transfers A verification', (_label, oldValue, replacementValue) => {
    const original = {
      value_text: oldValue,
      status: 'verified',
      source_doc_id: 'doc-a',
      verified_by: 'owner@example.com',
      verified_at: '2026-09-30T00:00:00.000Z',
    };
    const invalidation = invalidationForSupersededField(
      original,
      [sourceA],
      { ...sourceB, replacement_value: replacementValue },
      '2026-10-02T00:00:00.000Z',
    );
    const field = projectCurrentSourceField({
      ...original,
      ...invalidation.update,
    }, [sourceA, sourceB]);
    expect(field.status).toBe('needs_review');
    expect(field.value_text).toBe(oldValue);
    expect(field.verified_by).toBeNull();
    expect(field.verified_at).toBeNull();
    expect(isCurrentVerification(field, [sourceA, sourceB])).toBe(false);
  });

  test('preserves omitted A values as reviewable history, not current verification', () => {
    const invalidation = invalidationForSupersededField({
      id: 'field-1',
      value_text: 'A value',
      status: 'verified',
      source_doc_id: 'doc-a',
      source_doc_version: 'doc-a',
      source_file_hash: 'hash-a',
      source_page: 3,
      source_excerpt: 'Original clause',
      verified_by: 'owner@example.com',
      verified_role: 'Workspace Owner',
      verified_at: '2026-09-30T00:00:00.000Z',
    }, [sourceA], sourceB, '2026-10-02T00:00:00.000Z');

    expect(invalidation.update).toEqual(expect.objectContaining({
      status: 'needs_review',
      verified_by: null,
      verified_at: null,
    }));
    expect(invalidation.history).toEqual(expect.objectContaining({
      event_type: 'source_changed',
      prior_value: 'A value',
      new_value: 'A value',
      source_doc_id: 'doc-a',
      metadata: expect.objectContaining({
        prior_source_file_hash: 'hash-a',
        prior_verified_by: 'owner@example.com',
        prior_verified_at: '2026-09-30T00:00:00.000Z',
        replacement_document_id: 'doc-b',
        replacement_source_hash: 'hash-b',
      }),
    }));
  });

  test('keeps an active replacement conflict unresolved and unverified', () => {
    const field = projectCurrentSourceField({
      value_text: 'A value',
      status: 'conflicting',
      source_doc_id: 'doc-a',
      verified_by: 'owner@example.com',
      conflict_candidates: [{ value: 'B value', source_doc_id: 'doc-b' }],
    }, [sourceA, sourceB]);
    expect(field.status).toBe('conflicting');
    expect(field.value_text).toBe('A value');
    expect(field.current_source_is_active).toBe(false);
    expect(field.verified_by).toBeNull();
  });

  test('does not invalidate manual owner-entered values and normalizes their source metadata', () => {
    const manual = {
      status: 'verified',
      source_type: 'manual',
      verified_by: 'owner@example.com',
      value_text: 'Owner-entered fact',
    };
    expect(hasDocumentProvenance(manual)).toBe(false);
    expect(isFieldSourceCurrent(manual, [sourceA, sourceB])).toBe(true);
    expect(projectCurrentSourceField(manual, [sourceA, sourceB]).status).toBe('verified');
  });

  test('treats an inactive source as unavailable for confirmation or conflict selection', () => {
    expect(isFieldSourceCurrent({ source_doc_id: 'doc-a' }, [sourceA, sourceB])).toBe(false);
    expect(isFieldSourceCurrent({ source_doc_id: 'doc-b' }, [sourceA, sourceB])).toBe(true);
  });

  test.each([
    ['$42', '42', true],
    ['Forty two', 'Forty two', true],
    ['Forty two', '$42', false],
    [null, '$42', false],
  ])('matches a conflict candidate only by semantic equivalence or exact value (%p vs %p)', (
    selected,
    candidate,
    expected,
  ) => {
    expect(conflictValueMatches(
      selected,
      candidate,
      'transaction.purchase_price',
      'Purchase Price',
    )).toBe(expected);
  });

  test('owner verification cannot resolve an inactive source A', async () => {
    const source = await resolveCurrentSourceDocument(
      mockSourceDocuments([sourceA, sourceB]),
      'room-1',
      { source_doc_id: 'doc-a', source_file_hash: 'hash-a' },
    );
    expect(source.current).toBe(false);
  });

  test('conflict resolution rejects inactive A and accepts active B', async () => {
    const db = mockSourceDocuments([sourceA, sourceB]);
    const selectedA = await resolveCurrentSourceDocument(db, 'room-1', {
      source_doc_id: 'doc-a',
    });
    const selectedB = await resolveCurrentSourceDocument(db, 'room-1', {
      source_doc_id: 'doc-b',
    });
    expect(selectedA.current).toBe(false);
    expect(selectedB.current).toBe(true);
  });

  test('repeated hydration cannot replay confirmation history from inactive source A', () => {
    const staleA = {
      status: 'needs_review',
      source_doc_id: 'doc-a',
      source_file_hash: 'hash-a',
      value_text: '42',
    };
    const oldConfirmation = {
      event_type: 'confirmed',
      source_doc_id: 'doc-a',
      metadata: { source_file_hash: 'hash-a' },
    };
    expect(isConfirmationFromCurrentSource(staleA, oldConfirmation, [sourceA, sourceB])).toBe(false);
    expect(isConfirmationFromCurrentSource(staleA, oldConfirmation, [sourceA, sourceB])).toBe(false);
  });

  test('keeps document-independent confirmation available for a fresh owner confirmation', () => {
    const freshB = projectCurrentSourceField({
      value_text: 'B value',
      status: 'needs_review',
      source_doc_id: 'doc-b',
      source_doc_version: 'doc-b',
      source_file_hash: 'hash-b',
    }, [sourceA, sourceB]);
    expect(isCurrentVerification({ ...freshB, status: 'verified' }, [sourceA, sourceB])).toBe(true);
  });

  test('fails closed for document-backed values when active-source evidence is unavailable', () => {
    const stale = projectCurrentSourceField({
      status: 'verified',
      source_file_hash: 'hash-a',
      verified_by: 'owner@example.com',
    });
    expect(stale.status).toBe('needs_review');
    expect(stale.current_source_is_active).toBe(false);
  });

  test('excludes stale A from readiness, cross-document verification, and snapshot eligibility', () => {
    const staleField = {
      id: 'field-1',
      field_key: 'transaction.purchase_price',
      field_category: 'transaction',
      display_label: 'Purchase Price',
      value_text: '$42',
      status: 'verified',
      source_doc_id: 'doc-a',
      source_doc_version: 'doc-a',
      source_file_hash: 'hash-a',
      verified_by: 'owner@example.com',
      current_source_is_active: false,
    };
    const required = [{ key: 'transaction.purchase_price', label: 'Purchase Price' }];
    const recordState = computeTransactionRecordState([staleField], 'generic', required, []);
    expect(recordState.confirmedCount).toBe(0);
    expect(recordState.awaitingRequiredCount).toBe(1);

    const verification = buildVerificationResult(
      'room-1',
      null,
      [sourceB],
      '2026-10-03T00:00:00.000Z',
      [staleField],
      [],
    );
    expect(verification.normalized_facts.some(fact => fact.source_doc_id === 'doc-a')).toBe(false);

    const snapshot = buildVerifiedAssetSnapshot({ propertyId: 'room-1', recordState });
    expect(snapshot.digital_asset_readiness.eligible).toBe(false);
    const handoff = buildVerifiedAssetHandoff({
      propertyId: 'room-1',
      recordState,
      sourceStateAt: '2026-10-03T00:00:00.000Z',
    });
    expect(handoff.verified_data).toEqual([]);
  });

  test('a fresh confirmation against active source B restores verified readiness', () => {
    const freshB = projectCurrentSourceField({
      id: 'field-1',
      field_key: 'transaction.purchase_price',
      field_category: 'transaction',
      display_label: 'Purchase Price',
      value_text: '$42',
      status: 'verified',
      source_doc_id: 'doc-b',
      source_doc_version: 'doc-b',
      source_file_hash: 'hash-b',
      verified_by: 'owner@example.com',
      verified_at: '2026-10-03T00:00:00.000Z',
    }, [sourceA, sourceB]);
    expect(isCurrentVerification(freshB, [sourceA, sourceB])).toBe(true);
    expect(isConfirmationFromCurrentSource(freshB, {
      event_type: 'confirmed',
      source_doc_id: 'doc-b',
      metadata: { source_file_hash: 'hash-b' },
    }, [sourceA, sourceB])).toBe(true);
    const recordState = computeTransactionRecordState(
      [freshB],
      'generic',
      [{ key: 'transaction.purchase_price', label: 'Purchase Price' }],
      [],
    );
    expect(recordState.confirmedCount).toBe(1);
  });

  test('an already-created snapshot remains unchanged after A is superseded', () => {
    const originalField = {
      id: 'field-1',
      field_key: 'transaction.purchase_price',
      field_category: 'transaction',
      display_label: 'Purchase Price',
      value_text: '$42',
      status: 'verified',
      source_doc_id: 'doc-a',
      current_source_is_active: true,
      verified_by: 'owner@example.com',
      verified_at: '2026-09-30T00:00:00.000Z',
    };
    const required = [{ key: 'transaction.purchase_price', label: 'Purchase Price' }];
    const oldState = computeTransactionRecordState([originalField], 'generic', required, []);
    const oldSnapshot = buildVerifiedAssetSnapshot({ propertyId: 'room-1', recordState: oldState });
    const frozenContent = JSON.stringify(oldSnapshot);

    const currentState = computeTransactionRecordState([{
      ...originalField,
      current_source_is_active: false,
    }], 'generic', required, []);
    buildVerifiedAssetSnapshot({ propertyId: 'room-1', recordState: currentState });

    expect(JSON.stringify(oldSnapshot)).toBe(frozenContent);
    expect(oldSnapshot.created_from.transaction_record.canonical_fields[0].value).toBe('$42');
  });
});

function mockSourceDocuments(documents) {
  return {
    from(table) {
      if (table !== 'deal_analyses') throw new Error(`Unexpected table ${table}`);
      const filters = {};
      const query = {
        select() { return query; },
        eq(key, value) {
          filters[key] = value;
          return query;
        },
        order() { return query; },
        then(resolve, reject) {
          return Promise.resolve({
            data: documents.filter(document =>
              (!filters.property_id || document.property_id === filters.property_id)
            ),
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}