const {
  buildVerifiedAssetHandoff,
  fieldState,
} = require('./lib/verifiedAssetHandoff');

describe('verified asset handoff contract', () => {
  const fields = [
    {
      id: 'confirmed-field',
      key: 'asset.name',
      label: 'Asset name',
      category: 'asset_identity',
      value: 'Harbor View',
      status: 'confirmed',
      sourceDocId: 'doc-1',
      sourcePage: 2,
      sourceExcerpt: 'Harbor View Apartments',
      verifiedBy: 'owner@example.com',
      verifiedRole: 'Workspace Owner',
      verifiedAt: '2026-08-23T10:00:00Z',
    },
    { id: 'awaiting-field', key: 'financial.noi', label: 'NOI', value: '$100', status: 'awaiting' },
    { id: 'missing-field', key: 'legal.opinion', label: 'Legal opinion', status: 'missing' },
    { id: 'na-field', key: 'asset.encumbrances', label: 'Encumbrances', status: 'not_applicable' },
  ];

  test('only confirmed values enter verified_data', () => {
    const handoff = buildVerifiedAssetHandoff({
      propertyId: 'room-1',
      sourceStateAt: '2026-08-23T10:01:00Z',
      recordState: { fields },
    });
    expect(handoff.verified_data).toHaveLength(1);
    expect(handoff.verified_data[0]).toEqual(expect.objectContaining({
      field_key: 'asset.name',
      value: 'Harbor View',
    }));
    expect(handoff.state_manifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ field_key: 'financial.noi', current_state: 'awaiting_confirmation' }),
      expect.objectContaining({ field_key: 'legal.opinion', current_state: 'missing' }),
      expect.objectContaining({ field_key: 'asset.encumbrances', current_state: 'not_applicable' }),
    ]));
  });

  test('preserves provenance and confirmation context', () => {
    const handoff = buildVerifiedAssetHandoff({
      recordState: { fields: [fields[0]] },
      approvals: [{ field_id: 'confirmed-field', action: 'approved', actor_role: 'Deal Coordinator', created_at: '2026-08-23T10:02:00Z' }],
    });
    expect(handoff.verified_data[0].provenance).toEqual(expect.objectContaining({
      source_document_id: 'doc-1', source_page: 2,
    }));
    expect(handoff.verified_data[0].approval_context[0]).toEqual(expect.objectContaining({ action: 'approved' }));
  });

  test('exposes the shared Verified Asset and Readiness projections with lineage', () => {
    const handoff = buildVerifiedAssetHandoff({
      propertyId: 'room-1',
      sourceStateAt: '2026-08-23T10:01:00Z',
      recordState: { fields: [fields[0]], requiredFields: [fields[0]], schemaKey: 'generic' },
      approvals: [{
        field_id: 'confirmed-field',
        action: 'approved',
        actor_role: 'Deal Coordinator',
        created_at: '2026-08-23T10:02:00Z',
      }],
      history: [{
        field_id: 'confirmed-field',
        event_type: 'extracted',
        new_value: 'Harbor View',
        source_doc_id: 'doc-1',
        created_at: '2026-08-23T10:00:00Z',
      }],
      conflicts: [{
        field_id: 'confirmed-field',
        field_key: 'asset.name',
        status: 'resolved',
        canonical_value: 'Harbor View',
        conflicting_value: 'Old Harbor View',
      }],
      closingContext: { settlement_mode: 'traditional' },
    });

    expect(handoff.verified_asset).toEqual(expect.objectContaining({
      schema: 'kontra.verified-asset-state',
    }));
    expect(handoff.verified_asset.canonical_facts[0].evidence_lineage).toEqual(
      expect.objectContaining({
        extracted: expect.objectContaining({ value: 'Harbor View' }),
        final_canonical: expect.objectContaining({ value: 'Harbor View' }),
      }),
    );
    expect(handoff.digital_asset_readiness_export.asset.underlying_asset)
      .toEqual(expect.arrayContaining([expect.objectContaining({ field_key: 'asset.name' })]));
    expect(handoff.history_manifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ event_type: 'extracted', source_document_id: 'doc-1' }),
    ]));
    expect(handoff.exception_history).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'resolved', conflicting_value: 'Old Harbor View' }),
    ]));
  });

  test('serializes unresolved conflicts into the exception manifest', () => {
    const handoff = buildVerifiedAssetHandoff({
      recordState: { fields: [fields[1]] },
      conflicts: [{ field_key: 'financial.noi', display_label: 'NOI', canonical_value: '$100', conflicting_value: '$90', status: 'unresolved' }],
    });
    expect(handoff.exception_manifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'awaiting_confirmation', field_key: 'financial.noi' }),
      expect.objectContaining({ type: 'unresolved_conflict', field_key: 'financial.noi' }),
    ]));
    expect(fieldState({ status: 'source_changed' })).toBe('source_changed');
  });
});