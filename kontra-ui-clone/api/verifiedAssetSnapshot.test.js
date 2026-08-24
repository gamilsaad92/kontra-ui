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

  test('hash is stable for the same source payload', () => {
    const first = build();
    const second = build();
    expect(first.snapshot_hash).toBe(second.snapshot_hash);
    expect(hashSnapshot({
      property_id: first.property_id,
      digital_asset_readiness: first.digital_asset_readiness,
    })).toEqual(expect.any(String));
  });
});