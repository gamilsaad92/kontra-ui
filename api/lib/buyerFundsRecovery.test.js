'use strict';

const {
  deriveRecoverableBuyerFundsEvidence,
  buildRecoveredBuyerFundsFieldPatch,
} = require('./buyerFundsRecovery');

const activeDocument = {
  id: 'loi-document',
  property_id: 'existing-room',
  source_hash: 'sha256:loi',
  is_active: true,
};

function buyerFundsConflict(overrides = {}) {
  return {
    id: 'resolved-buyer-conflict',
    property_id: 'existing-room',
    field_key: 'parties.buyer',
    display_label: 'Estimated Buyer Funds Due',
    conflicting_value: '$1,450,000',
    conflicting_source_doc_id: activeDocument.id,
    conflicting_source_page: 1,
    conflicting_source_excerpt: 'Estimated buyer funds due at closing: $1,450,000.',
    status: 'resolved',
    ...overrides,
  };
}

describe('Buyer Funds Due evidence recovery', () => {
  test('recovers a resolved, misclassified amount for an existing room without changing the original conflict', () => {
    const conflict = buyerFundsConflict();
    const candidate = deriveRecoverableBuyerFundsEvidence({
      conflict,
      activeDocuments: [activeDocument],
      fields: [],
    });

    expect(candidate).toEqual(expect.objectContaining({
      conflict_id: conflict.id,
      original_field_key: 'parties.buyer',
      field_key: 'financial.buyer_funds_due',
      value_text: '$1,450,000',
      source_doc_id: activeDocument.id,
      source_file_hash: activeDocument.source_hash,
      source_page: 1,
      source_excerpt: conflict.conflicting_source_excerpt,
    }));
    expect(conflict).toMatchObject({
      field_key: 'parties.buyer',
      conflicting_value: '$1,450,000',
      status: 'resolved',
    });

    const patch = buildRecoveredBuyerFundsFieldPatch(candidate, activeDocument, null, '2026-11-23T12:00:00.000Z');
    expect(patch).toEqual(expect.objectContaining({
      field_key: 'financial.buyer_funds_due',
      field_category: 'financial',
      value_text: '$1,450,000',
      status: 'needs_review',
      is_required: false,
      source_doc_id: activeDocument.id,
      source_doc_version: activeDocument.id,
      source_file_hash: activeDocument.source_hash,
      source_page: 1,
      source_excerpt: conflict.conflicting_source_excerpt,
      verified_by: null,
      verified_role: null,
      verified_at: null,
      updated_at: '2026-11-23T12:00:00.000Z',
    }));
    expect(patch).not.toHaveProperty('created_at');
  });

  test('creates an optional canonical row for a new generated room whose schema has no Buyer Funds Due definition', () => {
    const candidate = deriveRecoverableBuyerFundsEvidence({
      conflict: buyerFundsConflict({ property_id: 'new-generated-room' }),
      activeDocuments: [{ ...activeDocument, property_id: 'new-generated-room' }],
      fields: [],
    });

    expect(candidate?.field_key).toBe('financial.buyer_funds_due');
    const patch = buildRecoveredBuyerFundsFieldPatch(
      candidate,
      { ...activeDocument, property_id: 'new-generated-room' },
      null,
    );
    expect(patch.is_required).toBe(false);
    expect(patch.status).toBe('needs_review');
    expect(patch.verified_at).toBeNull();
  });

  test('updates only a blank missing schema row and preserves its pre-existing requiredness', () => {
    const existingField = {
      id: 'buyer-funds-schema-row',
      field_key: 'financial.buyer_funds_due',
      value_text: null,
      value_json: null,
      status: 'missing',
      is_required: true,
    };
    const candidate = deriveRecoverableBuyerFundsEvidence({
      conflict: buyerFundsConflict(),
      activeDocuments: [activeDocument],
      fields: [existingField],
    });

    expect(candidate.existing_field_id).toBe(existingField.id);
    expect(buildRecoveredBuyerFundsFieldPatch(candidate, activeDocument, existingField).is_required).toBe(true);
  });

  test('prevents duplicate populated fields and rejects invalid, unresolved, or stale evidence', () => {
    expect(deriveRecoverableBuyerFundsEvidence({
      conflict: buyerFundsConflict(),
      activeDocuments: [activeDocument],
      fields: [{
        field_key: 'financial.buyer_funds_due',
        value_text: '$1,450,000',
        status: 'needs_review',
        is_required: false,
      }],
    })).toBeNull();
    expect(deriveRecoverableBuyerFundsEvidence({
      conflict: buyerFundsConflict({ status: 'unresolved' }),
      activeDocuments: [activeDocument],
    })).toBeNull();
    expect(deriveRecoverableBuyerFundsEvidence({
      conflict: buyerFundsConflict({ conflicting_value: 'Redwood Capital Partners LLC' }),
      activeDocuments: [activeDocument],
    })).toBeNull();
    expect(deriveRecoverableBuyerFundsEvidence({
      conflict: buyerFundsConflict({ display_label: 'Buyer Entity' }),
      activeDocuments: [activeDocument],
    })).toBeNull();
    expect(deriveRecoverableBuyerFundsEvidence({
      conflict: buyerFundsConflict(),
      activeDocuments: [],
    })).toBeNull();
  });
});
