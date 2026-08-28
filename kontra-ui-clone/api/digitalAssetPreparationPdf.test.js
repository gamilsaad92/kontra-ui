'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  PREPARATION_PDF_SCHEMA,
  PREPARATION_PDF_VERSION,
  ARTIFACT_HASH_PLACEHOLDER,
  buildPreparationPdfBuffer,
  hashPreparationPdf,
} = require('./lib/digitalAssetPreparationPdf');

function extractPdfText(buffer) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kontra-pdf-test-'));
  const input = path.join(directory, 'artifact.pdf');
  try {
    fs.writeFileSync(input, buffer);
    return execFileSync('pdftotext', [input, '-']).toString('utf8');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function extractPdfPages(buffer) {
  return extractPdfText(buffer)
    .split('\f')
    .map(page => page.trim())
    .filter(Boolean);
}

function getPdfPageCount(buffer) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kontra-pdf-pages-'));
  const input = path.join(directory, 'artifact.pdf');
  try {
    fs.writeFileSync(input, buffer);
    const info = execFileSync('pdfinfo', [input]).toString('utf8');
    return Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function readyPackage(value = 90000) {
  return {
    schema: 'kontra.digital-asset-preparation-package',
    package_status: 'ready_for_provider_review',
    package_hash: 'package-v1-hash',
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
      }, {
        field_key: 'financial.purchase_price',
        label: 'Purchase price',
        value: 325000,
        current_state: 'confirmed',
        provenance: { source_document_id: 'closing-doc-1', source_page: 5 },
      }, {
        field_key: 'ownership.percentage',
        label: 'Ownership percentage',
        value: 100,
        current_state: 'confirmed',
        provenance: { source_document_id: 'closing-doc-1', source_page: 6 },
      }, {
        field_key: 'repairs.additional_work_invoice',
        label: 'Additional Work Invoice',
        value: 28000,
        current_state: 'confirmed',
      }, {
        field_key: 'repairs.completed',
        label: 'Repairs Completed',
        value: 280000,
        current_state: 'confirmed',
      }, {
        field_key: 'financial.fund_release_request',
        label: 'Fund Release Request',
        value: 5500,
        current_state: 'confirmed',
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
        event_count: 24,
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
    const text = extractPdfText(buffer);
    expect(encoded).toContain(Buffer.from('snapshot-v8-hash').toString('hex'));
    expect(encoded).toContain('revision-v1-hash');
    expect(text).toContain('$90,000');
    expect(text).toContain('$325,000');
    expect(text).toContain('$28,000');
    expect(text).toContain('$280,000');
    expect(text).toContain('$5,500');
    expect(text).toContain('100%');
    expect(text).not.toContain('28000');
    expect(text).not.toContain('280000');
    expect(text).not.toContain('5500');
    expect(encoded).toContain('/Subtype /Image');
    expect(getPdfPageCount(buffer)).toBeGreaterThanOrEqual(4);
    expect(getPdfPageCount(buffer)).toBeLessThanOrEqual(5);
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

    expect(extractPdfText(first)).toContain('$90,000');
    expect(extractPdfText(first)).not.toContain('$80,000');
    expect(extractPdfText(second)).toContain('$80,000');
  });

  test('renders an institutional provenance appendix without internal object syntax', async () => {
    const packagePayload = readyPackage(90000);
    packagePayload.frozen_readiness.canonical_fields.push({
      field_key: 'organization.investor_or_agency',
      label: 'Investor or agency',
      value: 'Freddie Mac Multifamily',
      current_state: 'confirmed',
      confirmation: { confirmed: true, verified_at: '2026-08-27T12:04:00.000Z' },
      provenance: {
        source_type: 'manual_confirmation_history',
        source_document_id: 'organization-record',
        source_page: 12,
        evidence_id: 'evidence-org-1',
        extracted_at: '2026-08-27T12:03:00.000Z',
      },
    });
    packagePayload.frozen_readiness.provenance_evidence.manifest.push({
      field_key: 'organization.investor_or_agency',
      provenance: {
        source_type: 'manual_confirmation_history',
        source_document_id: 'organization-record',
        source_page: 12,
        evidence_id: 'evidence-org-1',
      },
    });
    packagePayload.frozen_readiness.blockers_exceptions.recorded_exceptions = [{
      id: 'exception-1',
      field_key: 'organization.investor_or_agency',
      label: 'Investor or agency',
      status: 'resolved',
      resolution_note: 'Confirmed by counsel',
      resolved_by: 'owner',
      resolved_at: '2026-08-27T12:06:00.000Z',
    }];
    packagePayload.frozen_readiness.blockers_exceptions.resolved_conflicts = [
      ...packagePayload.frozen_readiness.blockers_exceptions.recorded_exceptions,
    ];
    packagePayload.frozen_snapshot = {
      created_from: {
        confirmation_history: [{
          field_key: 'organization.investor_or_agency',
          event_type: 'manual_confirmation',
          actor_role: 'owner',
          created_at: '2026-08-27T12:06:00.000Z',
          source_doc_id: 'organization-record',
          source_page: 12,
          source_file_hash: 'file-hash-1',
        }],
      },
    };

    const hashTemplate = await buildPreparationPdfBuffer({
      propertyId: 'freddie-room',
      packageId: 'package-id',
      packagePayload,
      revisionId: 'revision-v7-id',
      revisionNumber: 7,
      revisionCreatedAt: '2026-08-27T12:05:00.000Z',
      revisionHash: 'revision-v7-hash',
      artifactHash: ARTIFACT_HASH_PLACEHOLDER,
    });
    const artifactHash = hashPreparationPdf(hashTemplate);
    const buffer = await buildPreparationPdfBuffer({
      propertyId: 'freddie-room',
      packageId: 'package-id',
      packagePayload,
      revisionId: 'revision-v7-id',
      revisionNumber: 7,
      revisionCreatedAt: '2026-08-27T12:05:00.000Z',
      revisionHash: 'revision-v7-hash',
      artifactHash,
    });
    const encoded = buffer.toString('latin1');
    const text = extractPdfText(buffer);
    const pages = extractPdfPages(buffer);
    const compactText = text.replace(/\s+/g, '');

    expect(pages[0]).toContain('Package identity and status');
    expect(pages[0]).toContain('Readiness at a glance');
    expect(pages[0]).toContain('Verified transaction and asset summary');
    expect(pages[1]).toContain('Digital Asset Preparation fields');
    expect(pages[2]).toContain('Verification and readiness');
    expect(pages[2]).toContain('Required approvals satisfied — 24 approval events recorded.');
    expect(pages.findIndex(page => page.includes('Evidence & Provenance Appendix')))
      .toBeGreaterThanOrEqual(3);
    expect(text).toContain('Evidence & Provenance Appendix');
    expect(text).toContain('Investor or agency');
    expect(text).toContain('Revision');
    expect(text).toContain('7');
    expect(text).toContain('evidence-org-1');
    expect(text).toContain('Required approvals satisfied — 24 approval events recorded.');
    expect(compactText).toContain(artifactHash);
    expect(text).not.toContain('organization.investor_or_agency');
    expect(text).not.toContain('ready_for_provider_review');
    expect(text).not.toContain('source_document_id');
    expect(text).not.toContain('manual_confirmation_history');
    expect(text).not.toContain('Approvals and review record');
    expect(text).not.toContain('Evidence reference register');
    expect(text).not.toContain('Confirmation and extraction history');
    expect((text.match(/Confirmed by counsel/g) || []).length)
      .toBe(1);
    expect(encoded).toContain(Buffer.from(artifactHash).toString('hex').slice(0, 32));
    expect(hashPreparationPdf(buffer, artifactHash)).toBe(artifactHash);
  });
});