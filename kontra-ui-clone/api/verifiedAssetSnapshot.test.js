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
    room: { settlement_mode: 'traditional' },
    recordState: state(overrides.recordState),
    conflicts: overrides.conflicts || [],
    approvals: overrides.approvals || [],
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
});