'use strict';

const {
  buildVerifiedAssetSnapshot,
  hashSnapshot,
} = require('./lib/verifiedAssetSnapshot');

function state(overrides = {}) {
  const field = {
    id: 'field-1',
    key: 'asset.name',
    label: 'Asset name',
    category: 'asset_identity',
    value: 'Example Asset',
    status: 'confirmed',
    sourceDocId: 'document-1',
    sourceFileHash: 'abc123',
    verifiedBy: 'coordinator@example.com',
    verifiedAt: '2026-08-24T00:00:00.000Z',
  };
  return {
    schemaKey: 'generic',
    fields: [field],
    requiredFields: [field],
    requiredCount: 1,
    confirmedCount: 1,
    awaitingRequiredCount: 0,
    missingRequiredCount: 0,
    unresolvedConflictCount: 0,
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildVerifiedAssetSnapshot({
    propertyId: 'room-1',
    room: { settlement_mode: 'traditional', ...(overrides.room || {}) },
    recordState: state(overrides.recordState),
    conflicts: overrides.conflicts || [],
    approvals: overrides.approvals || [],
    confirmationHistory: overrides.confirmationHistory || [],
  });
}

describe('Verified Asset snapshot foundation', () => {
  test('is eligible only when canonical required data has intact provenance', () => {
    const snapshot = build();
    expect(snapshot.digital_asset_readiness.eligible).toBe(true);
    expect(snapshot.digital_asset_readiness.status).toBe('ready_for_external_review');
  });

  test('blocks incomplete canonical required fields', () => {
    const snapshot = build({
      recordState: state({
        requiredFields: [{ ...state().fields[0], status: 'awaiting' }],
        fields: [{ ...state().fields[0], status: 'awaiting' }],
        confirmedCount: 0,
        awaitingRequiredCount: 1,
      }),
    });
    expect(snapshot.digital_asset_readiness.eligible).toBe(false);
    expect(snapshot.digital_asset_readiness.exceptions.incomplete_required_fields).toHaveLength(1);
  });

  test('blocks unresolved conflicts and unsatisfied required approvals', () => {
    const snapshot = build({
      conflicts: [{
        id: 'conflict-1',
        field_key: 'asset.name',
        display_label: 'Asset name',
        status: 'unresolved',
        conflicting_value: 'Other Asset',
      }],
      recordState: state({
        requiredFields: [{
          ...state().fields[0],
          id: 'approval-1',
          key: 'approval.closing',
          label: 'Closing approval',
          category: 'approvals',
        }],
        fields: [{
          ...state().fields[0],
          id: 'approval-1',
          key: 'approval.closing',
          label: 'Closing approval',
          category: 'approvals',
        }],
      }),
    });
    expect(snapshot.digital_asset_readiness.eligible).toBe(false);
    expect(snapshot.digital_asset_readiness.exceptions.unresolved_conflicts).toHaveLength(1);
    expect(snapshot.digital_asset_readiness.approvals.missing).toHaveLength(1);
  });

  test('retains resolved exceptions for audit without blocking eligibility', () => {
    const snapshot = build({
      conflicts: [{
        id: 'resolved-1',
        field_key: 'asset.name',
        display_label: 'Asset name',
        status: 'resolved',
        canonical_value: 'Example Asset',
        conflicting_value: 'Former Asset',
        resolution_note: 'Coordinator confirmed the current source.',
      }],
    });
    expect(snapshot.digital_asset_readiness.eligible).toBe(true);
    expect(snapshot.created_from.exceptions).toEqual([
      expect.objectContaining({ id: 'resolved-1', status: 'resolved' }),
    ]);
    expect(snapshot.digital_asset_readiness.exceptions.unresolved_conflicts).toHaveLength(0);
  });

  test('blocks confirmed fields without source provenance', () => {
    const snapshot = build({
      recordState: state({
        fields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
        requiredFields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
      }),
    });
    expect(snapshot.digital_asset_readiness.eligible).toBe(false);
    expect(snapshot.digital_asset_readiness.provenance.gaps).toHaveLength(1);
  });

  test('uses the latest manual approval as current provenance evidence', () => {
    const snapshot = build({
      recordState: state({
        fields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
        requiredFields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
      }),
      approvals: [{
        field_id: 'field-1',
        action: 'approved',
        actor_email: 'coordinator@example.com',
        actor_role: 'coordinator',
        is_manual: true,
        created_at: '2026-08-26T00:00:00.000Z',
      }],
    });
    expect(snapshot.digital_asset_readiness.eligible).toBe(true);
    expect(snapshot.digital_asset_readiness.provenance.gaps).toHaveLength(0);
    expect(snapshot.created_from.transaction_record.fields[0].confirmation).toEqual(expect.objectContaining({
      verified_by: 'coordinator@example.com',
      verified_role: 'coordinator',
    }));
    expect(snapshot.created_from.transaction_record.fields[0].provenance.source_type).toBe('manual_confirmation');
  });

  test('uses current persisted confirmation history as provenance evidence', () => {
    const snapshot = build({
      recordState: state({
        fields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
        requiredFields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
      }),
      confirmationHistory: [{
        field_id: 'field-1',
        event_type: 'confirmed',
        actor_email: 'coordinator@example.com',
        actor_role: 'Deal Coordinator',
        new_value: 'Example Asset',
        new_status: 'verified',
        created_at: '2026-08-26T00:00:00.000Z',
      }],
    });

    expect(snapshot.digital_asset_readiness.eligible).toBe(true);
    expect(snapshot.digital_asset_readiness.provenance.gaps).toHaveLength(0);
    expect(snapshot.created_from.transaction_record.fields[0].provenance.source_type)
      .toBe('manual_confirmation_history');
  });

  test('preserves complete evidence lineage for a verified canonical fact', () => {
    const field = {
      ...state().fields[0],
      value: 'Final Asset Name',
      sourceDocId: 'document-1',
      sourcePage: 4,
      sourceExcerpt: 'Final Asset Name',
    };
    const snapshot = build({
      recordState: state({
        fields: [field],
        requiredFields: [field],
      }),
      approvals: [{
        id: 'approval-1',
        field_id: 'field-1',
        action: 'approved',
        actor_email: 'coordinator@example.com',
        actor_role: 'Deal Coordinator',
        is_manual: true,
        prior_value: 'Extracted Asset Name',
        new_value: 'Final Asset Name',
        source_doc_id: 'document-1',
        created_at: '2026-08-27T00:00:00.000Z',
      }],
      confirmationHistory: [
        {
          field_id: 'field-1',
          event_type: 'extracted',
          new_value: 'Extracted Asset Name',
          new_status: 'extracted',
          source_doc_id: 'document-1',
          source_page: 3,
          source_excerpt: 'Extracted Asset Name',
          created_at: '2026-08-26T00:00:00.000Z',
        },
        {
          field_id: 'field-1',
          event_type: 'confirmed',
          actor_email: 'coordinator@example.com',
          actor_role: 'Deal Coordinator',
          new_value: 'Final Asset Name',
          new_status: 'verified',
          created_at: '2026-08-27T00:00:00.000Z',
        },
      ],
      conflicts: [{
        id: 'resolved-1',
        field_key: 'asset.name',
        display_label: 'Asset name',
        status: 'resolved',
        canonical_value: 'Final Asset Name',
        conflicting_value: 'Prior Asset Name',
        conflicting_source_doc_id: 'document-2',
        resolution_note: 'Coordinator selected the current canonical value.',
        resolved_by: 'coordinator@example.com',
        resolved_at: '2026-08-27T00:00:00.000Z',
      }],
    });

    const lineage = snapshot.verified_asset.canonical_facts[0].evidence_lineage;
    expect(lineage.source_document).toEqual(expect.objectContaining({
      id: 'document-1',
      page: 4,
      excerpt: 'Final Asset Name',
    }));
    expect(lineage.extracted).toEqual(expect.objectContaining({
      value: 'Extracted Asset Name',
    }));
    expect(lineage.human_confirmation).toEqual(expect.objectContaining({
      actor: 'coordinator@example.com',
      actor_role: 'Deal Coordinator',
      confirmed: true,
    }));
    expect(lineage.approvals[0]).toEqual(expect.objectContaining({
      id: 'approval-1',
      action: 'approved',
      prior_value: 'Extracted Asset Name',
      new_value: 'Final Asset Name',
    }));
    expect(lineage.exception_history[0]).toEqual(expect.objectContaining({
      id: 'resolved-1',
      status: 'resolved',
      conflicting_source_doc_id: 'document-2',
    }));
    expect(lineage.final_canonical).toEqual(expect.objectContaining({
      value: 'Final Asset Name',
      state: 'confirmed',
    }));
  });

  test('projects the provider-neutral Digital Asset Readiness model', () => {
    const fields = [
      { id: 'asset', key: 'asset.name', label: 'Underlying asset', category: 'asset_identity', value: 'Harbor View', status: 'confirmed', sourceDocId: 'doc-asset' },
      { id: 'owner', key: 'parties.legal_owner', label: 'Legal owner', category: 'parties', value: 'Harbor View Owner LLC', status: 'confirmed', sourceDocId: 'doc-owner' },
      { id: 'jurisdiction', key: 'transaction.jurisdiction', label: 'Jurisdiction', category: 'transaction', value: 'United States', status: 'confirmed', sourceDocId: 'doc-jurisdiction' },
      { id: 'governing', key: 'legal.governing_documents', label: 'Governing documents', category: 'legal', value: 'Recorded deed', status: 'confirmed', sourceDocId: 'doc-legal' },
      { id: 'restriction', key: 'legal.transfer_restrictions', label: 'Transfer restrictions', category: 'legal', value: 'Review required', status: 'confirmed', sourceDocId: 'doc-restrictions' },
      { id: 'issuance', key: 'external.issuance_reference_id', label: 'Future external issuance reference ID', category: 'transaction', value: 'REF-001', status: 'confirmed', sourceDocId: 'doc-issuance' },
    ];
    const snapshot = build({
      recordState: state({
        fields,
        requiredFields: fields,
        requiredCount: fields.length,
        confirmedCount: fields.length,
      }),
    });
    expect(snapshot.digital_asset_readiness.asset.underlying_asset)
      .toEqual(expect.arrayContaining([expect.objectContaining({ field_key: 'asset.name', value: 'Harbor View' })]));
    expect(snapshot.digital_asset_readiness.asset.legal_owner_rights)
      .toEqual(expect.arrayContaining([expect.objectContaining({ field_key: 'parties.legal_owner' })]));
    expect(snapshot.digital_asset_readiness.asset.jurisdiction)
      .toEqual(expect.arrayContaining([expect.objectContaining({ field_key: 'transaction.jurisdiction' })]));
    expect(snapshot.digital_asset_readiness.asset.governing_documents)
      .toEqual(expect.arrayContaining([expect.objectContaining({ field_key: 'legal.governing_documents' })]));
    expect(snapshot.digital_asset_readiness.asset.restrictions)
      .toEqual(expect.arrayContaining([expect.objectContaining({ field_key: 'legal.transfer_restrictions' })]));
    expect(snapshot.digital_asset_readiness.future_external_issuance_reference_id)
      .toEqual(expect.objectContaining({ value: 'REF-001' }));
    expect(snapshot.digital_asset_readiness.settlement_mode).toBe('traditional');
    expect(build().digital_asset_readiness.future_external_issuance_reference_id).toBeNull();
    expect(snapshot.verified_asset).toEqual(expect.objectContaining({
      schema: 'kontra.verified-asset-state',
      verification_status: expect.objectContaining({
        status: 'verified_for_external_review',
      }),
    }));
  });

  test('clears persisted confirmation evidence after a later incompatible field change', () => {
    const snapshot = build({
      recordState: state({
        fields: [{
          ...state().fields[0],
          value: 'Updated Asset Name',
          sourceDocId: null,
          sourceFileHash: null,
        }],
        requiredFields: [{
          ...state().fields[0],
          value: 'Updated Asset Name',
          sourceDocId: null,
          sourceFileHash: null,
        }],
      }),
      confirmationHistory: [
        {
          field_id: 'field-1',
          event_type: 'confirmed',
          actor_email: 'coordinator@example.com',
          actor_role: 'Deal Coordinator',
          new_value: 'Example Asset',
          new_status: 'verified',
          created_at: '2026-08-26T00:00:00.000Z',
        },
        {
          field_id: 'field-1',
          event_type: 'manual_edit',
          actor_email: 'coordinator@example.com',
          actor_role: 'Deal Coordinator',
          new_value: 'Updated Asset Name',
          new_status: 'awaiting',
          created_at: '2026-08-27T00:00:00.000Z',
        },
      ],
    });

    expect(snapshot.digital_asset_readiness.eligible).toBe(false);
    expect(snapshot.digital_asset_readiness.provenance.gaps).toHaveLength(1);
  });

  test('clears persisted confirmation evidence after a source replacement', () => {
    const snapshot = build({
      recordState: state({
        fields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
        requiredFields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
      }),
      confirmationHistory: [
        {
          field_id: 'field-1',
          event_type: 'confirmed',
          actor_email: 'coordinator@example.com',
          actor_role: 'Deal Coordinator',
          new_value: 'Example Asset',
          new_status: 'verified',
          created_at: '2026-08-26T00:00:00.000Z',
        },
        {
          field_id: 'field-1',
          event_type: 'source_changed',
          new_value: 'Example Asset',
          new_status: 'source_changed',
          created_at: '2026-08-27T00:00:00.000Z',
        },
      ],
    });

    expect(snapshot.digital_asset_readiness.eligible).toBe(false);
    expect(snapshot.digital_asset_readiness.provenance.gaps).toHaveLength(1);
  });

  test('clears all current provenance gaps for confirmed fields with persisted history', () => {
    const fields = Array.from({ length: 21 }, (_, index) => ({
      id: `field-${index + 1}`,
      key: `transaction.fact_${index + 1}`,
      label: `Fact ${index + 1}`,
      category: 'transaction',
      value: `Value ${index + 1}`,
      status: 'confirmed',
      sourceDocId: null,
      sourceFileHash: null,
    }));
    const snapshot = build({
      recordState: state({
        fields,
        requiredFields: fields,
        requiredCount: 21,
        confirmedCount: 21,
      }),
      confirmationHistory: fields.map(field => ({
        field_id: field.id,
        event_type: 'confirmed',
        actor_email: 'coordinator@example.com',
        actor_role: 'Deal Coordinator',
        new_value: field.value,
        new_status: 'verified',
        created_at: '2026-08-26T00:00:00.000Z',
      })),
    });

    expect(snapshot.created_from.readiness).toEqual(expect.objectContaining({
      confirmed_count: 21,
      required_count: 21,
    }));
    expect(snapshot.digital_asset_readiness.provenance.gaps).toHaveLength(0);
    expect(snapshot.digital_asset_readiness.exceptions.blocking_count).toBe(0);
    expect(snapshot.digital_asset_readiness.status).toBe('ready_for_external_review');
    expect(snapshot.digital_asset_readiness.eligible).toBe(true);
  });

  test('does not reuse an older approval after the latest approval action changes', () => {
    const snapshot = build({
      recordState: state({
        fields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
        requiredFields: [{ ...state().fields[0], sourceDocId: null, sourceFileHash: null }],
      }),
      approvals: [
        {
          field_id: 'field-1',
          action: 'approved',
          actor_email: 'coordinator@example.com',
          actor_role: 'coordinator',
          is_manual: true,
          created_at: '2026-08-26T00:00:00.000Z',
        },
        {
          field_id: 'field-1',
          action: 'rejected',
          actor_email: 'coordinator@example.com',
          actor_role: 'coordinator',
          is_manual: true,
          created_at: '2026-08-27T00:00:00.000Z',
        },
      ],
    });
    expect(snapshot.digital_asset_readiness.eligible).toBe(false);
    expect(snapshot.digital_asset_readiness.provenance.gaps).toHaveLength(1);
  });

  test('does not reuse a manual approval after the canonical field is updated', () => {
    const snapshot = build({
      recordState: state({
        fields: [{
          ...state().fields[0],
          sourceDocId: null,
          sourceFileHash: null,
          updated_at: '2026-08-27T00:00:00.000Z',
        }],
        requiredFields: [{
          ...state().fields[0],
          sourceDocId: null,
          sourceFileHash: null,
          updated_at: '2026-08-27T00:00:00.000Z',
        }],
      }),
      approvals: [{
        field_id: 'field-1',
        action: 'approved',
        actor_email: 'coordinator@example.com',
        actor_role: 'Workspace Owner',
        is_manual: true,
        created_at: '2026-08-26T00:00:00.000Z',
      }],
    });
    expect(snapshot.digital_asset_readiness.provenance.gaps).toHaveLength(1);
  });

  test('matches persisted fields to required definitions by canonical key or id', () => {
    const required = {
      id: 'required-row-id',
      key: 'asset.name',
      label: 'Asset name',
      category: 'asset_identity',
      status: 'confirmed',
      value: 'Required value',
    };
    const persisted = {
      id: 'persisted-row-id',
      field_key: 'asset.name',
      label: 'Asset name',
      category: 'asset_identity',
      status: 'confirmed',
      value: 'Persisted value',
      sourceDocId: 'document-2',
      sourceFileHash: 'hash-2',
    };
    const snapshot = build({
      recordState: state({
        fields: [persisted],
        requiredFields: [required],
      }),
    });
    expect(snapshot.digital_asset_readiness.eligible).toBe(true);
    expect(snapshot.created_from.transaction_record.fields[0].value).toBe('Persisted value');
  });

  test('hash is stable for the same source payload', () => {
    const first = build();
    const second = build();
    expect(first.snapshot_hash).toBe(second.snapshot_hash);
    expect(hashSnapshot({
      property_id: first.property_id,
      digital_asset_readiness: first.digital_asset_readiness,
    })).toEqual(expect.any(String));
  });

  test('keeps an earlier snapshot unchanged when canonical fields later change', () => {
    const first = build();
    const archivedFirst = JSON.parse(JSON.stringify(first));
    const updatedField = {
      ...state().fields[0],
      value: 'Updated Asset Name',
      updatedAt: '2026-08-25T00:00:00.000Z',
    };
    const second = build({
      recordState: state({
        fields: [updatedField],
        requiredFields: [updatedField],
      }),
    });

    expect(first).toEqual(archivedFirst);
    expect(first.created_from.transaction_record.fields[0].value).toBe('Example Asset');
    expect(second.created_from.transaction_record.fields[0].value).toBe('Updated Asset Name');
    expect(second.snapshot_hash).not.toBe(first.snapshot_hash);
  });

  test('freezes Borrower funds at 90,000 after the live value changes to 80,000', () => {
    const borrowerFunds = {
      id: 'field-borrower-funds',
      key: 'financial.borrower_funds',
      label: 'Borrower funds',
      category: 'financial',
      value: 90000,
      status: 'confirmed',
      sourceDocId: 'invoice-1',
      sourceFileHash: 'funds-hash',
      verifiedBy: 'coordinator@example.com',
      verifiedAt: '2026-08-24T00:00:00.000Z',
    };
    const v8 = build({
      recordState: state({
        fields: [borrowerFunds],
        requiredFields: [borrowerFunds],
        requiredCount: 1,
        confirmedCount: 1,
      }),
    });
    const storedSnapshots = [{
      version: 8,
      snapshot: JSON.parse(JSON.stringify(v8)),
    }];
    const liveBorrowerFunds = {
      ...borrowerFunds,
      value: 80000,
      updatedAt: '2026-08-27T00:00:00.000Z',
    };
    const liveState = build({
      recordState: state({
        fields: [liveBorrowerFunds],
        requiredFields: [liveBorrowerFunds],
        requiredCount: 1,
        confirmedCount: 1,
      }),
    });

    const inspectedV8 = storedSnapshots.find(item => item.version === 8).snapshot;
    expect(inspectedV8.created_from.transaction_record.canonical_fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field_key: 'financial.borrower_funds', value: 90000 }),
      ]),
    );
    expect(liveState.created_from.transaction_record.canonical_fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field_key: 'financial.borrower_funds', value: 80000 }),
      ]),
    );
    expect(inspectedV8.created_from.transaction_record.canonical_fields[0].value).toBe(90000);
    expect(storedSnapshots).toHaveLength(1);
    expect(storedSnapshots.map(item => item.version)).toEqual([8]);
  });
});