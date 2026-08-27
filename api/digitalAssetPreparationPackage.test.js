'use strict';

const {
  buildDigitalAssetPreparationPackage,
  hashPackage,
  updateDigitalAssetPreparationPackage,
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
    expect(pkg.human_summary.missing_preparation_fields).toEqual([
      'issuer',
      'jurisdiction',
      'legal_entity',
      'underlying_asset',
      'settlement_method',
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
      'Settlement Method',
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
});