'use strict';

const {
  PREPARATION_PDF_SCHEMA,
  PREPARATION_PDF_VERSION,
  buildPreparationPdfBuffer,
  hashPreparationPdf,
} = require('./lib/digitalAssetPreparationPdf');

function readyPackage(value = 90000) {
  return {
    schema: 'kontra.digital-asset-preparation-package',
    package_status: 'ready_for_provider_review',
    source_snapshot: {
      id: 'snapshot-v8-id',
      version: 8,
      snapshot_hash: 'snapshot-v8-hash',
      eligibility_status: 'eligible',
      recorded_at: '2026-08-27T12:00:00.000Z',
    },
    frozen_readiness: {
      eligible: true,
      status: 'ready_for_external_review',
      readiness: '14 / 19 confirmed',
      canonical_fields: [{
        field_key: 'financial.borrower_funds',
        label: 'Borrower funds advanced',
        value,
        current_state: 'confirmed',
        provenance: { source_document_id: 'closing-doc-1', source_page: 4 },
      }],
      provenance_evidence: {
        intact: true,
        gap_count: 0,
        evidence_entry_count: 1,
        manifest: [{
          field_key: 'financial.borrower_funds',
          source: 'closing-doc-1, page 4',
        }],
      },
      blockers_exceptions: {
        blocking_count: 0,
        resolved: true,
        recorded_exceptions: [],
      },
      approvals: {
        satisfied: true,
        missing_count: 0,
        event_count: 1,
        manifest: [{ action: 'approved', actor_role: 'owner' }],
      },
      settlement_mode: 'traditional',
    },
    preparation_fields: {
      issuer: { label: 'Issuer', required: true, value: 'Freddie Mac', status: 'recorded' },
      jurisdiction: {
        label: 'Jurisdiction',
        required: true,
        value: { choice: 'united_states', detail: 'Texas, United States' },
        status: 'recorded',
        origin: 'preparation_input',
      },
    },
    human_summary: {
      readiness: '14 / 19 confirmed',
      disclosure: 'Provider-neutral preparation data only.',
    },
  };
}

describe('Digital Asset Preparation PDF', () => {
  test('renders a readable PDF from the exact revision payload', async () => {
    const buffer = await buildPreparationPdfBuffer({
      propertyId: 'freddie-room',
      packageId: 'package-id',
      packagePayload: readyPackage(90000),
      revisionId: 'revision-v1-id',
      revisionNumber: 1,
      revisionCreatedAt: '2026-08-27T12:05:00.000Z',
      revisionHash: 'revision-v1-hash',
    });

    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
    const encoded = buffer.toString('latin1');
    expect(encoded).toContain(Buffer.from('snapshot-v8-hash').toString('hex'));
    expect(encoded).toContain('revision-v1-hash');
    expect(encoded).toContain(Buffer.from('90,000').toString('hex'));
    expect(hashPreparationPdf(buffer)).toMatch(/^[a-f0-9]{64}$/);
  });

  test('keeps the artifact schema metadata provider-neutral', () => {
    expect(PREPARATION_PDF_SCHEMA).toBe('kontra.digital-asset-preparation-pdf');
    expect(PREPARATION_PDF_VERSION).toBe('1.0.0');
  });

  test('does not read later live values when generating from a frozen payload', async () => {
    const snapshotPackage = readyPackage(90000);
    const first = await buildPreparationPdfBuffer({
      propertyId: 'freddie-room',
      packageId: 'package-id',
      packagePayload: snapshotPackage,
      revisionId: 'revision-v1-id',
      revisionNumber: 1,
      revisionCreatedAt: '2026-08-27T12:05:00.000Z',
      revisionHash: 'revision-v1-hash',
    });
    snapshotPackage.frozen_readiness.canonical_fields[0].value = 80000;
    const second = await buildPreparationPdfBuffer({
      propertyId: 'freddie-room',
      packageId: 'package-id',
      packagePayload: snapshotPackage,
      revisionId: 'revision-v2-id',
      revisionNumber: 2,
      revisionCreatedAt: '2026-08-27T12:10:00.000Z',
      revisionHash: 'revision-v2-hash',
    });

    expect(first.toString('latin1')).toContain(Buffer.from('90,000').toString('hex'));
    expect(first.toString('latin1')).not.toContain(Buffer.from('80,000').toString('hex'));
    expect(second.toString('latin1')).toContain(Buffer.from('80,000').toString('hex'));
  });
});