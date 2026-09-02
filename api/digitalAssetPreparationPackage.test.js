'use strict';

const {
  buildDigitalAssetPreparationPackage,
  hashPackage,
  normalizePreparationValueForField,
  updateDigitalAssetPreparationPackage,
  appendDigitalAssetPreparationRevision,
  PREPARATION_FIELD_DEFINITIONS,
} = require('./lib/digitalAssetPreparationPackage');

function snapshotRow(value = 80000) {
  const snapshot = {
    snapshot_hash: 'snapshot-v9-hash',
    source_state_at: '2026-08-27T12:00:00.000Z',
    digital_asset_readiness: {
      eligible: true,
      status: 'ready_for_external_review',
      exceptions: {
        incomplete_required_fields: [],
        unresolved_conflicts: [],
      },
      provenance: { intact: true, gaps: [] },
      approvals: { satisfied: true, missing: [] },
    },
    created_from: {
      settlement_mode: 'traditional',
      readiness: {
        confirmed_count: 21,
        required_count: 21,
        awaiting_count: 0,
        missing_count: 0,
      },
      transaction_record: {
        canonical_fields: [{
          field_key: 'financial.borrower_funds',
          label: 'Borrower funds advanced',
          value,
          current_state: 'confirmed',
          confirmation: { confirmed: true },
          provenance: { source_document_id: 'invoice-1' },
        }],
      },
      provenance_manifest: [{
        field_key: 'financial.borrower_funds',
        provenance: { source_document_id: 'invoice-1' },
      }],
      approvals: [{ action: 'approved', actor_role: 'owner' }],
      exceptions: [],
    },
  };
  return {
    id: 'snapshot-v9-id',
    version: 9,
    snapshot_hash: 'snapshot-v9-hash',
    eligibility_status: 'eligible',
    created_at: '2026-08-27T12:00:00.000Z',
    source_state_at: '2026-08-27T12:00:00.000Z',
    snapshot,
  };
}

describe('Digital Asset Preparation Package', () => {
  test('copies an eligible snapshot into an immutable package with preparation fields', () => {
    const pkg = buildDigitalAssetPreparationPackage({
      propertyId: 'freddie-room',
      snapshotRow: snapshotRow(),
      generatedAt: '2026-08-27T12:01:00.000Z',
    });

    expect(pkg.schema).toBe('kontra.digital-asset-preparation-package');
    expect(pkg.source_snapshot).toEqual(expect.objectContaining({
      id: 'snapshot-v9-id',
      version: 9,
      eligibility_status: 'eligible',
    }));
    expect(pkg.frozen_readiness).toEqual(expect.objectContaining({
      eligible: true,
      status: 'ready_for_external_review',
      settlement_mode: 'traditional',
    }));
    expect(pkg.frozen_readiness.canonical_fields[0]).toEqual(
      expect.objectContaining({ value: 80000 }),
    );
    expect(pkg.preparation_fields.issuer).toEqual(expect.objectContaining({
      value: null,
      status: 'not_recorded',
    }));
    expect(pkg.preparation_fields.settlement_method).toEqual(expect.objectContaining({
      value: { choice: 'traditional', detail: '' },
      origin: 'inherited_source',
      inherited: true,
    }));
    expect(pkg.human_summary.missing_preparation_fields).toEqual([
      'issuer',
      'jurisdiction',
      'legal_entity',
      'underlying_asset',
      'ownership_evidence',
      'governing_documents',
      'investor_restrictions',
      'security_offering_structure',
    ]);
    expect(pkg.human_summary.missing_preparation_field_names).toEqual([
      'Issuer',
      'Jurisdiction',
      'Legal Entity',
      'Underlying Asset',
      'Ownership Evidence',
      'Governing Documents',
      'Investor Restrictions',
      'Security Offering Structure',
    ]);
  });

  test('does not change when the live source value later changes', () => {
    const source = snapshotRow(80000);
    const pkg = buildDigitalAssetPreparationPackage({
      propertyId: 'freddie-room',
      snapshotRow: source,
      generatedAt: '2026-08-27T12:01:00.000Z',
    });
    source.snapshot.created_from.transaction_record.canonical_fields[0].value = 70000;

    expect(pkg.frozen_readiness.canonical_fields[0].value).toBe(80000);
    expect(pkg.frozen_snapshot.created_from.transaction_record.canonical_fields[0].value).toBe(80000);
    expect(pkg.package_hash).toBe(hashPackage({
      source_snapshot: pkg.source_snapshot,
      canonical_fields: pkg.frozen_readiness.canonical_fields,
      eligibility_status: pkg.frozen_readiness.eligibility_status,
      eligible: pkg.frozen_readiness.eligible,
      status: pkg.frozen_readiness.status,
      snapshot_timestamp: pkg.frozen_readiness.snapshot_timestamp,
      readiness: pkg.frozen_readiness.readiness,
      provenance_evidence: pkg.frozen_readiness.provenance_evidence,
      blockers_exceptions: pkg.frozen_readiness.blockers_exceptions,
      approvals: pkg.frozen_readiness.approvals,
      settlement_mode: pkg.frozen_readiness.settlement_mode,
    }));
  });

  test('recalculates named preparation requirements without changing frozen source values', () => {
    const pkg = buildDigitalAssetPreparationPackage({
      propertyId: 'freddie-room',
      snapshotRow: snapshotRow(),
      generatedAt: '2026-08-27T12:01:00.000Z',
    });
    const completed = updateDigitalAssetPreparationPackage({
      packagePayload: pkg,
      revision: 1,
      preparationValues: {
        issuer: 'Kontra Issuer',
        jurisdiction: 'Texas, United States',
        legal_entity: 'Kontra Asset Owner LLC',
        underlying_asset: 'Freddie Mac Multifamily Hazard Loss Review - Texas',
        settlement_method: 'Traditional institutional settlement',
        ownership_evidence: 'Recorded deed and closing evidence',
        governing_documents: 'Counsel-reviewed governing documents',
        investor_restrictions: 'Qualified purchasers; transfer restrictions apply',
        security_offering_structure: 'Provider-neutral participation interest',
      },
    });

    expect(completed.package_status).toBe('ready_for_provider_review');
    expect(completed.package_revision).toBe(1);
    expect(completed.human_summary.missing_preparation_fields).toEqual([]);
    expect(completed.human_summary.missing_preparation_field_names).toEqual([]);
    expect(completed.preparation_fields.issuer).toEqual(expect.objectContaining({
      value: 'Kontra Issuer',
      origin: 'preparation_input',
      editable: true,
      required: true,
    }));
    expect(completed.frozen_readiness.canonical_fields[0].value).toBe(80000);
    expect(completed.frozen_snapshot.created_from.transaction_record.canonical_fields[0].value).toBe(80000);
    expect(pkg.package_status).toBe('needs_information');
  });

  test('prefills only confirmed exact source mappings and preserves provenance', () => {
    const source = snapshotRow();
    source.snapshot.created_from.transaction_record.canonical_fields.push(
      {
        field_key: 'issuer_name',
        value: 'Freddie Mac',
        current_state: 'confirmed',
        confirmation: { confirmed: true },
        provenance: { source_document_id: 'issuer-doc' },
      },
      {
        field_key: 'jurisdiction',
        value: 'Texas, United States',
        current_state: 'confirmed',
        confirmation: { confirmed: true },
      },
      {
        label: 'Legal Entity',
        value: 'Do not inherit this ambiguous label-only value',
        current_state: 'confirmed',
      },
    );

    const pkg = buildDigitalAssetPreparationPackage({
      propertyId: 'freddie-room',
      snapshotRow: source,
    });

    expect(pkg.preparation_fields.issuer).toEqual(expect.objectContaining({
      value: 'Freddie Mac',
      origin: 'inherited_source',
      inherited: true,
      source_field_key: 'issuer_name',
      source_provenance: { source_document_id: 'issuer-doc' },
    }));
    expect(pkg.preparation_fields.jurisdiction).toEqual(expect.objectContaining({
      value: { choice: 'other', detail: 'Texas, United States' },
      origin: 'inherited_source',
      inherited: true,
    }));
    expect(pkg.preparation_fields.legal_entity.value).toBeNull();
  });

  test('supports structured choices and keeps an explicit owner clear from re-inheriting', () => {
    expect(normalizePreparationValueForField('security_offering_structure', {
      choice: 'equity_interest',
      detail: '',
    }, { strict: true })).toEqual({ choice: 'equity_interest', detail: '' });
    expect(normalizePreparationValueForField('investor_restrictions', {
      choices: ['qualified_investors', 'transfer_restrictions'],
      detail: 'Review with counsel',
    }, { strict: true })).toEqual({
      choices: ['qualified_investors', 'transfer_restrictions'],
      detail: 'Review with counsel',
    });

    const pkg = buildDigitalAssetPreparationPackage({
      propertyId: 'freddie-room',
      snapshotRow: snapshotRow(),
    });
    const cleared = updateDigitalAssetPreparationPackage({
      packagePayload: pkg,
      revision: 1,
      explicitKeys: ['settlement_method'],
      preparationValues: { settlement_method: null },
    });

    expect(cleared.preparation_fields.settlement_method).toEqual(expect.objectContaining({
      value: null,
      origin: 'preparation_input',
      inherited: false,
      status: 'not_recorded',
    }));
    expect(cleared.frozen_readiness.settlement_mode).toBe('traditional');
  });

  test('keeps offering frameworks out of jurisdiction and normalizes legacy values safely', () => {
    expect(PREPARATION_FIELD_DEFINITIONS.jurisdiction.choices.map(choice => choice.value))
      .not.toContain('us_reg_d');
    expect(PREPARATION_FIELD_DEFINITIONS.jurisdiction.choices
      .some(choice => /regulation d/i.test(choice.label))).toBe(false);
    expect(PREPARATION_FIELD_DEFINITIONS.security_offering_structure.choices
      .map(choice => choice.value)).toEqual(expect.arrayContaining(['regulation_d', 'regulation_s']));

    expect(normalizePreparationValueForField(
      'jurisdiction',
      'United States — Regulation D (counsel to confirm)',
      { strict: true },
    )).toEqual({ choice: 'united_states', detail: 'United States' });
    expect(normalizePreparationValueForField(
      'jurisdiction',
      { choice: 'us_reg_d', detail: 'United States' },
      { strict: true },
    )).toEqual({ choice: 'united_states', detail: 'United States' });
    expect(normalizePreparationValueForField(
      'security_offering_structure',
      { choice: 'regulation_d', detail: '' },
      { strict: true },
    )).toEqual({ choice: 'regulation_d', detail: '' });
  });

  test('creates exactly one append-only revision for an idempotent save request', async () => {
    const packageRow = {
      id: 'package-1',
      property_id: 'freddie-room',
      source_snapshot_id: 'snapshot-v9-id',
      source_snapshot_version: 9,
      source_snapshot_hash: 'snapshot-v9-hash',
      package: buildDigitalAssetPreparationPackage({ propertyId: 'freddie-room', snapshotRow: snapshotRow() }),
    };
    const revisions = [];
    const getLatestRevision = async () => revisions[revisions.length - 1] || null;
    const getRevisionByRequestId = async (_packageId, requestId) =>
      revisions.find(revision => revision.package.save_request_id === requestId) || null;
    const insertRevision = async values => {
      if (revisions.some(revision => revision.revision === values.revision)) {
        return { data: null, error: new Error('duplicate key value violates unique constraint') };
      }
      const revision = {
        ...values,
        id: `revision-${values.revision}`,
        created_at: '2026-08-27T12:02:00.000Z',
      };
      revisions.push(revision);
      return { data: revision, error: null };
    };
    const save = {
      packageRow,
      updates: { issuer: 'Kontra Issuer' },
      saveRequestId: 'save-request-1',
      getLatestRevision,
      getRevisionByRequestId,
      insertRevision,
    };

    const first = await appendDigitalAssetPreparationRevision(save);
    const retry = await appendDigitalAssetPreparationRevision(save);

    expect(first).toEqual(expect.objectContaining({ created: true, idempotent: false }));
    expect(retry).toEqual(expect.objectContaining({ created: false, idempotent: true }));
    expect(first.revision.id).toBe(retry.revision.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].package.package_revision).toBe(1);
    expect(revisions[0].package.save_request_id).toBe('save-request-1');
    expect(packageRow.package.package_revision).toBe(0);
    expect(packageRow.package.save_request_id).toBeUndefined();
  });

  test('assigns separate revisions to concurrent deliberate saves', async () => {
    const packageRow = {
      id: 'package-1',
      property_id: 'freddie-room',
      source_snapshot_id: 'snapshot-v9-id',
      source_snapshot_version: 9,
      source_snapshot_hash: 'snapshot-v9-hash',
      package: buildDigitalAssetPreparationPackage({ propertyId: 'freddie-room', snapshotRow: snapshotRow() }),
    };
    const revisions = [];
    const getLatestRevision = async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      return revisions[revisions.length - 1] || null;
    };
    const getRevisionByRequestId = async (_packageId, requestId) =>
      revisions.find(revision => revision.package.save_request_id === requestId) || null;
    const insertRevision = async values => {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (revisions.some(revision => revision.revision === values.revision)) {
        return { data: null, error: new Error('duplicate key value violates unique constraint') };
      }
      const revision = { ...values, id: `revision-${values.revision}` };
      revisions.push(revision);
      return { data: revision, error: null };
    };
    const makeSave = requestId => ({
      packageRow,
      updates: { issuer: `Issuer ${requestId}` },
      saveRequestId: requestId,
      getLatestRevision,
      getRevisionByRequestId,
      insertRevision,
    });

    const results = await Promise.all([
      appendDigitalAssetPreparationRevision(makeSave('save-a')),
      appendDigitalAssetPreparationRevision(makeSave('save-b')),
    ]);

    expect(revisions.map(revision => revision.revision)).toEqual([1, 2]);
    expect(results.map(result => result.revision.revision).sort()).toEqual([1, 2]);
    expect(results.every(result => result.created)).toBe(true);
  });
});